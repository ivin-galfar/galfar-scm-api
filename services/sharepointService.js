import crypto from "node:crypto";
import axios from "axios";

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGE_SIZE = 500;
const LIST_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _.-]{0,254}$/u;
const FIELD_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const VALUE = "(?:'(?:[^']|'')*'|-?\\d+(?:\\.\\d+)?|true|false|null)";
const CLAUSE = `(?:fields\\/)?([A-Za-z_][A-Za-z0-9_]*)\\s+(?:eq|ne|gt|ge|lt|le)\\s+${VALUE}`;
const FILTER_PATTERN = new RegExp(
  `^${CLAUSE}(?:\\s+(?:and|or)\\s+${CLAUSE})*$`,
  "i",
);

export class SharePointError extends Error {
  constructor(message, status = 500, code = "SHAREPOINT_ERROR") {
    super(message);
    this.name = "SharePointError";
    this.status = status;
    this.code = code;
  }
}

const splitConfig = (value) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getSharePointConfig() {
  const config = {
    tenantId: process.env.SHAREPOINT_TENANT_ID,
    clientId: process.env.SHAREPOINT_CLIENT_ID,
    clientSecret: process.env.SHAREPOINT_CLIENT_SECRET,
    hostname: process.env.SHAREPOINT_HOSTNAME,
    sitePath: process.env.SHAREPOINT_SITE_PATH,
    defaultListName: process.env.SHAREPOINT_LIST_NAME,
  };
  const missing = [
    "tenantId",
    "clientId",
    "clientSecret",
    "hostname",
    "sitePath",
  ].filter((key) => !config[key]);
  if (missing.length) {
    throw new SharePointError(
      `Missing SharePoint configuration: ${missing.join(", ")}`,
    );
  }

  config.allowedLists = splitConfig(process.env.SHAREPOINT_ALLOWED_LISTS);
  if (!config.allowedLists.length && config.defaultListName) {
    config.allowedLists = [config.defaultListName];
  }

  config.allowedFields = splitConfig(process.env.SHAREPOINT_ALLOWED_FIELDS);
  config.indexedFields = splitConfig(process.env.SHAREPOINT_INDEXED_FIELDS);
  config.maxPageSize = positiveInteger(
    process.env.SHAREPOINT_MAX_PAGE_SIZE,
    DEFAULT_MAX_PAGE_SIZE,
  );
  config.cursorTtlSeconds = positiveInteger(
    process.env.SHAREPOINT_CURSOR_TTL_SECONDS,
    3600,
  );
  config.cursorSecret =
    process.env.SHAREPOINT_CURSOR_SECRET || config.clientSecret;
  config.maxRetries = positiveInteger(process.env.SHAREPOINT_MAX_RETRIES, 3);
  config.maxRetryDelayMs = positiveInteger(
    process.env.SHAREPOINT_MAX_RETRY_DELAY_MS,
    10000,
  );
  return config;
}

function getGraphConfig() {
  const config = {
    tenantId: process.env.SHAREPOINT_TENANT_ID,
    clientId: process.env.SHAREPOINT_CLIENT_ID,
    clientSecret: process.env.SHAREPOINT_CLIENT_SECRET,
  };
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length)
    throw new Error(
      `Missing Microsoft Graph configuration: ${missing.join(", ")}`,
    );
  return config;
}

async function getAccessToken(config, scope) {
  const response = await axios.post(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope,
      grant_type: "client_credentials",
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  return response.data.access_token;
}

async function getGraphAccessToken(config) {
  return getAccessToken(config, "https://graph.microsoft.com/.default");
}

async function getGraphClient(config) {
  const accessToken = await getGraphAccessToken(config);
  return axios.create({
    baseURL: "https://graph.microsoft.com/v1.0",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
}

function retryDelay(error, maximum) {
  const headers = error.response?.headers;
  const value =
    headers?.get?.("retry-after") ??
    headers?.["retry-after"] ??
    headers?.["Retry-After"];
  if (!value) return Math.min(1000, maximum);
  const seconds = Number(value);
  const delay = Number.isFinite(seconds)
    ? seconds * 1000
    : new Date(value).getTime() - Date.now();
  return Math.max(0, Math.min(Number.isFinite(delay) ? delay : 1000, maximum));
}

async function graphGet(graph, url, config) {
  let retries = 0;
  while (true) {
    try {
      return await graph.get(url);
    } catch (error) {
      if (
        ![429, 503, 504].includes(error.response?.status) ||
        retries >= config.maxRetries
      )
        throw error;
      retries += 1;
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelay(error, config.maxRetryDelayMs)),
      );
    }
  }
}

async function getSharePointSite(graph, config) {
  const hostname = config.hostname
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  const sitePath = config.sitePath
    .trim()
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/^\/+|\/+$/g, "");
  const endpoint = sitePath
    ? `/sites/${hostname}:/${sitePath}`
    : `/sites/${hostname}`;
  return (await graphGet(graph, endpoint, config)).data;
}

async function getSharePointList(graph, siteId, listName, config) {
  let url = `/sites/${siteId}/lists?$select=id,displayName&$top=200`;
  while (url) {
    const response = await graphGet(graph, url, config);
    const match = response.data.value.find(
      (list) => list.displayName.toLowerCase() === listName.toLowerCase(),
    );
    if (match) return match;
    url = response.data["@odata.nextLink"] ?? null;
  }
  throw new SharePointError(
    `SharePoint list "${listName}" was not found`,
    404,
    "LIST_NOT_FOUND",
  );
}

function validateOptions(options, config) {
  const listName = (options.listName || config.defaultListName || "").trim();
  if (!LIST_NAME_PATTERN.test(listName)) {
    throw new SharePointError(
      "A valid listName is required",
      400,
      "INVALID_LIST_NAME",
    );
  }
  if (
    !config.allowedLists.some(
      (name) => name.toLowerCase() === listName.toLowerCase(),
    )
  ) {
    throw new SharePointError(
      "Access to this SharePoint list is not allowed",
      403,
      "LIST_NOT_ALLOWED",
    );
  }
  const rawPageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  if (!/^\d+$/.test(String(rawPageSize))) {
    throw new SharePointError(
      "pageSize must be a positive integer",
      400,
      "INVALID_PAGE_SIZE",
    );
  }
  const pageSize = Number(rawPageSize);
  if (pageSize < 1 || pageSize > config.maxPageSize) {
    throw new SharePointError(
      `pageSize must be between 1 and ${config.maxPageSize}`,
      400,
      "INVALID_PAGE_SIZE",
    );
  }
  const fields = Array.isArray(options.fields)
    ? options.fields
    : splitConfig(options.fields);
  if (fields.some((field) => !FIELD_NAME_PATTERN.test(field))) {
    throw new SharePointError(
      "fields contains an invalid column name",
      400,
      "INVALID_FIELDS",
    );
  }
  if (
    config.allowedFields.length &&
    fields.some(
      (field) =>
        !config.allowedFields.some(
          (allowed) => allowed.toLowerCase() === field.toLowerCase(),
        ),
    )
  ) {
    throw new SharePointError(
      "One or more requested fields are not allowed",
      403,
      "FIELD_NOT_ALLOWED",
    );
  }
  const filter = options.filter?.trim() || "";
  if (filter) {
    if (filter.length > 1000 || !FILTER_PATTERN.test(filter)) {
      throw new SharePointError(
        "filter is not a supported SharePoint filter",
        400,
        "INVALID_FILTER",
      );
    }
    const referenced = [
      ...filter.matchAll(
        /(?:fields\/)?([A-Za-z_][A-Za-z0-9_]*)\s+(?:eq|ne|gt|ge|lt|le)\s+/gi,
      ),
    ].map((match) => match[1]);
    if (new Set(referenced.map((field) => field.toLowerCase())).size > 1) {
      throw new SharePointError(
        "SharePoint filters may reference only one indexed field",
        400,
        "INVALID_FILTER",
      );
    }
    if (
      !config.indexedFields.length ||
      referenced.some(
        (field) =>
          !config.indexedFields.some(
            (indexed) => indexed.toLowerCase() === field.toLowerCase(),
          ),
      )
    ) {
      throw new SharePointError(
        "Filters may only use configured indexed fields",
        400,
        "NON_INDEXED_FILTER",
      );
    }
  }
  return { listName, pageSize, fields, filter };
}

const sign = (payload, secret) =>
  crypto.createHmac("sha256", secret).update(payload).digest("base64url");

function encodeCursor(data, config) {
  const payload = Buffer.from(
    JSON.stringify({
      ...data,
      exp: Date.now() + config.cursorTtlSeconds * 1000,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload, config.cursorSecret)}`;
}

function decodeCursor(cursor, config) {
  try {
    const [payload, supplied, extra] = String(cursor).split(".");
    if (!payload || !supplied || extra) throw new Error("Malformed cursor");
    const actual = sign(payload, config.cursorSecret);
    const suppliedBuffer = Buffer.from(supplied);
    const actualBuffer = Buffer.from(actual);
    if (
      suppliedBuffer.length !== actualBuffer.length ||
      !crypto.timingSafeEqual(suppliedBuffer, actualBuffer)
    ) {
      throw new Error("Invalid signature");
    }
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (decoded.exp < Date.now()) {
      throw new SharePointError(
        "The pagination cursor has expired",
        410,
        "CURSOR_EXPIRED",
      );
    }
    if (
      typeof decoded.nextLink !== "string" ||
      !decoded.nextLink.startsWith("https://graph.microsoft.com/v1.0/")
    ) {
      throw new Error("Invalid continuation URL");
    }
    return decoded;
  } catch (error) {
    if (error instanceof SharePointError) throw error;
    throw new SharePointError(
      "The pagination cursor is invalid",
      400,
      "INVALID_CURSOR",
    );
  }
}

function buildItemsUrl(siteId, listId, options) {
  const query = new URLSearchParams();
  query.set("$top", String(options.pageSize));
  query.set(
    "$expand",
    options.fields.length
      ? `fields($select=${options.fields.join(",")})`
      : "fields",
  );
  if (options.filter) {
    query.set(
      "$filter",
      options.filter.replace(
        /(^|\s)([A-Za-z_][A-Za-z0-9_]*)\s+(?=(?:eq|ne|gt|ge|lt|le)\s)/gi,
        "$1fields/$2 ",
      ),
    );
  }
  return `/sites/${siteId}/lists/${listId}/items?${query}`;
}

export async function getSharePointDataCount(options = {}) {
  const config = getSharePointConfig();
  const validated = validateOptions(
    { listName: options.listName, pageSize: config.maxPageSize, fields: [] },
    config,
  );
  const graph = await getGraphClient(config);
  const site = await getSharePointSite(graph, config);
  const list = await getSharePointList(
    graph,
    site.id,
    validated.listName,
    config,
  );

  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(list.id ?? "")) {
    throw new SharePointError(
      "SharePoint returned an invalid list ID",
      502,
      "INVALID_LIST_ID",
    );
  }

  const endpoint =
    "https://graph.microsoft.com/beta/sites/" +
    site.id +
    "/lists/" +
    list.id +
    "?$select=itemCount";
  const response = await graphGet(graph, endpoint, config);
  const count = Number(response.data?.itemCount);

  if (!Number.isSafeInteger(count) || count < 0) {
    throw new SharePointError(
      "Microsoft Graph returned an invalid list item count",
      502,
      "INVALID_ITEM_COUNT",
    );
  }

  return { listName: validated.listName, count };
}
export async function getSharePointData(options = {}) {
  const config = getSharePointConfig();

  const cursorData = options.cursor
    ? decodeCursor(options.cursor, config)
    : null;

  const effectiveOptions = cursorData
    ? {
        listName: options.listName ?? cursorData.listName,
        pageSize: options.pageSize ?? cursorData.pageSize,
        fields: options.fields ?? cursorData.fields,
        filter: options.filter ?? cursorData.filter,
      }
    : options;
  const validated = validateOptions(effectiveOptions, config);
  if (
    cursorData &&
    (cursorData.listName !== validated.listName ||
      cursorData.pageSize !== validated.pageSize ||
      cursorData.filter !== validated.filter ||
      JSON.stringify(cursorData.fields) !== JSON.stringify(validated.fields))
  ) {
    throw new SharePointError(
      "The pagination cursor does not match this query",
      400,
      "INVALID_CURSOR",
    );
  }
  const graph = await getGraphClient(config);
  const site = await getSharePointSite(graph, config);
  let requestUrl;
  if (cursorData) {
    requestUrl = cursorData.nextLink;
  } else {
    const list = await getSharePointList(
      graph,
      site.id,
      validated.listName,
      config,
    );
    requestUrl = buildItemsUrl(site.id, list.id, validated);
  }
  const response = await graphGet(graph, requestUrl, config);
  const nextLink = response.data["@odata.nextLink"] ?? null;
  return {
    items: (response.data.value ?? []).map((item) => ({
      id: item.id,
      ...item.fields,
    })),
    pageSize: validated.pageSize,
    hasNextPage: Boolean(nextLink),
    nextCursor: nextLink
      ? encodeCursor({ ...validated, nextLink }, config)
      : null,
  };
}

export async function getUserPhoto(email) {
  const graph = await getGraphClient(getGraphConfig());
  const response = await graph.get(
    `/users/${encodeURIComponent(email)}/photo/$value`,
    {
      responseType: "arraybuffer",
    },
  );
  return {
    contentType: response.headers["content-type"] || "image/jpeg",
    data: Buffer.from(response.data),
  };
}

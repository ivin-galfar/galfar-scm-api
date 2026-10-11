import assert from "node:assert/strict";
import test from "node:test";
import axios from "axios";
import {
  getSharePointData,
  getSharePointDataCount,
  getUserPhoto,
  SharePointError,
} from "../services/sharepointService.js";

const graphEnvironmentKeys = [
  "SHAREPOINT_TENANT_ID",
  "SHAREPOINT_CLIENT_ID",
  "SHAREPOINT_CLIENT_SECRET",
];

function preserveGraphEnvironment() {
  return Object.fromEntries(
    graphEnvironmentKeys.map((key) => [key, process.env[key]]),
  );
}

function restoreGraphEnvironment(environment) {
  for (const key of graphEnvironmentKeys) {
    if (environment[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = environment[key];
    }
  }
}

test("getUserPhoto fetches Microsoft Graph photo bytes", async () => {
  const environment = preserveGraphEnvironment();
  const originalPost = axios.post;
  const originalCreate = axios.create;
  let requestedPath;
  let requestedOptions;

  process.env.SHAREPOINT_TENANT_ID = "tenant-id";
  process.env.SHAREPOINT_CLIENT_ID = "client-id";
  process.env.SHAREPOINT_CLIENT_SECRET = "client-secret";

  axios.post = async () => ({ data: { access_token: "access-token" } });
  axios.create = () => ({
    get: async (path, options) => {
      requestedPath = path;
      requestedOptions = options;
      return {
        headers: { "content-type": "image/png" },
        data: Uint8Array.from([1, 2, 3]),
      };
    },
  });

  try {
    const photo = await getUserPhoto("person+test@example.com");

    assert.equal(
      requestedPath,
      "/users/person%2Btest%40example.com/photo/$value",
    );
    assert.deepEqual(requestedOptions, { responseType: "arraybuffer" });
    assert.equal(photo.contentType, "image/png");
    assert.deepEqual(photo.data, Buffer.from([1, 2, 3]));
  } finally {
    axios.post = originalPost;
    axios.create = originalCreate;
    restoreGraphEnvironment(environment);
  }
});

test("getUserPhoto rejects missing Microsoft Graph configuration", async () => {
  const environment = preserveGraphEnvironment();

  for (const key of graphEnvironmentKeys) {
    delete process.env[key];
  }

  try {
    await assert.rejects(
      getUserPhoto("person@example.com"),
      /Missing Microsoft Graph configuration/,
    );
  } finally {
    restoreGraphEnvironment(environment);
  }
});

const sharePointEnvironmentKeys = [
  ...graphEnvironmentKeys,
  "SHAREPOINT_HOSTNAME",
  "SHAREPOINT_SITE_PATH",
  "SHAREPOINT_LIST_NAME",
  "SHAREPOINT_ALLOWED_LISTS",
  "SHAREPOINT_ALLOWED_FIELDS",
  "SHAREPOINT_INDEXED_FIELDS",
  "SHAREPOINT_CURSOR_SECRET",
  "SHAREPOINT_MAX_RETRIES",
];

function setSharePointEnvironment() {
  process.env.SHAREPOINT_TENANT_ID = "tenant-id";
  process.env.SHAREPOINT_CLIENT_ID = "client-id";
  process.env.SHAREPOINT_CLIENT_SECRET = "client-secret";
  process.env.SHAREPOINT_HOSTNAME = "example.sharepoint.com";
  process.env.SHAREPOINT_SITE_PATH = "sites/operations";
  process.env.SHAREPOINT_LIST_NAME = "Fuel Entry";
  process.env.SHAREPOINT_ALLOWED_LISTS = "Fuel Entry,EquipmentMR";
  process.env.SHAREPOINT_ALLOWED_FIELDS = "Title,Status,EquipmentId";
  process.env.SHAREPOINT_INDEXED_FIELDS = "Status,EquipmentId";
  process.env.SHAREPOINT_CURSOR_SECRET = "test-cursor-secret";
}

test("getSharePointData fetches one page and continues with an opaque cursor", async () => {
  const environment = Object.fromEntries(
    sharePointEnvironmentKeys.map((key) => [key, process.env[key]]),
  );
  const originalPost = axios.post;
  const originalCreate = axios.create;
  const requests = [];
  const nextLink =
    "https://graph.microsoft.com/v1.0/sites/site-id/lists/list-id/items?$skiptoken=opaque";

  setSharePointEnvironment();
  axios.post = async () => ({ data: { access_token: "access-token" } });
  axios.create = () => ({
    get: async (url) => {
      requests.push(url);
      if (url.includes(":/sites/operations"))
        return { data: { id: "site-id" } };
      if (url.includes("/lists?$select")) {
        return {
          data: { value: [{ id: "list-id", displayName: "EquipmentMR" }] },
        };
      }
      if (url === nextLink) {
        return { data: { value: [{ id: "2", fields: { Title: "Second" } }] } };
      }
      return {
        data: {
          value: [{ id: "1", fields: { Title: "First", Status: "Open" } }],
          "@odata.nextLink": nextLink,
        },
      };
    },
  });

  try {
    const first = await getSharePointData({
      listName: "EquipmentMR",
      pageSize: "100",
      fields: "Title,Status",
      filter: "Status eq 'Open'",
    });
    assert.deepEqual(first.items, [
      { id: "1", Title: "First", Status: "Open" },
    ]);
    assert.equal(first.pageSize, 100);
    assert.equal(first.hasNextPage, true);
    assert.ok(first.nextCursor && !first.nextCursor.includes("skiptoken"));
    assert.match(requests.at(-1), /%24top=100/);
    assert.match(requests.at(-1), /fields%2FStatus/);

    requests.length = 0;
    const second = await getSharePointData({ cursor: first.nextCursor });
    assert.deepEqual(second, {
      items: [{ id: "2", Title: "Second" }],
      pageSize: 100,
      hasNextPage: false,
      nextCursor: null,
    });
    assert.equal(
      requests.filter((url) => url.includes("/lists?$select")).length,
      0,
    );
    assert.equal(requests.at(-1), nextLink);
  } finally {
    axios.post = originalPost;
    axios.create = originalCreate;
    for (const key of sharePointEnvironmentKeys) {
      if (environment[key] === undefined) delete process.env[key];
      else process.env[key] = environment[key];
    }
  }
});

test("getSharePointData rejects unapproved lists and invalid page sizes before Graph calls", async () => {
  const environment = Object.fromEntries(
    sharePointEnvironmentKeys.map((key) => [key, process.env[key]]),
  );
  const originalPost = axios.post;
  let tokenCalls = 0;
  setSharePointEnvironment();
  axios.post = async () => {
    tokenCalls += 1;
    return { data: { access_token: "unused" } };
  };
  try {
    await assert.rejects(
      getSharePointData({ listName: "Payroll" }),
      (error) =>
        error instanceof SharePointError && error.code === "LIST_NOT_ALLOWED",
    );
    await assert.rejects(
      getSharePointData({ listName: "EquipmentMR", pageSize: 501 }),
      (error) =>
        error instanceof SharePointError && error.code === "INVALID_PAGE_SIZE",
    );
    assert.equal(tokenCalls, 0);
  } finally {
    axios.post = originalPost;
    for (const key of sharePointEnvironmentKeys) {
      if (environment[key] === undefined) delete process.env[key];
      else process.env[key] = environment[key];
    }
  }
});

test("getSharePointDataCount reads Graph list itemCount without fetching list items", async () => {
  const environment = Object.fromEntries(sharePointEnvironmentKeys.map((key) => [key, process.env[key]]));
  const originalPost = axios.post;
  const originalCreate = axios.create;
  const scopes = [];
  const requests = [];
  const listId = "2d4f6f20-31d1-4ded-93cc-cb52f23a2e90";
  setSharePointEnvironment();
  axios.post = async (_url, body) => {
    scopes.push(new URLSearchParams(body).get("scope"));
    return { data: { access_token: "graph-token" } };
  };
  axios.create = ({ baseURL }) => ({
    get: async (url) => {
      requests.push({ baseURL, url });
      if (url.includes(":/sites/operations")) return { data: { id: "site-id" } };
      if (url.includes("/lists?$select")) return { data: { value: [{ id: listId, displayName: "EquipmentMR" }] } };
      if (url.includes("/beta/sites/")) return { data: { itemCount: 0 } };
      throw new Error("Count must not request list items");
    },
  });
  try {
    const result = await getSharePointDataCount({ listName: "EquipmentMR", filter: "Status eq 'Open'" });
    assert.deepEqual(result, { listName: "EquipmentMR", count: 0 });
    assert.deepEqual(scopes, ["https://graph.microsoft.com/.default"]);
    assert.equal(requests.length, 3);
    assert.equal(requests[2].url, "https://graph.microsoft.com/beta/sites/site-id/lists/" + listId + "?$select=itemCount");
  } finally {
    axios.post = originalPost;
    axios.create = originalCreate;
    for (const key of sharePointEnvironmentKeys) {
      if (environment[key] === undefined) delete process.env[key];
      else process.env[key] = environment[key];
    }
  }
});

test("getSharePointDataCount rejects invalid list IDs and surfaces metadata errors", async () => {
  const environment = Object.fromEntries(sharePointEnvironmentKeys.map((key) => [key, process.env[key]]));
  const originalPost = axios.post;
  const originalCreate = axios.create;
  let listId = "invalid-list-id";
  let metadataRequests = 0;
  setSharePointEnvironment();
  axios.post = async () => ({ data: { access_token: "graph-token" } });
  axios.create = () => ({
    get: async (url) => {
      if (url.includes(":/sites/operations")) return { data: { id: "site-id" } };
      if (url.includes("/lists?$select")) return { data: { value: [{ id: listId, displayName: "EquipmentMR" }] } };
      metadataRequests += 1;
      const error = new Error("SharePoint list metadata failed");
      error.response = { status: 403 };
      throw error;
    },
  });
  try {
    await assert.rejects(getSharePointDataCount({ listName: "EquipmentMR" }), (error) => error instanceof SharePointError && error.code === "INVALID_LIST_ID");
    assert.equal(metadataRequests, 0);
    listId = "2d4f6f20-31d1-4ded-93cc-cb52f23a2e90";
    await assert.rejects(getSharePointDataCount({ listName: "EquipmentMR" }), (error) => error.response?.status === 403);
    assert.equal(metadataRequests, 1);
  } finally {
    axios.post = originalPost;
    axios.create = originalCreate;
    for (const key of sharePointEnvironmentKeys) {
      if (environment[key] === undefined) delete process.env[key];
      else process.env[key] = environment[key];
    }
  }
});

test("getSharePointDataCount surfaces Graph token acquisition failures", async () => {
  const environment = Object.fromEntries(sharePointEnvironmentKeys.map((key) => [key, process.env[key]]));
  const originalPost = axios.post;
  setSharePointEnvironment();
  axios.post = async () => {
    const error = new Error("Graph token request failed");
    error.response = { status: 401 };
    throw error;
  };
  try {
    await assert.rejects(getSharePointDataCount({ listName: "EquipmentMR" }), (error) => error.response?.status === 401);
  } finally {
    axios.post = originalPost;
    for (const key of sharePointEnvironmentKeys) {
      if (environment[key] === undefined) delete process.env[key];
      else process.env[key] = environment[key];
    }
  }
});

test("getSharePointData retries a throttled Graph page without accumulating pages", async () => {
  const environment = Object.fromEntries(
    sharePointEnvironmentKeys.map((key) => [key, process.env[key]]),
  );
  const originalPost = axios.post;
  const originalCreate = axios.create;
  let itemAttempts = 0;
  setSharePointEnvironment();
  process.env.SHAREPOINT_MAX_RETRIES = "1";
  axios.post = async () => ({ data: { access_token: "access-token" } });
  axios.create = () => ({
    get: async (url) => {
      if (url.includes(":/sites/operations"))
        return { data: { id: "site-id" } };
      if (url.includes("/lists?$select")) {
        return {
          data: { value: [{ id: "list-id", displayName: "EquipmentMR" }] },
        };
      }
      itemAttempts += 1;
      if (itemAttempts === 1) {
        const error = new Error("throttled");
        error.response = { status: 429, headers: { "retry-after": "0" } };
        throw error;
      }
      return { data: { value: [{ id: "1", fields: { Title: "Retried" } }] } };
    },
  });
  try {
    const result = await getSharePointData({ listName: "EquipmentMR" });
    assert.equal(itemAttempts, 2);
    assert.deepEqual(result.items, [{ id: "1", Title: "Retried" }]);
  } finally {
    axios.post = originalPost;
    axios.create = originalCreate;
    for (const key of sharePointEnvironmentKeys) {
      if (environment[key] === undefined) delete process.env[key];
      else process.env[key] = environment[key];
    }
  }
});

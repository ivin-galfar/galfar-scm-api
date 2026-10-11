import {
  getSharePointDataCount,
  getSharePointData,
  getUserPhoto,
  SharePointError,
} from "../services/sharepointService.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function respondWithSharePointError(error, res) {
  const graphStatus = error.response?.status;
  const headers = error.response?.headers;
  const retryAfter =
    headers?.get?.("retry-after") ??
    headers?.["retry-after"] ??
    headers?.["Retry-After"];
  console.error("SharePoint API error:", {
    status: error.status ?? graphStatus,
    code: error.code,
    message: error.response?.data?.error?.message ?? error.message,
  });
  if (retryAfter) res.set("Retry-After", retryAfter);
  if (error instanceof SharePointError) {
    return res
      .status(error.status)
      .json({ error: error.code, message: error.message });
  }
  if (graphStatus === 404) {
    return res.status(404).json({
      error: "LIST_NOT_FOUND",
      message: "SharePoint list was not found",
    });
  }
  if (graphStatus === 401) {
    return res.status(502).json({
      error: "SHAREPOINT_AUTHENTICATION_FAILED",
      message: "SharePoint authentication failed",
    });
  }
  if (graphStatus === 403) {
    return res.status(403).json({
      error: "SHAREPOINT_PERMISSION_DENIED",
      message: "SharePoint permission denied",
    });
  }
  if ([429, 503, 504].includes(graphStatus)) {
    return res.status(503).json({
      error: "SHAREPOINT_THROTTLED",
      message: "SharePoint is temporarily unavailable; retry later",
    });
  }
  return res.status(500).json({
    error: "SHAREPOINT_ERROR",
    message: "Unable to retrieve SharePoint data",
  });
}

export async function fetchSharePointData(req, res) {
  try {
    const result = await getSharePointData({
      listName: req.query.listName,
      pageSize: req.query.pageSize,
      cursor: req.query.cursor,
      fields: req.query.fields ?? req.query.select,
      filter: req.query.filter,
    });
    return res.status(200).json(result);
  } catch (error) {
    return respondWithSharePointError(error, res);
  }
}

export async function fetchSharePointDataCount(req, res) {
  try {
    const result = await getSharePointDataCount({
      listName: req.query.listName,
    });
    return res.status(200).json(result);
  } catch (error) {
    return respondWithSharePointError(error, res);
  }
}

export async function fetchUserPhoto(req, res) {
  const email = req.params.email?.trim();
  if (!email || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({
      success: false,
      error: "A valid Microsoft account email is required",
    });
  }
  try {
    const photo = await getUserPhoto(email);

    res.set({
      "Content-Type": photo.contentType,
      "Content-Length": photo.data.length,
      "Cache-Control": "private, max-age=300",
    });
    return res.status(200).send(photo.data);
  } catch (error) {
    const graphStatus = error.response?.status;
    console.error("Microsoft Graph user photo error:", {
      status: graphStatus,
      message: error.response?.data?.error?.message ?? error.message,
    });
    if (graphStatus === 404) {
      res.set({ "Cache-Control": "private, max-age=300" });
      return res.status(200).end();
    }
    return res.status(graphStatus === 400 ? 400 : 500).json({
      success: false,
      error: "Unable to retrieve Microsoft account photo",
    });
  }
}

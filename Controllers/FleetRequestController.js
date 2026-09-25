import {
  FetchFleetRequest,
  FetchFleetRequestVal,
  FetchRequestDoc,
  InsertFleetRequest,
  UpdateFleetRequest,
} from "../Models/FleetRequestModel.js";
import {
  authorizeFleetRequestAction,
  canAccessFleetProject,
  getUserRoles,
} from "../Utils/fleetRequestAuthorization.js";

export const RequireFleetRequestInitiator = (req, res, next) => {
  if (!req.statementAccess?.canEdit) {
    return res.status(403).json({
      error: "Fleet Request edit access is required",
    });
  }

  return next();
};

const denyProject = (res) =>
  res.status(403).json({ error: "You are not assigned to this project." });

export const AddFleetRequest = async (req, res) => {
  const { project, date, location, status, items } = req.body ?? {};
  const fleetRequestItems = items;

  if (
    project === undefined ||
    project === null ||
    project === "" ||
    !date ||
    !location ||
    !Array.isArray(fleetRequestItems) ||
    fleetRequestItems.length === 0 ||
    fleetRequestItems.some(
      (item) => !item || typeof item !== "object" || Array.isArray(item),
    )
  ) {
    return res.status(400).json({
      error: "project, date, location and a non-empty items array are required",
    });
  }
  if (!canAccessFleetProject(req.user, project)) return denyProject(res);

  try {
    const fleetRequest = await InsertFleetRequest({
      project,
      date,
      location,
      status: "created",
      items: fleetRequestItems,
    });

    return res.status(201).json(fleetRequest);
  } catch (error) {
    console.error("AddFleetRequest Error:", error);
    return res.status(error.statusCode ?? 500).json({
      error: error.message,
      ...(error.detail && { details: error.detail }),
    });
  }
};

export const UpdateFleetRequestDetails = async (req, res) => {
  const { id } = req.params;

  const { project, date, location, content, status, comments, action, items } =
    req.body;

  if (!id) {
    return res.status(400).json({ error: "Fleet request id is required" });
  }

  try {
    const existingRequest = await FetchFleetRequestVal(id);
    if (!existingRequest)
      return res.status(404).json({ error: "Fleet request not found" });
    if (!canAccessFleetProject(req.user, existingRequest.project))
      return denyProject(res);

    const normalizedAction = String(action ?? "update")
      .trim()
      .toLowerCase();
    const authorization = authorizeFleetRequestAction({
      request: existingRequest,
      user: req.user,
      access: req.statementAccess,
      action: normalizedAction,
      project,
      comments,
    });
    if (authorization.error) {
      return res
        .status(authorization.statusCode)
        .json({ error: authorization.error });
    }

    const fleetRequest = await UpdateFleetRequest(id, {
      project,
      date,
      location,
      status: authorization.nextStatus,
      sentforapproval:
        normalizedAction === "send-for-approval" ? true : undefined,
      role: authorization.actorRole,
      comments,
      items,
      expectedStatus: existingRequest.status,
    });

    if (!fleetRequest) {
      return res.status(404).json({ error: "Fleet request not found" });
    }

    return res.status(200).json(fleetRequest);
  } catch (error) {
    console.error("UpdateFleetRequest Error:", error);
    return res.status(error.statusCode ?? 500).json({
      error: error.message,
      ...(error.detail && { details: error.detail }),
    });
  }
};

export const FleetRequest = async (req, res) => {
  const { module } = req.query;
  const { project } = req.params;
  const canEdit = req.statementAccess?.canEdit === true;

  const userRoles = getUserRoles(req.user);
  const canViewAllProjects = ["hod", "gm", "ceo"].some((role) =>
    userRoles.includes(role),
  );

  if (!module || (!project && !canViewAllProjects)) {
    return res.status(400).json({
      error: canViewAllProjects
        ? "module query parameter is required"
        : "project and module parameters are required",
    });
  }
  if (project && !canViewAllProjects) {
    const requestedProjects = String(project)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (
      requestedProjects.some(
        (projectCode) => !canAccessFleetProject(req.user, projectCode),
      )
    ) {
      return denyProject(res);
    }
  }
  try {
    const fleetrequests = await FetchFleetRequest(
      canViewAllProjects ? undefined : project,
      module,
      canEdit,
    );
    return res.status(200).json(fleetrequests);
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      error: error.message,
    });
  }
};

export const fetchFleetRequestById = async (req, res) => {
  const { id } = req.params;

  try {
    const fleetreqval = await FetchFleetRequestVal(id);

    if (!fleetreqval) {
      return res.status(404).json({ error: "Fleet request not found" });
    }
    if (!canAccessFleetProject(req.user, fleetreqval.project))
      return denyProject(res);
    const status = String(fleetreqval.status ?? "")
      .trim()
      .toLowerCase();
    if (
      !req.statementAccess?.canEdit &&
      ["created", "review"].includes(status)
    ) {
      return res.status(403).json({
        error:
          "This Fleet Request is only available to initiators while it is being edited.",
      });
    }

    return res.status(200).json(fleetreqval);
  } catch (error) {
    console.error("fetchFleetRequestById Error:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const fetchFRDocid = async (req, res) => {
  const { project } = req.params;
  if (!canAccessFleetProject(req.user, project)) return denyProject(res);
  try {
    const fetchfleetid = await FetchRequestDoc(project);
    return res.status(200).json(fetchfleetid);
  } catch (error) {
    return res.status(400).json(error);
  }
};

import {
  FetchFleetRequest,
  FetchFleetRequestVal,
  FetchRequestDoc,
  InsertFleetRequest,
  UpdateFleetRequestItemRefNo,
  UpdateFleetRequest,
} from "../Models/FleetRequestModel.js";
import {
  authorizeFleetRequestAction,
  canAccessFleetProject,
  getUserRoles,
} from "../Utils/fleetRequestAuthorization.js";
import {
  hasInvalidFitmentSelection,
  normalizeFleetRequestItems,
} from "../Utils/fleetRequestValidateItems.js";

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
    ) ||
    hasInvalidFitmentSelection(fleetRequestItems)
  ) {
    return res.status(400).json({
      error:
        "project, date, location, a non-empty items array, a Yes/No ADNOC Fitments selection, and a Normal/CP - 19 TPI selection are required",
    });
  }
  if (!canAccessFleetProject(req.user, project)) return denyProject(res);

  try {
    const fleetRequest = await InsertFleetRequest({
      project,
      date,
      location,
      status: "created",
      items: normalizeFleetRequestItems(fleetRequestItems),
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

  const {
    project,
    date,
    location,
    comments,
    action,
    items,
    deleted,
    item_id: itemId,
    ref_no: refNo,
    action_taken: actionTaken,
  } = req.body ?? {};

  if (!id) {
    return res.status(400).json({ error: "Fleet request id is required" });
  }

  const allocationOnlyUpdate =
    Array.isArray(items) &&
    items.length > 0 &&
    items.every(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        (item.id !== undefined || item.item_no !== undefined) &&
        Object.keys(item).every((key) =>
          ["id", "item_no", "allocation_type"].includes(key),
        ) &&
        (item.allocation_type !== undefined ||
          item.allocationType !== undefined),
    );
  if (
    items !== undefined &&
    (!Array.isArray(items) ||
      items.length === 0 ||
      (!allocationOnlyUpdate && hasInvalidFitmentSelection(items)))
  ) {
    return res.status(400).json({
      error:
        "items must be a non-empty array with a Yes/No ADNOC Fitments selection and a Normal/CP - 19 TPI selection",
    });
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
    if (normalizedAction === "update-action-taken") {
      if (!getUserRoles(req.user).includes("inith")) {
        return res.status(403).json({
          error: "Only Hire users can mark Action Taken.",
        });
      }
      if (actionTaken === undefined || ![0, 1].includes(Number(actionTaken))) {
        return res.status(400).json({
          error: "A valid action_taken value of 0 or 1 is required.",
        });
      }
      const updatedRequest = await UpdateFleetRequest(id, {
        action_taken: Number(actionTaken),
      });
      return res.status(200).json(updatedRequest);
    }

    if (actionTaken !== undefined) {
      return res.status(400).json({
        error: "Use the Action Taken update action to change this value.",
      });
    }

    if (
      String(action ?? "")
        .trim()
        .toLowerCase() === "update-ref-no"
    ) {
      if (!getUserRoles(req.user).includes("inith")) {
        return res.status(403).json({
          error: "Only Hire users can edit reference numbers.",
        });
      }
      if (
        !Number.isInteger(Number(itemId)) ||
        !Number.isFinite(Number(itemId)) ||
        typeof refNo !== "string"
      ) {
        return res.status(400).json({
          error: "A valid item_id and string ref_no are required.",
        });
      }

      const updatedItem = await UpdateFleetRequestItemRefNo(
        id,
        Number(itemId),
        refNo.trim(),
      );
      if (!updatedItem) {
        return res.status(404).json({ error: "Fleet Request item not found" });
      }
      return res.status(200).json(updatedItem);
    }

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
    if (
      allocationOnlyUpdate &&
      (normalizedAction !== "approve" || authorization.actorRole !== "hod")
    ) {
      return res.status(403).json({
        error: "Only the assigned HOD approver can update allocation type.",
      });
    }

    const fleetRequest = await UpdateFleetRequest(id, {
      project,
      date,
      location,
      status: authorization.nextStatus,
      sentforapproval:
        normalizedAction === "send-for-approval"
          ? true
          : normalizedAction === "recall"
            ? false
            : undefined,
      role: authorization.actorRole,
      comments,
      items:
        items === undefined || allocationOnlyUpdate
          ? undefined
          : normalizeFleetRequestItems(items),
      allocationUpdates: allocationOnlyUpdate ? items : undefined,
      expectedStatus: existingRequest.status,
      deleted,
      action_taken: actionTaken,
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
  const { module, page, limit, statusfilter, projects } = req.query;

  const canEdit = req.statementAccess?.canEdit === true;
  const hireusers = req.user.role.includes("inith");

  const userRoles = getUserRoles(req.user);
  const isAdmin = req.user?.is_admin === true;

  const canViewAllPending = isAdmin && (canEdit || hireusers);
  const canViewAllProjects = ["inith", "hod", "gm", "ceo"].some((role) =>
    userRoles.includes(role),
  );

  if (!module || (!projects && !canViewAllProjects)) {
    return res.status(400).json({
      error: canViewAllProjects
        ? "module query parameter is required"
        : "project and module parameters are required",
    });
  }
  if (projects && !canViewAllProjects) {
    const requestedProjects = String(projects)
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
      projects,
      module,
      canEdit,
      page,
      limit,
      statusfilter,
      userRoles,
      canViewAllPending,
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
      ["created", "review", "recalled"].includes(status)
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

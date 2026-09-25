const normalize = (value) => String(value ?? "").trim().toLowerCase();

export const STANDARD_FLEET_APPROVAL_ROLES = ["cm", "pm", "hod", "gm", "ceo"];
export const SPECIAL_FLEET_APPROVAL_ROLES = ["cm", "pm", "pd", "hod", "gm", "ceo"];

export const getUserRoles = (user) =>
  (Array.isArray(user?.role) ? user.role : [user?.role])
    .filter(Boolean)
    .map(normalize);

export const getSpecialFleetProjects = () => {
  const configured = process.env.SPECIAL_PROJECTS || "7102,7104,7106";
  return configured.split(",").map(Number).filter(Number.isFinite);
};

export const getFleetApprovalRoles = (project) =>
  getSpecialFleetProjects().includes(Number(project))
    ? SPECIAL_FLEET_APPROVAL_ROLES
    : STANDARD_FLEET_APPROVAL_ROLES;

export const getNextFleetRequestStatus = (request, currentRole) => {
  const flow = getFleetApprovalRoles(request?.project);
  const role = normalize(currentRole);
  const nextRole = role === "initiator" ? flow[0] : flow[flow.indexOf(role) + 1];
  return nextRole ? `pending for ${nextRole}` : "approved";
};

export const getCurrentFleetApproverRole = (request) => {
  const status = normalize(request?.status);
  return status.startsWith("pending for ")
    ? status.replace("pending for ", "").trim()
    : "";
};

export const isAssignedFleetApprover = (request, user) => {
  const expectedRole = getCurrentFleetApproverRole(request);
  return Boolean(expectedRole && getUserRoles(user).includes(expectedRole));
};

export const canAccessFleetProject = (user, project) => {
  if (["hod", "gm", "ceo"].some((role) => getUserRoles(user).includes(role))) {
    return true;
  }
  const projects = Array.isArray(user?.pr_code) ? user.pr_code : [user?.pr_code];
  return projects.filter((value) => value != null).map(Number).includes(Number(project));
};

export const canEditFleetRequestStatus = (status) =>
  ["created", "review"].includes(normalize(status));

export const authorizeFleetRequestAction = ({
  request,
  user,
  access,
  action = "update",
  project,
  comments,
}) => {
  const normalizedAction = normalize(action);
  const approvalActions = ["approve", "reject", "review"];
  if (!["update", "send-for-approval", ...approvalActions].includes(normalizedAction)) {
    return { statusCode: 400, error: "Invalid Fleet Request action." };
  }
  if (!canAccessFleetProject(user, request?.project)) {
    return { statusCode: 403, error: "You are not assigned to this project." };
  }

  if (approvalActions.includes(normalizedAction)) {
    if (!access?.canView) {
      return { statusCode: 403, error: "Fleet Request view access is required for approval actions." };
    }
    if (!isAssignedFleetApprover(request, user)) {
      return { statusCode: 403, error: "You are not the assigned approver for the current workflow step." };
    }
    if (["reject", "review"].includes(normalizedAction) && !String(comments ?? "").trim()) {
      return { statusCode: 400, error: "Comments are required for this action." };
    }
    const actorRole = getCurrentFleetApproverRole(request);
    return {
      actorRole,
      nextStatus: normalizedAction === "approve"
        ? getNextFleetRequestStatus(request, actorRole)
        : normalizedAction === "reject" ? "rejected" : "review",
    };
  }

  if (!access?.canEdit) {
    return { statusCode: 403, error: "Fleet Request edit access is required." };
  }
  if (!canEditFleetRequestStatus(request?.status)) {
    return { statusCode: 409, error: "Only created or review Fleet Requests can be edited by an initiator." };
  }
  if (project !== undefined && Number(project) !== Number(request?.project)) {
    return { statusCode: 409, error: "An existing Fleet Request cannot be moved to another project." };
  }
  if (project !== undefined && !canAccessFleetProject(user, project)) {
    return { statusCode: 403, error: "You are not assigned to this project." };
  }
  return {
    actorRole: "initiator",
    nextStatus: normalizedAction === "send-for-approval"
      ? getNextFleetRequestStatus({ ...request, project: project ?? request.project }, "initiator")
      : request.status,
  };
};

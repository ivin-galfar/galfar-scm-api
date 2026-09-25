const normalize = (value) => String(value ?? "").trim().toLowerCase();

export const resolveFleetRequestPermission = (permissions = []) => {
  const matches = permissions.filter(
    (permission) => normalize(permission?.statement_role) === "fl_req",
  );
  const levels = new Set(matches.map((permission) => normalize(permission?.access_level)));
  const accessLevel = levels.has("manage") || (levels.has("edit") && levels.has("view"))
    ? "manage"
    : levels.has("edit") ? "edit" : levels.has("view") ? "view" : null;
  const selected = matches.find((permission) => normalize(permission.access_level) === accessLevel)
    ?? matches.find((permission) => normalize(permission.access_level) === "edit")
    ?? matches[0];

  return selected ? {
    statement_role: "fl_req",
    allowed_role: selected.allowed_role,
    access_level: accessLevel,
  } : null;
};

export const buildSafeUserInfo = (account = {}, permissions = []) => {
  const {
    password,
    reset_token,
    reset_token_expires,
    password_reset_token,
    password_reset_expires,
    ...safeAccount
  } = account;
  void password;
  void reset_token;
  void reset_token_expires;
  void password_reset_token;
  void password_reset_expires;

  return {
    ...safeAccount,
    permission: resolveFleetRequestPermission(permissions),
  };
};

export const getStatementAccess = (user, statementRole) => {
  const permission = user?.permission;
  const accessLevel = normalize(permission?.statement_role) === normalize(statementRole)
    ? normalize(permission?.access_level)
    : "";
  const canManage = accessLevel === "manage";

  return {
    canView: canManage || accessLevel === "view",
    canEdit: canManage || accessLevel === "edit",
    canManage,
  };
};

export const requireStatementAccess = (statementRole, capability = "access") =>
  (req, res, next) => {
    const access = getStatementAccess(req.user, statementRole);
    const allowed = capability === "edit"
      ? access.canEdit
      : capability === "view"
        ? access.canView
        : access.canEdit || access.canView;

    if (!allowed) return res.status(403).json({ error: "You do not have permission to access this statement." });
    req.statementAccess = access;
    return next();
  };

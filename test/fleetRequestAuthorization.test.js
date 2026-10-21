import test from "node:test";
import assert from "node:assert/strict";
import { authorizeFleetRequestAction, canAccessFleetProject, getFleetApprovalRoles, getNextFleetRequestStatus } from "../Utils/fleetRequestAuthorization.js";
import { buildSafeUserInfo, getStatementAccess, requireStatementAccess, resolveFleetRequestPermission } from "../Utils/userPermissions.js";

const permission = (access_level, allowed_role = "pm") => ({ statement_role: "fl_req", allowed_role, access_level });
const user = (role, level, pr_code = [7097]) => ({
  role: Array.isArray(role) ? role : [role], pr_code,
  permission: level ? permission(level, Array.isArray(role) ? role[0] : role) : null,
});

test("permission matrix exposes exactly the intended capabilities", () => {
  assert.deepEqual(getStatementAccess(user("initfn", "edit"), "fl_req"), { canView: false, canEdit: true, canManage: false });
  assert.deepEqual(getStatementAccess(user("pm", "view"), "fl_req"), { canView: true, canEdit: false, canManage: false });
  assert.deepEqual(getStatementAccess(user(["pm", "initfn"], "manage"), "fl_req"), { canView: true, canEdit: true, canManage: true });
  assert.deepEqual(getStatementAccess(user("pm", null), "fl_req"), { canView: false, canEdit: false, canManage: false });
});

test("effective login permission uses precedence and exact response keys", () => {
  assert.deepEqual(resolveFleetRequestPermission([permission("view", "pm"), permission("edit", "initfn")]), {
    statement_role: "fl_req", allowed_role: "initfn", access_level: "manage",
  });
  assert.deepEqual(resolveFleetRequestPermission([permission("edit", "initfn"), permission("manage", "pm")]), permission("manage", "pm"));
  assert.equal(resolveFleetRequestPermission([{ statement_role: "other", allowed_role: "pm", access_level: "manage" }]), null);
});

test("login payload removes credentials and reset secrets", () => {
  const result = buildSafeUserInfo({
    id: 58, email: "user@example.com", password: "hash", reset_token: "secret",
    reset_token_expires: "tomorrow", password_reset_token: "secret-2",
    password_reset_expires: "later", role: ["pm"],
  }, [permission("view", "pm")]);
  assert.deepEqual(result, {
    id: 58, email: "user@example.com", role: ["pm"], permission: permission("view", "pm"),
  });
});

test("statement middleware denies no access and exposes capabilities on success", () => {
  const response = () => ({
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  const deniedRes = response();
  requireStatementAccess("fl_req")({ user: user("pm", null) }, deniedRes, () => assert.fail("must not continue"));
  assert.equal(deniedRes.statusCode, 403);

  const req = { user: user("pm", "view") };
  let continued = false;
  requireStatementAccess("fl_req", "view")(req, response(), () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(req.statementAccess.canView, true);
});

test("standard and special approval sequences advance every configured role", () => {
  assert.deepEqual(getFleetApprovalRoles(7097), ["cm", "pm", "hod", "gm"]);
  assert.deepEqual(getFleetApprovalRoles(7102), ["cm", "pm", "pd", "hod", "gm"]);
  for (const [project, flow] of [[7097, ["cm", "pm", "hod", "gm"]], [7102, ["cm", "pm", "pd", "hod", "gm"]]]) {
    assert.equal(getNextFleetRequestStatus({ project }, "initiator"), "pending for cm");
    flow.forEach((role, index) => assert.equal(
      getNextFleetRequestStatus({ project }, role),
      flow[index + 1] ? `pending for ${flow[index + 1]}` : "approved",
    ));
  }
});

test("each assigned approver can approve, reject, or review at its step", () => {
  for (const [project, roles] of [[7097, ["cm", "pm", "hod", "gm"]], [7102, ["cm", "pm", "pd", "hod", "gm"]]]) {
    for (const role of roles) {
      const request = { project, status: `pending for ${role}` };
      const actor = user(role, "view", [project]);
      const access = getStatementAccess(actor, "fl_req");
      assert.equal(authorizeFleetRequestAction({ request, user: actor, access, action: "approve" }).error, undefined);
      assert.equal(authorizeFleetRequestAction({ request, user: actor, access, action: "reject", comments: "No" }).nextStatus, "rejected");
      assert.equal(authorizeFleetRequestAction({ request, user: actor, access, action: "review", comments: "Revise" }).nextStatus, "review");
    }
  }
});

test("initiator rules and invalid or repeated transitions are rejected", () => {
  const actor = user("initfn", "edit");
  const access = getStatementAccess(actor, "fl_req");
  assert.equal(authorizeFleetRequestAction({ request: { project: 7097, status: "created" }, user: actor, access, action: "update" }).nextStatus, "created");
  assert.equal(authorizeFleetRequestAction({ request: { project: 7097, status: "review" }, user: actor, access, action: "send-for-approval" }).nextStatus, "pending for cm");
  assert.equal(authorizeFleetRequestAction({ request: { project: 7097, status: "recalled" }, user: actor, access, action: "update" }).nextStatus, "recalled");
  assert.equal(authorizeFleetRequestAction({ request: { project: 7097, status: "recalled" }, user: actor, access, action: "send-for-approval" }).nextStatus, "pending for cm");
  assert.equal(authorizeFleetRequestAction({ request: { project: 7097, status: "pending for pm" }, user: actor, access, action: "update" }).statusCode, 409);
  assert.equal(authorizeFleetRequestAction({ request: { project: 7097, status: "created" }, user: actor, access, action: "update", project: 7104 }).statusCode, 409);
  assert.equal(authorizeFleetRequestAction({ request: { project: 7097, status: "approved" }, user: actor, access, action: "approve" }).statusCode, 403);
  assert.equal(authorizeFleetRequestAction({ request: { project: 7097, status: "created" }, user: actor, access, action: "invalid" }).statusCode, 400);
});

test("initiators can recall pending requests but not completed or editable requests", () => {
  const actor = user("initfr", "edit");
  const access = getStatementAccess(actor, "fl_req");

  assert.deepEqual(
    authorizeFleetRequestAction({
      request: { project: 7097, status: "pending for pm" },
      user: actor,
      access,
      action: "recall",
    }),
    { actorRole: "initiator", nextStatus: "recalled" },
  );

  for (const status of ["created", "recalled", "review", "rejected", "approved"]) {
    assert.equal(
      authorizeFleetRequestAction({
        request: { project: 7097, status },
        user: actor,
        access,
        action: "recall",
      }).statusCode,
      409,
    );
  }

  const approver = user("pm", "view");
  assert.equal(
    authorizeFleetRequestAction({
      request: { project: 7097, status: "pending for pm" },
      user: approver,
      access: getStatementAccess(approver, "fl_req"),
      action: "recall",
    }).statusCode,
    403,
  );
});

test("wrong step, access, comments, and project boundaries are enforced", () => {
  const request = { project: 7097, status: "pending for pm" };
  for (const actor of [user("hod", "view"), user("pm", "edit"), user("pm", null)]) {
    assert.equal(authorizeFleetRequestAction({ request, user: actor, access: getStatementAccess(actor, "fl_req"), action: "approve" }).statusCode, 403);
  }
  const pm = user("pm", "view");
  assert.equal(authorizeFleetRequestAction({ request, user: pm, access: getStatementAccess(pm, "fl_req"), action: "review" }).statusCode, 400);
  assert.equal(canAccessFleetProject(user("pm", "view", [7001]), 7097), false);
  assert.equal(canAccessFleetProject(user("cm", "view", [7001]), 7097), false);
  assert.equal(canAccessFleetProject(user("pd", "view", [7001]), 7097), false);
  assert.equal(canAccessFleetProject(user("cm", "view", [7097]), 7097), true);
  assert.equal(canAccessFleetProject(user("hod", "view", []), 7097), true);
});

test("inith, HOD, GM, and CEO can view requests across all projects", () => {
  for (const role of ["inith", "hod", "gm", "ceo"]) {
    assert.equal(canAccessFleetProject(user(role, "view", []), 7097), true);
    assert.equal(canAccessFleetProject(user(role, "view", []), 7102), true);
  }
});

test("a completed step cannot be approved again from its new status", () => {
  const cm = user("cm", "view", [7097]);
  const access = getStatementAccess(cm, "fl_req");
  const first = authorizeFleetRequestAction({
    request: { project: 7097, status: "pending for cm" },
    user: cm,
    access,
    action: "approve",
  });
  assert.equal(first.nextStatus, "pending for pm");
  assert.equal(authorizeFleetRequestAction({
    request: { project: 7097, status: first.nextStatus },
    user: cm,
    access,
    action: "approve",
  }).statusCode, 403);
});

test("GM is the final Fleet Request approver and CEO cannot approve", () => {
  const request = { project: 7097, status: "pending for gm" };
  const gm = user("gm", "view", []);
  const gmResult = authorizeFleetRequestAction({
    request,
    user: gm,
    access: getStatementAccess(gm, "fl_req"),
    action: "approve",
  });
  assert.equal(gmResult.actorRole, "gm");
  assert.equal(gmResult.nextStatus, "approved");

  const ceo = user("ceo", "view", []);
  assert.equal(
    authorizeFleetRequestAction({
      request,
      user: ceo,
      access: getStatementAccess(ceo, "fl_req"),
      action: "approve",
    }).statusCode,
    403,
  );
});

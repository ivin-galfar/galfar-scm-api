import { approvalData } from "../Models/approvalData.js";

export const fetchApprovalData = async (req, res) => {
  let updatedRoles = "";
  const roles = req.user.role;
  const isAdmin = req.user.is_admin;
  const project_code = req.user.pr_code;
  const department = req.user.dept_code;

  const { pageSize, pageIndex, page, limit } = req.query;

  if (isAdmin) {
    const matchedAdminRoles = roles.filter((role) =>
      ["initpr", "initdc", "inith", "inita", "initfn", "initlg"].includes(role),
    );
    if (
      matchedAdminRoles.includes("initpr") &&
      matchedAdminRoles.includes("initdc")
    ) {
      updatedRoles = ["initfn", "initpr", "initdc"];
    } else {
      updatedRoles = matchedAdminRoles;
    }
  } else {
    updatedRoles = roles.filter((r) => r !== "initfn");
  }

  try {
    const result = await approvalData({
      dept: department ?? [],
      role: updatedRoles,
      isAdmin: isAdmin,
      pr_code: project_code,
      includeDeleted: req.query.includeDeleted === false,
      page: pageIndex ?? page,
      limit: pageSize ?? limit,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
};

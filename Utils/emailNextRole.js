import { getFleetApprovalRoles } from "./fleetRequestAuthorization.js";

const terminalStatuses = ["approved", "rejected", "review"];

const getPendingRole = (status) => {
  if (typeof status !== "string") return null;
  const match = status.match(/pending for\s+(.+)$/i);
  if (!match) return null;
  const role = match[1]?.trim().toLowerCase();
  return role === "sfm" ? "fm" : role;
};
const getNormalProjects = () =>
  (process.env.NORMAL_PROJECTS ?? "")
    .split(",")
    .map((project) => project.trim())
    .filter(Boolean);

export const getEmailNextRole = ({
  statementType,
  documentType,
  role,
  status,
  category,
  project,
  SLA = false,
}) => {
  const type = documentType ?? statementType;
  const normalProjects = getNormalProjects();
  const isNormalProject = normalProjects.includes(String(project).trim());

  if (statementType === "filenote") {
    const fileNoteSubrole =
      type === "file_note" && ["TFW", "General"].includes(category)
        ? "gm"
        : "fm";
    const iocSubrole =
      type === "ioc" && ["FWA", "Demob"].includes(category) && !isNormalProject
        ? "pm"
        : "gm";
    const pdProjects = process.env.SPECIAL_PROJECTS.split(",")
      .map((project) => project.trim())
      .filter(Boolean)
      .map(Number);
    const pmPdRole =
      type === "ioc" &&
      ["FWA", "Demob"].includes(category) &&
      !isNormalProject &&
      pdProjects.includes(project)
        ? "pd"
        : "gm";
    const isInsurance = category === "Insurance" ? "fm" : "gm";
    const map =
      type === "file_note"
        ? { initfn: "hod", hod: fileNoteSubrole, fm: "gm", gm: "ceo" }
        : {
            initfn: "hod",
            initpr: "cm",
            initdc: "cm",
            cm: iocSubrole,
            pm: pmPdRole,
            pd: "gm",
            hod: isInsurance,
            gm: "ceo",
          };
    const pendingRole = SLA ? getPendingRole(status) : null;
    if (pendingRole) return pendingRole;
    if (terminalStatuses.includes(status)) {
      return category !== "Demob" && category !== "FWA"
        ? "initfn"
        : category === "FWA"
          ? "initdc"
          : "initpr";
    }
    return map[role] || null;
  }

  if (statementType === "buyvsrent") {
    if (terminalStatuses.includes(status)) return "inita";
    return { inita: "hod", hod: "fm", fm: "gm", gm: "ceo" }[role] || null;
  }

  if (statementType === "hiringasset") {
    if (["Approved", "review", "Rejected"].includes(status)) {
      return type === "hiring" ? "inith" : "inita";
    }
    return { inith: "hod", inita: "hod", hod: "gm", gm: "ceo" }[role] || null;
  }

  if (statementType === "logistics") {
    if (terminalStatuses.includes(status)) return "initlg";
    const pdProjects = process.env.SPECIAL_PROJECTS.split(",")
      .map((project) => project.trim())
      .filter(Boolean)
      .map(Number);
    const projectCode = typeof project === "string" ? Number(project) : project;

    const map = {
      initlg: "incharge",
      incharge: "pm",
      pm: pdProjects.includes(projectCode) ? "pd" : "gm",
      pd: "gm",
      gm: "fm",
      fm: "ceo",
    };

    return map[role] || null;
  }

  if (statementType === "fr") {
    if (
      terminalStatuses.includes(
        String(status ?? "")
          .trim()
          .toLowerCase(),
      )
    ) {
      return "initfr";
    }
    const pendingRole = getPendingRole(status);
    if (pendingRole) return pendingRole;
    const flow = getFleetApprovalRoles(project);
    const currentRole = String(role ?? "")
      .trim()
      .toLowerCase();
    const index = flow.indexOf(currentRole);
    return currentRole === "initiator"
      ? flow[0]
      : index >= 0
        ? flow[index + 1] || null
        : null;
  }

  return null;
};

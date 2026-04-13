export const expectedStatuses = (currentrole) => {
  let statustext = "";
  if (currentrole == "inita") {
    statustext = "pending for hod";
  } else if (currentrole == "hod") {
    statustext = "pending for fm";
  } else if (currentrole == "fm") {
    statustext = "pending for gm";
  } else if (currentrole == "gm") {
    statustext = "pending for ceo";
  } else if (currentrole == "ceo") {
    statustext = "approved";
  }
  return statustext;
};

export const statusExpected = (currentrole = [], action, type, category) => {
  let statustext = "";
  const roles = currentrole.map((r) => r.toLowerCase());

  if (
    !roles.includes("cm") &&
    !roles.includes("pm") &&
    !roles.includes("initpr")
  ) {
    if (roles.includes("initfn") && action == "save") {
      statustext = "pending for hod";
    } else if (roles.includes("hod")) {
      statustext = `pending for ${type == "ioc" || (type == "file_note" && category == "TFW") || (type == "file_note" && category == "General") ? "gm" : "sfm"}`;
    } else if (roles.includes("fm")) {
      statustext = "pending for gm";
    } else if (roles.includes("gm")) {
      statustext = "pending for ceo";
    } else if (roles.includes("ceo")) {
      statustext = "approved";
    } else {
      statustext = "rejected";
    }
  } else if (roles.includes("initpr") && category == "Demob") {
    statustext = "pending for cm";
  } else if (roles.includes("cm")) {
    statustext = "approved";
  } else {
    statustext = "rejected";
  }

  return statustext;
};

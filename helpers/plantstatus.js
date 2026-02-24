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

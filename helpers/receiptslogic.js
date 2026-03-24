import { totalReceipts } from "../Models/receiptmodel.js";

export const fetchallreceiptslogic = async (
  type,
  expectedStatuses,
  statusfilter,
  multiStatus,
  searchcs,
  emailcron = false,
) => {
  let statuses = [];
  if (typeof expectedStatuses === "string") {
    statuses = expectedStatuses.split(",").map((s) => s.trim());
  } else {
    statuses = expectedStatuses;
  }

  let multiStatuses = [];
  if (multiStatus) {
    multiStatuses = multiStatus.split(",");
  }

  const { count } = await totalReceipts(
    type,
    statuses,
    statusfilter,
    multiStatuses,
    searchcs,
    emailcron,
  );

  return count;
};

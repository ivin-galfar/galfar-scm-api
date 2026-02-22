import cron from "node-cron";
import { fetchallreceiptslogic } from "../helpers/receiptslogic.js";
import { NewsletterTemplate } from "../helpers/emailTemplate.js";
import { fetchtotalstatements } from "../Models/logisticsModel.js";
const statuses = [
  "pending for hod",
  "pending for gm",
  "pending for ceo",
  "review",
  "rejected",
  "approved",
];
const rejectedStatuses = ["rejected"];
const approvedStatuses = ["approved"];
const pendingStatuses = [
  "pending for hod",
  "pending for gm",
  "pending for ceo",
];
export const cronemails = () => {
  cron.schedule("0 6 * * *", async () => {
    // Every day at 10:00 AM (06 in UTC)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    // Only run if tomorrow is the first day → today is last day of month
    if (tomorrow.getDate() === 1) {
      const totalReceipts = await fetchallreceiptslogic(null, statuses);
      const rejectedreceipts = await fetchallreceiptslogic(
        null,
        rejectedStatuses,
      );
      const approvedReceipts = await fetchallreceiptslogic(
        null,
        approvedStatuses,
      );
      const pendingReceipts = await fetchallreceiptslogic(
        null,
        pendingStatuses,
      );

      const totallogstatements = await fetchtotalstatements("All");
      const rejectedlogstatements = await fetchtotalstatements("rejected");
      const approvedlogstatements = await fetchtotalstatements("approved");
      const pendinglogstatements = await fetchtotalstatements(
        "Pending",
        null,
        null,
        true,
      );

      try {
        const html = await NewsletterTemplate({
          total: totalReceipts,
          rejected: rejectedreceipts,
          approved: approvedReceipts,
          pending: pendingReceipts,
          dept: "Plant",
        });
        const htmllogistics = await NewsletterTemplate({
          total: totallogstatements.count,
          rejected: rejectedlogstatements.count,
          approved: approvedlogstatements.count,
          pending: pendinglogstatements.count,
          dept: "Logistics",
        });
      } catch (error) {
        throw error;
      }
    }
  });
};

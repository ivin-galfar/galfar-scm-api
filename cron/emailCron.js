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
    // Only run if today is the first day of the month
    if (today.getDate() === 1) {
      const totalReceipts = await fetchallreceiptslogic(
        null,
        statuses,
        null,
        null,
        null,
        null,
        null,
        true,
      );
      const rejectedreceipts = await fetchallreceiptslogic(
        null,
        rejectedStatuses,
        null,
        null,
        null,
        null,
        null,
        true,
      );
      const approvedReceipts = await fetchallreceiptslogic(
        null,
        approvedStatuses,
        null,
        null,
        null,
        null,
        null,
        true,
      );
      const pendingReceipts = await fetchallreceiptslogic(
        null,
        pendingStatuses,
        null,
        null,
        null,
        null,
        null,
        true,
      );

      const totallogstatements = await fetchtotalstatements(
        "All",
        null,
        null,
        null,
        null,
        null,
        true,
      );
      const rejectedlogstatements = await fetchtotalstatements(
        "rejected",
        null,
        null,
        null,
        null,
        null,
        true,
      );
      const approvedlogstatements = await fetchtotalstatements(
        "approved",
        null,
        null,
        null,
        null,
        null,
        true,
      );
      const pendinglogstatements = await fetchtotalstatements(
        "Pending",
        null,
        null,
        null,
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

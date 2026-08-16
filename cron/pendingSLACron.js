import { SLAController } from "../Controllers/SLAController.js";
import { fetchPendingApprovalsBySLA } from "../Models/PendingStatementApprovals.js";
import cron from "node-cron";

export const pendingSLACron = () => {
  cron.schedule("0 9,15 * * *", async () => {
    const result = await fetchPendingApprovalsBySLA({
      hours: process.env.THRESHOLDHOURS,
      withinThreshold: false,
      includeDeleted: false,
    });
    console.log(
      "🔥 SLA cron ran at:",
      new Date().toLocaleString("en-US", {
        timeZone: "Asia/Dubai",
        dateStyle: "full",
        timeStyle: "long",
      }),
    );

    SLAController(result);
  });
};

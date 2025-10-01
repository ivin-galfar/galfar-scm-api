import express from "express";
import {
  feedReceipts,
  fetchApproverDetails,
  fetchReceipt,
  fetchReceipts,
  removeReceipt,
  updateApprovalstatus,
  updateReceipt,
  updatestatus,
} from "../Controllers/receiptController.js";
const router = express.Router();
router.route("/").post(feedReceipts);
router.route("/").get(fetchReceipts);
router.route("/:cs_id").get(fetchReceipt);
router.route("/:cs_id").delete(removeReceipt);
router.route("/updatereceipt/:cs_id").put(updateReceipt);
router.route("/updatereceiptstatus/:cs_id").put(updatestatus);
router.route("/approverdetails/:cs_id").get(fetchApproverDetails);
router.route("/approver/:cs_id").put(updateApprovalstatus);

export default router;

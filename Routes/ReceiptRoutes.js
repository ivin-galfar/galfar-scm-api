import express from "express";
import {
  feedReceipts,
  fetchApproverDetails,
  fetchReceipt,
  fetchReceipts,
  removeReceipt,
  softdeleteReceipt,
  updateApprovalstatus,
  updateReceipt,
  updatestatus,
  uploadFile,
} from "../Controllers/receiptController.js";
import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({ storage });

const router = express.Router();
router.route("/").post(feedReceipts);
router.route("/").get(fetchReceipts);
router.route("/:cs_id").get(fetchReceipt);
router.route("/:cs_id").delete(removeReceipt);
router.route("/:cs_id").post(softdeleteReceipt);
router.route("/updatereceipt/:cs_id").put(updateReceipt);
router.route("/updatereceiptstatus/:cs_id").put(updatestatus);
router.route("/approverdetails/:cs_id").get(fetchApproverDetails);
router.route("/approver/:cs_id").put(updateApprovalstatus);
router.route("/file").post(upload.array("file"), uploadFile);

export default router;

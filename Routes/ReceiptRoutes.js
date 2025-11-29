import express from "express";
import {
  feedReceipts,
  fetchallreceipts,
  fetchApproverDetails,
  fetchReceipt,
  fetchReceipts,
  removeReceipt,
  softdeleteReceipt,
  updateApprovalstatus,
  updateReceipt,
  updatestatus,
  uploadFile,
  withdrawRequest,
} from "../Controllers/receiptController.js";
import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({ storage });

const router = express.Router();
router.route("/file").post(upload.array("file"), uploadFile);

router.route("/updatereceipt/:cs_id").put(updateReceipt);
router.route("/updatereceiptstatus/:cs_id").put(updatestatus);
router.route("/approverdetails/:cs_id").get(fetchApproverDetails);
router.route("/approver/:cs_id").put(updateApprovalstatus);

router.route("/").post(feedReceipts);
router.route("/").get(fetchReceipts);
router.route("/totalreceipts").get(fetchallreceipts);
router.route("/:cs_id").get(fetchReceipt);
router.route("/:cs_id").delete(removeReceipt);
router.route("/:cs_id").post(softdeleteReceipt);
router.route("/initiator/:cs_id").put(withdrawRequest);

export default router;

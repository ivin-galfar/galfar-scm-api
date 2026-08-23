import express from "express";
import { fetchApprovalData } from "../Controllers/approvalDataController.js";

const router = express.Router();

router.get("/approvals", fetchApprovalData);

export default router;

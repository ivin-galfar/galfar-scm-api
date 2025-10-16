import express from "express";
import { EmailNotify } from "../Controllers/emailController.js";
const router = express.Router();

router.route("/:cs_id").post(EmailNotify);

export default router;

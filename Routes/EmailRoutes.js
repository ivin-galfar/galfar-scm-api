import express from "express";
import verifyToken from "../Utils/jwtTokenValidation.js";
import {
  EmailNotify,
  PwdReset,
  PwdResetReq,
  verifyResetToken,
} from "../Controllers/emailController.js";
const router = express.Router();

router.route("/pwdresetreq").post(PwdResetReq);
router.route("/verifyresettoken").post(verifyResetToken);
router.route("/pwdreset").post(PwdReset);
router.use(verifyToken);
router.route("/:cs_id").post(EmailNotify);
export default router;

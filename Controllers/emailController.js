import nodemailer from "nodemailer";
import crypto from "crypto";
import { fetchoneReceiptFormData, sendemail } from "../Models/receiptmodel.js";
import {
  getEmailsByProject,
  getEmailsByRole,
  getMultipleEmailsByRole,
  getUserByResetToken,
  updatePassword,
} from "../Models/userModel.js";
import { emaillogs, emaillogsfn } from "../Models/emailModel.js";
import pmMap from "../Utils/pmmapping.js";
import { sentemail } from "../Models/logisticsModel.js";
import { PmCmNames } from "../Models/projectModel.js";
import { PDFDocument } from "pdf-lib";
import { mergedPdf } from "../helpers/helperfunctions.js";
import { ProcessLogisticsEmail } from "../EmailAlerts/ProcessLogisticsEmail.js";
import { ProcessBvrEmail } from "../EmailAlerts/ProcessBvrEmail.js";
import { ProcessHireEmail } from "../EmailAlerts/ProcessHireEmail.js";
import { ProcessFnEmail } from "../EmailAlerts/ProcessFnEmail.js";

export const EmailNotify = async (req, res) => {
  const { dept = "", type = "", category = "" } = req.query || {};
  if (dept == "logistics") {
    const {
      status,
      project_code,
      cargo_details,
      userInfo,
      shipment_no,
      rejectedby,
      comments,
      created_at,
      approvedPdfUrl,
      file,
      filename,
    } = req.body;

    const { role } = userInfo;
    const { cs_id } = req.params;

    try {
      const result = await ProcessLogisticsEmail({
        status,
        project_code,
        cargo_details,
        userInfo,
        shipment_no,
        rejectedby,
        comments,
        created_at,
        approvedPdfUrl,
        file,
        filename,
        role,
        cs_id,
      });

      return res.status(200).json(result);
    } catch (error) {
      const statusCode = error.message?.includes("No next approver found")
        ? 400
        : 500;
      return res.status(statusCode).json({
        message: error.message,
      });
    }
  } else if (dept == "buyvsrent") {
    const {
      id,
      item,
      type,
      status,
      file,
      filename,
      created_at,
      approvedPdfUrl,
    } = req.body;
    const { role } = req.body.userInfo;
    try {
      const result = await ProcessBvrEmail({
        id,
        item,
        type,
        status,
        file,
        filename,
        created_at,
        approvedPdfUrl,
        role,
      });
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        message: error.message,
      });
    }
  } else if (dept == "plant" && !type && !category) {
    const { projectvalue, hiringname, type, created_at, file, filename } =
      req.body.formData;
    const role = req.body.userInfo.role[0];
    const { status, doc_no, approvedPdfUrl } = req.body;
    const { cs_id } = req.params;

    try {
      const result = await ProcessHireEmail({
        projectvalue,
        hiringname,
        type,
        created_at,
        file,
        filename,
        role,
        status,
        doc_no,
        approvedPdfUrl,
        cs_id,
      });
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        message: error.message,
      });
    }
  } else if (dept == "plant" && type != "" && category != "") {
    const {
      id,
      dept_id,
      role,
      is_admin,
      doc_no,
      name,
      status,
      created_at,
      project_code,
      exportedstatement,
      file,
      file_name,
    } = req.body;

    try {
      const result = await ProcessFnEmail({
        id,
        dept_id,
        role,
        is_admin,
        doc_no,
        name,
        status,
        created_at,
        project_code,
        exportedstatement,
        file,
        file_name,
        type,
        category,
      });
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        message: error.message,
      });
    }
  }
};

export const PwdResetReq = async (req, res) => {
  const { email, expiry, resettoken, resetToken } = req.body;
  const resetLinkToken = resettoken || resetToken;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required." });
  }

  if (!resetLinkToken) {
    return res
      .status(400)
      .json({ success: false, message: "Reset token is required." });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const resetUrl = `${process.env.ENVIRONMENT == "production" ? process.env.PROD_URL : process.env.DEV_URL}resetpwd?token=${resetLinkToken}${expiry ? `&expiry=${encodeURIComponent(expiry)}` : ""}`;
    const expiryText = expiry
      ? new Date(expiry).toLocaleString("en-AE", {
          timeZone: "Asia/Dubai",
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "soon";

    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="margin: 0 0 12px; color: #004080;">Password Reset</h2>
          <p style="margin: 0 0 12px; line-height: 1.6;">
            You requested a password reset for your Galfar Intranet account.
          </p>
          <p style="margin: 0 0 16px; line-height: 1.6;">
            Please use the link below to reset your password. This link will expire on <strong>${expiryText}</strong>.
          </p>
          <p style="margin: 0 0 20px;">
            <a href="${resetUrl}" style="background-color: #004080; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 6px; display: inline-block; font-weight: 600;">
              Reset Password
            </a>
          </p>
          <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">
            If the button above does not work, copy and paste this link into your browser:
          </p>
          <p style="margin: 0; font-size: 13px; color: #0f4b91; word-break: break-all;">${resetUrl}</p>
          <p style="margin: 24px 0 0; font-size: 12px; color: #888;">
            This is an automated email. Please do not reply.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: "Password reset email sent successfully.",
      info,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const verifyResetToken = async (req, res) => {
  const { resettoken } = req.body;
  const incomingToken = resettoken;

  if (!incomingToken) {
    return res.status(400).json({
      success: false,
      message: "Reset token is required.",
    });
  }

  try {
    const hashedToken = crypto
      .createHash("sha256")
      .update(incomingToken)
      .digest("hex");
    const user = await getUserByResetToken(hashedToken);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid reset token. Please try again.",
      });
    }

    const expiresAt = new Date(user.reset_token_expires);
    const now = new Date();

    if (!user.reset_token_expires || expiresAt <= now) {
      return res.status(401).json({
        success: false,
        message: "Reset token has expired. Please try again!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Reset token is valid.",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        dept_code: user.dept_code,
        pr_code: user.pr_code,
        is_admin: user.is_admin,
        is_valid: user.is_valid,
        reset_token_expires: user.reset_token_expires,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const PwdReset = async (req, res) => {
  const { token, password } = req.body;

  if (!token) {
    return res
      .status(400)
      .json({ success: false, message: "Reset token is required." });
  }

  if (!password) {
    return res
      .status(400)
      .json({ success: false, message: "New password is required." });
  }

  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await getUserByResetToken(hashedToken);

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid reset token." });
    }

    const expiresAt = new Date(user.reset_token_expires);
    const now = new Date();

    if (!user.reset_token_expires || expiresAt <= now) {
      return res.status(401).json({
        success: false,
        message: "Reset token has expired. Please try again!",
      });
    }

    const updatedUser = await updatePassword(user.id, password);

    return res.status(200).json({
      success: true,
      message: "Password updated successfully.",
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

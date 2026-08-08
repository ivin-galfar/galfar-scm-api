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
    let definedprojects = [
      7092, 7112, 7099, 7110, 7111, 7114, 7108, 7105, 7097, 7102, 7104, 7106, 1,
      7115,
    ];
    let project =
      typeof project_code === "string" ? Number(project_code) : project_code;

    let pm = role === "pm" ? (await PmCmNames(role, project_code))?.[0] : "";

    let pd = role === "pd" ? (await PmCmNames(role, project_code))?.[0] : "";

    if (role === "pm") {
      if (!definedprojects.includes(project)) {
        return res.status(400).json({
          message: "No recipients found. Approval flow stopped.",
        });
      }
    }
    const roleMap = {
      initlg: 1,
      incharge: 1,
      gm: 2,
      pm: 3,
      fm: 4,
      ceo: 5,
    };

    const PD_PROJECTS = [7102, 7104, 7106];
    const isPdProject = PD_PROJECTS.includes(project);

    const nextRoleMap = {
      initlg: "incharge",
      incharge: "pm",
      pm: isPdProject ? "pd" : "gm",
      pd: "gm",
      gm: "fm",
      fm: "ceo",
    };

    let nextRole = "";
    if (["approved", "rejected", "review"].includes(status)) {
      nextRole = "initlg";
    } else {
      nextRole = nextRoleMap[role];
    }
    let recipients = [];
    if (nextRole != "pm" && nextRole != "pd") {
      recipients = await getEmailsByRole(nextRole);
    } else {
      try {
        recipients = project ? await getEmailsByProject(project, nextRole) : [];
      } catch (error) {
        throw error;
      }
    }
    const email_flag = roleMap[role] || 0;

    if (!nextRole) {
      return res.status(400).json({
        success: false,
        message: `No next approver found for role: ${role}`,
      });
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

      const exportedStatementFilename = approvedPdfUrl
        ? approvedPdfUrl.split("/").pop().split("?")[0] ||
          "Exported Statement.pdf"
        : null;

      const exportedStatementAttachment = approvedPdfUrl
        ? [
            {
              filename: exportedStatementFilename,
              path: approvedPdfUrl,
            },
          ]
        : [];

      const supportingDocs = (file || []).map((url, index) => ({
        filename: filename[index] || "",
        path: url,
      }));

      const mailAttachments = [
        ...exportedStatementAttachment,
        ...supportingDocs,
      ];

      const mailOptions = {
        from: process.env.FROM,
        to: recipients,
        attachments: status == "approved" ? mailAttachments : [],
        subject: `Comparative Statement (Logistics) - ${shipment_no}/${cargo_details}/${
          project ? project + " : " : ""
        } ${
          nextRole === "initlg"
            ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
            : "Approval Required"
        }`,
        html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 10px 0;">
        <div style=" color: #333;">
          <p style="margin: 0 0 16px;">Dear User,</p>
          <p style="margin: 0 0 16px; color: #333; font-size: 14px; line-height: 1.6;">
           ${status == "approved" ? "This is to inform you that the following document(s) have been Approved." : status == "rejected" ? "This is to inform you that the following document(s) have been Rejected." : status == "review" ? "This is to inform you that the following document(s) have been submitted for review." : "This is to inform you that the following document(s) have been submitted for approval."} 
          </p>
            <div style="margin: 16px 0; padding: 18px; border-radius: 8px; color: #333; font-size: 14px; line-height: 1.0;">
              <p style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #1e293b;">Document Details</p>
              <ul style="margin: 0; padding-left: 18px; list-style: disc;">
              <li style="margin-bottom: 8px;"><strong>Dept. :</strong> ${"Logistics"}</li>
              <li style="margin-bottom: 8px;"><strong>Shipment No. :</strong> ${shipment_no}</li>
                <li style="margin-bottom: 8px;"><strong>Doc No. :</strong> ${cs_id}</li>
                ${project ? `<li style="margin-bottom: 8px;"><strong>Project Code :</strong> ${project}</li>` : ""}
                <li style="margin-bottom: 8px;"><strong>Cargo :</strong> ${cargo_details}</li>
                <li style="margin-bottom: 8px;"><strong>${status == "approved" ? "Approved By :" : status == "rejected" ? "Rejected By :" : status == "review" ? "Sent for Reveiew By :" : "Submitted By :"}</strong> ${role == "initlg" ? "INITIATOR" : role.toUpperCase()}</li>
                <li style="margin: 0;"><strong>Created Date:</strong> ${new Date(created_at || Date.now()).toLocaleDateString("en-AE", { timeZone: "Asia/Dubai", year: "numeric", month: "short", day: "2-digit" })}</li>
              </ul>
               ${
                 status === "approved" && approvedPdfUrl
                   ? `<div">
                    <p style="margin: 5px 0 12px; font-size: 14px; color: #4b5563; line-height: 1.6;">
                      The approved statement has been generated and is available for download below,
                    </p>
                    <p style="margin: 0;">
                      <a href="${approvedPdfUrl}" style="color: #0f4b91; text-decoration: underline; font-weight: 600; font-size: 14px;">
                        Download approved statement
                      </a>
                    </p>
                  </div>`
                   : ""
               }
            </div>
            <p style="margin: 0 0 16px; color: #555; font-size: 14px; line-height: 1.6;">
              ${
                status == "approved"
                  ? ` The approved document and supporting attachments are included with this email. You can also verify the approved document in our application via this link: <a href="${
                      process.env.ENVIRONMENT === "production"
                        ? `${process.env.PROD_URL}/lstatements/${cs_id}`
                        : `${process.env.DEV_URL}/lstatements/${cs_id}`
                    }" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">Verify and confirm.</a>`
                  : status == "review"
                    ? `. You can  check the under review document  directly in our app via this link: <a href="${
                        process.env.ENVIRONMENT === "production"
                          ? `${process.env.PROD_URL}/lstatements/${cs_id}`
                          : `${process.env.DEV_URL}/lstatements/${cs_id}`
                      }" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">>Review and Update.</a>`
                    : status == "rejected"
                      ? `. You can  check the rejected document via this link: <a href=${
                          process.env.ENVIRONMENT === "production"
                            ? `${process.env.PROD_URL}/lstatements/${cs_id}`
                            : `${process.env.DEV_URL}/lstatements/${cs_id}`
                        }" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">Review and create new.</a>`
                      : `You can review and approve directly in our app via this link: <a href="${
                          process.env.ENVIRONMENT === "production"
                            ? `${process.env.PROD_URL}/lstatements/${cs_id}`
                            : `${process.env.DEV_URL}/lstatements/${cs_id}`
                        }" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">Review and Approve.</a>`
              }
              <p style="margin: 0 0 16px; color: #555; font-size: 14px; line-height: 1.6;"> If you have any questions or require additional information, please contact the concerned department.</p>
            </p>

            <p style="margin: 24px 0 4px;">Thank you,</p>
            <p style="margin: 0; font-weight: 600;">Software Development Team</p>
            <p style="margin: 0; font-weight: 600;">Galfar Engineering and Contracting WLL Emirates</p>
          </div>

          <div style="background-color: transparent; padding: 2px 6px; font-size: 10px; color: #888; text-align: center; margin-top: 8px;">
           ***This is a system-generated email. Please do not reply to this message.***
          </div>
      </div>
    `,
      };
      const approverdetails = {
        role: role,
        datetime: new Date(),
        ...(role === "pm" && { pm }),
        ...(role === "pd" && { pd }),
        comments: comments,
      };
      const [emailInfo] = await Promise.all([
        transporter.sendMail(mailOptions),
        sentemail(cs_id, email_flag, approverdetails),
      ]);

      return res.status(200).json({
        success: true,
        message: "Email sent successfully.",
        emailInfo,
        approvedInfo: approverdetails,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
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

    const nextRoleMap = {
      inita: "hod",
      hod: "fm",
      fm: "gm",
      gm: "ceo",
    };

    let nextRole = "";
    if (["approved", "rejected", "review"].includes(status)) {
      nextRole = "inita";
    } else {
      nextRole = nextRoleMap[role];
    }

    let recipients = await getEmailsByRole(nextRole);

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

      const exportedStatementFilename = approvedPdfUrl
        ? approvedPdfUrl.split("/").pop().split("?")[0] ||
          "Exported Statement.pdf"
        : null;

      const exportedStatementAttachment = approvedPdfUrl
        ? [
            {
              filename: exportedStatementFilename,
              path: approvedPdfUrl,
            },
          ]
        : [];

      const supportingDocs = (file || []).map((url, index) => ({
        filename: filename[index] || "",
        path: url,
      }));

      const mailAttachments = [
        ...exportedStatementAttachment,
        ...supportingDocs,
      ];

      const mailOptions = {
        from: process.env.FROM,
        to: recipients,
        attachments: status == "approved" ? mailAttachments : [],
        subject: `Comparative Statement (BVR) - ${
          nextRole === "inita"
            ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
            : status == "review"
              ? "Under Review"
              : "Approval Required"
        }:${item} (${new Date(created_at)
          .toLocaleDateString("en-AE", {
            timeZone: "Asia/Dubai",
          })
          .replace(/\//g, "-")})`,

        html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 10px 0;">
        <div style=" color: #333;">
          <p style="margin: 0 0 16px;">Dear User,</p>
          <p style="margin: 0 0 16px; color: #333; font-size: 14px; line-height: 1.6;">
           ${status == "approved" ? "This is to inform you that the following document(s) have been Approved." : status == "rejected" ? "This is to inform you that the following document(s) have been Rejected." : status == "review" ? "This is to inform you that the following document(s) have been submitted for review." : "This is to inform you that the following document(s) have been submitted for approval."} 
          </p>
            <div style="margin: 16px 0; padding: 18px; border-radius: 8px; color: #333; font-size: 14px; line-height: 1.0;">
              <p style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #1e293b;">Document Details</p>
              <ul style="margin: 0; padding-left: 18px; list-style: disc;">
              <li style="margin-bottom: 8px;"><strong>Dept. :</strong> ${"Plant & Equipment"}</li>
              <li style="margin-bottom: 8px;"><strong>Type of Doc.:</strong> ${"Buy vs Rent"}</li>
              <li style="margin-bottom: 8px;"><strong>Item :</strong> ${item}</li>
              <li style="margin-bottom: 8px;"><strong>Doc No. :</strong> ${id}</li>
              <li style="margin-bottom: 8px;"><strong>Preferred Type:</strong> ${type}</li>
              <li style="margin-bottom: 8px;"><strong>${status == "approved" ? "Approved By :" : status == "rejected" ? "Rejected By :" : status == "review" ? "Sent for Reveiew By :" : "Submitted By :"}</strong> ${role == "inita" ? "INITIATOR" : role.toUpperCase()}</li>
              <li style="margin-bottom: 8px;"><strong>Created Date:</strong> ${new Date(created_at || Date.now()).toLocaleDateString("en-AE", { timeZone: "Asia/Dubai", year: "numeric", month: "short", day: "2-digit" })}</li>
              </ul>
               ${
                 status === "approved" && approvedPdfUrl
                   ? `<div">
                    <p style="margin: 5px 0 12px; font-size: 14px; color: #4b5563; line-height: 1.6;">
                      The approved statement has been generated and is available for download below,
                    </p>
                    <p style="margin: 0;">
                      <a href="${approvedPdfUrl}" style="color: #0f4b91; text-decoration: underline; font-weight: 600; font-size: 14px;">
                        Download approved statement
                      </a>
                    </p>
                  </div>`
                   : ""
               }
            </div>
            <p style="margin: 0 0 16px; color: #555; font-size: 14px; line-height: 1.6;">
              ${
                status == "approved"
                  ? ` The approved document and supporting attachments are included with this email. You can also verify the approved document in our application via this link: <a href="${
                      process.env.ENVIRONMENT === "production"
                        ? `${process.env.PROD_URL}/brstatement/${id}`
                        : `${process.env.DEV_URL}/brstatement/${id}`
                    }" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">Verify and confirm.</a>`
                  : status == "review"
                    ? `. You can  check the under review document  directly in our app via this link: <a href="${
                        process.env.ENVIRONMENT === "production"
                          ? `${process.env.PROD_URL}/brstatement/${id}`
                          : `${process.env.DEV_URL}/brstatement/${id}`
                      }" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">>Review and Update.</a>`
                    : status == "rejected"
                      ? `. You can  check the rejected document via this link: <a href=${
                          process.env.ENVIRONMENT === "production"
                            ? `${process.env.PROD_URL}/brstatement/${id}`
                            : `${process.env.DEV_URL}/brstatement/${id}`
                        }" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">Review and create new.</a>`
                      : `You can review and approve directly in our app via this link: <a href="${
                          process.env.ENVIRONMENT === "production"
                            ? `${process.env.PROD_URL}/brstatement/${id}`
                            : `${process.env.DEV_URL}/brstatement/${id}`
                        }" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">Review and Approve.</a>`
              }
              <p style="margin: 0 0 16px; color: #555; font-size: 14px; line-height: 1.6;"> If you have any questions or require additional information, please contact the concerned department.</p>
            </p>

            <p style="margin: 24px 0 4px;">Thank you,</p>
            <p style="margin: 0; font-weight: 600;">Software Development Team</p>
            <p style="margin: 0; font-weight: 600;">Galfar Engineering and Contracting WLL Emirates</p>
          </div>

          <div style="background-color: transparent; padding: 2px 6px; font-size: 10px; color: #888; text-align: center; margin-top: 8px;">
           ***This is a system-generated email. Please do not reply to this message.***
          </div>
      </div>
    `,
      };
      const approverdetails = {
        role: role,
        datetime: new Date(),
        status: status,
      };
      const [emailInfo] = await Promise.all([
        transporter.sendMail(mailOptions),
      ]);

      emaillogs(id, emailInfo, approverdetails);

      return res.status(200).json({
        success: true,
        message: "Email sent successfully.",
        emailInfo,
        approvedInfo: approverdetails,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  } else if (dept == "plant" && !type && !category) {
    const { projectvalue, hiringname, type, created_at, file, filename } =
      req.body.formData;
    const role = req.body.userInfo.role[0];
    const { status, doc_no, approvedPdfUrl } = req.body;
    const { cs_id } = req.params;

    try {
      const cs_exists = await fetchoneReceiptFormData(cs_id);
      if (!cs_exists.formData || Object.keys(cs_exists.formData).length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Receipt not found." });
      }
      const roleMap = {
        inith: 1,
        inita: 1,
        hod: 2,
        gm: 3,
        ceo: 4,
      };

      const nextRoleMap = {
        inith: "hod",
        inita: "hod",
        hod: "gm",
        gm: "ceo",
      };
      let nextRole = "";
      if (["Approved", "review", "Rejected"].includes(status)) {
        nextRole = type === "hiring" ? "inith" : "inita";
      } else {
        nextRole = nextRoleMap[role];
      }

      if (!nextRole) {
        return res.status(400).json({
          success: false,
          message: `No next approver found for role: ${role}`,
        });
      }
      let recipients = await getEmailsByRole(nextRole);

      if (
        process.env.ENVIRONMENT == "production" &&
        (nextRole == "inita" ||
          nextRole == "inith" ||
          role == "inita" ||
          role == "inith")
      ) {
        recipients.push("Hari.HS@galfaremirates.com");
      }

      const email_flag = roleMap[role] || 0;

      const transporter = nodemailer.createTransport({
        host: "smtp.office365.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      const exportedStatementFilename = approvedPdfUrl
        ? approvedPdfUrl.split("/").pop().split("?")[0] ||
          "Exported Statement.pdf"
        : null;

      const exportedStatementAttachment = approvedPdfUrl
        ? [
            {
              filename: exportedStatementFilename,
              path: approvedPdfUrl,
            },
          ]
        : [];

      const supportingDocs = (file || []).map((url, index) => ({
        filename: filename[index] || "",
        path: url,
      }));

      const mailAttachments = [
        ...exportedStatementAttachment,
        ...supportingDocs,
      ];
      let mergedDocs = [];
      let allArePdf = true;
      for (const attachment of mailAttachments) {
        const azureResponse = await fetch(attachment.path);
        const contentType = azureResponse.headers.get("content-type");
        if (contentType !== "application/pdf") {
          allArePdf = false;
          break;
        }
      }

      let emailAttachments;

      if (allArePdf) {
        mergedDocs = await mergedPdf(mailAttachments);

        emailAttachments = [
          {
            filename: exportedStatementFilename,
            content: mergedDocs,
            contentType: "application/pdf",
          },
        ];
      } else {
        emailAttachments = mailAttachments;
      }

      const mailOptions = {
        from: process.env.FROM,
        to: recipients,
        attachments: emailAttachments,
        subject: `Comparative Statement  (${type})- ${
          nextRole === "inith" || nextRole === "inita"
            ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
            : "Approval Required"
        }`,
        html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 10px 0;">
        <div style=" color: #333;">
          <p style="margin: 0 0 16px;">Dear User,</p>
          <p style="margin: 0 0 16px; color: #333; font-size: 14px; line-height: 1.6;">
           ${status.toLowerCase() == "approved" ? "This is to inform you that the following document(s) have been Approved. The supporting documents has been merged with the approved statement with this email." : status.toLowerCase() == "rejected" ? "This is to inform you that the following document(s) have been Rejected." : status.toLowerCase() == "review" ? "This is to inform you that the following document(s) have been submitted for review." : "This is to inform you that the following document(s) have been submitted for approval."} 
          </p>
            <div style="margin: 16px 0; padding: 18px; border-radius: 8px; color: #333; font-size: 14px; line-height: 1.0;">
              <p style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #1e293b;">Document Details</p>
              <ul style="margin: 0; padding-left: 18px; list-style: disc;">
              <li style="margin-bottom: 8px;"><strong>Dept. :</strong> ${"Plant & Equipment"}</li>
              <li style="margin-bottom: 8px;"><strong>Type of Doc.:</strong> ${type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()}</li>
              <li style="margin-bottom: 8px;"><strong>Subject :</strong> ${hiringname}</li>
              <li style="margin-bottom: 8px;"><strong>Doc No. :</strong> ${doc_no}</li>
              ${
                type == "hiring"
                  ? `<li style="margin-bottom: 8px;">
                <strong>Project :</strong> ${projectvalue}
              </li>`
                  : ""
              }
              <li style="margin-bottom: 8px;"><strong>${status.toLowerCase() == "approved" ? "Approved By :" : status.toLowerCase() == "rejected" ? "Rejected By :" : status.toLowerCase() == "review" ? "Sent for Reveiew By :" : "Submitted By :"}</strong> ${role == "inita" || role == "inith" ? "INITIATOR" : role.toUpperCase()}</li>
              <li style="margin-bottom: 8px;"><strong>Created Date:</strong> ${new Date(created_at || Date.now()).toLocaleDateString("en-AE", { timeZone: "Asia/Dubai", year: "numeric", month: "short", day: "2-digit" })}</li>
              </ul>
               ${
                 status === "approved" && approvedPdfUrl
                   ? `<div">
                    <p style="margin: 5px 0 12px; font-size: 14px; color: #4b5563; line-height: 1.6;">
                      The approved statement has been generated and is available for download below,
                    </p>
                    <p style="margin: 0;">
                      <a href="${approvedPdfUrl}" style="color: #0f4b91; text-decoration: underline; font-weight: 600; font-size: 14px;">
                        Download approved statement
                      </a>
                    </p>
                  </div>`
                   : ""
               }
            </div>
            <p style="margin: 0 0 16px; color: #555; font-size: 14px; line-height: 1.6;">
              ${
                status == "approved"
                  ? ` The approved document and supporting attachments are included with this email. You can also verify the approved document in our application via this link: <a href="${
                      process.env.ENVIRONMENT === "production"
                        ? `${process.env.PROD_URL}/receipts/${cs_id}`
                        : `${process.env.DEV_URL}/receipts/${cs_id}`
                    }" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">Verify and confirm.</a>`
                  : status == "review"
                    ? `. You can  check the under review document  directly in our app via this link: <a href="${
                        process.env.ENVIRONMENT === "production"
                          ? `${process.env.PROD_URL}/receipts/${cs_id}`
                          : `${process.env.DEV_URL}/receipts/${cs_id}`
                      }" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">>Review and Update.</a>`
                    : status == "rejected"
                      ? `. You can  check the rejected document via this link: <a href=${
                          process.env.ENVIRONMENT === "production"
                            ? `${process.env.PROD_URL}/receipts/${cs_id}`
                            : `${process.env.DEV_URL}/receipts/${cs_id}`
                        }" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">Review and create new.</a>`
                      : `You can review and approve directly in our app via this link: <a href="${
                          process.env.ENVIRONMENT === "production"
                            ? `${process.env.PROD_URL}/receipts/${cs_id}`
                            : `${process.env.DEV_URL}/receipts/${cs_id}`
                        }" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">Review and Approve.</a>`
              }
              <p style="margin: 0 0 16px; color: #555; font-size: 14px; line-height: 1.6;"> If you have any questions or require additional information, please contact the concerned department.</p>
            </p>

            <p style="margin: 24px 0 4px;">Thank you,</p>
            <p style="margin: 0; font-weight: 600;">Software Development Team</p>
            <p style="margin: 0; font-weight: 600;">Galfar Engineering and Contracting WLL Emirates</p>
          </div>

          <div style="background-color: transparent; padding: 2px 6px; font-size: 10px; color: #888; text-align: center; margin-top: 8px;">
           ***This is a system-generated email. Please do not reply to this message.***
          </div>
      </div>
    `,
      };

      const [emailInfo] = await Promise.all([
        transporter.sendMail(mailOptions),
        sendemail(cs_id, email_flag),
      ]);

      return res.status(200).json({
        success: true,
        message: "Email sent successfully.",
        emailInfo,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
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

    const filenotesubrole =
      type === "file_note" && ["TFW", "General"].includes(category)
        ? "gm"
        : "fm";
    const iocsubrole =
      type === "ioc" &&
      (category == "FWA" || category == "Demob") &&
      project_code !== 1501
        ? "pm"
        : "gm";
    const PD_PROJECTS = [7102, 7104, 7106];
    const pmpdrole =
      type === "ioc" &&
      (category == "FWA" || category == "Demob") &&
      project_code !== 1501 &&
      PD_PROJECTS.includes(project_code)
        ? "pd"
        : "gm";
    const isInsurance = category === "Insurance" ? "fm" : "gm";

    const nextRoleMap =
      type === "file_note"
        ? { initfn: "hod", hod: filenotesubrole, fm: "gm", gm: "ceo" }
        : {
            initfn: "hod",
            initpr: "cm",
            initdc: "cm",
            cm: iocsubrole,
            pm: pmpdrole,
            pd: "gm",
            hod: isInsurance,
            gm: "ceo",
          };
    let nextRole = "";
    let ccemail = [];
    const isTerminalStatus = ["approved", "rejected", "review"].includes(
      status?.toLowerCase(),
    );
    let submitted_by = "";

    if (isTerminalStatus) {
      submitted_by = role ? role.toUpperCase() : "";
    } else if (category == "FWA" || category == "Demob") {
      submitted_by = project_code + "  Project";
    } else {
      submitted_by = dept_id == 1 ? "P & E Dept." : dept_id;
    }
    nextRole =
      status === "approved" || status === "rejected" || status === "review"
        ? category != "Demob" && category != "FWA"
          ? "initfn"
          : category == "FWA"
            ? "initdc"
            : "initpr"
        : nextRoleMap[role] || null;

    let recipients = [];

    const exportedStatementFilename = exportedstatement
      ? exportedstatement.split("/").pop().split("?")[0] ||
        "Exported Statement.pdf"
      : null;

    const exportedStatementAttachment = exportedstatement
      ? [
          {
            filename: exportedStatementFilename,
            path: exportedstatement,
          },
        ]
      : [];

    const supportingDocs = (file || []).map((url, index) => ({
      filename: file_name[index] || "",
      path: url,
    }));

    const mailAttachments = [...exportedStatementAttachment, ...supportingDocs];
    try {
      if (nextRole == "initfn") {
        if (type == "file_note") {
          if (category == "General" || category == "Ap") {
            ccemail.push(...(await getMultipleEmailsByRole(["hod"], dept_id)));
            recipients = await getMultipleEmailsByRole(nextRole, dept_id, true);
          } else if (category == "ADTSRen" || category == "ADTSNew") {
            ccemail.push(...(await getMultipleEmailsByRole(["hod"], dept_id)));
            ccemail.push(
              ...(await getMultipleEmailsByRole(["initfn"], dept_id)),
            );
            if (status !== "rejected" && status !== "review") {
              ccemail.push(...(await getMultipleEmailsByRole(["fm"], dept_id)));
              recipients = await getMultipleEmailsByRole(["axp_adts"]);
            } else {
              recipients = await getMultipleEmailsByRole(["initfn"], dept_id);
            }
          } else if (category == "TFW") {
            ccemail.push(...(await getMultipleEmailsByRole(["hod"], dept_id)));
            recipients = await getMultipleEmailsByRole(nextRole, dept_id);
          }
        } else if (type == "ioc") {
          if (status !== "rejected" && status !== "review") {
            if (category == "Insurance") {
              recipients = await getMultipleEmailsByRole(["axp_in"]);
            } else if (category == "FC") {
              recipients = await getMultipleEmailsByRole(["axp_fc"]);
            } else if (category == "PR") {
              recipients = await getMultipleEmailsByRole(["axp_pr"]);
            } else if (category == "DPR") {
              recipients = await getMultipleEmailsByRole(["axp_dpr"]);
            }
            ccemail.push(...(await getMultipleEmailsByRole(["fm"], dept_id)));
          }

          if (status == "rejected" || status == "review") {
            ccemail.push(...(await getMultipleEmailsByRole(["hod"], dept_id)));
            recipients = await getMultipleEmailsByRole(["initfn"], dept_id);
          }
          if (
            (category == "Insurance" ||
              category == "FC" ||
              category == "PR" ||
              category == "DPR") &&
            status !== "rejected" &&
            status !== "review"
          ) {
            ccemail.push(...(await getMultipleEmailsByRole(["hod"], dept_id)));
            ccemail.push(
              ...(await getMultipleEmailsByRole(["initfn"], dept_id)),
            );
          }
        }
      } else if (nextRole == "initpr") {
        recipients = await getEmailsByRole(nextRole, dept_id, project_code);
        recipients.push(
          ...(await getEmailsByRole("inith", dept_id, project_code)),
        );
        recipients.push(
          ...(await getEmailsByRole("view", dept_id, project_code)),
        );
        if (status != "rejected" && status !== "review") {
          ccemail.push(
            ...(await getMultipleEmailsByRole(
              ["pm", "spm", "pd", "cm", "scm"],
              dept_id,
              false,
              project_code,
            )),
          );
          ccemail.push(...(await getMultipleEmailsByRole(["hod"], dept_id)));
          ccemail.push(...(await getMultipleEmailsByRole(["gm"], dept_id)));
        } else {
          ccemail.push(...(await getMultipleEmailsByRole(["hod"], dept_id)));
        }
      } else {
        recipients = await getEmailsByRole(nextRole, dept_id, project_code);
      }

      if (!Array.isArray(recipients)) recipients = [];
      if (recipients?.length === 0) {
        return res.status(400).json({
          success: true,
          message: "No email recipients found, email not sent",
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: `Failed to fetch recipient emails: ${error.message}`,
      });
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

      const mailOptions = {
        from: process.env.FROM,
        to: recipients,
        attachments: status == "approved" ? mailAttachments : [],
        cc: ccemail,
        subject: `${type == "file_note" ? "File Note" : "IOC"} - ${name} : ${category == "FWA" ? "HWA" : category}/${project_code ? project_code + "/" : ""}${doc_no} - ${
          nextRole === "initfn" ||
          nextRole === "initpr" ||
          nextRole === "initdc"
            ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
            : status == "review"
              ? "Under Review"
              : "Approval Required"
        }`,
        html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 10px 0;">
        <div style=" color: #333;">
          <p style="margin: 0 0 16px;">Dear User,</p>
          <p style="margin: 0 0 16px; color: #333; font-size: 14px; line-height: 1.6;">
           ${status == "approved" ? "This is to inform you that the following document(s) have been Approved." : status == "rejected" ? "This is to inform you that the following document(s) have been Rejected." : status == "review" ? "This is to inform you that the following document(s) have been submitted for review." : "This is to inform you that the following document(s) have been submitted for approval."} 
          </p>
            <div style="margin: 16px 0; padding: 18px; border-radius: 8px; color: #333; font-size: 14px; line-height: 1.0;">
              <p style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #1e293b;">Document Details</p>
              <ul style="margin: 0; padding-left: 18px; list-style: disc;">
                <li style="margin-bottom: 8px;"><strong>Doc No. :</strong> ${doc_no}</li>
                <li style="margin-bottom: 8px;"><strong>Type :</strong> ${type == "file_note" ? "File Note" : "IOC"}</li>
                <li style="margin-bottom: 8px;"><strong>Category :</strong> ${category.toLowerCase() != "fwa" ? category : "HWA"}</li>
                ${project_code ? `<li style="margin-bottom: 8px;"><strong>Project Code :</strong> ${project_code}</li>` : ""}
                <li style="margin-bottom: 8px;"><strong>Subject :</strong> ${name}</li>
                <li style="margin-bottom: 8px;"><strong>${status == "approved" ? "Approved By :" : status == "rejected" ? "Rejected By :" : status == "review" ? "Sent for Reveiew By :" : "Submitted By :"}</strong> ${submitted_by}</li>
                <li style="margin: 0;"><strong>Created Date:</strong> ${new Date(created_at || Date.now()).toLocaleDateString("en-AE", { timeZone: "Asia/Dubai", year: "numeric", month: "short", day: "2-digit" })}</li>
              </ul>
               ${
                 status === "approved" && exportedstatement
                   ? `<div">
                    <p style="margin: 5px 0 12px; font-size: 14px; color: #4b5563; line-height: 1.6;">
                      The approved statement has been generated and is available for download below,
                    </p>
                    <p style="margin: 0;">
                      <a href="${exportedstatement}" style="color: #0f4b91; text-decoration: underline; font-weight: 600; font-size: 14px;">
                        Download approved statement
                      </a>
                    </p>
                  </div>`
                   : ""
               }
            </div>
            <p style="margin: 0 0 16px; color: #555; font-size: 14px; line-height: 1.6;">
              ${
                status == "approved"
                  ? ` The approved document and supporting attachments are included with this email. You can also verify the approved document in our application via this link: <a href="${process.env.ENVIRONMENT == "production" ? `${process.env.PROD_URL}/filenote/` : `${process.env.DEV_URL}/filenote/`}${id}" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">Verify and confirm.</a>`
                  : status == "review"
                    ? `. You can  check the under review document  directly in our app via this link: <a href="${process.env.ENVIRONMENT == "production" ? `${process.env.PROD_URL}/filenote/` : `${process.env.DEV_URL}/filenote/`}${id}" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">>Review and Update.</a>`
                    : status == "rejected"
                      ? `. You can  check the rejected document via this link: <a href="${process.env.ENVIRONMENT == "production" ? `${process.env.PROD_URL}/filenote/` : `${process.env.DEV_URL}/filenote/`}${id}" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">Review and create new.</a>`
                      : `You can review and approve directly in our app via this link: <a href="${process.env.ENVIRONMENT == "production" ? `${process.env.PROD_URL}/filenote/` : `${process.env.DEV_URL}/filenote/`}${id}" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">Review and Approve.</a>`
              }
              <p style="margin: 0 0 16px; color: #555; font-size: 14px; line-height: 1.6;"> If you have any questions or require additional information, please contact the concerned department.</p>
            </p>

            <p style="margin: 24px 0 4px;">Thank you,</p>
            <p style="margin: 0; font-weight: 600;">Software Development Team</p>
            <p style="margin: 0; font-weight: 600;">Galfar Engineering and Contracting WLL Emirates</p>
          </div>

          <div style="background-color: transparent; padding: 2px 6px; font-size: 10px; color: #888; text-align: center; margin-top: 8px;">
           ***This is a system-generated email. Please do not reply to this message.***
          </div>
      </div>
    `,
      };
      const approverdetails = {
        role,
        datetime: new Date(),
        status: status,
      };
      const [emailInfo] = await Promise.all([
        transporter.sendMail(mailOptions),
      ]);

      emaillogsfn(id, emailInfo, approverdetails);

      return res.status(200).json({
        success: true,
        message: "Email sent successfully.",
        emailInfo,
        approvedInfo: approverdetails,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
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
      from: process.env.FROM,
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

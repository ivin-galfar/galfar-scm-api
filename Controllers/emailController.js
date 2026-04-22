import nodemailer from "nodemailer";
import { fetchoneReceiptFormData, sendemail } from "../Models/receiptmodel.js";
import {
  getEmailsByProject,
  getEmailsByRole,
  getMultipleEmailsByRole,
} from "../Models/userModel.js";
import { emaillogs, emaillogsfn } from "../Models/emailModel.js";
import pmMap from "../Utils/pmmapping.js";
import { sentemail } from "../Models/logisticsModel.js";

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
    } = req.body;

    const { role } = userInfo;

    const { cs_id } = req.params;
    let definedprojects = [
      7092, 7112, 7099, 7110, 7111, 7114, 7108, 7105, 7097, 7102, 7104, 7106, 1,
    ];
    let project =
      typeof project_code === "string" ? Number(project_code) : project_code;
    let pm = pmMap[project]?.name || "";
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
    const nextRoleMap = {
      initlg: "incharge",
      incharge: "pm",
      pm: "gm",
      gm: "fm",
      fm: "ceo",
    };

    let nextRole = "";
    if (["approved", "rejected"].includes(status)) {
      nextRole = "initlg";
    } else {
      nextRole = nextRoleMap[role];
    }
    let recipients = [];
    if (nextRole != "pm") {
      recipients = await getEmailsByRole(nextRole);
    } else {
      try {
        recipients = project ? await getEmailsByProject(project) : [];
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

      const mailOptions = {
        from: `"Galfar Intranet" <no-reply@galfaremirates.com>`,
        to: recipients,
        subject: `Comparative Statement (Logistics) - ${
          nextRole === "initlg"
            ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
            : "Approval"
        }`,
        html: `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; background-color: #f4f6f8; padding: 40px 0;">
    <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); overflow: hidden;">
      
      <!-- Header -->
      <!--[if mso]>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
            <td bgcolor="#004080"
                style="padding:16px 24px;">
              <p style="margin:0;
                        color:#ffffff;
                        font-size:20px;
                        font-weight:bold;
                        font-family:Arial, sans-serif;">
                Comparative Statement -
                ${
                  nextRole === "initlg"
                    ? status.charAt(0).toUpperCase() +
                      status.slice(1).toLowerCase()
                    : "Approval Required"
                }
              </p>
            </td>
          </tr>
        </table>
      <![endif]-->

      <!--[if !mso]><!-- -->
      <div style="background-color: #004080; padding: 16px 24px;">
        <h2 style="margin: 0; color: #ffffff; font-size: 20px;">Comparative Statement - ${
          nextRole === "initlg"
            ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
            : "Approval Required"
        }</h2>
      </div>
      <![endif]-->

      <!-- Body -->
      <div style="padding: 24px; color: #333;">
        <p style="margin: 0 0 16px;">Dear User,</p>
        <p style="margin: 0 0 16px;">The comparative statement  - <strong>${shipment_no}/${
          project ? project + "/" : ""
        }${cargo_details}</strong> is <strong>${
          ["approved", "rejected"].includes(status)
            ? status === "rejected"
              ? `Rejected by ${rejectedby.toUpperCase()}`
              : status
            : "awaiting your approval"
        }</strong>.</p>

        <!-- Button -->
         <!--[if mso]>
        <table align="center" cellpadding="0" cellspacing="0" role="presentation" style="margin:30px auto;">
        <tr>
          <td align="center"
              bgcolor="#004080"
              style="padding:12px 24px; font-weight:bold; font-size:16px;">
            <a href="https://intranet.galfaremirates.com/lstatements/${cs_id}"
              style="color:#ffffff; text-decoration:none; display:inline-block;">
              View Comparative Statement
            </a>
          </td>

        </tr>
      </table>
      <p style="margin-top: 30px;">Please review and update accordingly at your earliest convenience.</p>
      <![endif]-->
       <!--[if !mso]><!-- -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://intranet.galfaremirates.com/lstatements/${cs_id}"
             style="background-color: #004080; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
            View Comparative Statement
          </a>
          </div>
          <p style="margin: 0;">Please review and update accordingly at your earliest convenience.</p>
      <!--<![endif]-->
        
        <!-- Signature -->
        <p style="margin: 24px 0 4px;">Thank you,</p>
        <p style="margin: 0; font-weight: 600;">Software Development Team,</p>
        <p style="margin: 0; font-weight: 600;">Galfar Engineering and Contracting WLL Emirates</p>

      </div>

      <!-- Footer -->
      <div style="background-color: #f4f6f8; padding: 12px 24px; font-size: 12px; color: #888; text-align: center;margin-top:15px">
        This is an automated email. Please do not reply.
      </div>
    </div>
  </div>
`,
      };
      const approverdetails = {
        role: role,
        datetime: new Date(),
        ...(role === "pm" && { pm }),
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
    const { id, item, type, status, date } = req.body;

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

      const mailOptions = {
        from: `"Galfar Intranet" <no-reply@galfaremirates.com>`,
        to: recipients,
        subject: `Comparative Statement (BVR) - ${
          nextRole === "inita"
            ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
            : status == "review"
              ? "Under Review"
              : "Approval Required"
        }:${item} (${new Date(date)
          .toLocaleDateString("en-AE", {
            timeZone: "Asia/Dubai",
          })
          .replace(/\//g, "-")})`,
        html: `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; background-color: #f4f6f8; padding: 40px 0;">
    <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); overflow: hidden;">
      
      <!-- Header -->
      <!--[if mso]>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
            <td bgcolor="#004080"
                style="padding:16px 24px;">
              <p style="margin:0;
                        color:#ffffff;
                        font-size:20px;
                        font-weight:bold;
                        font-family:Arial, sans-serif;">
                Comparative Statement -
                ${
                  nextRole === "inita"
                    ? status.charAt(0).toUpperCase() +
                      status.slice(1).toLowerCase()
                    : "Approval Required"
                }
              </p>
            </td>
          </tr>
        </table>
      <![endif]-->

      <!--[if !mso]><!-- -->
      <div style="background-color: #004080; padding: 16px 24px;">
        <h2 style="margin: 0; color: #ffffff; font-size: 20px;">Comparative Statement - ${
          nextRole === "inita"
            ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
            : "Approval Required"
        }</h2>
      </div>
      <![endif]-->

      <!-- Body -->
      <div style="padding: 24px; color: #333;">
        <p style="margin: 0 0 16px;">Dear User,</p>
        <p style="margin: 0 0 16px;">The comparative statement  - <strong>${item}/${id}/${type}/${new Date(
          date,
        ).toLocaleDateString("en-AE", {
          timeZone: "Asia/Dubai",
        })}</strong> is <strong>${
          ["approved", "rejected", "review"].includes(status)
            ? status === "rejected"
              ? `Rejected by ${role}`
              : status == "review"
                ? "under Review"
                : status
            : "awaiting your approval"
        }</strong>.</p>

        <!-- Button -->
         <!--[if mso]>
        <table align="center" cellpadding="0" cellspacing="0" role="presentation" style="margin:30px auto;">
        <tr>
          <td align="center"
              bgcolor="#004080"
              style="padding:12px 24px; font-weight:bold; font-size:16px;">
            <a href="https://intranet.galfaremirates.com/brstatement/${id}"
              style="color:#ffffff; text-decoration:none; display:inline-block;">
              View Comparative Statement
            </a>
          </td>

        </tr>
      </table>
      <p style="margin-top: 30px;">Please review and update accordingly at your earliest convenience.</p>
      <![endif]-->
       <!--[if !mso]><!-- -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://intranet.galfaremirates.com/brstatement/${id}"
             style="background-color: #004080; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
            View Comparative Statement
          </a>
          </div>
          <p style="margin: 0;">Please review and update accordingly at your earliest convenience.</p>
      <!--<![endif]-->
        
        <!-- Signature -->
        <p style="margin: 24px 0 4px;">Thank you,</p>
        <p style="margin: 0; font-weight: 600;">Software Development Team,</p>
        <p style="margin: 0; font-weight: 600;">Galfar Engineering and Contracting WLL Emirates</p>

      </div>

      <!-- Footer -->
      <div style="background-color: #f4f6f8; padding: 12px 24px; font-size: 12px; color: #888; text-align: center;margin-top:15px">
        This is an automated email. Please do not reply.
      </div>
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
    const { projectvalue, hiringname, type } = req.body.formData;
    const role = req.body.userInfo.role[0];
    const { status } = req.body;
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

      const mailOptions = {
        from: `"Galfar Intranet" <no-reply@galfaremirates.com>`,
        to: recipients,
        subject: `Comparative Statement  (${type})- ${
          nextRole === "inith" || nextRole === "inita"
            ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
            : "Approval Required"
        }`,
        html: `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; background-color: #f4f6f8; padding: 40px 0;">
    <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); overflow: hidden;">
      
      <!-- Header -->
       <!--[if mso]>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
 <tr>
    <td bgcolor="#004080"
        style="padding:16px 24px;">
      <p style="margin:0;
                color:#ffffff;
                font-size:20px;
                font-weight:bold;
                font-family:Arial, sans-serif;">
        Comparative Statement -
        ${
          nextRole === "inith" || nextRole === "inita"
            ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
            : "Approval Required"
        }
      </p>
    </td>
  </tr>
</table>

         <![endif]-->
        
      <!--[if !mso]><!-- -->
      <div style="background-color: #004080; padding: 16px 24px;">
        <h2 style="margin: 0; color: #ffffff; font-size: 20px;">Comparative Statement - ${
          nextRole === "inith" || nextRole === "inita"
            ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
            : "Approval Required"
        }</h2>
      </div>
      <!--<![endif]-->

      <!-- Body -->
      <div style="padding: 24px; color: #333;">
        <!--[if mso]>
          <p style="margin-top: 30px">Dear User,</p>
         <![endif]-->

       <!--[if !mso]><!-- -->
        <p style="margin: 0 0 16px;">Dear User,</p>
         <!--<![endif]-->
        <p style="margin: 0 0 16px;">The comparative statement (${type}) - <strong>${cs_id}/${
          projectvalue ? projectvalue + "/" : ""
        }${hiringname}</strong> is <strong>${
          ["Approved", "Rejected"].includes(status)
            ? status
            : status === "review"
              ? "Under Review"
              : "awaiting your approval"
        }</strong>.</p>

        <!-- Button -->
        <!--[if mso]>
        <table align="center" cellpadding="0" cellspacing="0" role="presentation" style="margin:30px auto;">
        <tr>
          <td align="center"
              bgcolor="#004080"
              style="padding:12px 24px; font-weight:bold; font-size:16px;">
            <a href="https://intranet.galfaremirates.com/receipts/${cs_id}"
              style="color:#ffffff; text-decoration:none; display:inline-block;">
              View Comparative Statement
            </a>
          </td>

        </tr>
      </table>
      <p style="margin-top: 30px;">Please review and update accordingly at your earliest convenience.</p>
      <![endif]-->


      <!--[if !mso]><!-- -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://intranet.galfaremirates.com/receipts/${cs_id}"
             style="background-color: #004080; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
            View Comparative Statement
          </a>
          </div>
          <p style="margin-top: 30px;">Please review and update accordingly at your earliest convenience.</p>
      <!--<![endif]-->
        
        <!-- Signature -->
        <p style="margin: 24px 0 4px;">Thank you,</p>
        <p style="margin: 0; font-weight: 600;">Software Development Team,</p>
        <p style="margin: 0; font-weight: 600;">Galfar Engineering and Contracting WLL Emirates</p>

      </div>
  
      <!-- Footer -->
      <div style="background-color: #f4f6f8; padding: 12px 24px; font-size: 12px; color: #888; text-align: center;margin-top:15px">
      This is an automated email. Please do not reply.
      </div>
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
    } = req.body;

    const nextRoleMap =
      type === "file_note"
        ? { initfn: "hod", hod: "fm", fm: "gm", gm: "ceo" }
        : {
            initfn: "hod",
            initpr: "cm",
            initdc: "cm",
            cm: "pm",
            pm: "gm",
            hod: "gm",
            gm: "ceo",
          };
    let nextRole = "";
    let ccemail = [];

    nextRole =
      status === "approved" || status === "rejected" || status === "review"
        ? category != "Demob" && category != "FWA"
          ? "initfn"
          : category == "FWA"
            ? "initdc"
            : "initpr"
        : nextRoleMap[role] || null;

    let recipients = [];
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
              recipients = await getMultipleEmailsByRole(["fm"], dept_id);
            } else {
              recipients = await getMultipleEmailsByRole(["initfn"], dept_id);
            }
          } else if (category == "TFW") {
            ccemail.push(...(await getMultipleEmailsByRole(["hod"], dept_id)));
            recipients = await getMultipleEmailsByRole(nextRole, dept_id);
          }
        } else if (type == "ioc") {
          if (status !== "rejected" && status !== "review") {
            recipients = await getMultipleEmailsByRole(["fm"], dept_id);
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
        from: `"Galfar Intranet" <no-reply@galfaremirates.com>`,
        to: recipients,
        cc: ccemail,
        subject: `${type == "file_note" ? "File Note" : "IOC"}/${name}/${category}/${doc_no} - ${
          nextRole === "initfn" ||
          nextRole === "initpr" ||
          nextRole === "initdc"
            ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
            : status == "review"
              ? "Under Review"
              : "Approval Required"
        }: (${new Date(created_at)
          .toLocaleDateString("en-AE", {
            timeZone: "Asia/Dubai",
          })
          .replace(/\//g, "-")})`,
        html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; background-color: #f4f6f8; padding: 40px 0;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); overflow: hidden;">

          <!-- Header -->
          <!--[if mso]>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
                <td bgcolor="#004080"
                    style="padding:16px 24px;">
                  <p style="margin:0;
                            color:#ffffff;
                            font-size:20px;
                            font-weight:bold;
                            font-family:Arial, sans-serif;">
                    Comparative Statement -
                    ${
                      nextRole === "initfn" || nextRole == "initfn"
                        ? status.charAt(0).toUpperCase() +
                          status.slice(1).toLowerCase()
                        : "Approval Required"
                    }
                  </p>
                </td>
              </tr>
            </table>
          <![endif]-->

          <!--[if !mso]><!-- -->
          <div style="background-color: #004080; padding: 16px 24px;">
            <h2 style="margin: 0; color: #ffffff; font-size: 20px;">Comparative Statement - ${
              nextRole === "initfn"
                ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
                : "Approval Required"
            }</h2>
          </div>
          <![endif]-->

          <!-- Body -->
          <div style="padding: 24px; color: #333;">
            <p style="margin: 0 0 16px;">Dear User,</p>
            <p style="margin: 0 0 16px;">The FN/IOC  - <strong>${doc_no}/${name}/${type}/${new Date(
              created_at,
            ).toLocaleDateString("en-AE", {
              timeZone: "Asia/Dubai",
            })}</strong> is <strong>${
              ["approved", "rejected", "review"].includes(status)
                ? status === "rejected"
                  ? `Rejected by ${role}`
                  : status == "review"
                    ? "under Review"
                    : status
                : "awaiting your approval"
            }</strong>.</p>

            <!-- Button -->
             <!--[if mso]>
            <table align="center" cellpadding="0" cellspacing="0" role="presentation" style="margin:30px auto;">
            <tr>
              <td align="center"
                  bgcolor="#004080"
                  style="padding:12px 24px; font-weight:bold; font-size:16px;">
                <a href="${process.env.ENVIRONMENT == "production" ? "https://intranet.galfaremirates.com/filenote/" : "http://localhost:5173/filenote/"}${id}"
                  style="color:#ffffff; text-decoration:none; display:inline-block;">
                  View Comparative Statement
                </a>
              </td>

            </tr>
          </table>
          <p style="margin-top: 30px;">Please review and update accordingly at your earliest convenience.</p>
          <![endif]-->
           <!--[if !mso]><!-- -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.ENVIRONMENT == "production" ? "https://intranet.galfaremirates.com/filenote/" : "http://localhost:5173/filenote/"}${id}"
                 style="background-color: #004080; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
                View Comparative Statement
              </a>
              </div>
              <p style="margin: 0;">Please review and update accordingly at your earliest convenience.</p>
          <!--<![endif]-->

            <!-- Signature -->
            <p style="margin: 24px 0 4px;">Thank you,</p>
            <p style="margin: 0; font-weight: 600;">Software Development Team,</p>
            <p style="margin: 0; font-weight: 600;">Galfar Engineering and Contracting WLL Emirates</p>

          </div>

          <!-- Footer -->
          <div style="background-color: #f4f6f8; padding: 12px 24px; font-size: 12px; color: #888; text-align: center;margin-top:15px">
            This is an automated email. Please do not reply.
          </div>
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

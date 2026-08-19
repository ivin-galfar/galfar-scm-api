import nodemailer from "nodemailer";
import { getEmailsByProject, getEmailsByRole } from "../Models/userModel.js";
import { sentemail } from "../Models/logisticsModel.js";
import { PmCmNames } from "../Models/projectModel.js";
import { emaillogslg } from "../Models/emailModel.js";

export const ProcessLogisticsEmail = async ({
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
  SLA = false,
  date_flag,
}) => {
  const [day, month, year] = created_at.split("/");
  const formattedDate = new Date(
    `${year}-${month}-${day}T00:00:00`,
  ).toLocaleDateString("en-AE", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  const definedprojects = [
    7092, 7112, 7099, 7110, 7111, 7114, 7108, 7105, 7097, 7102, 7104, 7106, 1,
    7115,
  ];

  const project =
    typeof project_code === "string" ? Number(project_code) : project_code;

  const pm = role === "pm" ? (await PmCmNames(role, project_code))?.[0] : "";
  const pd = role === "pd" ? (await PmCmNames(role, project_code))?.[0] : "";

  if (role === "pm" && !definedprojects.includes(project)) {
    throw new Error("No recipients found. Approval flow stopped.");
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

  if (!nextRole) {
    throw new Error(`No next approver found for role: ${role}`);
  }

  let recipients = [];
  if (nextRole !== "pm" && nextRole !== "pd") {
    recipients = await getEmailsByRole(nextRole);
  } else {
    recipients = project ? await getEmailsByProject(project, nextRole) : [];
  }

  const email_flag = roleMap[role] || 0;
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
    let mailAttachments = [];
    if (!SLA) {
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
        filename: filename?.[index] || "",
        path: url,
      }));
      mailAttachments = [...exportedStatementAttachment, ...supportingDocs];
    }

    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: recipients,
      attachments: status == "approved" ? mailAttachments : [],
      subject: `${
        SLA ? "Reminder - Approval Required - " : ""
      }Comparative Statement (Logistics) - ${shipment_no}/${cargo_details}/${
        project ? project + " : " : ""
      }${
        !SLA
          ? nextRole === "initlg"
            ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
            : "Approval Required"
          : ""
      }`,

      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 10px 0;">
          <div style=" color: #333;">
            <p style="margin: 0 0 16px;">Dear User,</p>
            <p style="margin: 0 0 16px; color: #333; font-size: 14px; line-height: 1.6;">
              ${
                status == "approved"
                  ? "This is to inform you that the following document(s) have been Approved."
                  : status == "rejected"
                    ? "This is to inform you that the following document(s) have been Rejected."
                    : status == "review"
                      ? "This is to inform you that the following document(s) have been submitted for review."
                      : `This is to inform you that the following document(s) have been submitted for approval${SLA ? ` on ${date_flag}` + "." : "."}`
              }
            </p>
            <div style="margin: 16px 0; padding: 18px; border-radius: 8px; color: #333; font-size: 14px; line-height: 1.0;">
              <p style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #1e293b;">Document Details</p>
              <ul style="margin: 0; padding-left: 18px; list-style: disc;">
                <li style="margin-bottom: 8px;"><strong>Dept. :</strong> Logistics</li>
                <li style="margin-bottom: 8px;"><strong>Shipment No. :</strong> ${shipment_no}</li>
                <li style="margin-bottom: 8px;"><strong>Doc No. :</strong> ${cs_id}</li>
                ${project ? `<li style="margin-bottom: 8px;"><strong>Project Code :</strong> ${project}</li>` : ""}
                <li style="margin-bottom: 8px;"><strong>Cargo :</strong> ${cargo_details}</li>
                <li style="margin-bottom: 8px;"><strong>${
                  status == "approved"
                    ? "Approved By :"
                    : status == "rejected"
                      ? "Rejected By :"
                      : status == "review"
                        ? "Sent for Reveiew By :"
                        : "Submitted By :"
                }</strong> ${role == "initlg" ? "INITIATOR" : role.toUpperCase()}</li>
                <li style="margin: 0;"><strong>Created Date:</strong> ${formattedDate}</li>
              </ul>
              ${
                status === "approved" && approvedPdfUrl
                  ? `<div>
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
                  ? `The approved document and supporting attachments are included with this email. You can also verify the approved document in our application via this link: <a href="${
                      process.env.ENVIRONMENT === "production"
                        ? `${process.env.PROD_URL}/lstatements/${cs_id}`
                        : `${process.env.DEV_URL}/lstatements/${cs_id}`
                    }" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">Verify and confirm.</a>`
                  : status == "review"
                    ? `You can check the under review document directly in our app via this link: <a href="${
                        process.env.ENVIRONMENT === "production"
                          ? `${process.env.PROD_URL}/lstatements/${cs_id}`
                          : `${process.env.DEV_URL}/lstatements/${cs_id}`
                      }" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">Review and Update.</a>`
                    : status == "rejected"
                      ? `You can check the rejected document via this link: <a href="${
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
            </p>
            <p style="margin: 0 0 16px; color: #555; font-size: 14px; line-height: 1.6;">If you have any questions or require additional information, please contact the concerned department.</p>
            <p style="margin: 24px 0 4px;">Thank you,</p>
            <p style="margin: 0; font-weight: 600;">Software Development Team</p>
            <p style="margin: 0; font-weight: 600;">Galfar Engineering and Contracting WLL Emirates</p>
          </div>
          <div style="background-color: transparent; padding: 2px 6px; font-size: 10px; color: #888; text-align: center; margin-top: 8px;">
            ***This is a system-generated email. Please do not reply to this message.***
          </div>
        </div>
      `,
      ...(SLA && {
        priority: "high",
        headers: {
          "X-Priority": "1",
          "X-MSMail-Priority": "High",
          Importance: "high",
        },
      }),
    };

    const approverdetails = {
      role,
      datetime: new Date(),
      ...(role === "pm" && { pm }),
      ...(role === "pd" && { pd }),
      comments,
    };

    const [emailInfo] = await Promise.all([
      transporter.sendMail(mailOptions),
      emaillogslg(cs_id, email_flag, approverdetails),
    ]);

    return {
      success: true,
      message: "Email sent successfully.",
      emailInfo,
      approvedInfo: approverdetails,
      reminding_role: nextRole,
    };
  } catch (error) {
    throw new Error(error?.message || "Failed to send logistics email.");
  }
};

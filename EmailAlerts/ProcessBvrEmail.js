import nodemailer from "nodemailer";
import { getEmailsByRole } from "../Models/userModel.js";
import { emaillogs } from "../Models/emailModel.js";

export const ProcessBvrEmail = async ({
  id,
  item,
  type,
  status,
  file,
  filename,
  created_at,
  approvedPdfUrl,
  role,
  SLA = false,
  date_flag,
}) => {
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

    const mailAttachments = [...exportedStatementAttachment, ...supportingDocs];

    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: recipients,
      attachments: status == "approved" ? mailAttachments : [],
      subject: SLA
        ? `Reminder - Approval Required | Comparative Statement (BVR) - ${item}`
        : `${
            nextRole === "inita"
              ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
              : status === "review"
                ? "Comparative Statement (BVR) - Under Review"
                : "Comparative Statement (BVR) - Approval Required"
          } : ${item}`,

      html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 10px 0;">
        <div style=" color: #333;">
          <p style="margin: 0 0 16px;">Dear User,</p>
          <p style="margin: 0 0 16px; color: #333; font-size: 14px; line-height: 1.6;">
           ${status == "approved" ? "This is to inform you that the following document(s) have been Approved." : status == "rejected" ? "This is to inform you that the following document(s) have been Rejected." : status == "review" ? "This is to inform you that the following document(s) have been submitted for review." : `This is to inform you that the following document(s) have been submitted for approval${SLA ? ` on ${date_flag}` + "." : "."}`} 
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
      role: role,
      datetime: new Date(),
      status: status,
    };
    const [emailInfo] = await Promise.all([transporter.sendMail(mailOptions)]);

    emaillogs(id, emailInfo, approverdetails);

    return {
      success: true,
      message: "Email sent successfully.",
      emailInfo,
      approvedInfo: approverdetails,
    };
  } catch (error) {
    throw new Error(error?.message || "Failed to send BVR email.");
  }
};

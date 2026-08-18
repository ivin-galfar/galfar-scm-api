import nodemailer from "nodemailer";
import { getEmailsByRole } from "../Models/userModel.js";
import { emaillogs } from "../Models/emailModel.js";
import { fetchoneReceiptFormData, sendemail } from "../Models/receiptmodel.js";
import { mergedPdf } from "../helpers/helperfunctions.js";

export const ProcessHireEmail = async ({
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
  SLA = false,
  date_flag,
}) => {
  const formattedType = type.charAt(0).toUpperCase() + type.slice(1);

  try {
    const cs_exists = await fetchoneReceiptFormData(cs_id);
    if (!cs_exists.formData || Object.keys(cs_exists.formData).length === 0) {
      throw new Error("No recipients found. Approval flow stopped.");
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
      throw new Error(`No next approver found for role: ${role}`);
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

    const mailAttachments = [...exportedStatementAttachment, ...supportingDocs];
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

    if (allArePdf && status.toLowerCase() == "approved") {
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
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: recipients,
      attachments: status.toLowerCase() == "approved" ? emailAttachments : [],
      subject: `Comparative Statement  (${formattedType})- ${
        nextRole === "inith" || nextRole === "inita"
          ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
          : "Approval Required"
      }`,
      html: `
       <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 10px 0;">
         <div style=" color: #333;">
           <p style="margin: 0 0 16px;">Dear User,</p>
           <p style="margin: 0 0 16px; color: #333; font-size: 14px; line-height: 1.6;">
            ${status.toLowerCase() == "approved" ? "This is to inform you that the following document(s) have been Approved. The supporting documents has been merged with the approved statement with this email." : status.toLowerCase() == "rejected" ? "This is to inform you that the following document(s) have been Rejected." : status.toLowerCase() == "review" ? "This is to inform you that the following document(s) have been submitted for review." : `This is to inform you that the following document(s) have been submitted for approval${SLA ? ` on ${date_flag}` + "." : "."}`} 
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
      ...(SLA && {
        priority: "high",
        headers: {
          "X-Priority": "1",
          "X-MSMail-Priority": "High",
          Importance: "high",
        },
      }),
    };

    const [emailInfo] = await Promise.all([
      transporter.sendMail(mailOptions),
      sendemail(cs_id, email_flag),
    ]);

    return {
      success: true,
      message: "Email sent successfully.",
      emailInfo,
    };
  } catch (error) {
    throw new Error(error?.message || "Failed to send Hire/Assets email.");
  }
};

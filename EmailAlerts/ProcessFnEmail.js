import { emaillogsfn } from "../Models/emailModel.js";
import nodemailer from "nodemailer";
import {
  getEmailsByRole,
  getMultipleEmailsByRole,
} from "../Models/userModel.js";

export const ProcessFnEmail = async ({
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
  SLA = false,
  date_flag,
}) => {
  const filenotesubrole =
    type === "file_note" && ["TFW", "General"].includes(category) ? "gm" : "fm";
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
  const isTerminalStatus = ["approved", "rejected", "review"]?.includes(
    status?.toLowerCase(),
  );
  let submitted_by = "";

  if (isTerminalStatus) {
    submitted_by = role ? role.toUpperCase() : "";
  } else if (category == "FWA" || category == "Demob") {
    submitted_by = project_code + "  Project";
  } else {
    // submitted_by = dept_id == 1 ? "P & E Dept." : dept_id;
    submitted_by = role == "initfn" ? "INITIATOR" : role.toUpperCase();
  }
  if (!nextRole) {
    nextRole =
      status === "approved" || status === "rejected" || status === "review"
        ? category != "Demob" && category != "FWA"
          ? "initfn"
          : category == "FWA"
            ? "initdc"
            : "initpr"
        : nextRoleMap[role] || null;
  }

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
          ccemail.push(...(await getMultipleEmailsByRole(["initfn"], dept_id)));
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
          ccemail.push(...(await getMultipleEmailsByRole(["initfn"], dept_id)));
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
      throw new Error(`"No email recipients found, email not sent.`);
    }
  } catch (error) {
    throw new Error(`Failed to fetch recipient emails: ${error.message}`);
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
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: recipients,
      attachments: status == "approved" ? mailAttachments : [],
      cc: ccemail,
      subject: `${
        SLA
          ? `Reminder - Approval Required | ${type === "file_note" ? "File Note" : "IOC"} - ${name}`
          : `${type === "file_note" ? "File Note" : "IOC"} - ${
              nextRole === "initfn" ||
              nextRole === "initpr" ||
              nextRole === "initdc"
                ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
                : status === "review"
                  ? "Under Review"
                  : "Approval Required"
            } : ${name} : ${
              category === "FWA" ? "HWA" : category
            }/${project_code ? project_code + "/" : ""}${doc_no}`
      }`,
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
                  <li style="margin-bottom: 8px;"><strong>Doc No. :</strong> ${doc_no}</li>
                  <li style="margin-bottom: 8px;"><strong>Type :</strong> ${type == "file_note" ? "File Note" : "IOC"}</li>
                  <li style="margin-bottom: 8px;"><strong>Category :</strong> ${category?.toLowerCase() != "fwa" ? category : "HWA"}</li>
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
      status: status,
    };
    const [emailInfo] = await Promise.all([transporter.sendMail(mailOptions)]);

    emaillogsfn(id, emailInfo, approverdetails);
    return {
      success: true,
      message: "Email sent successfully.",
      emailInfo,
      approvedInfo: approverdetails,
    };
  } catch (error) {
    throw new Error(error?.message || "Failed to send logistics email.");
  }
};

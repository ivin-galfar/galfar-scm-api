import nodemailer from "nodemailer";
import {
  getEmailsByProject,
  getEmailsByRole,
  getMultipleEmailsByRole,
} from "../Models/userModel.js";
import { getFleetApprovalRoles } from "../Utils/fleetRequestAuthorization.js";

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const getActorRole = (role) => {
  const roles = Array.isArray(role) ? role : [role];
  const approvalRoles = ["cm", "pm", "pd", "hod", "gm"];
  return (
    roles.map(normalize).find((item) => approvalRoles.includes(item)) ??
    "initiator"
  );
};

const getNextRole = ({ project, role, status }) => {
  const normalizedStatus = normalize(status);
  if (["approved", "rejected", "review"].includes(normalizedStatus)) {
    return "initfr";
  }

  // The status produced by the Fleet Request workflow is authoritative.
  const pendingMatch = normalizedStatus.match(/^pending for\s+(.+)$/);
  if (pendingMatch) return pendingMatch[1].trim();

  const flow = getFleetApprovalRoles(project);

  const actorRole = getActorRole(role);

  const currentIndex = flow.indexOf(actorRole);
  return actorRole === "initiator"
    ? flow[0]
    : currentIndex >= 0
      ? flow[currentIndex + 1] || null
      : null;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export const shouldSendInithIntimation = ({ role, status }) => {
  const nextRole = normalize(status)
    .match(/^pending for\s+(.+)$/)?.[1]
    ?.trim();
  return getActorRole(role) === "pm" && ["hod", "pd"].includes(nextRole);
};

export const buildInithIntimationEmail = ({
  recipients,
  doc_id,
  project,
  location,
  created_at,
  nextRole,
  requestUrl,
  attachments = [],
}) => ({
  to: recipients,
  subject: `Intimation for Fleet Request - PM Approved the document : ${doc_id}`,
  attachments,
  html: `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 10px 0; color: #333;">
      <p style="margin: 0 0 16px;">Dear User,</p>
      <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6;">
        The following Fleet Request has been approved by PM and is now in the ${escapeHtml(nextRole.toUpperCase())} queue. This is an intimation so that you can proactively prepare for the upcoming work.
      </p>
      <div style="margin: 16px 0; padding: 18px; border-radius: 8px; font-size: 14px; line-height: 1.2;">
        <p style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #1e293b;">Document Details</p>
        <ul style="margin: 0; padding-left: 18px;">
          <li style="margin-bottom: 8px;"><strong>Doc No.:</strong> ${escapeHtml(doc_id)}</li>
          <li style="margin-bottom: 8px;"><strong>Project:</strong> ${escapeHtml(project)}</li>
          <li style="margin-bottom: 8px;"><strong>Location:</strong> ${escapeHtml(location)}</li>
          <li style="margin-bottom: 8px;"><strong>Approved By:</strong> PM</li>
          <li style="margin-bottom: 8px;"><strong>Awaiting Approval For:</strong> ${escapeHtml(nextRole.toUpperCase())}</li>
          <li><strong>Created Date:</strong> ${new Date(created_at || Date.now()).toLocaleDateString("en-AE", { timeZone: "Asia/Dubai", year: "numeric", month: "short", day: "2-digit" })}</li>
        </ul>
      </div>
      <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6;">
        You can open the Fleet Request in the application:
        <a href="${requestUrl}" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">View Fleet Request.</a>
      </p>
      <p style="margin: 24px 0 4px;">Thank you,</p>
      <p style="margin: 0; font-weight: 600;">Software Development Team</p>
      <p style="margin: 0; font-weight: 600;">Galfar Engineering and Contracting WLL Emirates</p>
      <div style="padding: 8px 6px; font-size: 10px; color: #888; text-align: center; margin-top: 8px;">
        ***This is a system-generated email. Please do not reply to this message.***
      </div>
    </div>
  `,
});

export const ProcessFREmail = async ({
  id,
  role,
  dept_id,
  project,
  doc_id,
  created_at,
  location,
  status,
  exportedStatementAttachment,
}) => {
  const normalizedStatus = normalize(status);

  if (!id || !project || !doc_id || !normalizedStatus) {
    throw new Error("id, project, doc_id and status are required.");
  }

  const nextRole = getNextRole({ project, role, status: normalizedStatus });

  if (!nextRole) throw new Error("No next Fleet Request approver found.");

  let recipients;
  let ccemail = [];
  let inithIntimationRecipients = [];
  const sendInithIntimation = shouldSendInithIntimation({
    role,
    status: normalizedStatus,
  });
  try {
    recipients =
      nextRole === "initfr"
        ? await getEmailsByProject(project, nextRole)
        : await getEmailsByRole(nextRole, dept_id, project);

    if (sendInithIntimation) {
      inithIntimationRecipients = await getEmailsByRole(
        "inith",
        dept_id,
        project,
      );
    }

    if (normalizedStatus === "approved") {
      ccemail.push(
        ...(await getMultipleEmailsByRole(
          ["cm", "pm"],
          dept_id,
          false,
          project,
        )),
      );
      ccemail.push(...(await getMultipleEmailsByRole(["hod"], dept_id)));
      ccemail.push(...(await getMultipleEmailsByRole(["inith"], dept_id)));

      const primaryRecipients = new Set(recipients);
      ccemail = [...new Set(ccemail)].filter(
        (email) => email && !primaryRecipients.has(email),
      );
    }
  } catch (error) {
    throw new Error(`Failed to fetch recipient emails: ${error.message}`);
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error(`No email recipients found for role ${nextRole}.`);
  }

  const actorRole = getActorRole(role);
  const isApproved = normalizedStatus === "approved";
  const isReview = normalizedStatus === "review";
  const isRejected = normalizedStatus === "rejected";
  const exportedStatementUrl =
    typeof exportedStatementAttachment === "string"
      ? exportedStatementAttachment.trim()
      : "";
  const exportedStatementFilename = exportedStatementUrl
    ? exportedStatementUrl.split("/").pop().split("?")[0] ||
      "Exported Fleet Request.pdf"
    : null;
  const mailAttachments = exportedStatementAttachment
    ? [
        typeof exportedStatementAttachment === "string"
          ? {
              filename: exportedStatementFilename,
              path: exportedStatementAttachment,
            }
          : exportedStatementAttachment,
      ]
    : [];
  const baseUrl =
    process.env.ENVIRONMENT === "production"
      ? process.env.PROD_URL
      : process.env.DEV_URL;
  const requestUrl = `${baseUrl}/fleetrequest/${id}`;
  const statusLabel = isApproved
    ? "Approved"
    : isRejected
      ? "Rejected"
      : isReview
        ? "Under Review"
        : "Approval Required";
  const actionText = isApproved
    ? "View approved request"
    : isRejected
      ? "Review and create new"
      : isReview
        ? "Review and update"
        : "Review and approve";

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

    const emailInfo = await transporter.sendMail({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: recipients,
      cc: ccemail,
      attachments: isApproved ? mailAttachments : [],
      subject: `Fleet Request - ${statusLabel}: ${doc_id}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 10px 0; color: #333;">
          <p style="margin: 0 0 16px;">Dear User,</p>
          <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6;">
            ${isApproved ? "The following Fleet Request has been approved." : isRejected ? "The following Fleet Request has been rejected." : isReview ? "The following Fleet Request has been submitted for review." : "The following Fleet Request has been submitted for approval."}
          </p>
          <div style="margin: 16px 0; padding: 18px; border-radius: 8px; font-size: 14px; line-height: 1.2;">
            <p style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #1e293b;">Document Details</p>
            <ul style="margin: 0; padding-left: 18px;">
              <li style="margin-bottom: 8px;"><strong>Doc No.:</strong> ${escapeHtml(doc_id)}</li>
              <li style="margin-bottom: 8px;"><strong>Project:</strong> ${escapeHtml(project)}</li>
              <li style="margin-bottom: 8px;"><strong>Location:</strong> ${escapeHtml(location)}</li>
              <li style="margin-bottom: 8px;"><strong>${isApproved ? "Approved By" : isRejected ? "Rejected By" : isReview ? "Sent for Review By" : "Submitted By"}:</strong> ${escapeHtml(actorRole === "initiator" ? "INITIATOR" : actorRole.toUpperCase())}</li>
              <li><strong>Created Date:</strong> ${new Date(created_at || Date.now()).toLocaleDateString("en-AE", { timeZone: "Asia/Dubai", year: "numeric", month: "short", day: "2-digit" })}</li>
            </ul>
            ${
              isApproved && exportedStatementUrl
                ? `<div>
                    <p style="margin: 12px 0; font-size: 14px; line-height: 1.6;">
                      The approved Fleet Request is attached and is also available below.
                    </p>
                    <a href="${exportedStatementUrl}" style="color: #0f4b91; text-decoration: underline; font-weight: 600;">
                      Download approved Fleet Request
                    </a>
                  </div>`
                : ""
            }
          </div>
          <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6;">
            You can open the Fleet Request in the application:
            <a href="${requestUrl}" style="color: #0f4b91; text-decoration: underline; font-weight: 700;">${actionText}.</a>
          </p>
          <p style="margin: 24px 0 4px;">Thank you,</p>
          <p style="margin: 0; font-weight: 600;">Software Development Team</p>
          <p style="margin: 0; font-weight: 600;">Galfar Engineering and Contracting WLL Emirates</p>
          <div style="padding: 8px 6px; font-size: 10px; color: #888; text-align: center; margin-top: 8px;">
            ***This is a system-generated email. Please do not reply to this message.***
          </div>
        </div>
      `,
    });

    let inithIntimationInfo = null;
    if (sendInithIntimation) {
      if (inithIntimationRecipients.length === 0) {
        throw new Error(
          "No email recipients found for PM approval intimation.",
        );
      }

      inithIntimationInfo = await transporter.sendMail({
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        ...buildInithIntimationEmail({
          recipients: inithIntimationRecipients,
          doc_id,
          project,
          location,
          created_at,
          nextRole,
          requestUrl,
          attachments: mailAttachments ?? [],
        }),
      });
    }

    return {
      success: true,
      message: "Email sent successfully.",
      emailInfo,
      inithIntimationInfo,
      approvedInfo: {
        role: actorRole,
        datetime: new Date(),
        status: normalizedStatus,
      },
      reminding_role: nextRole,
    };
  } catch (error) {
    throw new Error(error?.message || "Failed to send Fleet Request email.");
  }
};

import nodemailer from "nodemailer";
import { fetchoneReceiptFormData, sendemail } from "../Models/receiptmodel.js";
import { getEmailsByRole } from "../Models/userModel.js";

export const EmailNotify = async (req, res) => {
  const { projectvalue, hiringname, type } = req.body.formData;
  const { role } = req.body.userInfo;
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
      InitH: 1,
      InitA: 1,
      HOD: 2,
      GM: 3,
      CEO: 4,
    };

    const nextRoleMap = {
      InitH: "HOD",
      InitA: "HOD",
      HOD: "GM",
      GM: "CEO",
    };
    let nextRole = "";
    if (status === "Approved") {
      nextRole = type === "hiring" ? "InitH" : "InitA";
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

    if (nextRole == "InitA" || role == "InitA" || role == "InitH") {
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
      subject: `Comparative Statement - ${
        nextRole === "InitH" || nextRole === "InitA" ? status : "Approval"
      }`,
      html: `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; background-color: #f4f6f8; padding: 40px 0;">
    <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); overflow: hidden;">
      
      <!-- Header -->
      <div style="background-color: #004080; padding: 16px 24px;">
        <h2 style="margin: 0; color: #ffffff; font-size: 20px;">Comparative Statement ${
          nextRole === "InitH" || nextRole === "InitA"
            ? status
            : "Approval Required"
        }</h2>
      </div>

      <!-- Body -->
      <div style="padding: 24px; color: #333;">
        <p style="margin: 0 0 16px;">Dear Sir,</p>
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
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://intranet.galfaremirates.com/receipts/${cs_id}"
             style="background-color: #004080; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
            View Comparative Statement
          </a>
        </div>

        <p style="margin: 0;">Please review and update accordingly at your earliest convenience.</p>
        
        <!-- Signature -->
        <p style="margin: 24px 0 4px;">Thank you,</p>
        <p style="margin: 0; font-weight: 600;">Software Development Team,</p>
        <p style="margin: 0; font-weight: 600;">Galfar Engineering and Contracting WLL Emirates</p>

      </div>

      <!-- Footer -->
      <div style="background-color: #f4f6f8; padding: 12px 24px; font-size: 12px; color: #888; text-align: center;">
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

    return res
      .status(200)
      .json({ success: true, message: "Email sent successfully.", emailInfo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

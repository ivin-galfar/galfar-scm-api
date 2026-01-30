import nodemailer from "nodemailer";
import { getEmailByDept } from "../Models/receiptmodel.js";

export const NewsletterTemplate = async ({
  total,
  rejected,
  approved,
  pending,
  dept,
}) => {
  try {
    let recipients = await getEmailByDept(dept);
    const toList = recipients.map((r) => r.email).join(",");

    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
    const currentMonth = new Date().toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });
    const mailOptions = {
      from: `"Galfar Intranet" <no-reply@galfaremirates.com>`,
      to: toList,
      subject: `Monthly Comparative Statement Statistics - ${currentMonth}  (${dept}) `,
      html: `<!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <title>Receipt Summary</title>
                </head>

                <body style="margin: 0; padding: 0; background-color: #f4f6f8;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td align="center" style="padding: 30px 10px;">
                        <!-- Container -->
                        <table
                            width="600"
                            cellpadding="0"
                            cellspacing="0"
                            style="background-color: #ffffff; border-radius: 8px; overflow: hidden;"
                        >
                            <!-- Header -->
                            <tr>
                            <td
                                style="background-color: #1f2937; padding: 20px; text-align: center;"
                            >
                                <h1 style="color: #ffffff; margin: 0; font-size: 22px;">
                                Comparative Statement - Monthly Status updates
                                </h1>
                                <p style="color: #9ca3af; margin: 5px 0 0; font-size: 14px;">
                                Automated Summary Report
                                </p>
                            </td>
                            </tr>

                            <!-- Body -->
                            <tr>
                            <td style="padding: 30px;">
                                <p style="font-size: 15px; color: #374151; margin-bottom: 20px;">
                                Hello Team,
                                <br />
                                Below is the latest summary of CS Generated for ${dept} department:
                                </p>

                                <!-- Stats -->
                                <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <!-- Total -->
                                    <td
                                    width="33%"
                                    align="center"
                                    style="padding: 15px; background-color: #f9fafb;"
                                    >
                                    <h2 style="margin: 0; color: #111827;">${total}</h2>
                                    <p style="margin: 5px 0 0; color: #6b7280;">
                                        Total Receipts
                                    </p>
                                    </td>

                                    <!-- Approved -->
                                    <td
                                    width="33%"
                                    align="center"
                                    style="padding: 15px; background-color: #ecfdf5;"
                                    >
                                    <h2 style="margin: 0; color: #065f46;">${approved}</h2>
                                    <p style="margin: 5px 0 0; color: #047857;">
                                        Approved
                                    </p>
                                    </td>

                                    <!-- Rejected -->
                                    <td
                                    width="33%"
                                    align="center"
                                    style="padding: 15px; background-color: #fef2f2;"
                                    >
                                    <h2 style="margin: 0; color: #991b1b;">${rejected}</h2>
                                    <p style="margin: 5px 0 0; color: #b91c1c;">
                                        Rejected
                                    </p>
                                    </td>
                                    <td
                                        width="33%"
                                        align="center"
                                        style="padding:15px; background-color:#fffbeb;"
                                        >
                                        <h2 style="margin:0; color:#b45309;">${pending}</h2>
                                        <p style="margin:5px 0 0; color:#92400e;">
                                            Under Approval
                                        </p>
                                        </td>
                                </tr>
                                </table>

                                <!-- Divider -->
                                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />

                                <p style="font-size: 14px; color: #6b7280;">
                                This report is generated automatically at scheduled intervals.
                                Please review the data and take necessary actions if required.
                                </p>
                                <!--[if mso]>
                                        <table align="center" cellpadding="0" cellspacing="0" role="presentation" style="margin:30px auto;">
                                        <tr>
                                        <td align="center"
                                            bgcolor="#004080"
                                            style="padding:12px 24px; font-weight:bold; font-size:16px;">
                                           <a href="${dept == "Plant" ? "https://intranet.galfaremirates.com/dashboard" : "https://intranet.galfaremirates.com/dashboardlg"}"
                                            style="color:#ffffff; text-decoration:none; display:inline-block;">
                                            View Dashboard
                                            </a>
                                        </td>

                                        </tr>
                                    </table>
                                <![endif]-->
                                <!--[if !mso]><!-- -->
                                <!-- CTA -->
                                <div style="text-align: center; margin-top: 30px;">
                                <a
                                    href="${dept == "Plant" ? "https://intranet.galfaremirates.com/dashboard" : "https://intranet.galfaremirates.com/dashboardlg"}"
                                    style="
                                    background-color: #2563eb;
                                    color: #ffffff;
                                    text-decoration: none;
                                    padding: 12px 20px;
                                    border-radius: 5px;
                                    font-size: 14px;
                                    display: inline-block;
                                    "
                                >
                                    View Dashboard
                                </a>
                                </div>
                            <!--<![endif]-->

                            </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                            <td
                                style="
                                background-color: #f9fafb;
                                padding: 15px;
                                text-align: center;
                                font-size: 12px;
                                color: #9ca3af;
                                "
                            >
                                © 2026 Your Company Name. All rights reserved.<br />
                                This is an automated email. Please do not reply.
                            </td>
                            </tr>
                        </table>
                        <!-- End Container -->
                        </td>
                    </tr>
                    </table>
                </body>
                </html>`,
    };
    const emailInfo = await transporter.sendMail(mailOptions);

    return {
      success: true,
      message: "Monthly newsletter sent successfully.",
      emailInfo,
    };
  } catch (error) {
    throw error;
  }
};

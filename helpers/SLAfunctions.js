import { ProcessBvrEmail } from "../EmailAlerts/ProcessBvrEmail.js";
import { ProcessFnEmail } from "../EmailAlerts/ProcessFnEmail.js";
import { ProcessLogisticsEmail } from "../EmailAlerts/ProcessLogisticsEmail.js";
import {
  getStatementEmailTriggerSummary,
  insertStatementEmailTriggerLog,
} from "../Models/SLAEmailTriggerLog.js";
import { formattedDate } from "./helperfunctions.js";

const normalizePendingRole = (status) => {
  if (!status || typeof status !== "string") return null;
  const match = status.match(/pending for\s+(.+)$/i);
  if (!match) return null;

  const pendingRole = match[1].trim().toLowerCase();
  if (pendingRole === "sfm") return "fm";
  return pendingRole;
};

const shouldSendSLAEmail = ({ triggered_count, triggered_at }) => {
  if (!triggered_count || triggered_count === 0) return 0;
  if (!triggered_at) return 0;

  const lastTrigger = new Date(triggered_at);

  if (Number.isNaN(lastTrigger.getTime())) return 0;

  const hoursSinceLastTrigger = (Date.now() - lastTrigger.getTime()) / 3600000;
  return hoursSinceLastTrigger;
};

const buildLogisticsArgs = (statement, slaRole, date_flag) => ({
  status: statement.status,
  project_code: statement.project ?? statement.project_code,
  cargo_details: statement.cargo_details,
  userInfo: { role: slaRole || statement.role || "initlg" },
  shipment_no: statement.shipment_no,
  rejectedby: statement.rejectedby,
  comments:
    statement.comments || statement.comment_init || statement.comment_in || "",
  created_at:
    typeof statement.created_at === "string"
      ? statement.created_at
      : statement.created_at
        ? new Date(statement.created_at)
            .toLocaleDateString("en-GB")
            .replace(/-/g, "/")
        : "",
  approvedPdfUrl: statement.approved_pdf_url || statement.approvedPdfUrl,
  file: statement.file,
  filename: statement.filename,
  role: statement.approver_info?.at(-1)?.role ?? "",
  cs_id: statement.id || statement.cs_id,
  SLA: true,
  date_flag: date_flag,
});

const buildBvrArgs = (statement, slaRole, date_flag) => ({
  id: statement.id,
  item: statement.item,
  type: statement.chosentype,
  status: statement.status,
  file: statement.file,
  filename: statement.filename,
  created_at: statement.created_at,
  approvedPdfUrl: statement.approved_pdf_url || statement.approvedPdfUrl,
  role: statement.approver_info?.at(-1)?.role ?? "",
  SLA: true,
  date_flag: date_flag,
});

const buildFnArgs = (statement, slaRole, date_flag) => ({
  id: statement.id,
  dept_id: statement.department_id ?? statement.dept_id,
  role: statement.approver_info?.at(-1)?.role ?? "",
  is_admin: statement.is_admin || false,
  doc_no: statement.doc_no,
  name: statement.name,
  status: statement.status,
  created_at: statement.created_at,
  project_code: statement.project_code,
  exportedstatement:
    statement.exportedstatement || statement.exportedStatement || null,
  file: statement.file,
  file_name: statement.file_name,
  type: statement.type,
  category: statement.category,
  SLA: true,
  date_flag: date_flag,
});

export const Processslafunctions = async (statements = [], statementType) => {
  if (!Array.isArray(statements)) return [];

  const results = [];

  for (const statement of statements) {
    const statement_id = statement.id || statement.cs_id;
    const statement_type = statementType;
    const lastApprover = statement.approver_info?.at(-1);
    const triggerSummary = await getStatementEmailTriggerSummary({
      statement_id,
      statement_type,
    });

    const SLAhours = shouldSendSLAEmail(triggerSummary);
    const last_approved_date =
      lastApprover?.datetime ?? lastApprover?.date ?? "";
    const date_flag = formattedDate(last_approved_date);

    if (SLAhours !== 0 && SLAhours <= 48) {
      results.push({
        statement_id,
        statement_type,
        skipped: true,
        reason: "Not eligible for Approval Pending Reminder",
      });
      continue;
    }

    const slaRole = normalizePendingRole(statement.status);
    let emailResult = null;
    let triggerStatus = "failed";
    let triggerNumber = triggerSummary.triggered_count + 1;

    try {
      if (statementType === "logistics") {
        emailResult = await ProcessLogisticsEmail(
          buildLogisticsArgs(statement, slaRole, date_flag),
        );
      } else if (statementType === "buyvsrent") {
        emailResult = await ProcessBvrEmail(
          buildBvrArgs(statement, slaRole, date_flag),
        );
      } else if (statementType === "filenote") {
        emailResult = await ProcessFnEmail(
          buildFnArgs(statement, slaRole, date_flag),
        );
      } else {
        continue;
      }

      triggerStatus = "sent";
    } catch (error) {
      emailResult = {
        success: false,
        message: error.message || "SLA email send failed.",
      };
    }

    await insertStatementEmailTriggerLog({
      statement_id,
      statement_type,
      trigger_time: new Date(),
      trigger_number: triggerNumber,
      status: triggerStatus,
      email_sent: triggerStatus === "sent",
      document_id: statement.id || statement.cs_id,
      document_type:
        statementType === "filenote"
          ? statementType
          : statementType === "buyvsrent"
            ? "buyvsrent"
            : statementType === "logistics"
              ? "logistics"
              : statementType,
      document_category:
        statementType === "filenote" ? statement.category : "N/A",
      log_info: emailResult,
      last_approved: last_approved_date,
      dept:
        statementType !== "filenote" && statementType !== "buyvsrent"
          ? "Logistics"
          : "Plant",
      SLAhours: SLAhours,
    });

    results.push({
      statement_id,
      statement_type,
      trigger_status: triggerStatus,
      trigger_number: triggerNumber,
      result: emailResult,
    });
  }

  return results;
};

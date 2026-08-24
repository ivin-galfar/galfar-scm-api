import { ProcessBvrEmail } from "../EmailAlerts/ProcessBvrEmail.js";
import { ProcessFnEmail } from "../EmailAlerts/ProcessFnEmail.js";
import { ProcessHireEmail } from "../EmailAlerts/ProcessHireEmail.js";
import { ProcessLogisticsEmail } from "../EmailAlerts/ProcessLogisticsEmail.js";
import {
  getStatementEmailTriggerSummary,
  insertStatementEmailTriggerLog,
} from "../Models/SLAEmailTriggerLog.js";
import { formattedDate } from "./helperfunctions.js";

const shouldSendSLAEmail = ({ triggered_count, triggered_at }) => {
  if (!triggered_count || triggered_count === 0) return 0;
  if (!triggered_at) return 0;

  const lastTrigger = new Date(triggered_at);

  if (Number.isNaN(lastTrigger.getTime())) return 0;

  const hoursSinceLastTrigger = (Date.now() - lastTrigger.getTime()) / 3600000;
  return hoursSinceLastTrigger;
};

const buildLogisticsArgs = (statement, date_flag, triggerNumber) => ({
  status: statement.status,
  project_code: statement.project ?? statement.project_code,
  cargo_details: statement.cargo_details,
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
  triggerNumber,
});

const buildBvrArgs = (statement, date_flag, triggerNumber) => ({
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
  triggerNumber,
});

const buildFnArgs = (statement, date_flag, triggerNumber) => ({
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
  triggerNumber,
});

const buildHireAssetArgs = (statement, date_flag, triggerNumber) => ({
  cs_id: statement.id,
  hiringname: statement.hiringname,
  projectvalue: statement.projectvalue,
  date: statement.dateValue,
  role: statement.approver_info?.at(-1)?.role ?? "",
  doc_no: statement.doc_no,
  status: statement.status,
  dept: "plant",
  created_at: statement.created_at,
  project_code: statement.projectvalue,
  exportedstatement:
    statement.exportedstatement || statement.exportedStatement || null,
  file: statement.file,
  filename: statement.filename,
  type: statement.type,
  SLA: true,
  date_flag: date_flag,
  triggerNumber,
});

export const Processslafunctions = async (statements = [], statementType) => {
  if (!Array.isArray(statements)) return [];

  const results = [];

  for (const statement of statements) {
    const statement_id = statement.id || statement.cs_id;
    const statement_type = statement.type || statementType;
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

    let emailResult = null;
    let triggerStatus = "failed";
    let triggerNumber = triggerSummary.triggered_count + 1;

    try {
      if (statementType === "logistics") {
        emailResult = await ProcessLogisticsEmail(
          buildLogisticsArgs(statement, date_flag, triggerNumber),
        );
      } else if (statementType === "buyvsrent") {
        emailResult = await ProcessBvrEmail(
          buildBvrArgs(statement, date_flag, triggerNumber),
        );
      } else if (statementType === "filenote") {
        emailResult = await ProcessFnEmail(
          buildFnArgs(statement, date_flag, triggerNumber),
        );
      } else if (statementType === "hiringasset") {
        emailResult = await ProcessHireEmail(
          buildHireAssetArgs(statement, date_flag, triggerNumber),
        );
      } else {
        continue;
      }

      triggerStatus = "sent";
    } catch (error) {
      emailResult = {
        success: false,
        message: error || "SLA email send failed.",
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
      document_type: statement.type || statementType || "N/A",
      document_category:
        statementType === "filenote" ? statement.category : "N/A",
      log_info: emailResult,
      last_approved: last_approved_date,
      dept:
        statementType !== "filenote" &&
        statementType !== "buyvsrent" &&
        statementType !== "hiringasset"
          ? "Logistics"
          : "Plant",
      SLAhours: SLAhours,
      role: emailResult?.reminding_role,
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

export const parseApproverInfo = (approverInfo) => {
  if (!approverInfo) return [];
  if (typeof approverInfo === "string") {
    try {
      return JSON.parse(approverInfo);
    } catch (error) {
      return [];
    }
  }
  if (Array.isArray(approverInfo)) return approverInfo;
  return [];
};

export const getLatestApprovalEntry = (id, approverInfo) => {
  const entries = parseApproverInfo(approverInfo);

  return entries
    .map((entry) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        (!entry.datetime && !entry.date)
      )
        return null;
      const date = new Date(entry.datetime || entry.date);
      if (Number.isNaN(date.getTime())) return null;
      return { ...entry, datetime: date };
    })
    .filter(Boolean)
    .reduce((latest, entry, index) => {
      if (!latest) {
        return entry;
      }

      if (entry.datetime > latest.datetime) {
        return entry;
      }

      return latest;
    }, null);
};

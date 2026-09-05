import pool from "../Config/db.js";
import { getLatestApprovalEntry } from "../helpers/SLAfunctions.js";

const createResultRecord = (
  record,
  latestEntry,
  now,
  thresholdMs,
  withinThreshold,
) => {
  if (!latestEntry) return null;
  const ageMs = now - latestEntry.datetime;
  if (ageMs < 0) return null;

  const isWithinThreshold = ageMs <= thresholdMs;

  if (withinThreshold !== isWithinThreshold) return null;

  return {
    ...record,
    last_approval_datetime: latestEntry.datetime.toISOString(),
    last_approval_age_hours: Number((ageMs / 3600000).toFixed(2)),
    last_approval_role: latestEntry.role ?? null,
    last_approval_comments: latestEntry.comments ?? null,
  };
};

export const fetchPendingApprovalsBySLA = async ({
  hours,
  withinThreshold = false,
  includeDeleted = false,
} = {}) => {
  const thresholdMs = hours * 60 * 60 * 1000;
  const now = new Date();
  const baseFilter = includeDeleted ? "" : " WHERE deleted = 0";
  const pendingFilter = `${baseFilter}${baseFilter ? " AND" : " WHERE"} status IS NOT NULL AND status LIKE 'pending%'`;
  const pendingHireAssetFilter = `${baseFilter}${baseFilter ? " AND" : " WHERE"} r.status IS NOT NULL AND r.status LIKE 'Pending%'`;

  try {
    const [logResult, buyRentResult, fileNoteResult, hireAssetResult] =
      await Promise.all([
        pool.query(
          `SELECT * FROM log_statements${pendingFilter} ORDER BY created_at DESC LIMIT 70`,
        ),
        pool.query(
          `SELECT * FROM buy_rent_statements${pendingFilter} ORDER BY created_at DESC LIMIT 70`,
        ),
        pool.query(
          `SELECT * FROM file_note${pendingFilter} ORDER BY created_at DESC LIMIT 70`,
        ),
        pool.query(
          `SELECT r.*,COALESCE(
          json_agg(
          json_build_object(
		      'role', a.role,
            'comments', a.comments,
            'date',a.timestamp )
            ) FILTER (WHERE a.id IS NOT NULL),
            '[]'
          ) AS approver_info  FROM receipts r LEFT JOIN approverdetails a on r.id = a.cs_id  ${pendingHireAssetFilter} GROUP by r.id ORDER BY r.created_at DESC LIMIT 70 `,
        ),
      ]);

    const processRows = (rows) =>
      rows
        .map((row) => {
          const latestEntry = getLatestApprovalEntry(row.id, row.approver_info);

          const result = createResultRecord(
            row,
            latestEntry,
            now,
            thresholdMs,
            withinThreshold,
          );

          if (!result) return null;

          result.last_approval_exceeded =
            result.last_approval_age_hours > hours;
          if (!result.last_approval_exceeded) return null;

          return result;
        })
        .filter(Boolean);

    return {
      logStatements: processRows(logResult.rows),
      buyRentStatements: processRows(buyRentResult.rows),
      fileNotes: processRows(fileNoteResult.rows),
      hireAsset: processRows(hireAssetResult.rows),
    };
  } catch (error) {
    throw new Error(`fetchPendingApprovalsBySLA failed: ${error.message}`);
  }
};

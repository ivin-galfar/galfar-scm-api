import assert from "node:assert/strict";
import test from "node:test";
import pool from "../Config/db.js";
import { fetchPendingApprovalsBySLA } from "../Models/PendingStatementApprovals.js";

test("SLA pending approvals include overdue Fleet Requests", async () => {
  const originalQuery = pool.query;
  const executedQueries = [];
  const approvalDate = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  pool.query = async (query) => {
    executedQueries.push(query);
    if (query.includes("FROM fleet_request")) {
      return {
        rows: [
          {
            id: 71,
            doc_id: "FR-71",
            status: "pending for gm",
            approver_info: [{ role: "hod", datetime: approvalDate }],
          },
        ],
      };
    }
    return { rows: [] };
  };

  try {
    const result = await fetchPendingApprovalsBySLA({ hours: 48 });

    assert.equal(result.fleetRequests.length, 1);
    assert.equal(result.fleetRequests[0].id, 71);
    assert.match(result.fleetRequests[0].status, /^pending/i);
    assert.ok(
      executedQueries.some((query) =>
        query.includes("FROM fleet_request WHERE deleted = 0 AND status IS NOT NULL AND status LIKE 'pending%'")
      ),
    );
  } finally {
    pool.query = originalQuery;
  }
});

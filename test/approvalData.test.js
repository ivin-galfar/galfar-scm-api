import assert from "node:assert/strict";
import test from "node:test";
import pool from "../Config/db.js";
import { getOverallStatementsCount } from "../Models/approvalData.js";

test("overall statement count ignores user filters and excludes deleted rows", async () => {
  const originalQuery = pool.query;
  let executedQuery;
  pool.query = async (query) => {
    executedQuery = query;
    return { rows: [{ total: "42" }] };
  };

  try {
    assert.equal(await getOverallStatementsCount(), 42);
    assert.match(executedQuery, /receipts WHERE deleted = 0/);
    assert.match(executedQuery, /log_statements WHERE deleted = 0/);
    assert.match(executedQuery, /file_note WHERE deleted = 0/);
    assert.match(executedQuery, /buy_rent_statements WHERE deleted = 0/);
    assert.match(executedQuery, /fleet_request WHERE deleted = 0/);
    assert.doesNotMatch(executedQuery, /project|department|role/i);
  } finally {
    pool.query = originalQuery;
  }
});

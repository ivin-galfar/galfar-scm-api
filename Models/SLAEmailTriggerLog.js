import pool from "../Config/db.js";

export const getStatementEmailTriggerSummary = async ({
  statement_id,
  statement_type,
}) => {
  try {
    const { rows } = await pool.query(
      `SELECT triggered_count,triggered_at
       FROM statement_email_trigger_log
       WHERE document_id = $1 AND document_type = $2 AND email_sent = true`,
      [statement_id, statement_type],
    );

    return rows[0] || { triggered_count: 0, triggered_at: null };
  } catch (error) {
    throw new Error(`getStatementEmailTriggerSummary failed: ${error.message}`);
  }
};

export const insertStatementEmailTriggerLog = async ({
  trigger_time,
  trigger_number,
  status,
  email_sent,
  document_id,
  document_type,
  document_category,
  log_info,
  dept,
  last_approved,
  SLAhours,
  role,
}) => {
  try {
    // Check if a record for this document (id/type/category) already exists
    const { rows: existing } = await pool.query(
      `SELECT id FROM statement_email_trigger_log
       WHERE document_id = $1 AND document_type = $2 AND document_category = $3
       LIMIT 1`,
      [document_id, document_type, document_category],
    );

    if (existing.length) {
      // Update existing record: increment triggered_count, set latest triggered_at and append/update log_info
      const { rows } = await pool.query(
        `UPDATE statement_email_trigger_log
         SET triggered_count = $1,
             triggered_at = $2,
              log_info = CASE
              WHEN log_info IS NULL THEN jsonb_build_array($3::jsonb)
              ELSE log_info || jsonb_build_array($3::jsonb)  END,
             status = $4,
             email_sent = $5,
             department = $6,
             last_approved_at=$7,
             age_hours = $8
         WHERE id = $9
         RETURNING *`,
        [
          trigger_number,
          trigger_time,
          JSON.stringify(log_info),
          status,
          email_sent,
          dept,
          last_approved,
          SLAhours,
          existing[0].id,
        ],
      );

      return rows[0];
    }

    // No existing record -> insert a new one
    const { rows } = await pool.query(
      `INSERT INTO statement_email_trigger_log
        (document_id, department,last_approved_at,triggered_at, triggered_count, status, email_sent, document_type, document_category, log_info,age_hours,role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,$10,$11,$12) `,
      [
        document_id,
        dept,
        last_approved,
        trigger_time,
        trigger_number,
        status,
        email_sent,
        document_type,
        document_category,
        JSON.stringify(log_info),
        SLAhours,
        role,
      ],
    );

    return rows[0];
  } catch (error) {
    throw new Error(`insertStatementEmailTriggerLog failed: ${error.message}`);
  }
};

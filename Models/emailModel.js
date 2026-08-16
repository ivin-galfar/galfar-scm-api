import pool from "../Config/db.js";

export const emaillogs = async (cs_id, emailInfo, approverdetails) => {
  try {
    await pool.query(
      "Update buy_rent_statements set sent_email = COALESCE(sent_email, '{}'::text[]) || $1::text[], email_info = COALESCE(email_info, '[]'::jsonb) || $2::jsonb,logs = $3 WHERE id = $4",
      [emailInfo.accepted, approverdetails, emailInfo, cs_id],
    );
  } catch (error) {
    throw error;
  }
};

export const emaillogsfn = async (id, emailInfo, approverdetails) => {
  try {
    await pool.query(
      "Update file_note set sent_email = COALESCE(sent_email, '{}'::text[]) || $1::text[], email_info = COALESCE(email_info, '[]'::jsonb) || $2::jsonb,logs = $3 WHERE id = $4",
      [emailInfo.accepted, approverdetails, emailInfo, id],
    );
  } catch (error) {
    throw error;
  }
};

export const emaillogslg = async (cs_id, email_for, approverdetails) => {
  try {
    await pool.query(
      "Update log_statements set email_sent = $1, email_info = COALESCE(email_info, '[]'::jsonb) || $2::jsonb WHERE id = $3",
      [email_for, approverdetails, cs_id],
    );
  } catch (error) {
    console.error("Error updating email_sent:", error.message);
    throw error;
  }
};

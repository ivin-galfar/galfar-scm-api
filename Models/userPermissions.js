import pool from "../Config/db.js";

export const addUserPermissions = async (
  statement_role,
  allowed_role,
  accessLevel,
) => {
  const query = `
    INSERT INTO statement_role_permissions
      (statement_role, allowed_role, access_level)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const params = [statement_role, allowed_role, accessLevel];

  try {
    const { rows } = await pool.query(query, params);
    return rows[0];
  } catch (error) {
    throw error;
  }
};
9
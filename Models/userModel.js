import pool from "../Config/db.js";
import { Hashpassword } from "../Utils/Hashpassword.js";

export const addUser = async (
  email,
  password,
  isAdmin,
  role,
  deptcode,
  pr_code,
  createdAt,
) => {
  const hashedPassword = await Hashpassword(password);

  try {
    let query =
      "INSERT INTO users (email,password,is_admin,role,dept_code,pr_code,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *";
    let params = [
      email,
      hashedPassword,
      isAdmin,
      role,
      deptcode,
      pr_code,
      createdAt,
    ];

    const { rows } = await pool.query(query, params);

    return rows[0];
  } catch (error) {
    throw error;
  }
};

export const existing = async (email) => {
  const existing = await pool.query("SELECT * FROM users where email= $1", [
    email,
  ]);

  return existing.rows;
};

export const updatePasswordResetToken = async (
  userId,
  hashedToken,
  expires,
) => {
  const { rows } = await pool.query(
    `UPDATE users
     SET reset_token = $1,
         reset_token_expires = $2
     WHERE id = $3
     RETURNING *`,
    [hashedToken, expires, userId],
  );

  return rows[0];
};

export const getUserByResetToken = async (hashedToken) => {
  const { rows } = await pool.query(
    `SELECT id, email, role, dept_code, pr_code, is_admin, is_valid, reset_token_expires, created_at
     FROM users
     WHERE reset_token = $1`,
    [hashedToken],
  );

  return rows[0] || null;
};

export const updatePassword = async (userId, newPassword) => {
  const hashedPassword = await Hashpassword(newPassword);

  const { rows } = await pool.query(
    `UPDATE users
     SET password = $1,
         reset_token = NULL,
         reset_token_expires = NULL,
         password_updated = TRUE
     WHERE id = $2
     RETURNING id, email`,
    [hashedPassword, userId],
  );

  return rows[0] || null;
};

export const getEmailsByRole = async (
  role,
  dept_id,
  project_code,
  is_admin = false,
) => {
  try {
    let values = [role];
    let query = `
    SELECT * 
    FROM users 
    WHERE $1::text = ANY(role)
    AND is_valid = true`;
    let index = 2;

    if (dept_id) {
      query += ` AND $${index} = ANY(dept_code)`;
      values.push(dept_id);
      index++;
    }

    if (is_admin) {
      query += ` AND is_admin = $${index}`;
      values.push(is_admin);
      index++;
    }
    if (
      role == "cm" ||
      role == "pm" ||
      role == "pd" ||
      role == "initpr" ||
      role == "initdc" ||
      role == "view"
    ) {
      if (project_code) {
        query += ` AND $${index} = ANY(pr_code)`;
        values.push(project_code);
        index++;
      }
    }

    const result = await pool.query(query, values);

    return result.rows.map((r) => r.email);
  } catch (error) {
    throw error;
  }
};

export const getMultipleEmailsByRole = async (
  role,
  dept_id,
  is_admin = false,
  project_code,
) => {
  try {
    let values = Array.isArray(role) ? [role] : [[role]];
    const isHod = role.includes("hod");
    let query = `
    SELECT * 
    FROM users 
    WHERE is_valid = true`;
    let index = 2;

    if (dept_id) {
      query += ` AND $${index} = ANY(dept_code)`;
      values.push(dept_id);
      index++;
    }
    if (role.includes("initfn")) {
      query += ` AND ( role && array_remove($1::text[], 'initfn')  OR NOT ($1 @> ARRAY['initfn']) OR is_admin = true)`;
    }

    query += `
      AND (
        'hod' = ANY(role)
        OR (role && $1))`;

    if (isHod) {
      query += ` AND $${index} = ANY(pr_code)`;
      values.push(1);
      index++;
    } else if (project_code == null) {
      query += `
    AND (
      pr_code IS NULL OR pr_code = '{}'
    )`;
    } else {
      query += ` AND $${index} = ANY(pr_code)`;
      values.push(project_code);
      index++;
    }

    if (is_admin) {
      query += ` AND is_admin = $${index}`;
      values.push(is_admin);
      index++;
    }

    const result = await pool.query(query, values);

    return result.rows.map((r) => r.email).filter(Boolean);
  } catch (error) {
    throw error;
  }
};

export const getEmailsByProject = async (project, nextRole) => {
  if (!project) {
    throw new Error("Invalid project provided");
  }
  try {
    const query = `
    SELECT email 
    FROM users 
    WHERE $1 = ANY(pr_code) 
      AND $2::text = ANY(role)
      AND is_valid = true
  `;

    const params = [project, nextRole];
    const result = await pool.query(query, params);

    return result.rows.map((r) => r.email);
  } catch (error) {
    throw error;
  }
};
export const updateDocRead = async (click, email) => {
  try {
    const query = `
      UPDATE users 
      SET isdoc_read = COALESCE(isdoc_read, 0) + 1
      WHERE email = $1
      RETURNING isdoc_read
    `;
    const values = [email];

    const updated = await pool.query(query, values);

    return updated.rows;
  } catch (error) {
    throw error;
  }
};

import pool from "../Config/db.js";
import { Hashpassword } from "../Utils/Hashpassword.js";

export const addUser = async (
  email,
  password,
  isAdmin,
  role,
  deptcode,
  pr_code,
  createdAt
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
    console.log(error);
  }
};

export const existing = async (email) => {
  const existing = await pool.query("SELECT * FROM users where email= $1", [
    email,
  ]);

  return existing.rows;
};
export const getEmailsByRole = async (role) => {
  if (!role || typeof role !== "string") {
    throw new Error("Invalid role provided");
  }
  const query = "SELECT email FROM users WHERE role = $1 AND is_valid = true";
  const params = [role];
  const result = await pool.query(query, params);
  return result.rows.map((r) => r.email);
};

export const getEmailsByProject = async (project) => {
  if (!project) {
    throw new Error("Invalid project provided");
  }
  try {
    const query = "SELECT email from users WHERE $1 = ANY(pr_code)";
    const params = [project];
    const result = await pool.query(query, params);

    return result.rows.map((r) => r.email);
  } catch (error) {
    throw error;
  }
};

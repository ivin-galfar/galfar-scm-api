import pool from "../Config/db.js";
import { Hashpassword } from "../Utils/Hashpassword.js";

export const addUser = async (email, password, isAdmin, role, createdAt) => {
  const hashedPassword = await Hashpassword(password);
  const { rows } = await pool.query(
    "INSERT INTO users (email,password,is_admin,role,created_at) VALUES ($1, $2,$3,$4,$5) RETURNING *",
    [email, hashedPassword, isAdmin, role, createdAt]
  );
  return rows[0];
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
  const query = "SELECT email FROM users WHERE role = $1";
  const params = [role];
  const result = await pool.query(query, params);
  return result.rows.map((r) => r.email);
};

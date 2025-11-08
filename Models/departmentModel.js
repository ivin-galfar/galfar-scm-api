import pool from "../Config/db.js";

export const feedDepartment = async (name) => {
  try {
    const values = [name];
    let query =
      "INSERT INTO departments (department_name) VALUES ($1) RETURNING*";
    const { rows } = await pool.query(query, values);
    return rows;
  } catch (error) {
    console.error("Error adding department:", error.message);
    throw error;
  }
};

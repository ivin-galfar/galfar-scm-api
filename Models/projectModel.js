import pool from "../Config/db.js";

export const projectdetails = async () => {
  try {
    const activeprojects = await pool.query(
      "SELECT * FROM project_users where status ='active'",
    );
    return activeprojects.rows;
  } catch (error) {
    throw error;
  }
};

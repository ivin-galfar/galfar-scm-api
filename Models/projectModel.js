import pool from "../Config/db.js";

export const projectdetails = async () => {
  try {
    const activeprojects = await pool.query(
      "SELECT DISTINCT ON (project) * FROM project_users where status ='active' ORDER BY project",
    );

    return activeprojects.rows;
  } catch (error) {
    throw error;
  }
};

export const InsertProjectdetails = async (
  requiredrole,
  project,
  status,
  name,
  email,
) => {
  try {
    const query =
      "INSERT INTO project_users (role,project,status, name, email) VALUES ($1,$2,$3,$4,$5) RETURNING *";
    const values = [requiredrole, project, status, name, email];

    const { rows } = await pool.query(query, values);

    return rows;
  } catch (error) {
    throw error;
  }
};

export const PmCmNames = async (role, project) => {
  try {
    let query = "SELECT name FROM project_users";
    let whereConditions = [];
    let values = [];
    let paramIndex = 1;
    whereConditions.push("status ='active'");
    if (role) {
      whereConditions.push(`role = $${paramIndex}`);
      values.push(role);
      paramIndex++;
    }

    if (project) {
      whereConditions.push(`project = $${paramIndex}`);
      values.push(project);
      paramIndex++;
    }

    if (whereConditions.length > 0) {
      query += " WHERE " + whereConditions.join(" AND ");
    }
    const activeprojects = await pool.query(query, values);
    return activeprojects.rows?.[0].name;
  } catch (error) {
    throw error;
  }
};

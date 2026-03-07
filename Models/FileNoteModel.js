import pool from "../Config/db.js";

export const insertFileNotes = async ({ name, content, dept_id }) => {
  try {
    const query =
      "INSERT INTO file_note (department_id, name, content,sentforapproval,status) VALUES ($1,$2,$3,$4,$5) RETURNING *";
    const values = [dept_id, name, content, "yes", "created"];
    const { rows } = await pool.query(query, values);
    return rows[0];
  } catch (error) {
    throw error;
  }
};

export const filenote = async (
  module,
  role,
  statusfilter,
  page,
  limit,
  searchcs,
) => {
  try {
    let query = "SELECT * FROM file_note WHERE deleted = 0";
    if (module == "/filenote") {
      query += "limit 50";
    }
    query += " order by id desc";
    const { rows } = await pool.query(query);
    return rows;
  } catch (error) {
    throw error;
  }
};

export const onefilenote = async (id) => {
  try {
    let query = "SELECT * FROM file_note WHERE id =$1 AND deleted = 0";
    let values = [id];

    const { rows } = await pool.query(query, values);
    return rows;
  } catch (error) {
    throw error;
  }
};

export const updatefilenote = async (fnid, sentforapproval, status) => {
  try {
    let query = "UPDATE file_note SET status = $1";
    let values = [status];
    let paramIndex = 2;

    if (sentforapproval !== undefined) {
      query += `, sentforapproval = $${paramIndex}`;
      values.push(sentforapproval);
      paramIndex++;
    }
    query += ` WHERE id = $${paramIndex}`;
    values.push(fnid);

    const { rows } = await pool.query(query, values);
    return rows;
  } catch (error) {
    throw error;
  }
};

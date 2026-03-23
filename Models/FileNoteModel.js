import pool from "../Config/db.js";

export const insertFileNotes = async ({
  name,
  content,
  dept_id,
  type,
  category,
  file_names,
  file_urls,
}) => {
  try {
    const query =
      "INSERT INTO file_note (department_id, name, content,sentforapproval,status,type,category,file,file_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *";
    const values = [
      dept_id,
      name,
      content,
      "yes",
      "created",
      type,
      category,
      file_urls,
      file_names,
    ];

    const { rows } = await pool.query(query, values);

    return rows[0];
  } catch (error) {
    throw error;
  }
};

export const filenote = async (
  module,
  dept_id,
  role,
  isadmin,
  statusfilter,
  page,
  limit,
  searchcs,
) => {
  try {
    let query = "SELECT * FROM file_note";
    let whereConditions = [];
    let values = [];

    if (!isadmin && module == "/filenote") {
      const condition = `
    (status LIKE $${values.length + 1}
     OR status = $${values.length + 2}
     OR status = $${values.length + 3})
  `;

      values.push(`%${role.toLowerCase()}`);
      values.push("approved");
      values.push("rejected");

      whereConditions.push(condition);
    }
    if (isadmin && dept_id) {
      values.push(dept_id);
      whereConditions.push(`department_id = $${values.length}`);
    }
    whereConditions.push(`deleted=0`);
    if (whereConditions.length > 0) {
      query += " WHERE " + whereConditions.join(" AND ");
    }
    query += " order by id desc";

    const { rows } = await pool.query(query, values);

    return rows;
  } catch (error) {
    throw error;
  }
};

export const onefilenote = async (id, isadmin, updatedRoles) => {
  try {
    let query = "SELECT * FROM file_note WHERE id =$1 AND deleted = 0";
    let values = [id];

    if (!isadmin && updatedRoles) {
      query += ` AND (
      status LIKE $${values.length + 1} 
      OR status = $${values.length + 2} 
      OR status = $${values.length + 3}
    )`;
      values.push(`%${updatedRoles.toLowerCase()}%`);
      values.push("approved");
      values.push("rejected");
    }

    const { rows } = await pool.query(query, values);
    return rows;
  } catch (error) {
    throw error;
  }
};

export const updatefilenote = async (
  fnid,
  sentforapproval,
  status,
  role,
  comments,
) => {
  try {
    let query = "UPDATE file_note SET status = $1";
    let values = [status];
    let paramIndex = 2;

    if (status) {
      const approvalData = {
        ...(comments ? { comment: comments } : {}),
        date: new Date().toISOString(),
        role: role[0],
        status: status,
        ...(status === "rejected" && {
          rejectedBy: role[0],
        }),
      };

      query += `, approver_info = COALESCE(approver_info, '[]'::jsonb) || $${paramIndex}::jsonb`;
      values.push(JSON.stringify([approvalData]));
      paramIndex++;
    }

    if (sentforapproval !== undefined) {
      query += `, sentforapproval = $${paramIndex}`;
      values.push(sentforapproval);
      paramIndex++;
    }
    query += ` WHERE id = $${paramIndex} RETURNING *`;
    values.push(fnid);

    const { rows } = await pool.query(query, values);
    return rows[0];
  } catch (error) {
    throw error;
  }
};
export const lastfnid = async (dept_id, category) => {
  try {
    let query =
      "SELECT last_no FROM document_id WHERE dept_id =$1 AND category = $2";
    let values = [dept_id, category];
    const { rows } = await pool.query(query, values);
    if (rows.length === 0) {
      return { last_no: 0 };
    }
    return rows[0];
  } catch (error) {
    throw error;
  }
};

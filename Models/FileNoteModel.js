import pool from "../Config/db.js";

export const insertFileNotes = async ({
  name,
  content,
  dept_id,
  type,
  category,
  file_names,
  file_urls,
  project,
}) => {
  const projectValue = project === "" ? null : parseInt(project, 10);
  try {
    const query =
      "INSERT INTO file_note (department_id, name, content,sentforapproval,status,type,category,file,file_name,project_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *";
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
      projectValue,
    ];

    const { rows } = await pool.query(query, values);
    return rows[0];
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

export const filenote = async (
  module,
  department_id,
  role,
  isadmin,
  project_code,
  statusfilter,
  page,
  limit,
  searchcs,
  count,
) => {
  try {
    // Map role to pending condition
    const ROLE_PENDING_CONDITIONS = {
      ceo: "status = 'pending for ceo'",
      gm: "status = 'pending for gm'",
      hod: "status = 'pending for hod'",
      fm: "status = 'pending for fm'",
      cm: "status = 'pending for cm'",
      initfn: "status LIKE 'pending%'",
    };

    const pendingCondition = ROLE_PENDING_CONDITIONS[role] || "";
    const offset = page * limit;
    const whereConditions = [];
    const values = [];

    // Build base query
    let query = "";
    let last7DaysResult = [];
    if (module === "/") {
      query = `
        SELECT
          COUNT(*) AS total_count,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
          SUM(CASE WHEN ${pendingCondition} THEN 1 ELSE 0 END) AS pending_count,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
          SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) AS review_count
        FROM file_note`;
      let last7DaysQuery = `
            SELECT 
              name,created_at,status
            FROM file_note
            WHERE deleted = 0
            AND created_at >= NOW() - INTERVAL '7 days'
            ORDER BY created_at DESC`;
      const result = await pool.query(last7DaysQuery);
      last7DaysResult = result.rows;
    } else {
      query = count
        ? "SELECT COUNT(*) FROM file_note"
        : "SELECT id,name,doc_no,project_code,type,category,status,department_id,approver_info,created_at FROM file_note";
    }

    // Add access control filter
    if (!isadmin && module === "/filenote") {
      whereConditions.push(
        `(status LIKE $${values.length + 1} OR status = $${values.length + 2} OR status = $${values.length + 3})`,
      );
      values.push(`%${role.toLowerCase()}`, "approved", "rejected");
    }

    // Add department filter
    if (department_id) {
      const filteredDepts =
        role === "hod" ? department_id.filter((d) => d !== 2) : department_id;
      whereConditions.push(`department_id = ANY($${values.length + 1})`);
      values.push(filteredDepts);
    }

    // Always include non-deleted records
    whereConditions.push("deleted = 0");

    // Add category and project filter based on role
    if (["initpr", "cm", "pm"].includes(role)) {
      whereConditions.push(`category = $${values.length + 1}`);
      values.push("Demob");
      whereConditions.push(`project_code = $${values.length + 1}`);
      values.push(Number(project_code));
    } else {
      whereConditions.push(`category != $${values.length + 1}`);
      values.push("Demob");
    }

    // Hide created status for non-admins
    if (!isadmin) {
      whereConditions.push("status != 'created'");
    }

    // Add search filter
    if (searchcs) {
      whereConditions.push(`doc_no::text LIKE $${values.length + 1}`);
      values.push(`%${searchcs}%`);
    }

    // Add status filter for dashboard
    if (module === "/dashboardfn" && statusfilter !== "All") {
      if (statusfilter === "Pending") {
        const pendingPattern = isadmin ? "%pending%" : `%${role.toLowerCase()}`;
        whereConditions.push(`status LIKE $${values.length + 1}`);
        values.push(pendingPattern);
      } else {
        whereConditions.push(`status = $${values.length + 1}`);
        values.push(statusfilter.toLowerCase());
      }
    }

    // Apply WHERE clause
    if (whereConditions.length > 0) {
      query += " WHERE " + whereConditions.join(" AND ");
    }

    // Add sorting
    if (!count && module !== "/") {
      query += " ORDER BY id DESC";
    }

    // Add pagination
    if (!count && module !== "/") {
      if (module === "/dashboardfn") {
        query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);
      } else if (module !== "/filenote") {
        query += " LIMIT 50";
      }
    }

    const { rows } = await pool.query(query, values);

    if (count) {
      return rows[0].count;
    }

    return module === "/" ? { count: rows[0], last7DaysResult } : rows;
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
export const lastfnid = async (dept_id, category, project_code) => {
  try {
    let query =
      "SELECT last_no FROM document_id WHERE dept_id =$1 AND category = $2 ";
    let values = [dept_id, category];

    if (project_code) {
      query += "AND project_code= $3";
      values.push(project_code);
    }

    const { rows } = await pool.query(query, values);
    if (rows.length === 0) {
      return { last_no: 0 };
    }
    return rows[0];
  } catch (error) {
    throw error;
  }
};

export const softdeletefn = async (fnid) => {
  try {
    let query = "Update file_note set deleted = 1 WHERE id = $1";
    let values = [fnid];
    const { rows } = await pool.query(query, values);

    return rows;
  } catch (error) {
    throw error;
  }
};

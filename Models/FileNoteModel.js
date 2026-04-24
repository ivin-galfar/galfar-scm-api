import pool from "../Config/db.js";
import { statusExpected } from "../helpers/plantstatus.js";

export const insertFileNotes = async ({
  name,
  content,
  dept_id,
  type,
  category,
  file_names,
  file_urls,
  project,
  sentforapproval,
}) => {
  const projectValue = project === "" ? null : parseInt(project, 10);
  try {
    const query =
      "INSERT INTO file_note (department_id, name, content,sentforapproval,status,type,category,file,file_name,project_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *";
    const values = [
      dept_id,
      name,
      content,
      sentforapproval,
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
  categoryFilter,
  typeFilter,
) => {
  try {
    // Map role to pending condition
    const ROLE_PENDING_CONDITIONS = {
      ceo: "status = 'pending for ceo'",
      gm: "status = 'pending for gm'",
      hod: "status = 'pending for hod'",
      fm: "status = 'pending for sfm'",
      cm: "status = 'pending for cm'",
      initfn: "status LIKE 'pending%'",
      initpr: "status LIKE 'pending%'",
      initdc: "status LIKE 'pending%'",
      pm: "status LIKE 'pending for pm'",
    };

    const pendingCondition = ROLE_PENDING_CONDITIONS[role[0]] || "";
    const offset = page * limit;
    const whereConditions = [];
    const dashValues = [];
    let values = [];

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
            FROM file_note`;

      const last7DaysConditions = [];
      if (department_id) {
        const filteredDepts = role.includes("hod")
          ? department_id.filter((d) => d !== 2)
          : department_id;
        last7DaysConditions.push(
          `department_id = ANY($${dashValues.length + 1})`,
        );
        dashValues.push(filteredDepts);
      }
      last7DaysConditions.push("deleted = 0");

      if (["initpr"].some((r) => role.includes(r))) {
        last7DaysConditions.push(`category IN ($${dashValues.length + 1})`);
        dashValues.push("Demob");
        last7DaysConditions.push(
          `project_code = ANY($${dashValues.length + 1})`,
        );
        dashValues.push([...project_code].map(Number));
      } else if (["cm", "pm"].some((r) => role.includes(r))) {
        last7DaysConditions.push(
          `category IN ($${dashValues.length + 1}, $${dashValues.length + 2})`,
        );
        dashValues.push("FWA", "Demob");
        last7DaysConditions.push(
          `project_code = ANY($${dashValues.length + 1})`,
        );
        dashValues.push([...project_code].map(Number));
      } else if (["initdc"].some((r) => role.includes(r))) {
        last7DaysConditions.push(`category = $${dashValues.length + 1}`);
        dashValues.push("FWA");
        last7DaysConditions.push(
          `project_code = ANY($${dashValues.length + 1})`,
        );
        dashValues.push([...project_code].map(Number));
      } else {
        last7DaysConditions.push(
          `category NOT IN ($${dashValues.length + 1}, $${dashValues.length + 2})`,
        );
        dashValues.push("FWA", "Demob");
      }

      last7DaysConditions.push("created_at >= NOW() - INTERVAL '7 days'");

      if (last7DaysConditions.length > 0) {
        last7DaysQuery += " WHERE " + last7DaysConditions.join(" AND ");
      }

      const result = await pool.query(last7DaysQuery, dashValues);
      last7DaysResult = result.rows;
    } else {
      query = count
        ? "SELECT COUNT(*) FROM file_note"
        : "SELECT id,name,doc_no,project_code,type,category,status,department_id,approver_info,created_at,file_name FROM file_note";
    }

    // Add access control filter
    if (!isadmin && module === "/filenote") {
      whereConditions.push(
        `(status LIKE $${values.length + 1} OR status = $${values.length + 2} OR status = $${values.length + 3})`,
      );
      values.push(`%${role[0].toLowerCase()}`, "approved", "rejected");
    }

    // Add department filter
    if (department_id) {
      const filteredDepts = role.includes("hod")
        ? department_id.filter((d) => d !== 2)
        : department_id;
      whereConditions.push(`department_id = ANY($${values.length + 1})`);
      values.push(filteredDepts);
    }

    if (categoryFilter) {
      whereConditions.push(`category = ($${values.length + 1})`);
      values.push(categoryFilter);
    }
    if (typeFilter) {
      whereConditions.push(`type = ($${values.length + 1})`);
      values.push(typeFilter);
    }
    // Always include non-deleted records
    whereConditions.push("deleted = 0");

    // Add category and project filter based on role
    if (["initpr"].some((r) => role.includes(r))) {
      whereConditions.push(`category IN ($${values.length + 1})`);
      values.push("Demob");
      whereConditions.push(`project_code = ANY($${values.length + 1})`);
      values.push([...project_code].map(Number));
    } else if (["cm", "pm"].some((r) => role.includes(r))) {
      whereConditions.push(
        `category IN ($${values.length + 1}, $${values.length + 2})`,
      );
      values.push("FWA", "Demob");
      whereConditions.push(`project_code = ANY($${values.length + 1})`);
      values.push([...project_code].map(Number));
    } else if (["initdc"].some((r) => role.includes(r))) {
      whereConditions.push(`category = $${values.length + 1}`);
      values.push("FWA");
      whereConditions.push(`project_code = ANY($${values.length + 1})`);
      values.push([...project_code].map(Number));
    } else if (["gm"].some((r) => role.includes(r))) {
      whereConditions.push(`category NOT IN ($${values.length + 1})`);
      values.push("Demob");
    } else {
      whereConditions.push(
        `category NOT IN ($${values.length + 1}, $${values.length + 2})`,
      );
      values.push("FWA", "Demob");
    }

    // Hide created and review status for non-admins
    if (!isadmin) {
      whereConditions.push("status != 'created' AND status !='edit'");
    }

    // Add search filter
    if (searchcs) {
      whereConditions.push(`doc_no::text LIKE $${values.length + 1}`);
      values.push(`%${searchcs}%`);
    }

    // Add status filter for dashboard
    if (module === "/dashboardfn" && statusfilter !== "All") {
      if (statusfilter === "Pending") {
        const pendingPattern = isadmin
          ? "%pending%"
          : `%${role[0].toLowerCase()}`;
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
  type,
  category,
  action,
  content,
  attachments,
  name,
) => {
  const file = attachments?.map((a) => a.url);
  const file_name = attachments?.map((a) => a.name);

  try {
    let query = "UPDATE file_note SET status = $1";
    let values = [status];
    let paramIndex = 2;

    let currentstatus = "";
    let nextstatus = statusExpected(role, action, type, category);
    if (status != "review" && status != null) {
      if (nextstatus == status && status != "pending for hod") {
        currentstatus = "approved";
      } else if (status == "pending for hod") {
        currentstatus = "created";
      } else if (status == "rejected") {
        currentstatus = "rejected";
      } else {
        currentstatus = status;
      }
    }
    if (status) {
      const approvalData = {
        ...(comments ? { comment: comments } : {}),
        date: new Date().toISOString(),
        role: role[0],
        status: currentstatus,
        ...(status === "rejected" && {
          rejectedBy: role[0],
        }),
      };

      query += `, approver_info = COALESCE(approver_info, '[]'::jsonb) || $${paramIndex}::jsonb`;
      values.push(JSON.stringify([approvalData]));
      paramIndex++;
    }
    if (sentforapproval == null) {
      query += `, sentforapproval = $${paramIndex}`;
      values.push(sentforapproval);
      paramIndex++;
    }

    if (name != null) {
      query += `, name = $${paramIndex}`;
      values.push(name);
      paramIndex++;
    }

    if (sentforapproval !== undefined && sentforapproval !== null) {
      query += `, sentforapproval = $${paramIndex}`;
      values.push(sentforapproval);
      paramIndex++;
    }
    if (content !== undefined) {
      query += `, content = $${paramIndex}`;
      values.push(content);
      paramIndex++;
    }
    if (file !== undefined) {
      query += `, file = $${paramIndex}`;
      values.push(file);
      paramIndex++;
    }

    if (file_name !== undefined) {
      query += `, file_name = $${paramIndex}`;
      values.push(file_name);
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

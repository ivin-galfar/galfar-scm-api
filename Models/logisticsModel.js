import pool from "../Config/db.js";

export const feedlogisticsStatement = async ({ formData, tableData }) => {
  const {
    cargo_details,
    gross_weight,
    chargeable_weight,
    description,
    supplier,
    scopeofwork,
    mode,
    date,
    po,
    project,
    status,
    recommendation_reason,
    selected_vendor_index,
    file,
    filename,
    shipment_no,
    createdby,
  } = formData;
  try {
    let query =
      "INSERT INTO log_statements (cargo_details,gross_weight,chargeable_weight,description,supplier,scopeofwork,mode,date,po,project,status,recommendation_reason,selected_vendor_index,file,filename,shipment_no,createdby) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *";
    let params = [
      cargo_details,
      gross_weight,
      chargeable_weight,
      description,
      supplier,
      scopeofwork,
      mode,
      date,
      po,
      project,
      status,
      recommendation_reason,
      selected_vendor_index,
      file,
      filename,
      shipment_no,
      createdby,
    ];
    const { rows } = await pool.query(query, params);
    const receipts = rows[0];
    const insertedItems = [];

    let formatted = "";
    if (tableData && tableData.length > 0) {
      for (const data of tableData) {
        formatted = data.forwarders;
        if (data.particulars == "DOOR TO DOOR COST") {
          formatted = Object.fromEntries(
            Object.entries(data.forwarders || {}).map(([key, value]) => {
              const currencyMatch = String(value).match(/[A-Za-z]+/);
              const currency = currencyMatch ? currencyMatch[0] : "";

              const cleaned = String(value).replace(/[^\d.-]/g, "");
              const num = Number(cleaned);

              const formattedValue = Number.isFinite(num)
                ? `${currency} ${num.toFixed(2)}`.trim()
                : `${currency} 0.00`.trim();
              return [key, formattedValue];
            }),
          );
        }
        let query =
          "INSERT INTO forwarder_records (cs_id,particulars,forwarders,vendorcol,row_id)  VALUES($1,$2,$3,$4,$5) RETURNING *";
        let params = [
          receipts.id,
          data.particulars,
          formatted,
          Object.values(data.vendorcol),
          data.r_id,
        ];
        const { rows: items } = await pool.query(query, params);
        insertedItems.push(items[0]);
      }
    }

    return { receipts, insertedItems };
  } catch (error) {
    throw error;
  }
};

export const updatelogisticsStatement = async ({
  formData,
  tableData,
  cs_id,
}) => {
  const {
    cargo_details,
    gross_weight,
    chargeable_weight,
    description,
    supplier,
    scopeofwork,
    mode,
    date,
    po,
    project,
    status,
    recommendation_reason,
    selected_vendor_index,
    file,
    filename,
    edited_count,
    shipment_no,
  } = formData;
  try {
    let query =
      "UPDATE log_statements SET cargo_details = $1, gross_weight = $2,chargeable_weight = $3,  description = $4, supplier = $5,    scopeofwork = $6,  mode = $7,  date = $8, po = $9,  project = $10,  status = $11,recommendation_reason = $12, selected_vendor_index = $13, file = $14,  filename = $15, edited_count =$16, shipment_no =$18 WHERE id = $17  RETURNING *";
    let params = [
      cargo_details,
      gross_weight,
      chargeable_weight,
      description,
      supplier,
      scopeofwork,
      mode,
      date,
      po,
      project,
      status,
      recommendation_reason,
      selected_vendor_index,
      file,
      filename,
      edited_count,
      cs_id,
      shipment_no,
    ];
    const { rows } = await pool.query(query, params);
    const receipts = rows[0];
    const updatedItems = [];

    if (tableData && tableData.length > 0) {
      for (const data of tableData) {
        let query =
          "UPDATE forwarder_records SET forwarders=$1,vendorcol=$2 where id=$3 RETURNING * ";
        let params = [data.forwarders, Object.values(data.vendorcol), data.id];
        const { rows: items } = await pool.query(query, params);
        updatedItems.push(items[0]);
      }
    }
    return { receipts, updatedItems };
  } catch (error) {
    throw error;
  }
};

export const fetchformData = async (cs_id) => {
  try {
    let query = "SELECT * FROM log_statements where id =$1 and deleted=0";
    let params = [cs_id];
    const { rows } = await pool.query(query, params);
    return rows[0];
  } catch (error) {
    throw error;
  }
};

export const fetchTableData = async (cs_id) => {
  try {
    let query =
      "SELECT * FROM forwarder_records where cs_id =$1 and deleted=0 ORDER BY id ASC ";
    let params = [cs_id];
    const { rows } = await pool.query(query, params);

    return rows;
  } catch (error) {
    throw error;
  }
};

export const fetchAllCsid = async (module) => {
  try {
    let query =
      "SELECT id,status,project,created_at,cargo_details,createdby FROM log_statements where deleted=0 ORDER BY id Desc";
    if (module?.startsWith("/lstatements")) {
      query += " LIMIT 20";
    }
    if (module?.startsWith("/dashboardlg")) {
      query += " LIMIT 100";
    }
    const { rows } = await pool.query(query);
    return rows;
  } catch (error) {
    throw error;
  }
};

export const fetchtotalstatements = async (
  statusfilter,
  role,
  searchcs,
  emailcron = false,
) => {
  try {
    let query = " SELECT COUNT(*) FROM log_statements where deleted=0";
    let values = [];

    if (statusfilter != "All") {
      if (statusfilter == "Pending") {
        if (emailcron) {
          query += ` AND status LIKE ($${values.length + 1}::text)`;
          values.push(`%pending%`);
        } else {
          if (role != "initlg") {
            query += ` AND status LIKE ($${values.length + 1}::text)`;
            values.push(`%${role.toLowerCase()}`);
          } else {
            query += ` AND status LIKE ($${values.length + 1}::text)`;
            values.push(`%pending%`);
          }
        }
      } else {
        query += ` AND status = ($${values.length + 1})`;
        values.push(statusfilter.toLowerCase());
      }
    }
    if (searchcs) {
      query += ` AND shipment_no::text LIKE ($${values.length + 1})`;
      values.push(`%${searchcs}%`);
    }
    if (role != "initlg") {
      query += ` AND status != 'created' AND status IS NOT NULL`;
    }
    if (emailcron) {
      query += ` AND created_at >= date_trunc('month', CURRENT_DATE)
             AND created_at < date_trunc('month', CURRENT_DATE) + interval '1 month'`;
    }
    const { rows } = await pool.query(query, values);
    return rows[0];
  } catch (error) {
    throw error;
  }
};

export const fetchAllCsidvalues = async (
  statusfilter,
  searchcs,
  page,
  limit,
  role,
) => {
  try {
    const offset = page * limit;

    let values = [];
    let query = "SELECT * FROM log_statements where deleted=0 ";
    if (statusfilter != "All") {
      if (statusfilter == "Pending") {
        if (role != "initlg") {
          query += ` AND status LIKE ($${values.length + 1}::text)`;
          values.push(`%${role.toLowerCase()}`);
        } else {
          query += ` AND status LIKE ($${values.length + 1})`;
          values.push(`%pending%`);
        }
      } else {
        query += ` AND status = ($${values.length + 1})`;
        values.push(statusfilter.toLowerCase());
      }
    }
    if (searchcs) {
      query += ` AND shipment_no::text LIKE ($${values.length + 1})`;
      values.push(`%${searchcs}%`);
    }
    if (role != "initlg") {
      query += ` AND status != 'created' AND status IS NOT NULL`;
    }
    query += ` ORDER BY id Desc LIMIT $${values.length + 1} OFFSET $${
      values.length + 2
    }`;
    values.push(limit, offset);
    const { rows } = await pool.query(query, values);
    return rows;
  } catch (error) {
    throw error;
  }
};

export const updateCSStatus = async (
  cs_id,
  status,
  sentforapproval,
  selectedvendorindex,
  recommendation_reason,
  comments_incharge,
  comments_pm,
  comments_gm,
  comments_fm,
  comments_ceo,
  rejectedby,
  recalled_times,
) => {
  try {
    let query = "UPDATE log_statements SET status = $1";
    const params = [status];
    let paramIndex = 2;

    if (sentforapproval !== undefined) {
      query += `, sentforapproval = $${paramIndex}`;
      params.push(sentforapproval);
      paramIndex++;
    }

    if (recalled_times) {
      query += `, recalled_times = $${paramIndex}`;
      params.push(recalled_times);
      paramIndex++;
    }

    if (selectedvendorindex !== undefined && selectedvendorindex !== null) {
      query += `, selected_vendor_index = $${paramIndex}`;
      params.push(selectedvendorindex);
      paramIndex++;
    }

    if (recommendation_reason !== undefined && recommendation_reason !== null) {
      query += `, recommendation_reason = $${paramIndex}`;
      params.push(recommendation_reason);
      paramIndex++;
    }

    // Comments fields
    if (comments_incharge !== undefined && comments_incharge !== null) {
      query += `, comment_in = $${paramIndex}`;
      params.push(comments_incharge);
      paramIndex++;
    }
    if (comments_pm !== undefined && comments_pm !== null) {
      query += `, comment_pm = $${paramIndex}`;
      params.push(comments_pm);
      paramIndex++;
    }
    if (comments_gm !== undefined && comments_gm !== null) {
      query += `, comment_gm = $${paramIndex}`;
      params.push(comments_gm);
      paramIndex++;
    }
    if (comments_fm !== undefined && comments_fm !== null) {
      query += `, comment_fm = $${paramIndex}`;
      params.push(comments_fm);
      paramIndex++;
    }
    if (comments_ceo !== undefined && comments_ceo !== null) {
      query += `, comment_ceo = $${paramIndex}`;
      params.push(comments_ceo);
      paramIndex++;
    }
    if (status && status.toLowerCase() === "rejected" && rejectedby) {
      query += `, rejectedby = $${paramIndex}`;
      params.push(rejectedby);
      paramIndex++;
    }
    // WHERE clause
    query += ` WHERE id = $${paramIndex}`;
    params.push(cs_id);

    await pool.query(query, params);
  } catch (error) {
    throw error;
  }
};

export const updateDeleteFlag = async (cs_id) => {
  try {
    await pool.query(
      "Update forwarder_records set deleted = 1 WHERE cs_id = $1",
      [cs_id],
    );
    await pool.query("Update log_statements set deleted = 1 WHERE id = $1", [
      cs_id,
    ]);

    return { message: "Statement removed successfully" };
  } catch (error) {
    console.error("Error removing statement:", error);
    throw error;
  }
};
export const sentemail = async (cs_id, email_for, approverdetails) => {
  try {
    await pool.query(
      "Update log_statements set email_sent = $1, approver_info = COALESCE(approver_info, '[]'::jsonb) || $2::jsonb WHERE id = $3",
      [email_for, approverdetails, cs_id],
    );
  } catch (error) {
    console.error("Error updating email_sent:", error.message);
    throw error;
  }
};

export const getappoverdetails = async (cs_id) => {
  try {
    let query =
      "SELECT id,approver_info,project,status,comment_in,comment_pm,comment_gm,comment_fm,comment_ceo,createdby FROM log_statements WHERE id = $1";
    let params = [cs_id];
    const { rows } = await pool.query(query, params);
    return rows[0];
  } catch (error) {
    throw error;
  }
};

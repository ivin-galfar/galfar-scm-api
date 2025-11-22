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

    if (tableData && tableData.length > 0) {
      for (const data of tableData) {
        let query =
          "INSERT INTO forwarder_records (cs_id,particulars,forwarders,vendorcol,row_id)  VALUES($1,$2,$3,$4,$5) RETURNING *";
        let params = [
          receipts.id,
          data.particulars,
          data.forwarders,
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

export const fetchAllCsid = async () => {
  try {
    const { rows } = await pool.query(
      "SELECT id,status,project,created_at,cargo_details FROM log_statements where deleted=0"
    );
    return rows;
  } catch (error) {
    throw error;
  }
};

export const fetchAllCsidvalues = async () => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM log_statements where deleted=0"
    );
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
  rejectedby
) => {
  try {
    let query = "UPDATE log_statements SET status = $1";
    const params = [status];
    let paramIndex = 2;

    if (sentforapproval !== undefined && sentforapproval !== null) {
      query += `, sentforapproval = $${paramIndex}`;
      params.push(sentforapproval);
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
      [cs_id]
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
export const sentemail = async (cs_id, email_for) => {
  try {
    await pool.query(
      "Update log_statements set email_sent = $1 WHERE id = $2",
      [email_for, cs_id]
    );
  } catch (error) {
    console.error("Error updating email_sent:", error.message);
    throw error;
  }
};

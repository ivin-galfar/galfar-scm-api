import pool from "../Config/db.js";

export const feedReceipt = async ({ formData, tableData }) => {
  const {
    hiringname: hiringName,
    datevalue,
    projectvalue,
    locationvalue,
    equipmrnovalue,
    emrefnovalue,
    requireddatevalue,
    requirementdurationvalue: requirementDurationValue,
    type,
    currency,
    file,
    filename,
    qty,
  } = formData;
  const recommendationRow = tableData.find(
    (row) => row.particulars === "Recommendation (If Any)"
  );
  let selectedRecommendation = "";

  if (recommendationRow && recommendationRow.vendors) {
    selectedRecommendation =
      Object.values(recommendationRow.vendors).find(
        (val) => val && val.trim() !== ""
      ) || "";
  }

  const { rows } = await pool.query(
    "INSERT INTO receipts (hiringname,datevalue,projectvalue,locationvalue,equipmrnovalue,emrefnovalue,requireddatevalue,requirementdurationvalue,type,currency,file,filename,qty,selectedvendorreason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *",
    [
      hiringName,
      datevalue,
      projectvalue,
      locationvalue,
      equipmrnovalue,
      emrefnovalue,
      requireddatevalue,
      requirementDurationValue,
      type,
      currency,
      file,
      filename,
      qty,
      selectedRecommendation,
    ]
  );

  const receipt = rows[0];

  const insertedItems = [];
  if (tableData && tableData.length > 0) {
    for (const data of tableData) {
      const { rows: itemRows } = await pool.query(
        "INSERT INTO tableData (receipt_id, sl, particulars, qty, vendors) VALUES ($1, $2, $3, $4, $5)",
        [
          receipt.id,
          data.sl,
          data.particulars,
          formData.qty,
          JSON.stringify(data.vendors),
        ]
      );
      insertedItems.push(itemRows[0]);
    }
  }
  return { receipt, items: insertedItems };
};

export const allReceipts = async () => {
  try {
    const { rows } = await pool.query("SELECT * FROM receipts where deleted=0");
    return rows;
  } catch (error) {
    console.error("Error fetching receipts:", error);
    throw error;
  }
};

export const allTableData = async () => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM tableData where deleted=0"
    );
    return rows;
  } catch (error) {
    console.error("Error fetching receipts:", error);
    throw error;
  }
};

export const fetchoneReceiptFormData = async (cs_id) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM receipts where id = $1 and deleted=0",
      [cs_id]
    );
    return { formData: rows[0] };
  } catch (error) {
    throw error;
  }
};

export const fetchoneReceiptTableData = async (cs_id) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM tabledata where receipt_id = $1 and  deleted=0",
      [cs_id]
    );
    return { tableData: rows };
  } catch (error) {
    throw error;
  }
};

export const updateReceiptStatus = async (
  cs_id,
  selectedVendorIndex,
  selectedVendorReason,
  status
) => {
  try {
    const { rows } = await pool.query(
      "UPDATE receipts SET selectedvendorindex = $1,selectedvendorreason = $2,sentforapproval ='yes',status=$3 where id=$4  RETURNING* ",
      [selectedVendorIndex, selectedVendorReason, status, cs_id]
    );
    return rows;
  } catch (error) {
    throw error;
  }
};

export const AddApprovalStatus = async (
  cs_id,
  action,
  comments,
  role,
  userId,
  status,
  rejectedby,
  approverstatus
) => {
  try {
    const { rows } = await pool.query(
      `INSERT INTO approverdetails 
        (cs_id,user_id,role, action, comments, status, rejectedby, approverstatus, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        cs_id,
        userId,
        role,
        action,
        comments,
        status,
        rejectedby,
        approverstatus,
      ]
    );
    await pool.query("UPDATE receipts SET status=$1 where id=$2", [
      approverstatus,
      cs_id,
    ]);
    return rows;
  } catch (error) {
    console.log(error);
  }
};
export const updatereceipt = async (cs_id, updatedFormData) => {
  try {
    const {
      hiringname,
      datevalue,
      projectvalue,
      locationvalue,
      equipmrnovalue,
      emrefnovalue,
      requireddateValue,
      requirementdurationValue,
      type,
      selectedvendorindex,
      selectedvendorreason,
      qty,
      file,
      filename,
    } = updatedFormData;

    for (const item of updatedFormData.tableData ?? null) {
      await pool.query(
        `UPDATE tabledata
     SET particulars = $1, qty = $2, vendors = $3, updated = NOW()
     WHERE id = $4`,
        [item.particulars, item.qty, JSON.stringify(item.vendors), item.id]
      );
    }

    const { rows: tableData } = await pool.query(
      `SELECT * FROM tabledata WHERE receipt_id = $1 ORDER BY sl`,
      [cs_id]
    );

    const { rows: formData } = await pool.query(
      `UPDATE receipts
       SET
         hiringname = $1,
         datevalue = $2,
         projectvalue = $3,
         locationvalue = $4,
         equipMrNovalue = $5,
         emRefNovalue = $6,
         requireddatevalue = $7,
         requirementdurationvalue = $8,
         type = $9,
         selectedvendorindex = $10,
         selectedvendorreason = $11,
         qty = $13,
         file =$14,
         filename = $15,
         receiptupdated = now()
       WHERE id = $12
       RETURNING *`,
      [
        hiringname,
        datevalue,
        projectvalue,
        locationvalue,
        equipmrnovalue,
        emrefnovalue,
        requireddateValue,
        requirementdurationValue,
        type,
        selectedvendorindex,
        selectedvendorreason,
        cs_id,
        qty,
        file,
        filename,
      ]
    );

    return { formData, tableData };
  } catch (error) {
    console.error("Error updating receipt:", error);
    throw error;
  }
};

export const removeStatement = async (cs_id) => {
  try {
    await pool.query("DELETE FROM tabledata WHERE receipt_id = $1", [cs_id]);

    await pool.query("DELETE FROM receipts WHERE id = $1", [cs_id]);

    return { message: "Statement removed successfully" };
  } catch (error) {
    console.error("Error removing statement:", error);
    throw error;
  }
};

export const updateDeleteFlag = async (cs_id) => {
  try {
    await pool.query("Update tabledata set deleted = 1 WHERE receipt_id = $1", [
      cs_id,
    ]);

    await pool.query("Update receipts set deleted = 1 WHERE id = $1", [cs_id]);

    return { message: "Statement removed successfully" };
  } catch (error) {
    console.error("Error removing statement:", error);
    throw error;
  }
};

export const getApproverDetailsByCSId = async (cs_id) => {
  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM approverdetails
       WHERE cs_id = $1
       ORDER BY timestamp ASC`,
      [cs_id]
    );
    return rows;
  } catch (error) {
    console.error("Error fetching approver details:", error);
    throw error;
  }
};

export const getAllApproverDetails = async () => {
  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM approverdetails
       ORDER BY timestamp ASC`
    );

    return rows;
  } catch (error) {
    console.error("Error fetching approver details:", error);
    throw error;
  }
};

export const sendemail = async (cs_id, email_for) => {
  try {
    await pool.query("Update receipts set email_sent = $1 WHERE id = $2", [
      email_for,
      cs_id,
    ]);
  } catch (error) {
    console.error("Error updating email_sent:", error.message);
    throw error;
  }
};

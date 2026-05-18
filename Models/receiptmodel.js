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
    (row) => row.particulars === "Recommendation (If Any)",
  );
  let selectedRecommendation = "";

  if (recommendationRow && recommendationRow.vendors) {
    selectedRecommendation =
      Object.values(recommendationRow.vendors).find(
        (val) => val && val.trim() !== "",
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
    ],
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
        ],
      );
      insertedItems.push(itemRows[0]);
    }
  }
  return { receipt, items: insertedItems };
};

export const allReceipts = async (
  type,
  module,
  page,
  limit,
  statusfilter,
  multiStatuses,
  searchcsno,
  searchcsname,
  Statuses,
  showInactive,
) => {
  const filterType = type === "null" || type === "" ? null : type;

  let values = [];
  let conditions = [];

  try {
    let query = `
      SELECT DISTINCT ON (r.id)
        r.id,
        r.type,
        r.hiringname,
        r.qty,
        r.status,
        r.sentforapproval,
        r.created_at,
        r.comments_count,
        r.deleted
    `;

    if (module?.startsWith("/dashboard")) {
      query += `
        ,COALESCE(
          json_agg(
            json_build_object(
              'id', ad.id,
              'role', ad.role,
              'comments', ad.comments,
              'timestamp', ad.timestamp,
              'action', ad.action,
              'rejectedby', ad.rejectedby
            )
          ) FILTER (WHERE ad.id IS NOT NULL),
          '[]'
        ) AS approverdetails
      `;
    }

    query += `
      FROM receipts r
      LEFT JOIN approverdetails ad
      ON ad.cs_id = r.id 
    `;

    if (filterType) {
      conditions.push(`r.type = $${values.length + 1}`);
      values.push(filterType);
    }
    if (!showInactive) {
      conditions.push(`deleted = $${values.length + 1}`);
      values.push(0);
    }
    if (module?.startsWith("/dashboard")) {
      const offset = page * limit;
      if (multiStatuses.length > 0) {
        conditions.push(`LOWER(r.status) = ANY($${values.length + 1})`);

        values.push(multiStatuses);
      } else {
        conditions.push(`
          (
            $${values.length + 1}::text[] IS NULL
            OR LOWER(r.status) = ANY($${values.length + 1})
            OR (
              r.status IS NULL
              AND '' = ANY($${values.length + 1})
            )
          )
        `);

        values.push(Statuses);
      }

      if (statusfilter) {
        conditions.push(`r.status = $${values.length + 1}`);
        values.push(statusfilter);
      }

      if (searchcsno) {
        conditions.push(`r.id::text ILIKE $${values.length + 1}`);
        values.push(`%${searchcsno}%`);
      }

      if (searchcsname) {
        conditions.push(`r.hiringname::text ILIKE $${values.length + 1}`);

        values.push(`%${searchcsname}%`);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      query += `
        GROUP BY r.id
        ORDER BY r.id DESC
      `;

      query += `
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
      `;

      values.push(limit, offset);
    } else if (module?.startsWith("/receipts")) {
      conditions.push(`
        (
          $${values.length + 1}::text[] IS NULL
          OR LOWER(r.status) = ANY($${values.length + 1})
          OR (
            r.status IS NULL
            AND '' = ANY($${values.length + 1})
          )
        )
      `);

      values.push(Statuses);

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      query += `
        ORDER BY r.id DESC
        LIMIT 30
      `;
    } else {
      conditions.push(`
          (
            $${values.length + 1}::text[] IS NULL
            OR LOWER(r.status) = ANY($${values.length + 1})
            OR (
              r.status IS NULL
              AND '' = ANY($${values.length + 1})
            )
          )`);
      values.push(Statuses);
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }
      query += `
        GROUP BY r.id
        ORDER BY r.id DESC
      `;
    }

    const { rows } = await pool.query(query, values);

    return rows;
  } catch (error) {
    console.error("Error fetching receipts:", error);
    throw error;
  }
};

export const totalReceipts = async (
  type,
  Statuses,
  statusfilter,
  multiStatusfilter,
  searchcsno,
  searchcsname,
  showInactive,
  emailcron = false,
) => {
  try {
    let query = `SELECT count(*) FROM receipts`;

    let values = [];
    let conditions = [];

    if (type) {
      conditions.push(`type = $${values.length + 1}`);
      values.push(type);
    }

    if (multiStatusfilter.length > 0) {
      conditions.push(`LOWER(status) = ANY($${values.length + 1})`);
      values.push(multiStatusfilter);
    } else {
      let updatedStatus = Statuses?.map((s) => s.trim());

      conditions.push(
        `COALESCE(LOWER(status), '') = ANY($${values.length + 1})`,
      );

      values.push(updatedStatus);
    }

    if (searchcsno) {
      conditions.push(`id::text ILIKE $${values.length + 1}`);
      values.push(`%${searchcsno}%`);
    }

    if (searchcsname) {
      conditions.push(`hiringname::text ILIKE $${values.length + 1}`);
      values.push(`%${searchcsname}%`);
    }

    if (statusfilter) {
      conditions.push(`status = $${values.length + 1}`);
      values.push(statusfilter);
    }
    if (!showInactive) {
      conditions.push(`deleted = $${values.length + 1}`);
      values.push(0);
    }
    if (emailcron) {
      conditions.push(`
        created_at >= date_trunc('month', CURRENT_DATE - interval '1 month')
        AND created_at < date_trunc('month', CURRENT_DATE - interval '1 month') + interval '1 month'
      `);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    const { rows } = await pool.query(query, values);
    return rows[0];
  } catch (error) {
    console.error("Error fetching receipts:", error);
    throw error;
  }
};
export const allTableData = async () => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM tableData where deleted=0 ORDER BY id ASC",
    );
    return rows;
  } catch (error) {
    console.error("Error fetching receipts:", error);
    throw error;
  }
};

export const fetchoneReceiptFormData = async (cs_id) => {
  try {
    const { rows } = await pool.query("SELECT * FROM receipts where id = $1", [
      cs_id,
    ]);
    return { formData: rows[0] };
  } catch (error) {
    throw error;
  }
};

export const fetchoneReceiptTableData = async (cs_id) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM tabledata where receipt_id = $1 ORDER BY id ASC",
      [cs_id],
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
  status,
) => {
  try {
    const { rows } = await pool.query(
      "UPDATE receipts SET selectedvendorindex = $1,selectedvendorreason = $2,sentforapproval ='yes',status=$3 where id=$4  RETURNING* ",
      [selectedVendorIndex, selectedVendorReason, status, cs_id],
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
  approverstatus,
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
      ],
    );
    await pool.query("UPDATE receipts SET status=$1 where id=$2", [
      approverstatus,
      cs_id,
    ]);
    return rows;
  } catch (error) {
    throw error;
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
      requireddatevalue,
      requirementdurationvalue,
      type,
      selectedvendorindex,
      selectedvendorreason,
      qty,
      file,
      filename,
      status,
      sentforapproval,
    } = updatedFormData;

    for (const item of updatedFormData.tableData ?? null) {
      await pool.query(
        `UPDATE tabledata
     SET particulars = $1, qty = $2, vendors = $3, updated = NOW()
     WHERE id = $4`,
        [item.particulars, item.qty, JSON.stringify(item.vendors), item.id],
      );
    }

    const { rows: tableData } = await pool.query(
      `SELECT * FROM tabledata WHERE receipt_id = $1 ORDER BY sl`,
      [cs_id],
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
         status =$16,
         sentforapproval=$17,
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
        requireddatevalue,
        requirementdurationvalue,
        type,
        selectedvendorindex,
        selectedvendorreason,
        cs_id,
        qty,
        file,
        filename,
        status,
        sentforapproval,
      ],
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
      [cs_id],
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
       ORDER BY timestamp ASC`,
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

export const revertrequest = async (cs_id, approvalstatus, status) => {
  try {
    await pool.query(
      "Update receipts set status = $1,sentforapproval=$2  WHERE id = $3",
      [status, approvalstatus, cs_id],
    );
  } catch (error) {
    throw error;
  }
};

export const getEmailByDept = async (dept) => {
  let dept_code = null;
  if (dept.includes("Plant")) {
    dept_code = 1;
  } else if (dept.includes("Logistics")) {
    dept_code = 2;
  }
  try {
    let query = `SELECT email from users WHERE dept_code @> $1::int[] AND is_valid = true`;
    let values = [[dept_code]];
    if (dept.includes("Plant")) {
      query += ` AND role && ARRAY['gm', 'ceo', 'hod', 'inith', 'inita']`;
    }
    const { rows } = await pool.query(query, values);
    return rows;
  } catch (error) {
    throw error;
  }
};

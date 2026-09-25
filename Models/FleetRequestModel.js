import pool from "../Config/db.js";

const stringifyJson = (value, fieldName) => {
  try {
    return typeof value === "string"
      ? JSON.stringify(JSON.parse(value))
      : JSON.stringify(value);
  } catch {
    const error = new Error(`${fieldName} must be valid JSON`);
    error.statusCode = 400;
    throw error;
  }
};

export const InsertFleetRequest = async ({
  project,
  date,
  location,
  status,
  items,
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const fleetRequestResult = await client.query(
      `
        INSERT INTO fleet_request (project, created_date, location,status)
        VALUES ($1, $2, $3,$4)
        RETURNING *
      `,
      [project, date, location, status],
    );
    const fleetRequest = fleetRequestResult.rows[0];

    const insertedItems = [];

    for (const [index, item] of items.entries()) {
      const itemResult = await client.query(
        `
          INSERT INTO fleet_request_items (
            fleet_request_id,
            item_no,
            equipment_description,
            capacity,
            cicpa,
            quantity,
            required_from,
            rental_type,
            duration,
            purpose,
            production_qty_envisaged,
            qty_similar_machines_available,
            utilization,
            remarks
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13,$14
          )
          RETURNING *
        `,
        [
          fleetRequest.id,
          index + 1,
          item.equip_desc,
          item.capacity,
          item.cicpa,
          item.quantity,
          item.required_from,
          item.rental_type,
          item.duration,
          item.purpose,
          item.production_qty_envisaged,
          item.qty_similar_machines,
          item.utilization,
          item.remarks,
        ],
      );

      insertedItems.push(itemResult.rows[0]);
    }

    await client.query("COMMIT");

    return { ...fleetRequest, items: insertedItems };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const UpdateFleetRequest = async (
  id,
  {
    project,
    date,
    location,
    status,
    sentforapproval,
    role,
    approver_info,
    comments,
    items,
    expectedStatus,
  },
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const setClauses = [];
    const values = [];

    const addValue = (column, value, cast = "") => {
      if (value === undefined) return;
      values.push(value);
      setClauses.push(`${column} = $${values.length}${cast}`);
    };

    addValue("project", project);
    addValue("created_date", date);
    addValue("location", location);

    addValue("status", status);
    addValue("sentforapproval", sentforapproval);

    let approvalData = approver_info;
    if (
      approvalData === undefined &&
      (role !== undefined || comments !== undefined)
    ) {
      approvalData = {
        ...(comments !== undefined && { comment: comments }),
        date: new Date().toISOString(),
        ...(role !== undefined && { role }),
        ...(status !== undefined && { status }),
      };
    }

    if (approvalData !== undefined && approvalData !== null) {
      let normalizedApprovalData;
      try {
        normalizedApprovalData =
          typeof approvalData === "string"
            ? JSON.parse(approvalData)
            : approvalData;
      } catch {
        const error = new Error("approver_info must be valid JSON");
        error.statusCode = 400;
        throw error;
      }

      const approvalEntries = Array.isArray(normalizedApprovalData)
        ? normalizedApprovalData
        : [normalizedApprovalData];
      values.push(stringifyJson(approvalEntries, "approver_info"));
      setClauses.push(
        `approver_info = COALESCE(approver_info, '[]'::jsonb) || $${values.length}::jsonb`,
      );
    }

    if (setClauses.length === 0) {
      const error = new Error("At least one field is required for update");
      error.statusCode = 400;
      throw error;
    }

    values.push(id);
    const idParameter = values.length;
    if (expectedStatus !== undefined) values.push(expectedStatus);
    const query = `
    UPDATE fleet_request
    SET ${setClauses.join(", ")}
    WHERE id = $${idParameter}
      ${expectedStatus !== undefined ? `AND LOWER(TRIM(status)) = LOWER(TRIM($${values.length}))` : ""}
    RETURNING *
  `;

    const { rows } = await client.query(query, values);
    if (rows.length === 0) {
      const error = new Error(
        "Fleet Request changed before this action completed. Refresh and try again.",
      );
      error.statusCode = 409;
      throw error;
    }

    let updatedItems;
    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        const error = new Error("items must be a non-empty array");
        error.statusCode = 400;
        throw error;
      }
      await client.query(
        "DELETE FROM fleet_request_items WHERE fleet_request_id = $1",
        [id],
      );
      updatedItems = [];
      for (const [index, item] of items.entries()) {
        const itemResult = await client.query(
          `INSERT INTO fleet_request_items (
            fleet_request_id, item_no, equipment_description, capacity, cicpa,
            quantity, required_from, rental_type, duration, purpose,
            production_qty_envisaged, qty_similar_machines_available, utilization, remarks
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
          [
            id,
            index + 1,
            item.equip_desc ?? item.equipmentDescription,
            item.capacity,
            item.cicpa,
            item.quantity,
            item.required_from ?? item.requiredFrom,
            item.rental_type ?? item.rentalType,
            item.duration,
            item.purpose,
            item.production_qty_envisaged ?? item.productionQtyEnvisaged,
            item.qty_similar_machines ?? item.similarMachinesAvailable,
            item.utilization,
            item.remarks,
          ],
        );
        updatedItems.push(itemResult.rows[0]);
      }
    }

    await client.query("COMMIT");

    return updatedItems ? { ...rows[0], items: updatedItems } : rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

//minimal data for dashboards data
export const FetchFleetRequest = async (project, module, canEdit = false) => {
  const fieldsByModule = {
    equipfr: "id,doc_id",
    frdashboard: "id,doc_id, created_date, project, status",
  };

  const fields = fieldsByModule[module];

  if (!fields) {
    const error = new Error("Invalid module. Use fr or frdashboard");
    error.statusCode = 400;
    throw error;
  }

  const values = [];
  let whereConditions = [];

  let query = `
    SELECT ${fields}
    FROM fleet_request
  `;

  if (!canEdit) {
    whereConditions.push(
      `status IS NOT NULL AND LOWER(TRIM(status)) NOT IN ('created', 'review')`,
    );
  }

  if (project) {
    const projects = String(project)
      .split(",")
      .map((projectCode) => projectCode.trim())
      .filter(Boolean)
      .map(Number);
    if (
      projects.length === 0 ||
      projects.some((projectCode) => !Number.isInteger(projectCode))
    ) {
      const error = new Error(
        "project must contain comma-separated numeric project codes",
      );
      error.statusCode = 400;
      throw error;
    }

    whereConditions.push(`project = ANY($${values.length + 1}::int[])`);
    values.push(projects);
  }

  if (whereConditions.length > 0) {
    query += " WHERE " + whereConditions.join(" AND ");
  }
  query += " ORDER BY created_date DESC";

  const { rows } = await pool.query(query, values);

  return rows;
};

export const FetchFleetRequestVal = async (id) => {
  const fleetRequestResult = await pool.query(
    "SELECT * FROM fleet_request WHERE id = $1",
    [id],
  );

  if (fleetRequestResult.rowCount === 0) {
    return null;
  }

  const itemsResult = await pool.query(
    `
      SELECT *
      FROM fleet_request_items
      WHERE fleet_request_id = $1
      ORDER BY item_no ASC
    `,
    [id],
  );

  return {
    ...fleetRequestResult.rows[0],
    items: itemsResult.rows,
  };
};

export const FetchRequestDoc = async (project) => {
  try {
    let query =
      "SELECT last_id,formatted_doc_id FROM doc_id_fl_req where project = $1";
    let values = [project];
    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return { last_id: 0 };
    }
    return rows[0];
  } catch (error) {
    throw error;
  }
};

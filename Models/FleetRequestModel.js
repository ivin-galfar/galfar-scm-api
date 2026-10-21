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
        INSERT INTO fleet_request (project, created_at, location,status)
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
            fleet_description,
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
            adnoc_fitments,
            tpi,
            remarks
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13, $14, $15, $16
          )
          RETURNING *
        `,
        [
          fleetRequest.id,
          index + 1,
          item.fleet_description,
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
          item.adnoc_fitments,
          item.tpi,
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
    allocationUpdates,
    expectedStatus,
    deleted,
    action_taken,
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
    addValue("created_at", date);
    addValue("location", location);

    addValue("status", status);
    addValue("sentforapproval", sentforapproval);
    addValue("deleted", deleted);
    addValue("action_taken", action_taken);

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
      updatedItems = [];
      for (const [index, item] of items.entries()) {
        const itemResult = await client.query(
          `INSERT INTO fleet_request_items (
            fleet_request_id, item_no, fleet_description, capacity, cicpa,
            quantity, required_from, rental_type, duration, purpose,
            production_qty_envisaged, qty_similar_machines_available, utilization,
            adnoc_fitments, tpi, remarks
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
          ON CONFLICT (fleet_request_id, item_no) DO UPDATE SET
            fleet_description = EXCLUDED.fleet_description,
            capacity = EXCLUDED.capacity,
            cicpa = EXCLUDED.cicpa,
            quantity = EXCLUDED.quantity,
            required_from = EXCLUDED.required_from,
            rental_type = EXCLUDED.rental_type,
            duration = EXCLUDED.duration,
            purpose = EXCLUDED.purpose,
            production_qty_envisaged = EXCLUDED.production_qty_envisaged,
            qty_similar_machines_available = EXCLUDED.qty_similar_machines_available,
            utilization = EXCLUDED.utilization,
            adnoc_fitments = EXCLUDED.adnoc_fitments,
            tpi = EXCLUDED.tpi,
            remarks = EXCLUDED.remarks
          RETURNING *`,
          [
            id,
            index + 1,
            item.fleetDescription,
            item.capacity,
            item.cicpa,
            item.quantity,
            item.requiredFrom,
            item.rentalType,
            item.duration,
            item.purpose,
            item.productionQtyEnvisaged,
            item.similarMachinesAvailable,
            item.utilization,
            item.adnocFitments,
            item.tpi,
            item.remarks,
          ],
        );
        updatedItems.push(itemResult.rows[0]);
      }

      await client.query(
        "DELETE FROM fleet_request_items WHERE fleet_request_id = $1 AND item_no > $2",
        [id, items.length],
      );
    }

    if (allocationUpdates !== undefined) {
      if (!Array.isArray(allocationUpdates) || allocationUpdates.length === 0) {
        const error = new Error("allocation updates must be a non-empty array");
        error.statusCode = 400;
        throw error;
      }
      for (const allocation of allocationUpdates) {
        const rawItemId = allocation.id ?? null;
        const itemId = Number(rawItemId);
        const itemNo = Number(allocation.item_no);
        const allocationType = allocation.allocation_type ?? null;
        if (
          (!Number.isInteger(itemId) && !Number.isInteger(itemNo)) ||
          typeof allocationType !== "string"
        ) {
          const error = new Error(
            "Each allocation update requires an item identifier and allocation_type",
          );
          error.statusCode = 400;
          throw error;
        }
        const useItemId = rawItemId !== undefined && Number.isInteger(itemId);

        let allocationquery = `UPDATE fleet_request_items
           SET allocation_type = $3
           WHERE fleet_request_id = $1 AND ${useItemId ? "id = $2" : "item_no = $2"}
           RETURNING *`;
        let allocationvalues = [
          id,
          useItemId ? itemId : itemNo,
          allocationType,
        ];

        const itemResult = await client.query(
          allocationquery,
          allocationvalues,
        );
        if (itemResult.rowCount === 0) {
          const error = new Error(
            "Fleet Request item not found for allocation update",
          );
          error.statusCode = 404;
          throw error;
        }
      }
    }

    await client.query("COMMIT");

    if (updatedItems || allocationUpdates !== undefined) {
      const refreshedItems = await client.query(
        "SELECT * FROM fleet_request_items WHERE fleet_request_id = $1 ORDER BY item_no ASC",
        [id],
      );

      return { ...rows[0], items: updatedItems ?? refreshedItems.rows };
    }
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const UpdateFleetRequestItemRefNo = async (requestId, itemId, refNo) => {
  const { rows } = await pool.query(
    `
      UPDATE fleet_request_items AS item
      SET ref_no = $3
      FROM fleet_request AS request
      WHERE item.id = $2
        AND item.fleet_request_id = request.id
        AND request.id = $1
      RETURNING item.id, item.item_no, item.ref_no
    `,
    [requestId, itemId, refNo],
  );

  return rows[0] ?? null;
};

//minimal data for dashboards data
export const FetchFleetRequest = async (
  project,
  module,
  canEdit = false,
  page = 0,
  limit = 10,
  statusfilter = "All",
  userRoles = [],
  canViewAllPending = false,
) => {
  const fieldsByModule = {
    fleetrequest: "id,doc_id,project",
    frdashboard:
      "id,doc_id,location, created_at, project, status, approver_info, action_taken",
  };

  const fields = fieldsByModule[module];

  if (!fields) {
    const error = new Error("Invalid module. Use fleetrequest or frdashboard");
    error.statusCode = 400;
    throw error;
  }

  const normalizedPage = Number(page);
  const normalizedLimit = Number(limit);
  if (
    module === "frdashboard" &&
    (!Number.isInteger(normalizedPage) ||
      normalizedPage < 0 ||
      !Number.isInteger(normalizedLimit) ||
      normalizedLimit < 1)
  ) {
    const error = new Error(
      "page must be a non-negative integer and limit must be a positive integer",
    );
    error.statusCode = 400;
    throw error;
  }

  const values = [];
  const whereConditions = ["deleted = 0"];

  let query = `
    SELECT ${fields}
    FROM fleet_request
  `;

  if (!canEdit) {
    whereConditions.push(
      `status IS NOT NULL AND LOWER(TRIM(status)) NOT IN ('created', 'review', 'recalled')`,
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

  const normalizedStatusFilter = String(statusfilter ?? "All")
    .trim()
    .toLowerCase();

  if (
    module === "frdashboard" &&
    normalizedStatusFilter &&
    normalizedStatusFilter !== "all"
  ) {
    if (normalizedStatusFilter === "pending") {
      if (canViewAllPending) {
        whereConditions.push(`LOWER(TRIM(status)) LIKE $${values.length + 1}`);
        values.push("pending for %");
      } else {
        const pendingStatuses = userRoles.map(
          (role) => `pending for ${String(role).trim().toLowerCase()}`,
        );
        whereConditions.push(
          `LOWER(TRIM(status)) = ANY($${values.length + 1}::text[])`,
        );
        values.push(pendingStatuses);
      }
    } else {
      whereConditions.push(`LOWER(TRIM(status)) = $${values.length + 1}`);
      values.push(normalizedStatusFilter);
    }
  }

  if (whereConditions.length > 0) {
    query += " WHERE " + whereConditions.join(" AND ");
  }

  query += " ORDER BY id DESC";

  if (module === "fleetrequest") {
    query += " LIMIT 20";
  } else {
    // Count the same filtered result set as the dashboard query, excluding only
    // its pagination parameters.
    const countValues = [...values];
    const countQuery = `
      SELECT COUNT(*)::int AS total_count
      FROM fleet_request
      WHERE ${whereConditions.join(" AND ")}
    `;

    query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(normalizedLimit, normalizedPage * normalizedLimit);

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, countValues),
    ]);
    return {
      data: dataResult.rows,
      totalCount: countResult.rows[0].total_count,
    };
  }

  return {
    data: (await pool.query(query, values)).rows,
  };
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

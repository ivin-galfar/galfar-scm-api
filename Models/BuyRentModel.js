import pool from "../Config/db.js";
import { expectedStatuses } from "../helpers/plantstatus.js";

export const feedbrstatements = async ({
  formData,
  cashflow,
  accounting,
  payback,
}) => {
  const {
    item,
    unit_price,
    no_of_units,
    int_rate,
    fin_tenure,
    op_cost,
    maint_yearly,
    tenure_months,
    principal_cost,
    monthly_installment,
    total_interest_cost,
    op_cost_tenure,
    maint_cost_tenure,
    principal_with_interest_buy,
    cash_outflow_buying,
    monthly_rental,
    total_monthly_rental,
    total_rental,
    maintainence_cost_rent,
    operational_cost_rent,
    cash_outflow_renting,
    dp_rate,
    is_included_maintain_cost_rent,
    is_included_op_cost_rent,
    status,
    file,
    filename,
    dp_year,
    currency,
  } = formData;

  const { chosentype, benefit } = cashflow;

  const {
    depreciation_cost,
    total_expenses_buying,
    total_expenses_rentals,
    accounting_gain_loss,
  } = accounting;
  const {
    cost_in_buying_without_main,
    cost_in_buying_with_main,
    period_months_with_main,
    period_months_without_main,
  } = payback;
  try {
    let query =
      "INSERT INTO buy_rent_statements (item, unit_price, units_no, int_rate, fin_tenure, op_cost_monthly,maintenance_yearly,tenure_months, principal_cost, monthly_installment, total_interest_cost, op_cost_tenure,maintenance_cost_tenure, principal_with_interest_buy,cash_outflow_buying,monthly_rent,total_monthly_rental,total_rental_cost,maint_rental,op_cost_rental,cash_outflow_renting,dp_rate,chosentype,benefit,depreciation_cost,total_expenses_buying,total_expenses_rentals,accounting_gain_loss,cost_in_buying_without_main,cost_in_buying_with_main,period_months_without_main,period_months_with_main,included_op_cost_rent,included_maintain_cost_rent,status,file,filename,dp_year,currency) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, $11, $12, $13, $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39) RETURNING *";
    let params = [
      item,
      unit_price,
      no_of_units,
      int_rate,
      fin_tenure,
      op_cost,
      maint_yearly,
      tenure_months,
      principal_cost,
      monthly_installment,
      total_interest_cost,
      op_cost_tenure,
      maint_cost_tenure,
      principal_with_interest_buy,
      cash_outflow_buying,
      monthly_rental,
      total_monthly_rental,
      total_rental,
      maintainence_cost_rent,
      operational_cost_rent,
      cash_outflow_renting,
      dp_rate,
      chosentype,
      benefit,
      depreciation_cost,
      total_expenses_buying,
      total_expenses_rentals,
      accounting_gain_loss,
      cost_in_buying_without_main,
      cost_in_buying_with_main,
      period_months_with_main,
      period_months_without_main,
      is_included_op_cost_rent,
      is_included_maintain_cost_rent,
      status,
      file,
      filename,
      dp_year,
      currency,
    ];

    const { rows } = await pool.query(query, params);

    return rows[0];
  } catch (error) {
    throw error;
  }
};

export const fetchBrStatements = async (
  module,
  role,
  statusfilter = "All",
  page,
  limit,
  searchcs,
) => {
  let pendingCondition = "";
  let last7DaysResult = [];
  if (role === "ceo") pendingCondition = "status = 'pending for ceo'";
  if (role === "gm") pendingCondition = "status = 'pending for gm'";
  if (role === "hod") pendingCondition = "status = 'pending for hod'";
  if (role === "fm") pendingCondition = "status = 'pending for fm'";

  if (role == "inita") pendingCondition = "status LIKE 'pending%'";
  try {
    const offset = page * limit;
    let columns = ["id"];
    if (module == "/dashboardbr") {
      columns.push(
        "item",
        "chosentype",
        "status",
        "approver_info",
        "created_at",
      );
    }

    const selectColumns = columns.join(",");
    let query = "";
    if (module != "/") {
      query = `
        SELECT ${selectColumns}
        FROM buy_rent_statements
        WHERE deleted = 0
      `;
    } else {
      query = `
          SELECT
            COUNT(*) AS total_count,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
            SUM(
              CASE 
                WHEN ${pendingCondition}
                THEN 1 ELSE 0
              END
            ) AS pending_count,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
            SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) AS review_count
          FROM buy_rent_statements
          WHERE deleted = 0`;
      let last7DaysQuery = `
            SELECT 
              item,created_at,status
            FROM buy_rent_statements
            WHERE deleted = 0
            AND created_at >= NOW() - INTERVAL '7 days'
            ORDER BY created_at DESC`;
      const result = await pool.query(last7DaysQuery);
      last7DaysResult = result.rows;
    }

    let values = [];
    if (role !== "inita") {
      query += `
    AND status IS NOT NULL
    AND status <> 'created'
    AND status <> 'reverted'`;
    }
    if (statusfilter != "All") {
      if (statusfilter == "Pending") {
        if (role == "inita") {
          query += ` AND status LIKE ($${values.length + 1}::text)`;
          values.push(`%pending%`);
        } else {
          query += ` AND status LIKE ($${values.length + 1}::text)`;
          values.push(`%${role.toLowerCase()}`);
        }
      } else {
        query += ` AND status = ($${values.length + 1})`;
        values.push(statusfilter.toLowerCase());
      }
    }
    if (searchcs) {
      query += ` AND id::text LIKE ($${values.length + 1})`;
      values.push(`%${searchcs}%`);
    }

    if (module == "/dashboardbr") {
      query += ` ORDER BY id Desc LIMIT $${values.length + 1} OFFSET $${
        values.length + 2
      }`;
      values.push(limit, offset);
    } else if (module !== "/") {
      query += ` ORDER BY id Desc LIMIT 50`;
    }

    const { rows } = await pool.query(query, values);

    return { rows, last7DaysResult };
  } catch (error) {
    throw error;
  }
};

export const fetchtotalBrStatements = async (
  module,
  role,
  statusfilter,
  searchcs,
  fromCron = false,
) => {
  try {
    let query = `
      SELECT COUNT(*) as total
      FROM buy_rent_statements
      WHERE deleted = 0
    `;

    let values = [];
    if (role !== "inita") {
      query += `
    AND status IS NOT NULL
    AND status <> 'created'
     AND status <> 'reverted'`;
    }
    if (statusfilter != "All") {
      if (statusfilter == "Pending") {
        if (role == "inita") {
          query += ` AND status LIKE ($${values.length + 1}::text)`;
          values.push(`%pending%`);
        } else {
          query += ` AND status LIKE ($${values.length + 1}::text)`;
          values.push(`%${role.toLowerCase()}`);
        }
      } else {
        query += ` AND status = ($${values.length + 1})`;
        values.push(statusfilter.toLowerCase());
      }
    }
    if (searchcs) {
      query += ` AND id::text LIKE ($${values.length + 1})`;
      values.push(`%${searchcs}%`);
    }
    const { rows } = await pool.query(query, values);
    return rows[0];
  } catch (error) {
    throw error;
  }
};

export const fetchBrStatement = async (cs_id) => {
  try {
    let query = "Select * FROM buy_rent_statements WHERE id=$1 AND deleted=0";
    let values = [cs_id];
    const { rows } = await pool.query(query, values);
    return rows[0];
  } catch (error) {
    throw error;
  }
};
export const updateStatements = async (
  cs_id,
  status,
  comments,
  role,
  file,
  filename,
) => {
  try {
    let setClauses = [];
    let values = [];
    let paramIndex = 1;

    setClauses.push(`status = $${paramIndex}`);
    values.push(status);
    paramIndex++;

    if (status === "pending for hod") {
      setClauses.push(`sentforapproval = $${paramIndex}`);
      values.push("yes");
      paramIndex++;
    }
    let currentstatus = "";
    let nextstatus = expectedStatuses(role);

    if (status != "review") {
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

    if (file != null || filename != null) {
      setClauses.push(`file = $${paramIndex}`);
      values.push(file && file.length ? file : []);
      paramIndex++;
      setClauses.push(`filename = $${paramIndex}`);
      values.push(filename && filename.length ? filename : []);
      paramIndex++;
    }

    if (status) {
      const approvalData = {
        ...(comments ? { comment: comments } : {}),
        date: new Date().toISOString(),
        role: role,
        status: currentstatus != "" ? currentstatus : status,
        ...(status === "rejected" && { rejectedBy: role }),
      };

      setClauses.push(`
        approver_info = COALESCE(approver_info, '[]'::jsonb) || $${paramIndex}::jsonb
      `);

      values.push(JSON.stringify([approvalData]));
      paramIndex++;
    }

    const whereParam = paramIndex;
    values.push(cs_id);

    const query = `
      UPDATE buy_rent_statements
      SET ${setClauses.join(", ")}
      WHERE id = $${whereParam}
      RETURNING *
    `;
    const { rows } = await pool.query(query, values);
    return rows[0];
  } catch (error) {
    throw error;
  }
};

export const updateBrValues = async (
  cs_id,
  formData,
  cashflow,
  accounting,
  payback,
) => {
  const {
    item,
    unit_price,
    no_of_units,
    int_rate,
    fin_tenure,
    op_cost,
    maint_yearly,
    tenure_months,
    principal_cost,
    monthly_installment,
    total_interest_cost,
    op_cost_tenure,
    maint_cost_tenure,
    principal_with_interest_buy,
    cash_outflow_buying,
    monthly_rental,
    total_monthly_rental,
    total_rental,
    maintainence_cost_rent,
    operational_cost_rent,
    cash_outflow_renting,
    dp_rate,
    is_included_maintain_cost_rent,
    is_included_op_cost_rent,
    status,
    file,
    filename,
    dp_year,
    currency,
  } = formData;

  const { chosentype, benefit } = cashflow;

  const {
    depreciation_cost,
    total_expenses_buying,
    total_expenses_rentals,
    accounting_gain_loss,
  } = accounting;

  const {
    cost_in_buying_without_main,
    cost_in_buying_with_main,
    period_months_with_main,
    period_months_without_main,
  } = payback;

  try {
    const query = `
      UPDATE buy_rent_statements
      SET
        item = $1,
        unit_price = $2,
        units_no = $3,
        int_rate = $4,
        fin_tenure = $5,
        op_cost_monthly = $6,
        maintenance_yearly = $7,
        tenure_months = $8,
        principal_cost = $9,
        monthly_installment = $10,
        total_interest_cost = $11,
        op_cost_tenure = $12,
        maintenance_cost_tenure = $13,
        principal_with_interest_buy = $14,
        cash_outflow_buying = $15,
        monthly_rent = $16,
        total_monthly_rental = $17,
        total_rental_cost = $18,
        maint_rental = $19,
        op_cost_rental = $20,
        cash_outflow_renting = $21,
        dp_rate = $22,
        chosentype = $23,
        benefit = $24,
        depreciation_cost = $25,
        total_expenses_buying = $26,
        total_expenses_rentals = $27,
        accounting_gain_loss = $28,
        cost_in_buying_without_main = $29,
        cost_in_buying_with_main = $30,
        period_months_without_main = $31,
        period_months_with_main = $32,
        included_op_cost_rent = $33,
        included_maintain_cost_rent = $34,
        status = $35,
        file = $36,
        filename = $37,
        dp_year = $38,
        currency = $39
      WHERE id = $40
      RETURNING *
    `;

    const values = [
      item,
      unit_price,
      no_of_units,
      int_rate,
      fin_tenure,
      op_cost,
      maint_yearly,
      tenure_months,
      principal_cost,
      monthly_installment,
      total_interest_cost,
      op_cost_tenure,
      maint_cost_tenure,
      principal_with_interest_buy,
      cash_outflow_buying,
      monthly_rental,
      total_monthly_rental,
      total_rental,
      maintainence_cost_rent,
      operational_cost_rent,
      cash_outflow_renting,
      dp_rate,
      chosentype,
      benefit,
      depreciation_cost,
      total_expenses_buying,
      total_expenses_rentals,
      accounting_gain_loss,
      cost_in_buying_without_main,
      cost_in_buying_with_main,
      period_months_without_main,
      period_months_with_main,
      is_included_maintain_cost_rent,
      is_included_op_cost_rent,
      status,
      file,
      filename,
      dp_year,
      currency,
      cs_id,
    ];

    const { rows } = await pool.query(query, values);
    return rows;
  } catch (error) {
    throw error;
  }
};

export const updateDeleteFlag = async (cs_id) => {
  try {
    await pool.query(
      "Update buy_rent_statements set deleted = 1 WHERE id = $1",
      [cs_id],
    );
    return { message: "Statement removed successfully" };
  } catch (error) {
    console.error("Error removing statement:", error);
    throw error;
  }
};

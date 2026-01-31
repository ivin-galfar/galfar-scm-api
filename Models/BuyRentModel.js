import pool from "../Config/db.js";

export const feedbrstatements = async ({ formData, cashflow }) => {
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
    maint_cost_tenrure,
    principal_with_interest_buy,
    cash_outflow_buying,
    monthly_rental,
    total_monthly_rental,
    total_rental,
    maint_rental,
    op_cost_rental,
    cash_outflow_renting,
    dp_rate,
  } = formData;
  const {
    chosentype,
    benefit,
    depreciation_cost,
    total_expenses_buying,
    total_expenses_rentals,
  } = cashflow;
  try {
    let query =
      "INSERT INTO buy_rent_statements (item, unit_price, units_no, int_rate, fin_tenure, op_cost_monthly,maintenance_yearly,tenure_months, principal_cost, monthly_installment, total_interest_cost, op_cost_tenure,maintenance_cost_tenure, principal_with_interest_buy,cash_outflow_buying,monthly_rent,total_monthly_rental,total_rental_cost,maint_rental,op_cost_rental,cash_outflow_renting,dp_rate,chosentype,benefit,depreciation_cost,total_expenses_buying,total_expenses_rentals) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, $11, $12, $13, $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) RETURNING *";
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
      maint_cost_tenrure,
      principal_with_interest_buy,
      cash_outflow_buying,
      monthly_rental,
      total_monthly_rental,
      total_rental,
      maint_rental,
      op_cost_rental,
      cash_outflow_renting,
      dp_rate,
      chosentype,
      benefit,
      depreciation_cost,
      total_expenses_buying,
      total_expenses_rentals,
    ];

    const { rows } = await pool.query(query, params);

    return rows[0];
  } catch (error) {
    throw error;
  }
};

import {
  feedbrstatements,
  fetchBrStatement,
  fetchBrStatements,
  fetchtotalBrStatements,
  updateBrValues,
  updateDeleteFlag,
  updateStatements,
} from "../Models/BuyRentModel.js";

export const AddBuyRentStatements = async (req, res) => {
  const { formData } = req.body;
  const {
    fin_tenure,
    int_rate,
    unit_price,
    no_of_units,
    op_cost,
    maint_yearly,
    monthly_rental,
    maintain_cost_rent,
    op_cost_rent,
    dp_rate,
    is_included_maintain_cost_rent,
    is_included_op_cost_rent,
  } = req.body.formData;

  for (const [key, value] of Object.entries(formData)) {
    if (key === "file" || key === "filename") continue;
    if (
      value === "" ||
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "")
    ) {
      return res.status(400).json({
        message: `Validation Error: "${key}" cannot be empty.`,
      });
    }
  }
  const calculateEMI = (principal_cost, int_rate, tenure_months) => {
    let monthly_rate = int_rate / 12;
    if (int_rate == 0) return 0;
    if (int_rate > 0) {
      return (
        (principal_cost * monthly_rate) /
        (1 - 1 / Math.pow(1 + monthly_rate, tenure_months))
      );
    }
  };
  formData.tenure_months = fin_tenure * 12;
  formData.principal_cost = unit_price * no_of_units;

  formData.monthly_installment =
    int_rate == 0
      ? 0
      : calculateEMI(
          formData.principal_cost,
          int_rate / 100,
          formData.tenure_months,
        );

  formData.total_interest_cost =
    int_rate == 0
      ? 0
      : formData.monthly_installment * formData.tenure_months -
        formData.principal_cost;

  formData.op_cost_tenure = op_cost * no_of_units * formData.tenure_months;

  formData.maint_cost_tenure =
    maint_yearly == 0
      ? 0
      : formData.principal_cost * fin_tenure * (maint_yearly / 100);

  //if maintainence cost for rental has values
  formData.maintainence_cost_rent = 0;
  if (
    !is_included_maintain_cost_rent &&
    maintain_cost_rent > 0 &&
    formData.maint_cost_tenure != null
  ) {
    formData.maintainence_cost_rent = formData.maint_cost_tenure;
  }
  formData.operational_cost_rent = 0;
  if (
    !is_included_op_cost_rent &&
    op_cost_rent > 0 &&
    formData.op_cost_tenure != null
  ) {
    formData.operational_cost_rent = formData.op_cost_tenure;
  }

  formData.principal_with_interest_buy =
    formData.total_interest_cost + formData.principal_cost;

  formData.cash_outflow_buying =
    formData.principal_with_interest_buy +
    formData.maint_cost_tenure +
    formData.op_cost_tenure;

  formData.total_monthly_rental = monthly_rental * no_of_units;
  formData.total_rental =
    formData.total_monthly_rental * formData.tenure_months;

  formData.is_included_maintain_cost_rent = is_included_maintain_cost_rent;
  formData.is_included_op_cost_rent = is_included_op_cost_rent;

  formData.cash_outflow_renting =
    formData.total_rental +
    formData.maintainence_cost_rent +
    formData.operational_cost_rent;

  let cashflow = {};
  cashflow.chosentype =
    formData.cash_outflow_renting > formData.cash_outflow_buying
      ? "Buying"
      : "Renting";
  cashflow.benefit =
    formData.cash_outflow_renting > formData.cash_outflow_buying
      ? formData.cash_outflow_renting - formData.cash_outflow_buying
      : formData.cash_outflow_buying - formData.cash_outflow_renting;
  let accounting = {};
  accounting.depreciation_cost =
    formData.principal_cost * (dp_rate / 100) * fin_tenure >
    formData.principal_cost
      ? formData.principal_cost
      : formData.principal_cost * (dp_rate / 100) * fin_tenure;

  accounting.total_expenses_buying =
    accounting.depreciation_cost +
    formData.total_interest_cost +
    formData.maint_cost_tenure +
    formData.op_cost_tenure;

  accounting.total_expenses_rentals = formData.total_rental;

  accounting.accounting_gain_loss =
    accounting.total_expenses_rentals - accounting.total_expenses_buying;
  let payback = {};

  payback.cost_in_buying_without_main =
    formData.principal_with_interest_buy + formData.op_cost_tenure;

  payback.cost_in_buying_with_main = formData.cash_outflow_buying;
  payback.period_months_without_main =
    formData.total_monthly_rental > 0
      ? payback.cost_in_buying_without_main / formData.total_monthly_rental
      : null;
  payback.period_months_with_main =
    formData.total_monthly_rental > 0
      ? payback.cost_in_buying_with_main / formData.total_monthly_rental
      : null;

  try {
    const feedstatement = await feedbrstatements({
      formData,
      cashflow,
      accounting,
      payback,
    });
    return res.status(200).json(feedstatement);
  } catch (error) {
    console.log(error);

    res.status(500).json({ error: error.message });
  }
};

export const fetchBuyRentStatements = async (req, res) => {
  const { module, role, statusfilter, page, limit, searchcs } = req.query;

  try {
    const Brstatements = await fetchBrStatements(
      module,
      role,
      statusfilter,
      page,
      limit,
      searchcs,
    );

    return res.status(200).json(Brstatements);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const fetchBuyRentTotalStatements = async (req, res) => {
  const { module, role, statusfilter, searchcs } = req.query;
  try {
    const count = await fetchtotalBrStatements(
      module,
      role,
      statusfilter,
      searchcs,
    );
    return res.status(200).json(count);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const fetchBuyRentStatement = async (req, res) => {
  const { cs_id } = req.params;
  try {
    const Brstatements = await fetchBrStatement(cs_id);
    return res.status(200).json(Brstatements);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const updateBuyRentStatement = async (req, res) => {
  const { cs_id } = req.params;
  const { status, comments, role, file, filename } = req.body;

  try {
    const UpdatedBrStatements = await updateStatements(
      cs_id,
      status,
      comments,
      role,
      file,
      filename,
    );
    return res.status(200).json(UpdatedBrStatements);
  } catch (error) {
    console.log(error);

    res.status(500).json({ error: error.message });
  }
};

export const updateBuyRentStatementValues = async (req, res) => {
  const { cs_id } = req.params;
  const { formData } = req.body;

  const {
    fin_tenure,
    int_rate,
    unit_price,
    no_of_units,
    op_cost,
    maint_yearly,
    monthly_rental,
    maintain_cost_rent,
    op_cost_rent,
    dp_rate,
    is_included_maintain_cost_rent,
    is_included_op_cost_rent,
  } = req.body.formData;
  for (const [key, value] of Object.entries(formData)) {
    if (key === "file" || key === "filename") continue;
    if (
      value === "" ||
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "")
    ) {
      return res.status(400).json({
        message: `Validation Error: "${key}" cannot be empty.`,
      });
    }
  }
  const calculateEMI = (principal_cost, int_rate, tenure_months) => {
    let monthly_rate = int_rate / 12;
    if (int_rate == 0) return 0;
    if (int_rate > 0) {
      return (
        (principal_cost * monthly_rate) /
        (1 - 1 / Math.pow(1 + monthly_rate, tenure_months))
      );
    }
  };
  formData.tenure_months = fin_tenure * 12;
  formData.principal_cost = unit_price * no_of_units;

  formData.monthly_installment =
    int_rate == 0
      ? 0
      : calculateEMI(
          formData.principal_cost,
          int_rate / 100,
          formData.tenure_months,
        );

  formData.total_interest_cost =
    int_rate == 0
      ? 0
      : formData.monthly_installment * formData.tenure_months -
        formData.principal_cost;

  formData.op_cost_tenure = op_cost * no_of_units * formData.tenure_months;

  formData.maint_cost_tenure =
    maint_yearly == 0
      ? 0
      : formData.principal_cost * fin_tenure * (maint_yearly / 100);
  //if maintainence cost for rental has values
  formData.maintainence_cost_rent = 0;
  if (
    !is_included_maintain_cost_rent &&
    maintain_cost_rent > 0 &&
    formData.maint_cost_tenure != null
  ) {
    formData.maintainence_cost_rent = formData.maint_cost_tenure;
  }
  formData.operational_cost_rent = 0;
  if (
    !is_included_op_cost_rent &&
    op_cost_rent > 0 &&
    formData.op_cost_tenure != null
  ) {
    formData.operational_cost_rent = formData.op_cost_tenure;
  }

  formData.principal_with_interest_buy =
    formData.total_interest_cost + formData.principal_cost;

  formData.cash_outflow_buying =
    formData.principal_with_interest_buy +
    formData.maint_cost_tenure +
    formData.op_cost_tenure;

  formData.total_monthly_rental = monthly_rental * no_of_units;
  formData.total_rental =
    formData.total_monthly_rental * formData.tenure_months;

  formData.is_included_maintain_cost_rent = is_included_maintain_cost_rent;
  formData.is_included_op_cost_rent = is_included_op_cost_rent;

  formData.cash_outflow_renting =
    formData.total_rental +
    formData.maintainence_cost_rent +
    formData.operational_cost_rent;

  let cashflow = {};
  cashflow.chosentype =
    formData.cash_outflow_renting > formData.cash_outflow_buying
      ? "Buying"
      : "Renting";
  cashflow.benefit =
    formData.cash_outflow_renting > formData.cash_outflow_buying
      ? formData.cash_outflow_renting - formData.cash_outflow_buying
      : formData.cash_outflow_buying - formData.cash_outflow_renting;
  let accounting = {};
  accounting.depreciation_cost =
    formData.principal_cost * (dp_rate / 100) * fin_tenure >
    formData.principal_cost
      ? formData.principal_cost
      : formData.principal_cost * (dp_rate / 100) * fin_tenure;

  accounting.total_expenses_buying =
    accounting.depreciation_cost +
    formData.total_interest_cost +
    formData.maint_cost_tenure +
    formData.op_cost_tenure;

  accounting.total_expenses_rentals = formData.total_rental;

  accounting.accounting_gain_loss =
    accounting.total_expenses_rentals - accounting.total_expenses_buying;
  let payback = {};

  payback.cost_in_buying_without_main =
    formData.principal_with_interest_buy + formData.op_cost_tenure;

  payback.cost_in_buying_with_main = formData.cash_outflow_buying;
  payback.period_months_with_main =
    formData.total_monthly_rental > 0
      ? payback.cost_in_buying_with_main / formData.total_monthly_rental
      : null;
  payback.period_months_with_main =
    formData.total_monthly_rental > 0
      ? payback.cost_in_buying_with_main / formData.total_monthly_rental
      : null;

  try {
    const updatedStatementValues = await updateBrValues(
      cs_id,
      formData,
      cashflow,
      accounting,
      payback,
    );
    return res.status(200).json(updatedStatementValues);
  } catch (error) {
    console.log(error);

    throw error;
  }
};

export const softdeletebrstatement = async (req, res) => {
  const { cs_id } = req.params;

  const Brstatements = await fetchBrStatement(cs_id);

  if (Brstatements?.length == 0) {
    return res.status(404).json({ error: "Statement not found" });
  }
  try {
    const deletedstatement = await updateDeleteFlag(cs_id);
    return res.status(200).json(deletedstatement);
  } catch (error) {
    return res.status(500).json(error);
  }
};

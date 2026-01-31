import { feedbrstatements } from "../Models/BuyRentModel.js";

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
    maint_rental,
    op_cost_rental,
    dp_rate,
  } = req.body.formData;

  for (const [key, value] of Object.entries(formData)) {
    // if (
    //   key === "item" ||
    //   key === "unit_price" ||
    //   key === "dp_rate" ||
    //   key === "fin_tenure" ||
    //   key === "int_rate" ||
    //   key === "maint_yearly" ||
    //   key === "monthly_rent" ||
    //   key === "no_of_units" ||
    //   key === "op_cost"
    // )
    //   continue;
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

  formData.maint_cost_tenrure =
    maint_yearly == 0
      ? 0
      : formData.principal_cost * fin_tenure * (maint_yearly / 100);

  formData.principal_with_interest_buy =
    formData.total_interest_cost + formData.principal_cost;

  formData.cash_outflow_buying =
    formData.principal_with_interest_buy +
    formData.maint_cost_tenrure +
    formData.op_cost_tenure;

  formData.total_monthly_rental = monthly_rental * no_of_units;
  formData.total_rental =
    formData.total_monthly_rental * formData.tenure_months;
  formData.cash_outflow_renting =
    formData.total_rental + maint_rental + op_cost_rental;

  let cashflow = {};
  cashflow.chosentype =
    formData.cash_outflow_renting > formData.cash_outflow_buying
      ? " Buying"
      : "Renting";
  cashflow.benefit =
    formData.cash_outflow_renting > formData.cash_outflow_buying
      ? formData.cash_outflow_renting - formData.cash_outflow_buying
      : cash_outflow_buying - cash_outflow_renting;

  cashflow.depreciation_cost =
    formData.principal_cost * (dp_rate / 100) * fin_tenure >
    formData.principal_cost
      ? formData.principal_cost
      : formData.principal_cost * (dp_rate / 100) * fin_tenure;

  cashflow.total_expenses_buying =
    cashflow.depreciation_cost +
    formData.total_interest_cost +
    formData.maint_cost_tenrure +
    formData.op_cost_tenure;

  cashflow.total_expenses_rentals = formData.total_rental;
  try {
    const feedstatement = await feedbrstatements({ formData, cashflow });
    return res.status(200).json(feedstatement);
  } catch (error) {
    console.log(error);

    res.status(500).json({ error: error.message });
  }
};

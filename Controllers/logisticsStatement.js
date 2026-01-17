import {
  feedlogisticsStatement,
  fetchAllCsid,
  fetchAllCsidvalues,
  fetchformData,
  fetchTableData,
  fetchtotalstatements,
  getappoverdetails,
  updateCSStatus,
  updateDeleteFlag,
  updatelogisticsStatement,
} from "../Models/logisticsModel.js";

export const AddlogisticsStatement = async (req, res) => {
  const { formData, tableData } = req.body;

  for (const [key, value] of Object.entries(formData)) {
    if (
      key === "file" ||
      key === "filename" ||
      key === "lastupdated" ||
      key === "review" ||
      key === "recommendation_reason" ||
      key === "created_at" ||
      key === "chargeable_weight" ||
      key === "rejectedby"
    )
      continue;
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
  try {
    const feedstatement = await feedlogisticsStatement({ formData, tableData });
    return res.status(200).json(feedstatement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const UpdatelogisticsStatement = async (req, res) => {
  const { formData, tableData } = req.body;

  const { cs_id } = req.params;
  // for (const [key, value] of Object.entries(formData)) {
  //   if (
  //     key === "file" ||
  //     key === "filename" ||
  //     key === "lastupdated" ||
  //     key === "review"
  //   )
  //     continue;
  //   if (
  //     value === "" ||
  //     value === null ||
  //     value === undefined ||
  //     (typeof value === "string" && value.trim() === "")
  //   ) {
  //     return res.status(400).json({
  //       message: `Validation Error: "${key}" cannot be empty.`,
  //     });
  //   }
  // }
  try {
    const feedstatement = await updatelogisticsStatement({
      formData,
      tableData,
      cs_id,
    });
    return res.status(200).json(feedstatement);
  } catch (error) {
    console.log(error);

    res.status(500).json({ error: error.message });
  }
};

export const fetchLogisticsStatement = async (req, res) => {
  const { cs_id } = req.params;
  try {
    const logistics_statement = await fetchformData(cs_id);
    const forwarder_records = await fetchTableData(cs_id);
    return res
      .status(200)
      .json({ formData: logistics_statement, tableData: forwarder_records });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const fetchAllID = async (req, res) => {
  const { module } = req.query;
  try {
    const cs_id = await fetchAllCsid(module);
    return res.status(200).json(cs_id);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const fetchAllCs = async (req, res) => {
  const { statusfilter, searchcs, pageIndex, pageSize, role } = req.query;

  try {
    const cs_id = await fetchAllCsidvalues(
      statusfilter,
      searchcs,
      pageIndex,
      pageSize,
      role
    );
    return res.status(200).json(cs_id);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const fetchCscount = async (req, res) => {
  const { statusfilter, searchcs, role } = req.query;

  try {
    const { count } = await fetchtotalstatements(statusfilter, role, searchcs);

    return res.status(200).json({ receipts_count: count });
  } catch (error) {
    console.log(error);

    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateCS = async (req, res) => {
  const {
    updatedstatus,
    sentforapproval,
    selected_vendor_index,
    recommendation_reason,
    comments_incharge,
    comments_pm,
    comments_gm,
    comments_fm,
    comments_ceo,
    rejectedby,
  } = req.body;

  const { cs_id } = req.params;

  try {
    await updateCSStatus(
      cs_id,
      updatedstatus,
      sentforapproval,
      selected_vendor_index,
      recommendation_reason,
      comments_incharge,
      comments_pm,
      comments_gm,
      comments_fm,
      comments_ceo,
      rejectedby
    );

    return res.status(200).json({ message: "Successfully Updated" });
  } catch (error) {
    console.log(error);

    res.status(500).json({ error: error.message });
  }
};

export const softdeletestatement = async (req, res) => {
  const { cs_id } = req.params;

  const statementExists = (await fetchformData(cs_id)) || [];

  if (statementExists?.length == 0) {
    return res.status(404).json({ error: "Statement not found" });
  }
  try {
    const deletedstatement = await updateDeleteFlag(cs_id);
    return res.status(200).json(deletedstatement);
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const approverDetails = async (req, res) => {
  const { cs_id } = req.params;
  try {
    const approverdetails = await getappoverdetails(cs_id);
    return res.status(200).json(approverdetails);
  } catch (error) {
    return res.status(500).json(error);
  }
};

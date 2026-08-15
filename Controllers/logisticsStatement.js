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
import { PmCmNames } from "../Models/projectModel.js";

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

  try {
    const feedstatement = await updatelogisticsStatement({
      formData,
      tableData,
      cs_id,
    });
    return res.status(200).json(feedstatement);
  } catch (error) {
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
  const {
    module,
    ["project[]"]: project,
    ["role[]"]: role,
    showinactive,
  } = req.query;
  const showInactive = showinactive === "true";

  try {
    const cs_id = await fetchAllCsid(module, role, project, showInactive);
    return res.status(200).json(cs_id);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const fetchAllCs = async (req, res) => {
  const {
    statusfilter,
    searchcsno,
    searchcsname,
    pageIndex,
    pageSize,
    role,
    ["project[]"]: project,
    showinactive,
  } = req.query;
  const showInactive = showinactive === "true";

  try {
    const cs_id = await fetchAllCsidvalues(
      statusfilter,
      searchcsno,
      searchcsname,
      pageIndex,
      pageSize,
      role,
      project == "1" ? "plant" : project,
      showInactive,
    );
    return res.status(200).json(cs_id);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const fetchCscount = async (req, res) => {
  const {
    statusfilter,
    searchcsno,
    searchcsname,
    role,
    ["project[]"]: project,
    showinactive,
  } = req.query;
  const showInactive = showinactive === "true";

  try {
    const { count } = await fetchtotalstatements(
      statusfilter,
      role,
      searchcsno,
      searchcsname,
      project == "1" ? "plant" : project,
      showInactive,
    );

    return res.status(200).json({ receipts_count: count });
  } catch (error) {
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
    comments_pd,
    comments_gm,
    comments_fm,
    comments_ceo,
    comments_init,
    rejectedby,
    recalled_times,
    role,
    project,
  } = req.body;

  const { cs_id } = req.params;
  const project_code = typeof project === "string" ? Number(project) : project;

  const pm = role === "pm" ? (await PmCmNames(role, project_code))?.[0] : "";
  const pd = role === "pd" ? (await PmCmNames(role, project_code))?.[0] : "";

  const commentsByRole = {
    incharge: comments_incharge,
    pm: comments_pm,
    pd: comments_pd,
    gm: comments_gm,
    fm: comments_fm,
    ceo: comments_ceo,
    init: comments_init,
  };

  const approverdetails = {
    role,
    datetime: new Date(),
    ...(role === "pm" && { pm }),
    ...(role === "pd" && { pd }),
    comment: commentsByRole[role] ?? "",
  };

  try {
    await updateCSStatus(
      cs_id,
      updatedstatus,
      sentforapproval,
      selected_vendor_index,
      recommendation_reason,
      comments_incharge,
      comments_pm,
      comments_pd,
      comments_gm,
      comments_fm,
      comments_ceo,
      rejectedby,
      recalled_times,
      comments_init,
      approverdetails,
    );

    return res.status(200).json({ message: "Successfully Updated" });
  } catch (error) {
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

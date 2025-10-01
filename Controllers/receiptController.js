import {
  AddApprovalStatus,
  allReceipts,
  allTableData,
  feedReceipt,
  fetchoneReceiptFormData,
  fetchoneReceiptTableData,
  getAllApproverDetails,
  getApproverDetailsByCSId,
  removeStatement,
  updatereceipt,
  updateReceiptStatus,
} from "../Models/receiptmodel.js";

export const feedReceipts = async (req, res) => {
  try {
    const { formData, tableData } = req.body;
    if (formData.type !== "asset") {
      for (const [key, value] of Object.entries(formData)) {
        if (key === "file" || key === "receiptupdated") continue;
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
    }
    const transformedTableData = tableData?.map(
      ({ id, sl, particulars, qty, vendors }) => {
        const cleanVendors = {};
        if (vendors) {
          Object.entries(vendors).forEach(([key, value]) => {
            cleanVendors[key] = value ?? "";
          });
        }
        return {
          id,
          sl,
          particulars,
          qty,
          vendors: cleanVendors,
        };
      }
    );

    const newReceipt = await feedReceipt({
      formData,
      tableData: transformedTableData,
    });
    return res
      .status(201)
      .json({ message: "Receipt saved successfully", receipt: newReceipt });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const fetchReceipts = async (req, res) => {
  try {
    const formData = await allReceipts();
    const tableData = await allTableData();

    const tableDataMap = tableData.reduce((acc, item) => {
      const receiptId = item.receipt_id;
      if (!acc[receiptId]) acc[receiptId] = [];
      acc[receiptId].push(item);
      return acc;
    }, {});

    const mappedReceipts = formData.map((receipt) => ({
      formData: receipt,
      tableData: tableDataMap[receipt.id] || [],
    }));

    return res.status(200).json({ receipts: mappedReceipts });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const fetchReceipt = async (req, res) => {
  try {
    const { cs_id } = req.params;
    const { formData } = await fetchoneReceiptFormData(cs_id);
    const { tableData } = await fetchoneReceiptTableData(cs_id);

    if (formData.length == 0) {
      return res.status(404).json({ error: "Statement not found" });
    }
    return res.json({
      formData,
      tableData,
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updatestatus = async (req, res) => {
  try {
    const { cs_id } = req.params;
    const { selectedVendorIndex, selectedVendorReason, status } = req.body;

    const { formData } = await fetchoneReceiptFormData(cs_id);

    if (formData.length == 0) {
      return res.status(404).json({ error: "Statement not found" });
    }
    const updated = await updateReceiptStatus(
      cs_id,
      selectedVendorIndex,
      selectedVendorReason,
      status
    );
    return res.json({ formData: updated[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateApprovalstatus = async (req, res) => {
  const { cs_id } = req.params;
  const { action } = req.body;
  const { approverComments } = req.body;
  const { role } = req.body;
  const { userId } = req.body;
  const { status } = req.body;
  const { rejectedby } = req.body;
  const { approverstatus } = req.body;
  const { formData } = await fetchoneReceiptFormData(cs_id);

  try {
    if (formData.length == 0) {
      return res.status(404).json({ error: "Statement not found" });
    }

    const updatestatus = await AddApprovalStatus(
      cs_id,
      action,
      approverComments || {},
      role,
      userId,
      status,
      rejectedby || null,
      approverstatus || null
    );
    return res.json(updatestatus);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateReceipt = async (req, res) => {
  const { cs_id } = req.params;
  const { formData, tableData, selectedIndex, selectedReason } = req.body;

  try {
    if (formData.length == 0) {
      return res.status(404).json({ error: "Statement not found" });
    }

    if (formData?.type != "asset") {
      for (const [key, value] of Object.entries(formData)) {
        if (
          key === "file" ||
          key == "receiptupdated" ||
          key === "currency" ||
          key == "selectedvendorreason"
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
    }

    const transformedTableData = tableData?.map(
      ({ id, sl, particulars, qty, vendors }) => {
        const cleanVendors = {};
        if (vendors) {
          Object.entries(vendors).forEach(([key, value]) => {
            cleanVendors[key] = value ?? "";
          });
        }
        return {
          id,
          sl,
          particulars,
          qty,
          vendors: cleanVendors,
        };
      }
    );

    const updatedFormData = {
      ...formData,
      tableData: transformedTableData,
      selectedVendorIndex: selectedIndex,
      selectedVendorReason: selectedReason,
      receiptupdated: new Date(),
    };
    const updatedreceipt = await updatereceipt(cs_id, updatedFormData);
    return res.status(200).json({
      message: "Receipt updated successfully",
      receipt: updatedreceipt,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

export const removeReceipt = async (req, res) => {
  const { cs_id } = req.params;
  const { formData } = await fetchoneReceiptFormData(cs_id);

  if (formData.length == 0) {
    return res.status(404).json({ error: "Statement not found" });
  }
  try {
    const deletedstatement = await removeStatement(cs_id);
    return res.status(200).json(deletedstatement);
  } catch (error) {}
};

export const fetchApproverDetails = async (req, res) => {
  const { cs_id } = req.params;

  if (!cs_id) {
    return res.status(400).json({ error: "cs_id parameter is required" });
  }

  try {
    const details = await getApproverDetailsByCSId(cs_id);
    if (details.length === 0) {
      return res.status(400).json({ message: "No approver details found" });
    }
    return res.status(200).json({ approverDetails: details });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
};

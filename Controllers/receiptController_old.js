const Receipt = require("../Models/receiptModel_old");

const feedReceipt = async (req, res) => {
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
    const mrexists = await Receipt.findOne({
      "formData.equipMrNoValue": formData.equipMrNoValue,
    });

    if (mrexists) {
      return res
        .status(400)
        .json({ message: "Receipt with this equipment number already exists" });
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

    const newReceipt = await Receipt.create({
      formData,
      tableData: transformedTableData,
    });

    return res
      .status(201)
      .json({ message: "Receipt saved successfully", receipt: newReceipt });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const fetchReceipts = async (req, res) => {
  const query = Receipt.find({});
  const Receipts = await query.exec();
  const totalReceipts = await Receipt.countDocuments({});

  res.json({ receipts: Receipts, total: totalReceipts });
};

const fetchReceipt = async (req, res) => {
  try {
    const { mrno } = req.params;
    const receipt = await Receipt.findOne({ "formData.equipMrNoValue": mrno });

    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    res.json(receipt);
  } catch (error) {
    console.error("Error fetching receipt:", error);
    res.status(500).json({ error: error.message });
  }
};

const updatestatus = async (req, res) => {
  try {
    const { mrno } = req.params;
    const { selectedVendorIndex } = req.body;
    const { selectedVendorReason } = req.body;
    const { status } = req.body;

    const receiptExists = await Receipt.findOne({
      "formData.equipMrNoValue": mrno,
    });

    if (!receiptExists) {
      return res.status(404).json({ error: "Receipt not found" });
    }
    const receipt = await Receipt.findOneAndUpdate(
      { "formData.equipMrNoValue": mrno },
      {
        $set: {
          "formData.selectedVendorIndex": selectedVendorIndex,
          "formData.selectedVendorReason": selectedVendorReason,
          "formData.sentForApproval": "yes",
          "formData.status": status,
        },
      },
      { new: true }
    );

    res.json(receipt);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateApprovalstatus = async (req, res) => {
  try {
    const { mrno } = req.params;
    const { action } = req.body;
    const { approverComments } = req.body || {};
    const { role } = req.body;
    const { userId } = req.body;
    const { status } = req.body;
    const { rejectedby } = req.body || null;
    const { approverstatus } = req.body || null;

    const receipt = await Receipt.findOneAndUpdate(
      { "formData.equipMrNoValue": mrno },
      {
        $push: {
          "formData.approverdetails": {
            role: role,
            userId: userId,
            action: action,
            approverstatus: approverstatus,
            comments: approverComments,
            rejectedby: rejectedby,
          },
        },
        $set: {
          "formData.status": status,
        },
      },
      { new: true }
    );
    res.json(receipt);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateReceipt = async (req, res) => {
  try {
    const { mrno } = req.params;
    const { formData, tableData, selectedIndex, selectedReason } = req.body;
    if (formData.type != "asset") {
      for (const [key, value] of Object.entries(formData)) {
        if (
          key === "file" ||
          key == "receiptupdated" ||
          key == "selectedVendorReason"
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

    const existingReceipt = await Receipt.findOne({
      "formData.equipMrNoValue": mrno,
    });

    if (!existingReceipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    await existingReceipt.save();

    existingReceipt.formData = formData;
    if (transformedTableData) existingReceipt.tableData = transformedTableData;
    existingReceipt.formData.selectedVendorIndex = selectedIndex;
    existingReceipt.formData.selectedVendorReason = selectedReason;
    existingReceipt.formData.receiptupdated = new Date();

    await existingReceipt.save();

    return res.status(200).json({
      message: "Receipt updated successfully",
      receipt: existingReceipt,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const removeReceipt = async (req, res) => {
  try {
    const { mrno } = req.params;
    const receipt = await Receipt.findOne({ "formData.equipMrNoValue": mrno });

    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    await Receipt.findOneAndDelete({
      "formData.equipMrNoValue": mrno,
    });
    res.status(200).json({ message: "The receipt is successfully deleted!!" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  feedReceipt,
  fetchReceipts,
  fetchReceipt,
  updatestatus,
  updateApprovalstatus,
  removeReceipt,
  updateReceipt,
};

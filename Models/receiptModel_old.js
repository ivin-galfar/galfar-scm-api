const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const formDataSchema = mongoose.Schema({
  hiringName: { type: String },
  dateValue: { type: String },
  projectValue: { type: String },
  locationValue: { type: String },
  equipMrNoValue: {
    type: String,
    required: true,
  },
  emRegNoValue: { type: String },
  requiredDateValue: { type: String },
  qty: { type: Number },
  requirementDurationValue: { type: String },
  sentForApproval: { type: String },
  selectedVendorIndex: { type: Number },
  selectedVendorReason: { type: String },
  status: { type: String },
  currency: { type: String },
  receiptupdated: { type: Date },
  type: { type: String, enum: ["asset", "hiring"] },
  approverdetails: [
    {
      role: {
        type: String,
        required: true,
        enum: ["Initiator", "HOD", "GM", "CEO"],
      },
      userId: {
        type: String,
        required: true,
      },
      approverstatus: { type: String },
      action: { type: String },
      comments: { type: String },
      rejectedby: { type: String },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  file: { type: [String], required: false },
});

const tableRowSchema = mongoose.Schema({
  id: { type: String, required: true },
  sl: { type: String },
  particulars: { type: String },
  qty: { type: String },
  vendors: {
    type: Map,
    of: String,
  },
});

const dataSchema = mongoose.Schema(
  {
    formData: formDataSchema,
    tableData: [tableRowSchema],
  },
  {
    timestamps: true,
  }
);

const Receipts = mongoose.model("Receipts", dataSchema);

module.exports = Receipts;

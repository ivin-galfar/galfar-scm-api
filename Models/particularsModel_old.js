const mongoose = require("mongoose");

const particularsSchema = mongoose.Schema(
  {
    owner: {
      type: String,
      required: true,
    },
    template: {
      type: String,
      required: true,
    },
    particulars: {
      type: [String],
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);
const Particulars = mongoose.model("Particulars", particularsSchema);
module.exports = Particulars;

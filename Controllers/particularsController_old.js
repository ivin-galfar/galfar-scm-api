const Particulars = require("../Models/particularsModel");

const feedParticulars = async (req, res) => {
  const { created, template } = req.body;

  try {
    const particularNameExists = await Particulars.findOne({
      template: template.name,
    });

    if (particularNameExists) {
      return res
        .status(400)
        .json({ message: "The template Name already exists!!" });
    }
    const companyName = "Vendor Name";
    const recommendation = "Recommendation (If Any)";
    const newParticulars = await Particulars.create({
      template: template.name,
      owner: created.owner,
      createdDate: new Date(),
      particulars: [companyName, ...template.particulars, recommendation],
    });
    return res.status(201).json({
      message: "Template created successfully",
      Template: newParticulars,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const fetchParticulars = async (req, res) => {
  const query = Particulars.find({});
  const Particularstemplates = await query.exec();
  const totalParticularstemplates = await Particulars.countDocuments({});

  res.json({
    Particulars: Particularstemplates,
    Particulars_total: totalParticularstemplates,
  });
};

const fetchParticularstemplate = async (req, res) => {
  const { pid } = req.params;

  try {
    const particular = await Particulars.findOne({
      template: pid,
    });
    if (!particular) {
      return res.status(404).json({ error: "Receipt not found" });
    }
    res.json({ particular });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteparticular = async (req, res) => {
  const { pid } = req.params;

  try {
    const particular = await Particulars.findOne({
      template: pid,
    });
    if (!particular) {
      return res.status(404).json({ error: "Receipt not found" });
    }
    await Particulars.deleteOne({ template: pid });
    return res.status(200).json({ message: "Particular deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  feedParticulars,
  fetchParticulars,
  fetchParticularstemplate,
  deleteparticular,
};

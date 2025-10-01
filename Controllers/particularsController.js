import {
  deleteParticular,
  existingparticulars,
  feedParticular,
  fetchAllParticulars,
  fetchParticularTemplate,
} from "../Models/particularsModel.js";

export const feedParticulars = async (req, res) => {
  const { created, template } = req.body;
  try {
    const templateexists = await existingparticulars(template.name);
    if (templateexists.length > 0) {
      return res
        .status(401)
        .json(" Particular with same name already Exists!!");
    }
    const companyName = "Vendor Name";
    const recommendation = "Recommendation (If Any)";
    const created_at = new Date();
    const particulars = [companyName, ...template.particulars, recommendation];
    const newParticulars = await feedParticular(
      created.owner,
      template.name,
      particulars,
      created_at
    );
    return res.status(201).json({
      message: "Template created successfully",
      Template: newParticulars,
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const fetchParticulars = async (req, res) => {
  try {
    const fetchParticular = await fetchAllParticulars();
    return res.status(200).json({
      Particulars: fetchParticular,
    });
  } catch (error) {}
};

export const fetchParticularTemplates = async (req, res) => {
  const { name } = req.params;
  try {
    const particular = await fetchParticularTemplate(name);
    return res.json({ particular });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteparticular = async (req, res) => {
  const { name } = req.params;

  const templateexists = await existingparticulars(name);

  if (templateexists.length == 0) {
    return res.status(404).json(" Particular not exists!!");
  }
  try {
    await deleteParticular(name);
    return res.status(200).json({ message: "Particular deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

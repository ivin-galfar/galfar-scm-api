import { feedDepartment } from "../Models/departmentModel.js";

export const AddDepartment = async (req, res) => {
  const { name } = req.body;
  try {
    const feeddept = await feedDepartment(name);
    return res.status(200).json(feeddept);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

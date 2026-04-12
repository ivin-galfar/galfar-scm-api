import { projectdetails } from "../Models/projectModel.js";

export const FetchProjects = async (req, res) => {
  try {
    const fetchprojects = await projectdetails();
    return res.status(200).json(fetchprojects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

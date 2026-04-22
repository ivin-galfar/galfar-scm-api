import {
  InsertProjectdetails,
  PmCmNames,
  projectdetails,
} from "../Models/projectModel.js";

export const FetchProjects = async (req, res) => {
  try {
    const fetchprojects = await projectdetails();
    return res.status(200).json(fetchprojects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const Addprojectdetails = async (req, res) => {
  const { requiredrole, project, status, name, email } = req.body;

  try {
    const Adddetails = await InsertProjectdetails(
      requiredrole,
      project,
      status,
      [name],
      email,
    );
    return res.status(200).json(Adddetails);
  } catch (error) {
    console.log(error);

    res.status(500).json({ error: error.message });
  }
};

export const FetchPmCmNames = async (req, res) => {
  const { requiredrole, project } = req.query;
  try {
    const fetchprojects = await PmCmNames(requiredrole, project);
    return res.status(200).json(fetchprojects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

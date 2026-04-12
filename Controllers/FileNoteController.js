import {
  filenote,
  insertFileNotes,
  lastfnid,
  onefilenote,
  updatefilenote,
  softdeletefn,
} from "../Models/FileNoteModel.js";

export const AddFileNotes = async (req, res) => {
  const {
    name,
    content,
    dept_id,
    type,
    category,
    file_names,
    file_urls,
    project,
  } = req.body;

  try {
    const filenote = await insertFileNotes({
      name,
      content,
      dept_id,
      type,
      category,
      file_names,
      file_urls,
      project,
    });
    return res.status(200).json(filenote);
  } catch (error) {
    console.error("AddFileNotes Error:", error.message);
    console.error("Error Details:", error);
    return res
      .status(500)
      .json({ error: error.message, details: error.detail });
  }
};

export const fetchfnids = async (req, res) => {
  const { module, statusfilter, page, limit, searchcs, count } = req.query;
  const project_code = req.query["project_code[]"];
  const roles = req.query?.role.split(",");

  const department_id = req.query?.dept_id.split(",");
  const isadmin = req.query.isadmin === "true";
  let updatedRoles = roles.filter((r) => r !== "initfn")[0];
  // if (!roles.includes("initpr"))
  //   updatedRoles = roles.filter((r) => r == "initfn")[0];

  try {
    const fnotes = await filenote(
      module,
      department_id,
      updatedRoles,
      isadmin,
      project_code,
      statusfilter,
      page,
      limit,
      searchcs,
      count,
    );

    return res.status(200).json(fnotes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const fetchfnvalue = async (req, res) => {
  const { fnid } = req.params;
  const roles = req.query?.role.split(",");
  const isadmin = req.query.isadmin === "true";
  const updatedRoles = roles.filter((r) => r !== "initfn")[0];
  try {
    const fnidvalue = await onefilenote(fnid, isadmin, updatedRoles);
    return res.status(200).json(fnidvalue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updatefnvalue = async (req, res) => {
  const { fnid } = req.params;
  const { sentforapproval, status, comments, role } = req.body;

  try {
    const fnidvalue = await updatefilenote(
      fnid,
      sentforapproval,
      status,
      role,
      comments,
    );
    return res.status(200).json(fnidvalue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const fetchfn = async (req, res) => {
  const { dept_id, category, project_code } = req.query;
  try {
    const fnidvalue = await lastfnid(dept_id, category, project_code);
    return res.status(200).json(fnidvalue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deletefn = async (req, res) => {
  const { fnid } = req.params;
  try {
    const deletedfn = await softdeletefn(fnid);
    return res.status(200).json(deletedfn);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

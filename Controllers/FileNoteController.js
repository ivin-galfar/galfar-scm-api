import {
  filenote,
  insertFileNotes,
  lastfnid,
  onefilenote,
  updatefilenote,
} from "../Models/FileNoteModel.js";

export const AddFileNotes = async (req, res) => {
  const { name, content, dept_id, type, category, file_names, file_urls } =
    req.body;

  try {
    const filenote = await insertFileNotes({
      name,
      content,
      dept_id,
      type,
      category,
      file_names,
      file_urls,
    });
    return res.status(200).json(filenote);
  } catch (error) {
    throw error;
  }
};

export const fetchfnids = async (req, res) => {
  const { module, dept_id, statusfilter, page, limit, searchcs } = req.query;
  const roles = req.query?.role.split(",");
  const isadmin = req.query.isadmin === "true";
  const updatedRoles = roles.filter((r) => r !== "initfn")[0];

  try {
    const fnotes = await filenote(
      module,
      dept_id,
      updatedRoles,
      isadmin,
      statusfilter,
      page,
      limit,
      searchcs,
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
  const { dept_id, category } = req.query;
  try {
    const fnidvalue = await lastfnid(dept_id, category);
    return res.status(200).json(fnidvalue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

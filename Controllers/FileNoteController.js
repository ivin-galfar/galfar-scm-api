import {
  filenote,
  insertFileNotes,
  onefilenote,
  updatefilenote,
} from "../Models/FileNoteModel.js";

export const AddFileNotes = async (req, res) => {
  const { name, content, dept_id } = req.body;
  try {
    const filenote = await insertFileNotes({ name, content, dept_id });
    return res.status(200).json(filenote);
  } catch (error) {
    throw error;
  }
};

export const fetchfnids = async (req, res) => {
  const { module, role, statusfilter, page, limit, searchcs } = req.query;

  try {
    const Brstatements = await filenote(
      module,
      role,
      statusfilter,
      page,
      limit,
      searchcs,
    );

    return res.status(200).json(Brstatements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const fetchfnvalue = async (req, res) => {
  const { fnid } = req.params;
  try {
    const fnidvalue = await onefilenote(fnid);
    return res.status(200).json(fnidvalue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updatefnvalue = async (req, res) => {
  const { fnid } = req.params;
  const { sentforapproval, status } = req.body;
  try {
    const fnidvalue = await updatefilenote(fnid, sentforapproval, status);
    return res.status(200).json(fnidvalue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

import {
  deleteAnnouncement,
  feedAnnouncements,
  getAnnouncementById,
  getAnnouncements,
  updateAnnouncement,
} from "../Models/Announcement.js";

const getAnnouncementInput = (body) => {
  const { name, desc, description, tag } = body;
  return { name, description: desc ?? description, tag };
};

const validateAnnouncementInput = ({ name, description, tag }) => {
  if (!name || typeof name !== "string" || !name.trim()) {
    return "name is required";
  }

  if (!tag) {
    return "tag is required";
  }
  if (!description || typeof description !== "string" || !description.trim()) {
    return "desc is required";
  }
  return null;
};

export const addAnnouncement = async (req, res) => {
  const input = getAnnouncementInput(req.body);

  const validationError = validateAnnouncementInput(input);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const announcement = await feedAnnouncements(
      input.name.trim(),
      input.description.trim(),
      input.tag.map((t) => t.trim()),
    );
    return res.status(201).json(announcement);
  } catch (error) {
    console.log();

    return res.status(500).json({ error: error.message });
  }
};

export const fetchAnnouncements = async (req, res) => {
  try {
    const announcements = await getAnnouncements();
    return res.status(200).json(announcements);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const fetchAnnouncement = async (req, res) => {
  try {
    const announcement = await getAnnouncementById(req.params.id);
    if (!announcement)
      return res.status(404).json({ error: "Announcement not found" });
    return res.status(200).json(announcement);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const editAnnouncement = async (req, res) => {
  const input = getAnnouncementInput(req.body);

  try {
    const announcement = await updateAnnouncement(
      req.params.id,
      input?.name?.trim(),
      input?.description?.trim(),
    );
    if (!announcement)
      return res.status(404).json({ error: "Announcement not found" });
    return res.status(200).json(announcement);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const removeAnnouncement = async (req, res) => {
  try {
    const announcement = await deleteAnnouncement(req.params.id);
    if (!announcement)
      return res.status(404).json({ error: "Announcement not found" });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

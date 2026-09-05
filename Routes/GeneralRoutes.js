import express from "express";
import {
  addAnnouncement,
  editAnnouncement,
  fetchAnnouncement,
  fetchAnnouncements,
  removeAnnouncement,
} from "../Controllers/Announcements.js";

const router = express.Router();

router.route("/").post(addAnnouncement).get(fetchAnnouncements);
router
  .route("/:id")
  .get(fetchAnnouncement)
  .put(editAnnouncement)
  .delete(removeAnnouncement);

export default router;

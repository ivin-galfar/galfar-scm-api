import express from "express";
import {
  deleteparticular,
  feedParticulars,
  fetchParticulars,
  fetchParticularTemplates,
} from "../Controllers/particularsController.js";

const router = express.Router();
router.route("/").post(feedParticulars);
router.route("/").get(fetchParticulars);
router.route("/:name").get(fetchParticularTemplates);
router.route("/:name").delete(deleteparticular);

export default router;

import express from "express";
import {
  deleteparticular,
  feedParticulars,
  fetchParticulars,
  fetchParticularTemplates,
  updateParticularsValue,
} from "../Controllers/particularsController.js";

const router = express.Router();
router.route("/").post(feedParticulars);
router.route("/:id").put(updateParticularsValue);
router.route("/").get(fetchParticulars);
router.route("/:id").get(fetchParticularTemplates);
router.route("/:id").delete(deleteparticular);

export default router;

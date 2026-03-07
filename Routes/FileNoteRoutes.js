import express from "express";
import {
  AddFileNotes,
  fetchfnids,
  fetchfnvalue,
  updatefnvalue,
} from "../Controllers/FileNoteController.js";
const router = express.Router();

router.route("/addfn").post(AddFileNotes);
router.route("/").get(fetchfnids);
router.route("/:fnid").get(fetchfnvalue);
router.route("/updatefn/:fnid").put(updatefnvalue);

export default router;

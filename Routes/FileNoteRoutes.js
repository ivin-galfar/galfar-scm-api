import express from "express";
import {
  AddFileNotes,
  fetchfn,
  fetchfnids,
  fetchfnvalue,
  updatefnvalue,
} from "../Controllers/FileNoteController.js";
const router = express.Router();

router.route("/addfn").post(AddFileNotes);
router.route("/").get(fetchfnids);
router.route("/fetchdocno/").get(fetchfn);
router.route("/:fnid").get(fetchfnvalue);
router.route("/updatefn/:fnid").put(updatefnvalue);

export default router;

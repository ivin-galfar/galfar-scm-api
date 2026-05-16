import express from "express";
import {
  AddFileNotes,
  fetchfn,
  fetchfnids,
  fetchfnvalue,
  updatefnvalue,
  deletefn,
  addCategory,
  fetchAllCategories,
  updateIoc,
} from "../Controllers/FileNoteController.js";
const router = express.Router();

router.route("/addfn").post(AddFileNotes);
router.route("/").get(fetchfnids);
router.route("/fetchdocno/").get(fetchfn);
router.route("/fetchcategory").get(fetchAllCategories);
router.route("/:fnid").get(fetchfnvalue);
router.route("/updatefn/:fnid").put(updatefnvalue);
router.route("/updatedemob/:fnid").put(updateIoc);
router.route("/deletefn/:fnid").put(deletefn);
router.route("/category").post(addCategory);

export default router;

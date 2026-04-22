import express from "express";
import {
  Addprojectdetails,
  FetchPmCmNames,
  FetchProjects,
} from "../Controllers/projectController.js";
const router = express.Router();

router.route("/").get(FetchProjects);
router.route("/").post(Addprojectdetails);
router.route("/cmpmnames").get(FetchPmCmNames);

export default router;

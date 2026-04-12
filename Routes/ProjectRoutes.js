import express from "express";
import { FetchProjects } from "../Controllers/projectController.js";
const router = express.Router();

router.route("/").get(FetchProjects);

export default router;

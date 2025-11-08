import express from "express";
import { AddDepartment } from "../Controllers/departmentController.js";
const router = express.Router();

router.route("/").post(AddDepartment);

export default router;

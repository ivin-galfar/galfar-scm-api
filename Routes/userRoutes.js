import express from "express";
import {
  authUser,
  createUser,
  updateisDocRead,
  verifyUser,
} from "../Controllers/userController.js";

const router = express.Router();

router.post("/login", authUser);
router.post("/register", createUser);
router.put("/updatedocread", updateisDocRead);
router.post("/validateemail", verifyUser);
router.get("/data", verifyUser);
export default router;

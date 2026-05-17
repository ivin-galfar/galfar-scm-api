import express from "express";
import {
  authUser,
  createUser,
  updateisDocRead,
} from "../Controllers/userController.js";

const router = express.Router();

router.post("/login", authUser);
router.post("/register", createUser);
router.put("/updatedocread", updateisDocRead);

export default router;

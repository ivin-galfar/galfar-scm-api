import express from "express";
import { authUser, createUser } from "../Controllers/userController.js";

const router = express.Router();

router.post("/login", authUser);
router.post("/register", createUser);

export default router;

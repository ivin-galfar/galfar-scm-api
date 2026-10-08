import express from "express";
import {
  authUser,
  createUser,
  updateisDocRead,
  verifyUser,
} from "../Controllers/userController.js";
import { createUserPermission } from "../Controllers/userPermissionController.js";

const router = express.Router();

router.post("/login", authUser);
router.post("/register", createUser);
router.post("/permissions", createUserPermission);
router.put("/updatedocread", updateisDocRead);
router.post("/validateemail", verifyUser);
export default router;

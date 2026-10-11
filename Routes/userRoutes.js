import express from "express";
import {
  authUser,
  createUser,
  updateisDocRead,
  verifyUser,
} from "../Controllers/userController.js";
import { createUserPermission } from "../Controllers/userPermissionController.js";
import { fetchUserPhoto } from "../Controllers/sharePoint.js";

const router = express.Router();

router.post("/login", authUser);
router.post("/register", createUser);
router.post("/permissions", createUserPermission);
router.put("/updatedocread", updateisDocRead);
router.post("/validateemail", verifyUser);
router.get("/user-photo/:email", fetchUserPhoto);

export default router;

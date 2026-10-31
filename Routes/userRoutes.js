import express from "express";
import {
  authUser,
  createUser,
  logoutUser,
  updateisDocRead,
  verifyUser,
} from "../Controllers/userController.js";
import { createUserPermission } from "../Controllers/userPermissionController.js";
import { fetchUserPhoto } from "../Controllers/sharePoint.js";
import verifyToken from "../Utils/jwtTokenValidation.js";

const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (!req.user?.is_admin) {
    return res.status(403).json({ message: "Administrator access required" });
  }
  return next();
};

router.post("/login", authUser);
router.post("/logout", logoutUser);
router.post("/register", createUser);
router.post("/permissions", verifyToken, requireAdmin, createUserPermission);
router.put("/updatedocread", verifyToken, updateisDocRead);
router.post("/validateemail", verifyUser);
router.get("/user-photo/:email", fetchUserPhoto);

export default router;

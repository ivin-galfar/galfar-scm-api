import jwt from "jsonwebtoken";
import { getuserById } from "../Models/userModel.js";

function verifyToken(req, res, next) {
  const token = req.cookies?.access_token;

  const clearAuthCookie = () =>
    res.clearCookie("access_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

  if (!token) {
    clearAuthCookie();
    return res.status(401).json({ message: "Authentication required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err || !user?.id) {
      clearAuthCookie();
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    try {
      const userInfo = await getuserById(user.id);

      if (!userInfo) {
        clearAuthCookie();
        return res.status(401).json({ message: "User not found" });
      }
      req.user = userInfo;

      next();
    } catch (error) {
      console.error("Error fetching user:", error);

      return res.status(500).json({
        message: "Failed to get user details",
      });
    }
  });
}

export default verifyToken;

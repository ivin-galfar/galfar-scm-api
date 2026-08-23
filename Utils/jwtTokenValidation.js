import jwt from "jsonwebtoken";
import { getuserById } from "../Models/userModel.js";

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "No token provided" });
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    try {
      const userInfo = await getuserById(user.id);

      if (!userInfo) {
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

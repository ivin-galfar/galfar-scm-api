import {
  addUser,
  existing,
  updateDocRead,
  updatePasswordResetToken,
} from "../Models/userModel.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import generateToken from "../Utils/generateToken.js";
export const createUser = async (req, res) => {
  const { email, password, isAdmin, role, deptcode, pr_code } = req.body;

  const hasAccount = await existing(email);
  if (hasAccount.length > 0) {
    return res.status(401).json(" User already Exists!!");
  }

  try {
    const createdAt = new Date();
    const user = await addUser(
      email,
      password,
      isAdmin,
      role,
      deptcode,
      pr_code,
      createdAt,
    );
    res.json(user);
  } catch (er) {
    res.status(500).json({ error: er.message });
  }
};

export const authUser = async (req, res) => {
  const { email, password } = req.body;

  const hasAccount = await existing(email);
  let user = hasAccount[0];

  try {
    if (hasAccount.length === 0) {
      return res.status(401).json("User not Registered!");
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json("Invalid Credentials!");
    }
    const token = generateToken(user.id);
    res.json({
      ...user,
      token,
    });
  } catch (er) {
    res.status(500).json({ error: er.message });
  }
};
export const updateisDocRead = async (req, res) => {
  const { email, click } = req.body;

  try {
    const updated = await updateDocRead(click, email);

    return res.status(200).json(updated[0].isdoc_read);
  } catch (error) {
    res.status(500).json({ error: er.message });
  }
};

export const verifyUser = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  try {
    const hasAccount = await existing(email);
    if (hasAccount.length === 0) {
      return res.status(404).json("Email not registered!");
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await updatePasswordResetToken(hasAccount[0].id, hashedToken, expires);

    return res.status(200).json({
      email: hasAccount[0].email,
      resetToken,
      hashedToken,
      expires,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



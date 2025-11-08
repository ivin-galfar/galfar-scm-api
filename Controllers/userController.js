import { addUser, existing } from "../Models/userModel.js";
import bcrypt from "bcryptjs";
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
      createdAt
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

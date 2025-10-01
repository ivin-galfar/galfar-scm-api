import bcrypt from "bcryptjs";

const saltRounds = 10;

export async function Hashpassword(password) {
  try {
    const hashed = await bcrypt.hash(password, saltRounds);
    return hashed;
  } catch (error) {
    throw new Error("Error hashing password: " + error.message);
  }
}

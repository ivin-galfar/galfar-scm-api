import { addUserPermissions } from "../Models/userPermissions.js";

export const createUserPermission = async (req, res) => {
  const { statement_role, allowed_role, access_level } = req.body ?? {};

  if (
    statement_role == null ||
    statement_role === "" ||
    allowed_role == null ||
    allowed_role === "" ||
    access_level == null
  ) {
    return res.status(400).json({
      error:
        "statement_role, allowed_role, and access_level (or access) are required.",
    });
  }

  try {
    const permission = await addUserPermissions(
      statement_role,
      allowed_role,
      access_level,
    );

    return res.status(201).json(permission);
  } catch (error) {
    console.log(error);

    return res.status(500).json({ error: error.message });
  }
};

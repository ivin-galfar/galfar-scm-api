import pool from "../Config/db.js";

export const feedParticular = async (
  owner,
  template,
  particulars,
  created_at
) => {
  const { rows } = await pool.query(
    "INSERT INTO particulars (owner,template,particulars,created_at) VALUES ($1,$2,$3,$4) RETURNING *",
    [owner, template, particulars, created_at]
  );

  return rows[0];
};

export const existingparticulars = async (id) => {
  const existing = await pool.query("SELECT * FROM particulars where id= $1", [
    id,
  ]);
  return existing.rows;
};

export const existingParticularsByName = async (template) => {
  const existing = await pool.query(
    "SELECT * FROM particulars where template= $1",
    [template]
  );
  return existing.rows;
};

export const fetchAllParticulars = async () => {
  const { rows } = await pool.query("SELECT * FROM particulars ");
  return rows;
};
export const fetchParticularTemplate = async (id) => {
  const { rows } = await pool.query("SELECT * FROM particulars where id =$1", [
    id,
  ]);
  return rows[0] || null;
};

export const deleteParticular = async (id) => {
  const { rows } = await pool.query(
    "DELETE FROM public.particulars where id =$1",
    [id]
  );
  return rows;
};

import pool from "../Config/db.js";

export const feedParticular = async (
  owner,
  template,
  particulars,
  created_at,
  dept_code
) => {
  const { rows } = await pool.query(
    "INSERT INTO particulars (owner,template,particulars,created_at,dept_code) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [owner, template, particulars, created_at, dept_code]
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

export const fetchAllParticulars = async (dept_code) => {
  let query = "SELECT * FROM particulars where dept_code = $1";
  let params = [dept_code];

  const { rows } = await pool.query(query, params);
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

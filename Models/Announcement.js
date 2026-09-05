import pool from "../Config/db.js";

export const feedAnnouncements = async (name, description, tag) => {
  const query = `
		INSERT INTO announcements (name, "desc","tag")
		VALUES ($1, $2,$3)
		RETURNING id, name, "desc",tag, created_date`;
  const { rows } = await pool.query(query, [name, description, tag]);
  return rows[0];
};

export const getAnnouncements = async () => {
  const query = `
		SELECT id, name, "desc",tag, created_date
		FROM announcements
		ORDER BY created_date DESC, id DESC`;
  const { rows } = await pool.query(query);
  return rows;
};

export const getAnnouncementById = async (id) => {
  const query = `
		SELECT id, name, "desc", created_date
		FROM announcements
		WHERE id = $1`;
  const { rows } = await pool.query(query, [id]);
  return rows[0];
};

export const updateAnnouncement = async (id, name, description) => {
  const query = `
		UPDATE announcements
		SET name = $1, "desc" = $2
		WHERE id = $3
		RETURNING id, name, "desc", created_date`;
  const { rows } = await pool.query(query, [name, description, id]);
  return rows[0];
};

export const deleteAnnouncement = async (id) => {
  const query = `
		DELETE FROM announcements
		WHERE id = $1
		RETURNING id`;
  const { rows } = await pool.query(query, [id]);
  return rows[0];
};

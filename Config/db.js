import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  // ssl: {
  //   rejectUnauthorized: true, // ensure encryption
  // },
});
export const connectDB = async () => {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log(
      "✅ PostgreSQL connected successfully! Server time:",
      res.rows[0].now
    );
  } catch (error) {
    console.error("❌ PostgreSQL connection failed:", error);
    process.exit(1);
  }
};

export default pool;

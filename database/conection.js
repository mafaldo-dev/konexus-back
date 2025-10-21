import pkg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export default pool;

import pkg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const { Pool } = pkg;
{/*
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});
*/}


{/**/}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL || "postgresql://postgres:!devgui123@@db:5432/guiman",
});

console.log("[DB] Conectado ao banco LOCAL (container Docker)");


export default pool;
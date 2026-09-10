import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import DB from "./config/knex.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function checkAndInitDatabase(force = false) {
  try {
    const hasTable = await DB.schema.hasTable("user_credential");
    if (hasTable && !force) {
      console.log("✅ Database verified: table 'user_credential' exists.");
      return { status: "ready", message: "Database already initialized." };
    }

    console.log("⚠️ Table 'user_credential' not found. Initializing database from SQL dump...");

    const possiblePaths = [
      path.join(__dirname, "../db_klinik_kecantikan.sql"),
      path.join(process.cwd(), "db_klinik_kecantikan.sql"),
      path.join(process.cwd(), "../db_klinik_kecantikan.sql"),
    ];

    const sqlFile = possiblePaths.find((p) => fs.existsSync(p));
    if (!sqlFile) {
      console.error("❌ SQL dump file db_klinik_kecantikan.sql not found!");
      return { status: "error", message: "SQL dump file not found." };
    }

    const sqlContent = fs.readFileSync(sqlFile, "utf8");

    // Execute SQL script
    await DB.raw(sqlContent);
    console.log("✅ Database initialized successfully from db_klinik_kecantikan.sql!");
    return { status: "success", message: "Database initialized successfully." };
  } catch (error) {
    console.error("❌ Error initializing database:", error.message);
    return { status: "error", message: error.message };
  }
}

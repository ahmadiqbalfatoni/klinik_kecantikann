import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import DB from "./config/knex.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getSqlDump() {
  const possiblePaths = [
    path.join(__dirname, "../db_klinik_kecantikan.sql"),
    path.join(process.cwd(), "express_standart_be/db_klinik_kecantikan.sql"),
    path.join(process.cwd(), "db_klinik_kecantikan.sql"),
    path.join(process.cwd(), "../db_klinik_kecantikan.sql"),
  ];

  const sqlFile = possiblePaths.find((p) => fs.existsSync(p));
  if (!sqlFile) {
    return null;
  }
  return fs.readFileSync(sqlFile, "utf8");
}

/**
 * Non-destructive automated migration & schema sync for existing databases
 */
export async function syncDatabaseSchema() {
  const logs = [];
  try {
    // 1. Check/create mst_cabang
    const hasCabangTable = await DB.schema.hasTable("mst_cabang");
    if (!hasCabangTable) {
      console.log("⚙️ Creating table mst_cabang...");
      await DB.schema.createTable("mst_cabang", (table) => {
        table.increments("id").primary();
        table.string("kode_cabang", 50).notNullable().unique();
        table.string("nama_cabang", 150).notNullable();
        table.text("alamat").nullable();
        table.string("no_telp", 50).nullable();
        table.string("email", 100).nullable();
        table.string("pj_manager", 100).nullable();
        table.enum("status", ["aktif", "tidak aktif"]).defaultTo("aktif");
        table.string("tz", 50).defaultTo("Asia/Jakarta");
        table.string("created_by", 100).nullable();
        table.timestamp("created_at").defaultTo(DB.fn.now());
        table.string("updated_by", 100).nullable();
        table.timestamp("updated_at").defaultTo(DB.fn.now());
      });
      logs.push("Created table mst_cabang");
    }

    // 2. Ensure default CBG-001
    const hasMstCabangNow = await DB.schema.hasTable("mst_cabang");
    if (hasMstCabangNow) {
      const cbgUtama = await DB("mst_cabang").where("kode_cabang", "CBG-001").first();
      if (!cbgUtama) {
        await DB("mst_cabang").insert({
          kode_cabang: "CBG-001",
          nama_cabang: "Klinik Cabang Utama",
          alamat: "Kantor Pusat Klinik Kecantikan",
          no_telp: "081234567890",
          email: "pusat@klinik.com",
          pj_manager: "Manager Utama",
          status: "aktif",
          created_by: "SYSTEM",
        });
        logs.push("Seeded default CBG-001");
      }
    }

    // 3. Ensure kode_cabang in target tables
    const targetTables = [
      "user_credential",
      "mst_pasien",
      "mst_karyawan",
      "mst_jadwal_karyawan",
      "mst_ruangan",
      "mst_alat",
      "mst_produk",
      "mst_layanan",
      "mst_paket_layanan",
      "mst_paket_produk",
      "mst_promo",
      "mst_detail_promo",
      "mst_supplier",
      "mst_kategori_layanan",
      "mst_kategori_produk",
      "trx_kunjungan",
      "trx_antrian_awal",
      "trx_antrian_layanan",
      "trx_booking",
      "trx_transaksi",
      "trx_detail_transaksi",
      "trx_rekam_medis",
      "trx_purchase_order",
      "trx_stok_movement",
      "trx_kepemilikan_paket_layanan",
      "trx_kepemilikan_paket_produk"
    ];

    for (const tbl of targetTables) {
      const hasTbl = await DB.schema.hasTable(tbl);
      if (!hasTbl) continue;

      const hasCol = await DB.schema.hasColumn(tbl, "kode_cabang");
      if (!hasCol) {
        await DB.schema.table(tbl, (table) => {
          table.string("kode_cabang", 50).nullable().index();
        });
        logs.push(`Added kode_cabang to ${tbl}`);
      }

      // Link any existing null rows to CBG-001 (except superadmin user_credential)
      if (tbl !== "user_credential") {
        await DB(tbl)
          .whereNull("kode_cabang")
          .orWhere("kode_cabang", "")
          .update({ kode_cabang: "CBG-001" });
      }
    }

    // 4. Ensure durasi_menit in trx_detail_antrian_layanan, trx_detail_booking, and mst_layanan
    if (await DB.schema.hasTable("trx_detail_antrian_layanan")) {
      const hasDurasi = await DB.schema.hasColumn("trx_detail_antrian_layanan", "durasi_menit");
      if (!hasDurasi) {
        await DB.schema.table("trx_detail_antrian_layanan", (table) => {
          table.integer("durasi_menit").notNullable().defaultTo(30).after("harga");
        });
        logs.push("Added durasi_menit to trx_detail_antrian_layanan");
      }
    }

    if (await DB.schema.hasTable("trx_detail_booking")) {
      const hasDurasi = await DB.schema.hasColumn("trx_detail_booking", "durasi_menit");
      if (!hasDurasi) {
        await DB.schema.table("trx_detail_booking", (table) => {
          table.integer("durasi_menit").notNullable().defaultTo(0).after("harga");
        });
        logs.push("Added durasi_menit to trx_detail_booking");
      }
    }

    if (await DB.schema.hasTable("mst_layanan")) {
      const hasDurasi = await DB.schema.hasColumn("mst_layanan", "durasi_menit");
      if (!hasDurasi) {
        await DB.schema.table("mst_layanan", (table) => {
          table.integer("durasi_menit").notNullable().defaultTo(30).after("harga");
        });
        logs.push("Added durasi_menit to mst_layanan");
      }
    }

    // 5. Ensure manager user exists
    if (await DB.schema.hasTable("user_credential")) {
      const managerUsername = "manager@klinik.com";
      const managerUser = await DB("user_credential").where("username", managerUsername).first();
      if (!managerUser) {
        const lastUser = await DB("user_credential")
          .where("user_code", "like", "USR%")
          .orderBy("user_code", "desc")
          .first();
        let nextNum = 1;
        if (lastUser && lastUser.user_code) {
          const numPart = parseInt(lastUser.user_code.replace("USR", ""), 10);
          if (!isNaN(numPart)) nextNum = numPart + 1;
        }
        const cUserCode = `USR${String(nextNum).padStart(6, "0")}`;
        const rawPassword = "password123";
        const userKey = process.env.USER_KEY || "random";
        const secret = process.env.USER_SECRET || "random";
        const cPassword = userKey + cUserCode + rawPassword;
        const hashedPassword = crypto.createHmac("sha512", secret).update(cPassword).digest("hex");

        await DB("user_credential").insert({
          user_code: cUserCode,
          username: managerUsername,
          fullname: "Manager Cabang Utama",
          telp: "081122334455",
          role: "owner",
          password: hashedPassword,
          status: "1",
          kode_cabang: "CBG-001",
          tz: "Asia/Jakarta",
          created_by: "SYSTEM",
        });

        let navTemplate = null;
        if (await DB.schema.hasTable("mst_navigation")) {
          navTemplate = await DB("mst_navigation").where("role", "master").first();
        }
        if (!navTemplate && (await DB.schema.hasTable("user_navigation"))) {
          navTemplate = await DB("user_navigation").where("user_code", "USR000000").first();
        }
        if (navTemplate?.menu && (await DB.schema.hasTable("user_navigation"))) {
          await DB("user_navigation").insert({
            user_code: cUserCode,
            menu: navTemplate.menu,
          });
        }
        logs.push(`Created default manager account (${managerUsername})`);
      }
    }

    console.log("✅ Database schema sync completed:", logs.length > 0 ? logs : "All schemas up to date.");
    return { status: "success", logs };
  } catch (err) {
    console.error("⚠️ Schema auto-sync error:", err.message);
    return { status: "warning", error: err.message, logs };
  }
}

export async function checkAndInitDatabase(force = false) {
  try {
    const hasTable = await DB.schema.hasTable("user_credential");

    if (force) {
      console.log("⚠️ Force initializing database: dropping existing tables and restoring from SQL dump...");
      const sqlContent = getSqlDump();
      if (!sqlContent) {
        return { status: "error", message: "SQL dump file db_klinik_kecantikan.sql not found." };
      }

      await DB.raw("SET FOREIGN_KEY_CHECKS = 0;");
      const [tables] = await DB.raw("SHOW TABLES;");
      for (const row of tables) {
        const tableName = Object.values(row)[0];
        await DB.raw(`DROP TABLE IF EXISTS \`${tableName}\`;`);
      }
      await DB.raw(sqlContent);
      await DB.raw("SET FOREIGN_KEY_CHECKS = 1;");

      console.log("✅ Database successfully force-reinitialized from db_klinik_kecantikan.sql!");
      return { status: "success", message: "Database reinitialized successfully from SQL dump." };
    }

    if (hasTable) {
      console.log("✅ Database verified: table 'user_credential' exists. Running auto-sync...");
      const syncResult = await syncDatabaseSchema();
      return { status: "ready", message: "Database already initialized. Schema verified and synced.", sync: syncResult };
    }

    console.log("⚠️ Table 'user_credential' not found. Initializing database from SQL dump...");
    const sqlContent = getSqlDump();
    if (!sqlContent) {
      console.error("❌ SQL dump file db_klinik_kecantikan.sql not found!");
      return { status: "error", message: "SQL dump file not found." };
    }

    await DB.raw("SET FOREIGN_KEY_CHECKS = 0;");
    await DB.raw(sqlContent);
    await DB.raw("SET FOREIGN_KEY_CHECKS = 1;");
    console.log("✅ Database initialized successfully from db_klinik_kecantikan.sql!");

    // Run sync right after dump to guarantee all multi-branch / durasi settings
    await syncDatabaseSchema();

    return { status: "success", message: "Database initialized successfully." };
  } catch (error) {
    console.error("❌ Error initializing database:", error.message);
    return { status: "error", message: error.message };
  }
}

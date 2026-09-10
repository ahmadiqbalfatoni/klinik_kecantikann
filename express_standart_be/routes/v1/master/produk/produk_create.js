import express from "express";
import { status } from "../../components/tools/general.js";
import Joi from "joi";
import DB from "../../../../core/config/knex.js";
import { Logging, ChangesLog, validatePayload } from "../../components/tools/servertool.js";
import { formatDateSystem } from "../../components/tools/date_tools.js";
const router = express.Router();
router.post("/", async (req, res) => {
  const oPayload = req.body;
  const username = req?.auth?.username || "";
  try {
    const cValidation = await validatePayload(
      {
        nama: Joi.string().max(100).required().label("Nama Produk"),
        kode_kategori_produk: Joi.string().required().label("Kategori Produk"),
        satuan: Joi.string().max(20).required().label("Satuan"),
        harga_beli: Joi.number().min(0).required().label("Harga Beli"),
        harga_jual: Joi.number().min(0).required().label("Harga Jual"),
        stok_minimum: Joi.number().integer().min(0).optional().default(5).label("Stok Minimum"),
        stok_tersedia: Joi.number().integer().min(0).optional().default(0).label("Stok Tersedia"),
        status: Joi.string().valid("aktif", "nonaktif").required().label("Status"),
      },
      { "any.required": "{#label} wajib diisi", "string.empty": "{#label} tidak boleh kosong" },
      oPayload,
      { uniqueField: ["nama"], table: "mst_produk", allowUnknown: true }
    );
    if (cValidation) return res.status(422).json({ status: status.BAD_REQUEST, message: cValidation, datetime: formatDateSystem() });
    let kode = "";
    await DB.transaction(async (trx) => {
      const allPrd = await trx("mst_produk").where("kode_produk", "like", "PRD-%").select("kode_produk");
      let maxNum = 0;
      for (const p of allPrd) {
        const num = parseInt(p.kode_produk.replace("PRD-", ""), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
      kode = `PRD-${String(maxNum + 1).padStart(3, "0")}`;
      const oData = {
        kode_produk: kode,
        kode_kategori_produk: oPayload.kode_kategori_produk,
        nama: oPayload.nama,
        satuan: oPayload.satuan,
        harga_beli: oPayload.harga_beli,
        harga_jual: oPayload.harga_jual,
        stok_minimum: oPayload.stok_minimum ?? 5,
        stok_tersedia: oPayload.stok_tersedia ?? 0,
        status: oPayload.status,
        tz: oPayload.tz || "UTC",
        created_by: username,
        created_at: formatDateSystem(),
        updated_by: username,
        updated_at: formatDateSystem(),
      };
      await trx("mst_produk").insert(oData);
      await ChangesLog({ description: `Tambah Produk ${kode}`, tableName: "mst_produk", referenceCode: kode, action: "CREATE", dataBefore: null, dataAfter: oData, user: username, tz: oPayload.tz || "UTC" }, trx);
    });
    return res.status(200).json({ status: status.SUKSES, message: "Produk berhasil ditambahkan", datetime: formatDateSystem(), data: { kode_produk: kode } });
  } catch (error) {
    const oResult = { status: status.BAD_REQUEST, message: error.message || "Sistem sedang maintenance", datetime: formatDateSystem() };
    Logging(error, { file: "/master/produk/produk_create.js", func: "create", request: oPayload, response: oResult, user: username });
    return res.status(500).json(oResult);
  }
});
export default router;

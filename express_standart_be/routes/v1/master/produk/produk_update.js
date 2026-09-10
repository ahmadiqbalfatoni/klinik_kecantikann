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
        kode_produk: Joi.string().required().label("Kode Produk"),
        nama: Joi.string().max(100).required().label("Nama Produk"),
        kode_kategori_produk: Joi.string().required().label("Kategori Produk"),
        satuan: Joi.string().max(20).required().label("Satuan"),
        harga_beli: Joi.number().min(0).required().label("Harga Beli"),
        harga_jual: Joi.number().min(0).required().label("Harga Jual"),
        stok_minimum: Joi.number().integer().min(0).optional().label("Stok Minimum"),
        stok_tersedia: Joi.number().integer().min(0).optional().label("Stok Tersedia"),
        status: Joi.string().valid("aktif", "nonaktif").required().label("Status"),
      },
      { "any.required": "{#label} wajib diisi" },
      oPayload,
      { allowUnknown: true }
    );
    if (cValidation) return res.status(422).json({ status: status.BAD_REQUEST, message: cValidation, datetime: formatDateSystem() });
    await DB.transaction(async (trx) => {
      const prev = await trx("mst_produk").where("kode_produk", oPayload.kode_produk).forUpdate().first();
      if (!prev) { const e = new Error("Data tidak ditemukan"); e.statusCode = 404; throw e; }
      const oData = {
        kode_kategori_produk: oPayload.kode_kategori_produk,
        nama: oPayload.nama,
        satuan: oPayload.satuan,
        harga_beli: oPayload.harga_beli,
        harga_jual: oPayload.harga_jual,
        stok_minimum: oPayload.stok_minimum !== undefined ? oPayload.stok_minimum : prev.stok_minimum,
        stok_tersedia: oPayload.stok_tersedia !== undefined ? oPayload.stok_tersedia : prev.stok_tersedia,
        status: oPayload.status,
        updated_by: username,
        updated_at: formatDateSystem(),
      };
      await trx("mst_produk").where("kode_produk", oPayload.kode_produk).update(oData);
      await ChangesLog({ description: `Edit Produk ${oPayload.kode_produk}`, tableName: "mst_produk", referenceCode: oPayload.kode_produk, action: "UPDATE", dataBefore: prev, dataAfter: { ...prev, ...oData }, user: username, tz: oPayload.tz || "UTC" }, trx);
    });
    return res.status(200).json({ status: status.SUKSES, message: "Produk berhasil diupdate", datetime: formatDateSystem() });
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ status: status.NOT_FOUND, message: "Data tidak ditemukan", datetime: formatDateSystem() });
    const oResult = { status: status.BAD_REQUEST, message: "Sistem sedang maintenance", datetime: formatDateSystem() };
    Logging(error, { file: "/master/produk/produk_update.js", func: "update", request: oPayload, response: oResult, user: username });
    return res.status(500).json(oResult);
  }
});
export default router;

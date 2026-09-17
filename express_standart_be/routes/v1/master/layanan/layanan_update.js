/**
 * @project Sistem Klinik Kecantikan
 * @file layanan_update.js
 */
import express from "express";
import { status } from "../../components/tools/general.js";
import Joi from "joi";
import DB from "../../../../core/config/knex.js";
import { Logging, ChangesLog, validatePayload } from "../../components/tools/servertool.js";
import { formatDateSystem } from "../../components/tools/date_tools.js";
import { getBranchScope } from "../../components/tools/branch_scope.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { body } = req;
  const oPayload = body;
  const username = req?.auth?.username || "";
  const branchCode = getBranchScope(req, oPayload.kode_cabang);

  try {
    const cValidation = await validatePayload(
      {
        kode_layanan: Joi.string().required().label("Kode Layanan"),
        nama: Joi.string().max(100).required().label("Nama Layanan"),
        kode_kategori_layanan: Joi.string().required().label("Kategori Layanan"),
        kode_ruangan: Joi.string().optional().allow("", null).label("Ruangan"),
        wajib_konsultasi: Joi.string().valid("tidak", "opsional", "wajib").optional().label("Wajib Konsultasi"),
        kode_ruangan_konsultasi: Joi.string().optional().allow("", null).label("Ruangan Konsultasi"),
        tipe: Joi.string().valid("MEDICAL TREATMENT", "BEAUTY TREATMENT", "SERVICE TREATMENT").required().label("Tipe Layanan"),
        harga: Joi.number().min(0).required().label("Harga"),
        durasi_menit: Joi.number().integer().min(1).required().label("Durasi (Menit)"),
        status: Joi.string().valid("aktif", "nonaktif").required().label("Status"),
      },
      { "any.required": "{#label} wajib diisi", "string.empty": "{#label} tidak boleh kosong" },
      oPayload,
      { allowUnknown: true }
    );
    if (cValidation) return res.status(422).json({ status: status.BAD_REQUEST, message: cValidation, datetime: formatDateSystem() });

    await DB.transaction(async (trx) => {
      let qPrev = trx("mst_layanan").where("kode_layanan", oPayload.kode_layanan);
      if (branchCode) qPrev = qPrev.andWhere("kode_cabang", branchCode);
      const prevRecord = await qPrev.forUpdate().first();
      if (!prevRecord) { const e = new Error("Data tidak ditemukan"); e.statusCode = 404; throw e; }

      const wajibKonsul = oPayload.wajib_konsultasi || prevRecord.wajib_konsultasi || "tidak";
      const oData = {
        kode_kategori_layanan: oPayload.kode_kategori_layanan,
        kode_ruangan: oPayload.kode_ruangan || null,
        wajib_konsultasi: wajibKonsul,
        kode_ruangan_konsultasi: wajibKonsul !== "tidak" ? (oPayload.kode_ruangan_konsultasi || null) : null,
        nama: oPayload.nama,
        tipe: oPayload.tipe || prevRecord.tipe || "BEAUTY TREATMENT",
        harga: oPayload.harga,
        durasi_menit: oPayload.durasi_menit,
        status: oPayload.status,
        updated_by: username,
        updated_at: formatDateSystem(),
      };
      await trx("mst_layanan").where("kode_layanan", oPayload.kode_layanan).update(oData);
      await ChangesLog({ description: `Edit Layanan ${oPayload.kode_layanan}`, tableName: "mst_layanan", referenceCode: oPayload.kode_layanan, action: "UPDATE", dataBefore: prevRecord, dataAfter: { ...prevRecord, ...oData }, user: username, tz: oPayload.tz || "UTC" }, trx);
    });

    return res.status(200).json({ status: status.SUKSES, message: "Layanan berhasil diupdate", datetime: formatDateSystem() });
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ status: status.NOT_FOUND, message: "Data tidak ditemukan", datetime: formatDateSystem() });
    const oResult = { status: status.BAD_REQUEST, message: "Sistem sedang maintenance", datetime: formatDateSystem() };
    Logging(error, { file: "/master/layanan/layanan_update.js", func: "update", request: oPayload, response: oResult, user: username });
    return res.status(500).json(oResult);
  }
});

export default router;

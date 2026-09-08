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
        kode_jadwal: Joi.string().required().label("Kode Jadwal"),
        no_sip: Joi.string().required().label("No SIP / Karyawan"),
        kode_ruangan: Joi.string().optional().allow("", null).label("Ruangan"),
        hari: Joi.string().valid("senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu").required().label("Hari"),
        jam_mulai: Joi.string().required().label("Jam Mulai"),
        jam_selesai: Joi.string().required().label("Jam Selesai"),
        kuota: Joi.number().integer().min(0).optional().allow(null).default(0).label("Kuota"),
        status: Joi.string().valid("aktif", "nonaktif").required().label("Status"),
        is_penanggung_jawab: Joi.alternatives().try(Joi.boolean(), Joi.number().valid(0, 1)).optional().label("Penanggung Jawab")
      },
      { "any.required": "{#label} wajib diisi" }, oPayload, { allowUnknown: true }
    );

    if (cValidation) return res.status(422).json({ status: status.BAD_REQUEST, message: cValidation, datetime: formatDateSystem() });

    const isPJ = oPayload.is_penanggung_jawab === true || oPayload.is_penanggung_jawab === 1 || oPayload.is_penanggung_jawab === "1" || oPayload.is_penanggung_jawab === "true";

    await DB.transaction(async (trx) => {
      const prev = await trx("mst_jadwal_karyawan").where("kode_jadwal", oPayload.kode_jadwal).forUpdate().first();
      if (!prev) { const e = new Error("Data tidak ditemukan"); e.statusCode = 404; throw e; }

      const targetRuangan = oPayload.kode_ruangan !== undefined ? oPayload.kode_ruangan : prev.kode_ruangan;
      const targetHari = oPayload.hari || prev.hari;
      const targetJamMulai = (oPayload.jam_mulai || prev.jam_mulai || "").slice(0, 5);
      const targetJamSelesai = (oPayload.jam_selesai || prev.jam_selesai || "").slice(0, 5);
      let effectiveKuota = oPayload.kuota !== undefined && oPayload.kuota !== null ? parseInt(oPayload.kuota) : prev.kuota;

      if (isPJ && targetRuangan && targetHari) {
        // Unset PJ HANYA berlaku untuk baris lain dalam SESI YANG SAMA (jam_mulai & jam_selesai sama persis)
        await trx("mst_jadwal_karyawan")
          .where({
            kode_ruangan: targetRuangan,
            hari: targetHari
          })
          .whereRaw("LEFT(jam_mulai, 5) = ?", [targetJamMulai])
          .whereRaw("LEFT(jam_selesai, 5) = ?", [targetJamSelesai])
          .whereNot("kode_jadwal", oPayload.kode_jadwal)
          .update({
            is_penanggung_jawab: 0,
            kuota: effectiveKuota,
            updated_by: username,
            updated_at: formatDateSystem()
          });
      } else if (!isPJ && targetRuangan && targetHari) {
        // Cari PJ pada SESI YANG SAMA untuk mewarisi kuota
        const pjRow = await trx("mst_jadwal_karyawan")
          .where({
            kode_ruangan: targetRuangan,
            hari: targetHari,
            is_penanggung_jawab: 1
          })
          .whereRaw("LEFT(jam_mulai, 5) = ?", [targetJamMulai])
          .whereRaw("LEFT(jam_selesai, 5) = ?", [targetJamSelesai])
          .whereNot("kode_jadwal", oPayload.kode_jadwal)
          .first();
        if (pjRow && pjRow.kuota !== undefined) {
          effectiveKuota = pjRow.kuota;
        }
      }

      const oData = {
        no_sip: oPayload.no_sip,
        kode_ruangan: oPayload.kode_ruangan || null,
        is_penanggung_jawab: isPJ ? 1 : 0,
        hari: oPayload.hari,
        jam_mulai: oPayload.jam_mulai,
        jam_selesai: oPayload.jam_selesai,
        kuota: effectiveKuota,
        status: oPayload.status,
        updated_by: username,
        updated_at: formatDateSystem()
      };

      await trx("mst_jadwal_karyawan").where("kode_jadwal", oPayload.kode_jadwal).update(oData);
      await ChangesLog({ description: `Edit Jadwal Karyawan ${oPayload.kode_jadwal}`, tableName: "mst_jadwal_karyawan", referenceCode: oPayload.kode_jadwal, action: "UPDATE", dataBefore: prev, dataAfter: { ...prev, ...oData }, user: username, tz: oPayload.tz || "UTC" }, trx);
    });

    return res.status(200).json({ status: status.SUKSES, message: "Jadwal karyawan berhasil diupdate", datetime: formatDateSystem() });
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ status: status.NOT_FOUND, message: "Data tidak ditemukan", datetime: formatDateSystem() });
    const oResult = { status: status.BAD_REQUEST, message: "Sistem sedang maintenance", datetime: formatDateSystem() };
    Logging(error, { file: "/master/jadwal_karyawan/jadwal_karyawan_update.js", func: "update", request: oPayload, response: oResult, user: username });
    return res.status(500).json(oResult);
  }
});

export default router;

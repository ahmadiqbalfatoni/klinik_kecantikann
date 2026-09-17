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
        nama: Joi.string().max(100).required().label("Nama Paket"),
        kode_ruangan: Joi.string().optional().allow("", null).label("Ruangan"),
        tipe: Joi.string().valid("MEDICAL TREATMENT", "BEAUTY TREATMENT", "SERVICE TREATMENT").optional().allow("", null).label("Tipe Paket"),
        harga_paket: Joi.number().min(0).required().label("Harga Paket"),
        masa_berlaku_hari: Joi.number().integer().min(0).optional().allow(null).label("Masa Berlaku (Hari)"),
        is_masa_berlaku_selamanya: Joi.boolean().optional().allow(null).label("Masa Berlaku Selamanya"),
        is_selamanya: Joi.boolean().optional().allow(null).label("Aktif Selamanya"),
        tanggal_mulai: Joi.string().optional().allow("", null).label("Tanggal Mulai"),
        tanggal_selesai: Joi.string().optional().allow("", null).label("Tanggal Selesai"),
        status: Joi.string().valid("aktif", "nonaktif").required().label("Status"),
        details: Joi.array().items(
          Joi.object({
            kode_layanan: Joi.string().required().label("Layanan"),
            jumlah_sesi: Joi.number().integer().min(1).required().label("Jumlah Sesi")
          })
        ).min(1).required().label("Detail Layanan")
      },
      { "any.required": "{#label} wajib diisi", "array.min": "Minimal tambahkan 1 detail layanan ke dalam paket" },
      oPayload, { uniqueField: ["nama"], table: "mst_paket_layanan", allowUnknown: true }
    );
    if (cValidation) return res.status(422).json({ status: status.BAD_REQUEST, message: cValidation, datetime: formatDateSystem() });

    const selectedTipe = oPayload.tipe || "BEAUTY TREATMENT";

    let kode = "";
    const isSelamanya = Boolean(oPayload.is_selamanya);
    const isMasaBerlakuSelamanya = Boolean(oPayload.is_masa_berlaku_selamanya) || parseInt(oPayload.masa_berlaku_hari, 10) === 0;
    const todayStr = formatDateSystem(new Date(), "yyyy-MM-dd");
    const tglMulai = oPayload.tanggal_mulai || todayStr;
    const tglSelesai = isSelamanya ? null : (oPayload.tanggal_selesai || null);

    let finalStatus = oPayload.status;
    if (!isSelamanya && tglSelesai && tglSelesai < todayStr) {
      finalStatus = "nonaktif";
    }

    await DB.transaction(async (trx) => {
      const last = await trx("mst_paket_layanan").orderBy("id", "desc").first();
      let n = 1;
      if (last?.kode_paket_layanan) { n = (parseInt(last.kode_paket_layanan.replace("PKT-", "")) || 0) + 1; }
      kode = `PKT-${String(n).padStart(3, "0")}`;

      const branchCode = oPayload.kode_cabang || req?.auth?.kode_cabang || "CBG-001";
      const oData = {
        kode_cabang: branchCode,
        kode_paket_layanan: kode,
        kode_ruangan: oPayload.kode_ruangan || null,
        nama: oPayload.nama,
        tipe: selectedTipe,
        harga_paket: oPayload.harga_paket,
        masa_berlaku_hari: isMasaBerlakuSelamanya ? 0 : (parseInt(oPayload.masa_berlaku_hari, 10) || 365),
        is_masa_berlaku_selamanya: isMasaBerlakuSelamanya ? 1 : 0,
        is_selamanya: isSelamanya ? 1 : 0,
        tanggal_mulai: tglMulai,
        tanggal_selesai: tglSelesai,
        status: finalStatus,
        tz: oPayload.tz || "UTC",
        created_by: username,
        created_at: formatDateSystem(),
        updated_by: username,
        updated_at: formatDateSystem(),
      };
      await trx("mst_paket_layanan").insert(oData);

      let detailSeq = 1;
      const detailInserts = oPayload.details.map((d) => ({
        kode_detail_paket_layanan: `DPKT-${kode}-${String(detailSeq++).padStart(2, "0")}`,
        kode_paket_layanan: kode,
        kode_layanan: d.kode_layanan,
        jumlah_sesi: d.jumlah_sesi,
        tz: oPayload.tz || "UTC",
        created_by: username,
        created_at: formatDateSystem(),
        updated_by: username,
        updated_at: formatDateSystem(),
      }));
      await trx("mst_detail_paket_layanan").insert(detailInserts);

      await ChangesLog({ description: `Tambah Paket Layanan ${kode}`, tableName: "mst_paket_layanan", referenceCode: kode, action: "CREATE", dataBefore: null, dataAfter: { ...oData, details: detailInserts }, user: username, tz: oPayload.tz || "UTC" }, trx);
    });

    return res.status(200).json({ status: status.SUKSES, message: "Paket layanan berhasil ditambahkan", datetime: formatDateSystem(), data: { kode_paket_layanan: kode } });
  } catch (error) {
    const oResult = { status: status.BAD_REQUEST, message: error.message || "Sistem sedang maintenance", datetime: formatDateSystem() };
    Logging(error, { file: "/master/paket_layanan/paket_layanan_create.js", func: "create", request: oPayload, response: oResult, user: username });
    return res.status(500).json(oResult);
  }
});

export default router;

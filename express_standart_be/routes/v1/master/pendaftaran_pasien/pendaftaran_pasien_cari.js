/**
 * @copyright (c) 2026 PT Marstech Global (info@marstech.co.id)
 * @project Sistem Klinik
 * @file pendaftaran_pasien_cari.js
 * @description Endpoint untuk mencari & me-list data pasien (mst_pasien) by NIK, No HP, No RM, atau Nama (dengan opsi pagination)
 *
 * @author Antigravity
 * @created 2026-08-21
 */

import express from "express";
import DB from "../../../../core/config/knex.js";
import { formatDateSystem } from "../../components/tools/date_tools.js";
import { Logging } from "../../components/tools/servertool.js";
import { status } from "../../components/tools/general.js";
import { getBranchScope } from "../../components/tools/branch_scope.js";

const router = express.Router();

const handleSearch = async (req, res) => {
  const oPayload = { ...req.query, ...req.body };
  const username = req?.auth?.username || "";
  const branchCode = getBranchScope(req, oPayload.kode_cabang);
  const keyword = (oPayload.keyword || oPayload.q || "").trim();
  const nik = (oPayload.nik || "").trim();
  const no_hp = (oPayload.no_hp || "").trim();
  const no_rm = (oPayload.no_rm || "").trim();
  const nama = (oPayload.nama || "").trim();

  const hasPagination = oPayload.page !== undefined || oPayload.perPage !== undefined;

  try {
    const baseQuery = DB("mst_pasien as p")
      .where("p.status", "aktif")
      .modify((qb) => {
        if (branchCode) {
          qb.where("p.kode_cabang", branchCode);
        }
        if (nik) {
          qb.where("p.nik", nik);
        } else if (no_hp) {
          qb.where("p.no_hp", "like", `%${no_hp}%`);
        } else if (no_rm) {
          qb.where("p.no_rm", "like", `%${no_rm}%`);
        } else if (nama) {
          qb.whereRaw("LOWER(p.nama) LIKE ?", [`%${nama.toLowerCase()}%`]);
        } else if (keyword) {
          const lower = keyword.toLowerCase();
          qb.where(function () {
            this.whereRaw("LOWER(p.no_rm) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(p.nama) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(p.nik) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(p.no_hp) LIKE ?", [`%${lower}%`]);
          });
        }
      });

    const selectFields = [
      "p.id",
      "p.no_rm",
      "p.nama",
      "p.nik",
      "p.tempat_lahir",
      "p.tanggal_lahir",
      "p.jenis_kelamin",
      "p.golongan_darah",
      "p.agama",
      "p.status_perkawinan",
      "p.kewarganegaraan",
      "p.pekerjaan",
      "p.provinsi",
      "p.kota_kabupaten",
      "p.kecamatan",
      "p.kelurahan_desa",
      "p.kode_pos",
      "p.patokan",
      "p.no_hp",
      "p.email",
      "p.nama_kontak_darurat",
      "p.no_hp_kontak_darurat",
      "p.hubungan_kontak_darurat",
      "p.alergi",
      "p.foto",
      "p.status",
      "p.created_at",
    ];

    let vaData = [];
    let totalRecords = 0;

    if (hasPagination) {
      const page = parseInt(oPayload.page, 10) || 1;
      const perPage = parseInt(oPayload.perPage, 10) || 10;
      const offset = (page - 1) * perPage;

      const countResult = await baseQuery.clone().count("p.id as total").first();
      totalRecords = parseInt(countResult?.total || 0, 10);

      vaData = await baseQuery
        .clone()
        .select(selectFields)
        .orderBy("p.id", "desc")
        .limit(perPage)
        .offset(offset);
    } else {
      vaData = await baseQuery
        .clone()
        .select(selectFields)
        .orderBy("p.id", "desc")
        .limit(20);

      totalRecords = vaData.length;
    }

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data pasien ditemukan",
      datetime: formatDateSystem(),
      data: vaData,
      total_data: totalRecords,
    });
  } catch (error) {
    const oResult = {
      status: status.BAD_REQUEST,
      message: "Sistem sedang maintenance harap tunggu sebentar",
      datetime: formatDateSystem(),
    };

    Logging(error, {
      file: "/master/pendaftaran_pasien/pendaftaran_pasien_cari.js",
      func: "cari",
      request: oPayload,
      response: oResult,
      user: username,
    });

    return res.status(500).json(oResult);
  }
};

router.get("/", handleSearch);
router.post("/", handleSearch);

export default router;

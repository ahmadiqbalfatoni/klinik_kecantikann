/**
 * @copyright (c) 2026 PT Marstech Global (info@marstech.co.id)
 * @project Sistem Klinik Kecantikan
 * @file produk_dropdown.js
 * @description Endpoint dropdown daftar produk aktif untuk form hasil treatment & rekomendasi
 *
 * @author Antigravity
 * @created 2026-08-27
 */

import express from "express";
import DB from "../../../core/config/knex.js";
import { formatDateSystem } from "../components/tools/date_tools.js";
import { Logging } from "../components/tools/servertool.js";
import { status } from "../components/tools/general.js";
import { getBranchScope } from "../components/tools/branch_scope.js";

const router = express.Router();

const handleProdukDropdown = async (req, res) => {
  const oPayload = { ...req.query, ...req.body };
  const username = req?.auth?.username || "system";
  const branchCode = getBranchScope(req, oPayload.kode_cabang);
  const search = oPayload.search || oPayload.keyword || "";

  try {
    let query = DB("mst_produk")
      .where("status", "aktif")
      .whereRaw("kode_produk NOT LIKE 'CUSTOM-%' AND kode_produk NOT LIKE 'CST-%'");

    if (branchCode) query = query.where("kode_cabang", branchCode);

    query = query
      .select("kode_produk", "nama", "harga_jual", "satuan")
      .orderBy("nama", "asc");

    if (search) {
      const lower = search.toLowerCase();
      query = query.where(function () {
        this.whereRaw("LOWER(nama) LIKE ?", [`%${lower}%`])
          .orWhereRaw("LOWER(kode_produk) LIKE ?", [`%${lower}%`]);
      });
    }

    const vaData = await query;

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data produk berhasil dimuat",
      datetime: formatDateSystem(),
      data: vaData,
    });
  } catch (error) {
    const oResult = {
      status: status.BAD_REQUEST,
      message: "Sistem sedang maintenance harap tunggu sebentar",
      datetime: formatDateSystem(),
    };
    Logging(error, {
      file: "/master/produk_dropdown.js",
      func: "dropdown",
      request: oPayload,
      response: oResult,
      user: username,
    });
    return res.status(500).json(oResult);
  }
};

router.get("/", handleProdukDropdown);
router.post("/", handleProdukDropdown);

export default router;

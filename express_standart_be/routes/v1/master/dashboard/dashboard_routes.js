import express from "express";
import DB from "../../../../core/config/knex.js";
import { formatDateSystem } from "../../components/tools/date_tools.js";
import { Logging } from "../../components/tools/servertool.js";
import { status } from "../../components/tools/general.js";

const router = express.Router();

/**
 * POST /master/dashboard/role-data
 * Mengambil agregasi metrik data real-time untuk 5 role dashboard:
 * owner, dokter, beautician, kasir, warehouse
 */
router.post("/role-data", async (req, res) => {
  const { body } = req;
  const role = (body.role || "owner").toLowerCase();

  try {
    const todayStr = formatDateSystem(new Date(), "yyyy-MM-dd");

    // ── 1. METRIK OWNER / MANAGER ──
    // Kunjungan hari ini & total pasien
    const kunjunganToday = await DB("trx_kunjungan")
      .whereRaw("DATE(tanggal_kunjungan) = ?", [todayStr])
      .count("id as count")
      .first();

    const totalPasien = await DB("mst_pasien").count("id as count").first();
    const totalLayanan = await DB("mst_layanan").where("status", "aktif").count("id as count").first();

    // Omzet hari ini
    const omzetToday = await DB("trx_transaksi")
      .whereRaw("DATE(tanggal_transaksi) = ?", [todayStr])
      .whereIn("status", ["lunas", "selesai"])
      .sum("total_bayar as total")
      .first();

    // Total omzet keseluruhan
    const omzetTotal = await DB("trx_transaksi")
      .whereIn("status", ["lunas", "selesai"])
      .sum("total_bayar as total")
      .first();

    // Breakdown metode bayar
    const metodeBreakdown = await DB("trx_transaksi")
      .whereIn("status", ["lunas", "selesai"])
      .select("metode_bayar")
      .count("id as jumlah_trx")
      .sum("total_bayar as nominal")
      .groupBy("metode_bayar");

    // Top Treatment
    const topTreatments = await DB("trx_detail_antrian_layanan")
      .select("nama_layanan", "kode_layanan")
      .count("id as total_sesi")
      .whereNotNull("nama_layanan")
      .groupBy("kode_layanan", "nama_layanan")
      .orderBy("total_sesi", "desc")
      .limit(5);

    // Inventory status ringkas
    const inventorySummary = await DB("mst_produk")
      .select(
        DB.raw("COUNT(id) as total_sku"),
        DB.raw("COALESCE(SUM(harga_beli * stok_tersedia), 0) as total_aset"),
        DB.raw("COALESCE(SUM(CASE WHEN stok_tersedia <= stok_minimum THEN 1 ELSE 0 END), 0) as stok_menipis"),
        DB.raw("COALESCE(SUM(CASE WHEN stok_tersedia <= 0 THEN 1 ELSE 0 END), 0) as stok_habis")
      )
      .first();

    // Performa SDM (Dokter & Beautician)
    const dokterPerforma = await DB("mst_karyawan as k")
      .leftJoin("trx_rekam_medis as rm", "k.kode_karyawan", "rm.kode_karyawan")
      .where("k.jabatan", "dokter")
      .select("k.nama", "k.kode_karyawan")
      .count("rm.id as total_konsul")
      .groupBy("k.kode_karyawan", "k.nama")
      .limit(5);

    const beauticianPerforma = await DB("mst_karyawan as k")
      .leftJoin("trx_antrian_layanan as al", "k.kode_karyawan", "al.kode_karyawan")
      .whereIn("k.jabatan", ["perawat", "terapis"])
      .select("k.nama", "k.jabatan", "k.kode_karyawan")
      .count("al.id as total_tindakan")
      .groupBy("k.kode_karyawan", "k.nama", "k.jabatan")
      .limit(5);

    // ── 2. METRIK DOKTER ──
    const antreanDokter = await DB("trx_antrian_layanan as al")
      .leftJoin("trx_kunjungan as k", "al.kode_kunjungan", "k.kode_kunjungan")
      .leftJoin("mst_pasien as p", "k.no_rm", "p.no_rm")
      .leftJoin("trx_detail_antrian_layanan as dal", "al.kode_antrian_layanan", "dal.kode_antrian_layanan")
      .select(
        "al.id",
        "al.kode_antrian_layanan",
        "p.nama as nama_pasien",
        "p.no_rm",
        "dal.nama_layanan",
        "al.nama_ruangan",
        "al.status",
        "al.created_at"
      )
      .orderBy("al.created_at", "desc")
      .limit(8);

    const rekamMedisTerbaru = await DB("trx_rekam_medis as rm")
      .leftJoin("mst_pasien as p", "rm.no_rm", "p.no_rm")
      .leftJoin("mst_karyawan as d", "rm.kode_karyawan", "d.kode_karyawan")
      .select(
        "rm.id",
        "rm.kode_rekam_medis",
        "p.nama as nama_pasien",
        "rm.no_rm",
        "rm.diagnosis",
        "rm.keluhan",
        "rm.plan",
        "rm.created_at as tanggal_pemeriksaan",
        "d.nama as nama_dokter"
      )
      .orderBy("rm.created_at", "desc")
      .limit(6);

    // ── 3. METRIK BEAUTICIAN ──
    const treatmentBeautician = await DB("trx_antrian_layanan as al")
      .leftJoin("trx_detail_antrian_layanan as dal", "al.kode_antrian_layanan", "dal.kode_antrian_layanan")
      .leftJoin("trx_kunjungan as k", "al.kode_kunjungan", "k.kode_kunjungan")
      .leftJoin("mst_pasien as p", "k.no_rm", "p.no_rm")
      .select(
        "al.kode_antrian_layanan",
        "dal.nama_layanan",
        "p.nama as nama_pasien",
        "al.nama_ruangan",
        "al.status",
        "al.created_at"
      )
      .orderBy("al.created_at", "desc")
      .limit(8);

    // Foto Before After terbaru
    const fotoBeforeAfter = await DB("trx_rekam_medis_foto as f")
      .leftJoin("trx_rekam_medis as rm", "f.id_rekam_medis", "rm.id")
      .leftJoin("mst_pasien as p", "rm.no_rm", "p.no_rm")
      .select("f.id", "f.url_foto", "f.tipe", "p.nama as nama_pasien", "f.created_at")
      .orderBy("f.created_at", "desc")
      .limit(6);

    // ── 4. METRIK KASIR ──
    const transaksiKasir = await DB("trx_transaksi as t")
      .leftJoin("mst_pasien as p", "t.no_rm", "p.no_rm")
      .select(
        "t.id",
        "t.kode_transaksi",
        "p.nama as nama_pasien",
        "t.no_rm",
        "t.tanggal_transaksi",
        "t.metode_bayar",
        "t.total_harga",
        "t.total_diskon",
        "t.total_bayar",
        "t.status"
      )
      .orderBy("t.created_at", "desc")
      .limit(10);

    const totalTrxKasirToday = await DB("trx_transaksi")
      .count("id as total_trx")
      .sum("total_bayar as total_bayar")
      .sum("total_diskon as total_diskon")
      .first();

    // ── 5. METRIK WAREHOUSE ──
    const stockList = await DB("mst_produk as p")
      .leftJoin("mst_kategori_produk as kp", "p.kode_kategori_produk", "kp.kode_kategori_produk")
      .select(
        "p.kode_produk",
        "p.nama",
        "kp.nama as kategori",
        "p.satuan",
        "p.stok_tersedia",
        "p.stok_minimum",
        "p.harga_beli",
        "p.harga_jual",
        "p.status"
      )
      .orderBy("p.stok_tersedia", "asc")
      .limit(10);

    const purchaseOrders = await DB("trx_purchase_order as po")
      .leftJoin("mst_supplier as s", "po.kode_supplier", "s.kode_supplier")
      .select(
        "po.id",
        "po.kode_po",
        "s.nama as nama_supplier",
        "po.tanggal_po",
        "po.total_po",
        "po.status"
      )
      .orderBy("po.tanggal_po", "desc")
      .limit(6);

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data Dashboard Role-Based berhasil dimuat",
      datetime: formatDateSystem(),
      data: {
        active_role: role,
        owner: {
          kpi: {
            kunjungan_hari_ini: parseInt(kunjunganToday?.count || 0, 10),
            total_pasien: parseInt(totalPasien?.count || 0, 10),
            total_layanan: parseInt(totalLayanan?.count || 0, 10),
            omzet_hari_ini: parseFloat(omzetToday?.total || 0),
            omzet_total: parseFloat(omzetTotal?.total || 0),
          },
          metode_bayar: metodeBreakdown || [],
          top_treatment: topTreatments || [],
          inventory: {
            total_sku: parseInt(inventorySummary?.total_sku || 0, 10),
            total_aset: parseFloat(inventorySummary?.total_aset || 0),
            stok_menipis: parseInt(inventorySummary?.stok_menipis || 0, 10),
            stok_habis: parseInt(inventorySummary?.stok_habis || 0, 10),
          },
          sdm: {
            dokter: dokterPerforma || [],
            beautician: beauticianPerforma || [],
          },
        },
        dokter: {
          antrean: antreanDokter || [],
          rekam_medis: rekamMedisTerbaru || [],
          total_antrean_hari_ini: antreanDokter.length,
          total_konsul_selesai: rekamMedisTerbaru.length,
        },
        beautician: {
          antrean: treatmentBeautician || [],
          foto_before_after: fotoBeforeAfter || [],
          total_tindakan: treatmentBeautician.length,
        },
        kasir: {
          transaksi: transaksiKasir || [],
          summary: {
            total_transaksi: parseInt(totalTrxKasirToday?.total_trx || 0, 10),
            total_bayar: parseFloat(totalTrxKasirToday?.total_bayar || 0),
            total_diskon: parseFloat(totalTrxKasirToday?.total_diskon || 0),
          },
          metode_bayar: metodeBreakdown || [],
        },
        warehouse: {
          stock: stockList || [],
          purchase_orders: purchaseOrders || [],
          summary: {
            total_sku: parseInt(inventorySummary?.total_sku || 0, 10),
            total_aset: parseFloat(inventorySummary?.total_aset || 0),
            stok_menipis: parseInt(inventorySummary?.stok_menipis || 0, 10),
            stok_habis: parseInt(inventorySummary?.stok_habis || 0, 10),
          },
        },
      },
    });
  } catch (err) {
    Logging(err, { file: "dashboard_routes.js", func: "role-data", request: body });
    return res.status(500).json({ status: status.BAD_REQUEST, message: err.message });
  }
});

export default router;

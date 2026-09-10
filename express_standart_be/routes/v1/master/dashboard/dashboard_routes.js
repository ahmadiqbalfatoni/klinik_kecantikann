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

    const tanggalDari = body.tanggal_dari || null;
    const tanggalSampai = body.tanggal_sampai || null;

    // Omzet hari ini (Pelunasan hari ini + DP booking diterima hari ini)
    const pelunasanToday = await DB("trx_transaksi")
      .whereRaw("DATE(tanggal_transaksi) = ?", [todayStr])
      .whereIn("status", ["lunas", "selesai"])
      .sum(DB.raw("COALESCE(sisa_bayar, total_bayar) as total"))
      .first();

    const dpReceivedToday = await DB("trx_booking")
      .whereRaw("DATE(COALESCE(dp_dibayar_at, created_at)) = ?", [todayStr])
      .whereIn("dp_status", ["sudah_bayar", "dipotong_treatment", "hangus"])
      .sum("dp_nominal as total")
      .first();

    const omzetTodayVal = parseFloat(pelunasanToday?.total || 0) + parseFloat(dpReceivedToday?.total || 0);

    // Total omzet keseluruhan (Nilai transaksi tindakan lunas + DP hangus)
    const omzetTrxTotal = await DB("trx_transaksi")
      .whereIn("status", ["lunas", "selesai"])
      .sum("total_bayar as total")
      .first();

    const dpHangusTotal = await DB("trx_booking")
      .where("status", "tidak_hadir")
      .where("dp_status", "hangus")
      .sum("dp_nominal as total")
      .first();

    const omzetTotalVal = parseFloat(omzetTrxTotal?.total || 0) + parseFloat(dpHangusTotal?.total || 0);

    // ── Breakdown metode bayar akurat (UNION Pelunasan Kasir + DP Booking Terlaksana + DP Hangus) ──
    let qPelunasanWhere = "status IN ('lunas', 'selesai') AND COALESCE(sisa_bayar, total_bayar) > 0";
    let qDpBookingWhere = "t.status IN ('lunas', 'selesai') AND t.dp_nominal > 0 AND t.metode_pembayaran_dp IS NOT NULL";
    let qDpHangusWhere = "b.status = 'tidak_hadir' AND b.dp_status = 'hangus' AND b.dp_nominal > 0 AND b.metode_pembayaran_dp IS NOT NULL";

    const pelunasanBindings = [];
    const dpBookingBindings = [];
    const dpHangusBindings = [];

    if (tanggalDari) {
      qPelunasanWhere += " AND DATE(tanggal_transaksi) >= ?";
      pelunasanBindings.push(tanggalDari);

      qDpBookingWhere += " AND DATE(COALESCE(b.dp_dibayar_at, b.created_at)) >= ?";
      dpBookingBindings.push(tanggalDari);

      qDpHangusWhere += " AND DATE(COALESCE(b.dp_dibayar_at, b.created_at)) >= ?";
      dpHangusBindings.push(tanggalDari);
    }
    if (tanggalSampai) {
      qPelunasanWhere += " AND DATE(tanggal_transaksi) <= ?";
      pelunasanBindings.push(tanggalSampai);

      qDpBookingWhere += " AND DATE(COALESCE(b.dp_dibayar_at, b.created_at)) <= ?";
      dpBookingBindings.push(tanggalSampai);

      qDpHangusWhere += " AND DATE(COALESCE(b.dp_dibayar_at, b.created_at)) <= ?";
      dpHangusBindings.push(tanggalSampai);
    }

    const unionSql = `
      SELECT
        LOWER(TRIM(metode)) as metode_bayar,
        COUNT(id) as jumlah_trx,
        SUM(nominal) as nominal
      FROM (
        SELECT
          id,
          metode_bayar as metode,
          COALESCE(sisa_bayar, total_bayar) as nominal
        FROM trx_transaksi
        WHERE ${qPelunasanWhere}

        UNION ALL

        SELECT
          t.id,
          t.metode_pembayaran_dp as metode,
          t.dp_nominal as nominal
        FROM trx_transaksi as t
        JOIN trx_kunjungan as k ON t.kode_kunjungan = k.kode_kunjungan
        JOIN trx_booking as b ON k.kode_booking = b.kode_booking
        WHERE ${qDpBookingWhere}

        UNION ALL

        SELECT
          b.id,
          b.metode_pembayaran_dp as metode,
          b.dp_nominal as nominal
        FROM trx_booking as b
        WHERE ${qDpHangusWhere}
      ) as combined
      GROUP BY LOWER(TRIM(metode))
    `;

    const allBindings = [...pelunasanBindings, ...dpBookingBindings, ...dpHangusBindings];
    const metodeBreakdownRaw = await DB.raw(unionSql, allBindings);
    const metodeBreakdown = (metodeBreakdownRaw[0] || []).map((row) => ({
      metode_bayar: row.metode_bayar,
      jumlah_trx: parseInt(row.jumlah_trx || 0, 10),
      nominal: parseFloat(row.nominal || 0),
    }));

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
            omzet_hari_ini: omzetTodayVal,
            omzet_total: omzetTotalVal,
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

/**
 * @project Sistem Klinik Kecantikan
 * @file laporan_routes.js
 * @description Controller router terpadu untuk modul Laporan & Analytics Klinik Kecantikan
 */
import express from "express";
import DB from "../../../../core/config/knex.js";
import { formatDateSystem } from "../../components/tools/date_tools.js";
import { Logging } from "../../components/tools/servertool.js";
import { status } from "../../components/tools/general.js";
import { getBranchScope } from "../../components/tools/branch_scope.js";

const router = express.Router();

/**
 * 0. ENDPOINT OPSI FILTER LAPORAN REAL DARI DATABASE
 */
router.post("/options", async (req, res) => {
  try {
    const [karyawanList, ruanganList, kategoriList] = await Promise.all([
      DB("mst_karyawan").select("kode_karyawan", "nama", "jabatan").orderBy("nama", "asc"),
      DB("mst_ruangan").select("kode_ruangan", "nama_ruangan").orderBy("nama_ruangan", "asc"),
      DB("mst_kategori_produk").select("kode_kategori_produk", "nama").orderBy("nama", "asc"),
    ]);

    const petugasOptions = karyawanList.map((k) => ({
      label: `${k.nama} (${k.jabatan ? k.jabatan.toUpperCase() : 'STAFF'})`,
      value: k.kode_karyawan,
      jabatan: k.jabatan,
    }));

    const dokterOptions = karyawanList
      .filter((k) => (k.jabatan || "").toLowerCase() === "dokter")
      .map((k) => ({
        label: k.nama,
        value: k.kode_karyawan,
      }));

    const ruanganOptions = ruanganList.map((r) => ({
      label: r.nama_ruangan,
      value: r.kode_ruangan,
    }));

    const kategoriOptions = kategoriList.map((kp) => ({
      label: kp.nama,
      value: kp.kode_kategori_produk,
    }));

    const metodeBayarOptions = [
      { label: "Tunai", value: "tunai" },
      { label: "QRIS", value: "qris" },
      { label: "Debit", value: "debit" },
      { label: "Kredit", value: "kredit" },
      { label: "Transfer", value: "transfer" },
    ];

    const statusPenjualanOptions = [
      { label: "Lunas", value: "lunas" },
      { label: "Draft / Pending", value: "draft" },
      { label: "Batal", value: "batal" },
    ];

    const statusTreatmentOptions = [
      { label: "Menunggu", value: "menunggu" },
      { label: "Dipanggil", value: "dipanggil" },
      { label: "Selesai", value: "selesai" },
      { label: "Batal", value: "batal" },
    ];

    const statusKunjunganOptions = [
      { label: "Berlangsung", value: "berlangsung" },
      { label: "Selesai", value: "selesai" },
      { label: "Batal", value: "batal" },
    ];

    return res.status(200).json({
      status: status.SUKSES,
      message: "Berhasil memuat opsi filter laporan",
      datetime: formatDateSystem(),
      data: {
        petugas: petugasOptions,
        dokter: dokterOptions,
        ruangan: ruanganOptions,
        kategori_produk: kategoriOptions,
        metode_bayar: metodeBayarOptions,
        status_penjualan: statusPenjualanOptions,
        status_treatment: statusTreatmentOptions,
        status_kunjungan: statusKunjunganOptions,
      },
    });
  } catch (err) {
    Logging(err, { file: "laporan_routes.js", func: "options" });
    return res.status(500).json({ status: status.BAD_REQUEST, message: err.message });
  }
});

/**
 * 1. LAPORAN PENJUALAN
 */
router.post("/penjualan", async (req, res) => {
  const { body } = req;
  const branchCode = getBranchScope(req, body.kode_cabang);
  const keyword = body.keyword || "";
  const filterStatus = body.status || null;
  const filterMetode = body.metode_bayar || null;
  const tanggal_dari = body.tanggal_dari || null;
  const tanggal_sampai = body.tanggal_sampai || null;
  const page = parseInt(body.page) || 1;
  const perPage = parseInt(body.perPage) || 10;
  const offset = (page - 1) * perPage;

  try {
    const baseQuery = DB("trx_transaksi as t")
      .leftJoin("mst_pasien as p", "t.no_rm", "p.no_rm")
      .modify((qb) => {
        if (branchCode) {
          qb.where("t.kode_cabang", branchCode);
        }
        if (tanggal_dari) {
          qb.whereRaw("DATE(t.tanggal_transaksi) >= ?", [tanggal_dari]);
        }
        if (tanggal_sampai) {
          qb.whereRaw("DATE(t.tanggal_transaksi) <= ?", [tanggal_sampai]);
        }
        if (filterStatus) {
          if (Array.isArray(filterStatus) && filterStatus.length > 0) {
            qb.whereIn("t.status", filterStatus);
          } else if (typeof filterStatus === "string" && filterStatus.trim()) {
            qb.where("t.status", filterStatus.trim());
          }
        }
        if (filterMetode) {
          if (Array.isArray(filterMetode) && filterMetode.length > 0) {
            qb.whereIn("t.metode_bayar", filterMetode);
          } else if (typeof filterMetode === "string" && filterMetode.trim()) {
            qb.where("t.metode_bayar", filterMetode.trim());
          }
        }
        if (keyword) {
          const lower = keyword.toLowerCase();
          qb.where(function () {
            this.whereRaw("LOWER(t.kode_transaksi) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(t.no_rm) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(p.nama) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(t.metode_bayar) LIKE ?", [`%${lower}%`]);
          });
        }
      });

    const countResult = await baseQuery.clone().count("t.id as total").first();
    const totalData = parseInt(countResult?.total || 0, 10);

    const summaryResult = await baseQuery.clone()
      .select(
        DB.raw("COALESCE(SUM(t.total_harga), 0) as total_bruto"),
        DB.raw("COALESCE(SUM(t.total_diskon), 0) as total_diskon"),
        DB.raw("COALESCE(SUM(t.total_bayar), 0) as total_omzet"),
        DB.raw("COUNT(t.id) as total_transaksi")
      )
      .first();

    const data = await baseQuery.clone()
      .select(
        "t.id",
        "t.kode_transaksi",
        "t.kode_kunjungan",
        "t.no_rm",
        "p.nama as nama_pasien",
        "p.no_hp",
        "t.tanggal_transaksi",
        "t.total_harga",
        "t.total_diskon",
        "t.total_bayar",
        "t.metode_bayar",
        "t.status",
        "t.created_at"
      )
      .orderBy("t.tanggal_transaksi", "desc")
      .orderBy("t.id", "desc")
      .limit(perPage)
      .offset(offset);

    // Ambil detail ringkasan item per transaksi
    const kodeTrxList = data.map((d) => d.kode_transaksi).filter(Boolean);
    let detailsMap = {};
    if (kodeTrxList.length > 0) {
      const details = await DB("trx_detail_transaksi as dt")
        .leftJoin("mst_layanan as l", "dt.kode_layanan", "l.kode_layanan")
        .leftJoin("mst_paket_layanan as pl", "dt.kode_layanan", "pl.kode_paket_layanan")
        .leftJoin("mst_produk as prod", "dt.kode_produk", "prod.kode_produk")
        .whereIn("dt.kode_transaksi", kodeTrxList)
        .select(
          "dt.kode_transaksi",
          "dt.qty",
          "dt.harga_satuan",
          "dt.subtotal",
          DB.raw("COALESCE(prod.nama, l.nama, pl.nama, 'Item') as item_nama")
        );

      details.forEach((item) => {
        if (!detailsMap[item.kode_transaksi]) {
          detailsMap[item.kode_transaksi] = [];
        }
        detailsMap[item.kode_transaksi].push(item);
      });
    }

    const formattedData = data.map((tr) => ({
      ...tr,
      items: detailsMap[tr.kode_transaksi] || [],
      total_items: (detailsMap[tr.kode_transaksi] || []).reduce((acc, curr) => acc + curr.qty, 0),
    }));

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data Laporan Penjualan berhasil dimuat",
      datetime: formatDateSystem(),
      data: formattedData,
      total_data: totalData,
      summary: {
        total_bruto: parseFloat(summaryResult?.total_bruto || 0),
        total_diskon: parseFloat(summaryResult?.total_diskon || 0),
        total_omzet: parseFloat(summaryResult?.total_omzet || 0),
        total_transaksi: parseInt(summaryResult?.total_transaksi || 0, 10),
      },
    });
  } catch (err) {
    Logging(err, { file: "laporan_routes.js", func: "penjualan", request: body });
    return res.status(500).json({ status: status.BAD_REQUEST, message: err.message });
  }
});

/**
 * 2. LAPORAN TREATMENT
 */
router.post("/treatment", async (req, res) => {
  const { body } = req;
  const branchCode = getBranchScope(req, body.kode_cabang);
  const keyword = body.keyword || "";
  const filterRuangan = body.kode_ruangan || null;
  const filterKaryawan = body.kode_karyawan || null;
  const filterStatus = body.status || null;
  const tanggal_dari = body.tanggal_dari || null;
  const tanggal_sampai = body.tanggal_sampai || null;
  const page = parseInt(body.page) || 1;
  const perPage = parseInt(body.perPage) || 10;
  const offset = (page - 1) * perPage;

  try {
    const baseQuery = DB("trx_antrian_layanan as al")
      .leftJoin("trx_kunjungan as k", "al.kode_kunjungan", "k.kode_kunjungan")
      .leftJoin("mst_pasien as p", "k.no_rm", "p.no_rm")
      .leftJoin("mst_ruangan as r", "al.kode_ruangan", "r.kode_ruangan")
      .leftJoin("trx_booking as b", "k.kode_booking", "b.kode_booking")
      .leftJoin("mst_jadwal_karyawan as jk", "b.kode_jadwal", "jk.kode_jadwal")
      .leftJoin("trx_rekam_medis_ruangan as rmr", "al.kode_antrian_layanan", "rmr.kode_antrian_layanan")
      .leftJoin("trx_rekam_medis as rm", function () {
        this.on("al.kode_antrian_layanan", "=", "rm.kode_antrian_layanan")
          .orOn("al.kode_kunjungan", "=", "rm.kode_kunjungan");
      })
      .leftJoin("mst_karyawan as kry_al", function () {
        this.on("al.kode_karyawan", "=", "kry_al.kode_karyawan")
          .orOn("al.kode_karyawan", "=", "kry_al.no_sip")
          .orOn("al.kode_karyawan", "=", "kry_al.kode_user");
      })
      .leftJoin("mst_karyawan as kry_rmr", function () {
        this.on("rmr.kode_karyawan", "=", "kry_rmr.kode_karyawan")
          .orOn("rmr.kode_karyawan", "=", "kry_rmr.no_sip")
          .orOn("rmr.kode_karyawan", "=", "kry_rmr.kode_user");
      })
      .leftJoin("mst_karyawan as kry_rm", function () {
        this.on("rm.kode_karyawan", "=", "kry_rm.kode_karyawan")
          .orOn("rm.no_sip", "=", "kry_rm.no_sip");
      })
      .leftJoin("mst_karyawan as kry_book", "jk.no_sip", "kry_book.no_sip")
      .leftJoin("trx_detail_antrian_layanan as dal", "al.kode_antrian_layanan", "dal.kode_antrian_layanan")
      .leftJoin("mst_layanan as lyn", "dal.kode_layanan", "lyn.kode_layanan")
      .modify((qb) => {
        if (branchCode) {
          qb.where("al.kode_cabang", branchCode);
        }
        if (tanggal_dari) {
          qb.whereRaw("DATE(al.created_at) >= ?", [tanggal_dari]);
        }
        if (tanggal_sampai) {
          qb.whereRaw("DATE(al.created_at) <= ?", [tanggal_sampai]);
        }
        if (filterRuangan) {
          qb.where("al.kode_ruangan", filterRuangan);
        }
        if (filterKaryawan) {
          qb.where("al.kode_karyawan", filterKaryawan);
        }
        if (filterStatus) {
          if (Array.isArray(filterStatus) && filterStatus.length > 0) {
            qb.whereIn("al.status", filterStatus);
          } else if (typeof filterStatus === "string" && filterStatus.trim()) {
            qb.where("al.status", filterStatus.trim());
          }
        }
        if (keyword) {
          const lower = keyword.toLowerCase();
          qb.where(function () {
            this.whereRaw("LOWER(al.kode_antrian_layanan) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(p.nama) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(p.no_rm) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(lyn.nama) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(al.nama_ruangan) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(COALESCE(kry_al.nama, kry_rmr.nama, kry_rm.nama, kry_book.nama, '')) LIKE ?", [`%${lower}%`]);
          });
        }
      });

    const countResult = await baseQuery.clone().countDistinct("al.id as total").first();
    const totalData = parseInt(countResult?.total || 0, 10);

    const rows = await baseQuery.clone()
      .select(
        "al.id",
        "al.kode_antrian_layanan",
        "al.kode_kunjungan",
        "al.nomor_antrian",
        "al.kode_ruangan",
        "al.nama_ruangan",
        "al.status",
        "al.dipanggil_at",
        "al.selesai_at",
        "al.created_at",
        "p.no_rm",
        "p.nama as nama_pasien",
        DB.raw("COALESCE(kry_al.nama, kry_rmr.nama, kry_rm.nama, kry_book.nama, '-') as nama_petugas"),
        DB.raw("COALESCE(kry_al.jabatan, kry_rmr.jabatan, kry_rm.jabatan, kry_book.jabatan, '') as jabatan_petugas"),
        DB.raw("COALESCE(GROUP_CONCAT(DISTINCT lyn.nama SEPARATOR ', '), 'Treatment Umum') as nama_treatment")
      )
      .groupBy(
        "al.id",
        "al.kode_antrian_layanan",
        "al.kode_kunjungan",
        "al.nomor_antrian",
        "al.kode_ruangan",
        "al.nama_ruangan",
        "al.status",
        "al.dipanggil_at",
        "al.selesai_at",
        "al.created_at",
        "p.no_rm",
        "p.nama",
        "kry_al.nama",
        "kry_al.jabatan",
        "kry_rmr.nama",
        "kry_rmr.jabatan",
        "kry_rm.nama",
        "kry_rm.jabatan",
        "kry_book.nama",
        "kry_book.jabatan"
      )
      .orderBy("al.created_at", "desc")
      .limit(perPage)
      .offset(offset);

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data Laporan Treatment berhasil dimuat",
      datetime: formatDateSystem(),
      data: rows,
      total_data: totalData,
    });
  } catch (err) {
    Logging(err, { file: "laporan_routes.js", func: "treatment", request: body });
    return res.status(500).json({ status: status.BAD_REQUEST, message: err.message });
  }
});

/**
 * 3. LAPORAN PRODUK
 */
router.post("/produk", async (req, res) => {
  const { body } = req;
  const branchCode = getBranchScope(req, body.kode_cabang);
  const keyword = body.keyword || "";
  const filterKategori = body.kode_kategori_produk || null;
  const filterStatusStok = body.status_stok || null;
  const filterStatus = body.status || null;
  const tanggal_dari = body.tanggal_dari || null;
  const tanggal_sampai = body.tanggal_sampai || null;

  try {
    const query = DB("mst_produk as p")
      .leftJoin("mst_kategori_produk as kp", "p.kode_kategori_produk", "kp.kode_kategori_produk")
      .leftJoin("mst_supplier as s", "p.kode_supplier", "s.kode_supplier")
      .leftJoin("trx_detail_transaksi as dt", "p.kode_produk", "dt.kode_produk")
      .leftJoin("trx_transaksi as tr", "dt.kode_transaksi", "tr.kode_transaksi")
      .modify((qb) => {
        if (branchCode) {
          qb.where("p.kode_cabang", branchCode);
        }
        if (tanggal_dari) {
          qb.whereRaw("(tr.tanggal_transaksi >= ? OR tr.tanggal_transaksi IS NULL)", [tanggal_dari]);
        }
        if (tanggal_sampai) {
          qb.whereRaw("(tr.tanggal_transaksi <= ? OR tr.tanggal_transaksi IS NULL)", [tanggal_sampai]);
        }
        if (filterKategori) {
          qb.where("p.kode_kategori_produk", filterKategori);
        }
        if (filterStatus) {
          qb.where("p.status", filterStatus);
        }
        if (filterStatusStok === "habis") {
          qb.where("p.stok_tersedia", "<=", 0);
        } else if (filterStatusStok === "menipis") {
          qb.where("p.stok_tersedia", ">", 0).whereRaw("p.stok_tersedia <= p.stok_minimum");
        } else if (filterStatusStok === "aman") {
          qb.whereRaw("p.stok_tersedia > p.stok_minimum");
        }
        if (keyword) {
          const lower = keyword.toLowerCase();
          qb.where(function () {
            this.whereRaw("LOWER(p.kode_produk) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(p.nama) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(kp.nama) LIKE ?", [`%${lower}%`]);
          });
        }
      })
      .select(
        "p.id",
        "p.kode_produk",
        "p.nama as nama_produk",
        "kp.nama as nama_kategori",
        "s.nama as nama_supplier",
        "p.satuan",
        "p.harga_beli",
        "p.harga_jual",
        "p.stok_tersedia",
        "p.stok_minimum",
        "p.status",
        DB.raw("COALESCE(SUM(dt.qty), 0) as total_terjual"),
        DB.raw("COALESCE(SUM(dt.subtotal), 0) as total_pendapatan")
      )
      .groupBy(
        "p.id",
        "p.kode_produk",
        "p.nama",
        "kp.nama",
        "s.nama",
        "p.satuan",
        "p.harga_beli",
        "p.harga_jual",
        "p.stok_tersedia",
        "p.stok_minimum",
        "p.status"
      )
      .orderBy("total_terjual", "desc");

    const rows = await query;

    const totalTerjual = rows.reduce((acc, r) => acc + parseInt(r.total_terjual || 0, 10), 0);
    const totalOmzet = rows.reduce((acc, r) => acc + parseFloat(r.total_pendapatan || 0), 0);
    const totalProduk = rows.length;

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data Laporan Produk berhasil dimuat",
      datetime: formatDateSystem(),
      data: rows,
      total_data: totalProduk,
      summary: {
        total_terjual: totalTerjual,
        total_omzet: totalOmzet,
        total_produk: totalProduk,
      },
    });
  } catch (err) {
    Logging(err, { file: "laporan_routes.js", func: "produk", request: body });
    return res.status(500).json({ status: status.BAD_REQUEST, message: err.message });
  }
});

/**
 * 4. LAPORAN PAKET
 */
router.post("/paket", async (req, res) => {
  const { body } = req;
  const branchCode = getBranchScope(req, body.kode_cabang);
  const keyword = body.keyword || "";
  const filterStatus = body.status || null;
  const filterRuangan = body.kode_ruangan || null;
  const filterTipe = body.tipe || null;

  try {
    const todayStr = formatDateSystem(new Date(), "yyyy-MM-dd");

    // Auto-sync status semua paket berdasarkan status layanannya & tanggal expired
    const allPakets = await DB("mst_paket_layanan").select("kode_paket_layanan", "status", "tanggal_selesai", "is_selamanya");
    for (const pkt of allPakets) {
      const inactiveCount = await DB("mst_detail_paket_layanan as d")
        .leftJoin("mst_layanan as l", "d.kode_layanan", "l.kode_layanan")
        .where("d.kode_paket_layanan", pkt.kode_paket_layanan)
        .where("l.status", "nonaktif")
        .count("d.kode_detail_paket_layanan as cnt")
        .first();

      const hasInactive = parseInt(inactiveCount?.cnt || 0) > 0;
      const isExpired = !Boolean(pkt.is_selamanya) && pkt.tanggal_selesai && pkt.tanggal_selesai < todayStr;
      const targetStatus = (hasInactive || isExpired) ? "nonaktif" : "aktif";

      if (pkt.status !== targetStatus) {
        await DB("mst_paket_layanan")
          .where("kode_paket_layanan", pkt.kode_paket_layanan)
          .update({ status: targetStatus, updated_at: formatDateSystem() });
      }
    }

    const baseQuery = DB("mst_paket_layanan as pl")
      .leftJoin("mst_ruangan as r", "pl.kode_ruangan", "r.kode_ruangan")
      .modify((qb) => {
        if (branchCode) {
          qb.where("pl.kode_cabang", branchCode);
        }
        if (filterStatus) {
          qb.where("pl.status", filterStatus);
        }
        if (filterRuangan) {
          qb.where("pl.kode_ruangan", filterRuangan);
        }
        if (filterTipe) {
          qb.where("pl.tipe", filterTipe);
        }
        if (keyword) {
          const lower = keyword.toLowerCase();
          qb.where(function () {
            this.whereRaw("LOWER(pl.kode_paket_layanan) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(pl.nama) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(r.nama_ruangan) LIKE ?", [`%${lower}%`]);
          });
        }
      });

    const rows = await baseQuery
      .select(
        "pl.id",
        "pl.kode_paket_layanan",
        "pl.nama",
        "pl.nama as nama_paket",
        "pl.harga_paket",
        "pl.masa_berlaku_hari",
        "pl.status",
        "pl.tipe",
        "pl.is_selamanya",
        "pl.kode_ruangan",
        "r.nama_ruangan",
        DB.raw("COALESCE(DATE_FORMAT(pl.tanggal_mulai, '%Y-%m-%d'), DATE_FORMAT(pl.created_at, '%Y-%m-%d')) as tanggal_mulai"),
        DB.raw("DATE_FORMAT(pl.tanggal_selesai, '%Y-%m-%d') as tanggal_selesai"),
        DB.raw("CASE WHEN pl.is_selamanya = 1 THEN 99999 WHEN pl.tanggal_selesai IS NOT NULL THEN GREATEST(0, DATEDIFF(pl.tanggal_selesai, CURDATE())) ELSE 99999 END as sisa_hari")
      )
      .orderBy("pl.created_at", "desc");

    // Ambil detail layanan di setiap paket
    const kodePaketList = rows.map((r) => r.kode_paket_layanan);
    let detailsMap = {};
    let inactiveMap = {};

    if (kodePaketList.length > 0) {
      const details = await DB("mst_detail_paket_layanan as dpl")
        .leftJoin("mst_layanan as l", "dpl.kode_layanan", "l.kode_layanan")
        .whereIn("dpl.kode_paket_layanan", kodePaketList)
        .select(
          "dpl.kode_paket_layanan",
          "dpl.kode_layanan",
          "l.nama as nama_layanan",
          "l.status as status_layanan",
          "dpl.jumlah_sesi"
        );

      details.forEach((d) => {
        if (!detailsMap[d.kode_paket_layanan]) {
          detailsMap[d.kode_paket_layanan] = [];
        }
        detailsMap[d.kode_paket_layanan].push(d);
        if (d.status_layanan === 'nonaktif') {
          if (!inactiveMap[d.kode_paket_layanan]) inactiveMap[d.kode_paket_layanan] = [];
          inactiveMap[d.kode_paket_layanan].push(d.nama_layanan);
        }
      });
    }

    const formattedData = rows.map((p) => ({
      ...p,
      details: detailsMap[p.kode_paket_layanan] || [],
      items: detailsMap[p.kode_paket_layanan] || [],
      has_inactive_layanan: Boolean(inactiveMap[p.kode_paket_layanan]?.length),
      inactive_layanan_names: inactiveMap[p.kode_paket_layanan] || [],
      total_sesi: (detailsMap[p.kode_paket_layanan] || []).reduce(
        (acc, curr) => acc + (curr.jumlah_sesi || 0),
        0
      ),
    }));

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data Laporan Paket berhasil dimuat",
      datetime: formatDateSystem(),
      data: formattedData,
      total_data: formattedData.length,
    });
  } catch (err) {
    Logging(err, { file: "laporan_routes.js", func: "paket", request: body });
    return res.status(500).json({ status: status.BAD_REQUEST, message: err.message });
  }
});

/**
 * 6. LAPORAN PASIEN
 */
router.post("/pasien", async (req, res) => {
  const { body } = req;
  const branchCode = getBranchScope(req, body.kode_cabang);
  const keyword = body.keyword || "";
  const filterGender = body.jenis_kelamin || null;
  const filterStatus = body.status || null;
  const page = parseInt(body.page) || 1;
  const perPage = parseInt(body.perPage) || 10;
  const offset = (page - 1) * perPage;

  try {
    const baseQuery = DB("mst_pasien as p").modify((qb) => {
      if (branchCode) {
        qb.where("p.kode_cabang", branchCode);
      }
      if (filterGender) {
        qb.where("p.jenis_kelamin", filterGender);
      }
      if (filterStatus) {
        qb.where("p.status", filterStatus);
      }
      if (keyword) {
        const lower = keyword.toLowerCase();
        qb.where(function () {
          this.whereRaw("LOWER(p.no_rm) LIKE ?", [`%${lower}%`])
            .orWhereRaw("LOWER(p.nama) LIKE ?", [`%${lower}%`])
            .orWhereRaw("LOWER(p.nik) LIKE ?", [`%${lower}%`])
            .orWhereRaw("LOWER(p.no_hp) LIKE ?", [`%${lower}%`]);
        });
      }
    });

    const countResult = await baseQuery.clone().count("p.id as total").first();
    const totalData = parseInt(countResult?.total || 0, 10);

    const rows = await baseQuery.clone()
      .select(
        "p.id",
        "p.no_rm",
        "p.nama",
        "p.nik",
        "p.jenis_kelamin",
        "p.tanggal_lahir",
        "p.no_hp",
        "p.kota_kabupaten",
        "p.status",
        "p.created_at",
        DB.raw("(SELECT COUNT(k.id) FROM trx_kunjungan k WHERE k.no_rm = p.no_rm) as total_kunjungan"),
        DB.raw("(SELECT COALESCE(SUM(t.total_bayar), 0) FROM trx_transaksi t WHERE t.no_rm = p.no_rm) as total_transaksi")
      )
      .orderBy("p.created_at", "desc")
      .limit(perPage)
      .offset(offset);

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data Laporan Pasien berhasil dimuat",
      datetime: formatDateSystem(),
      data: rows,
      total_data: totalData,
    });
  } catch (err) {
    Logging(err, { file: "laporan_routes.js", func: "pasien", request: body });
    return res.status(500).json({ status: status.BAD_REQUEST, message: err.message });
  }
});

/**
 * 7. LAPORAN KUNJUNGAN
 */
router.post("/kunjungan", async (req, res) => {
  const { body } = req;
  const branchCode = getBranchScope(req, body.kode_cabang);
  const keyword = body.keyword || "";
  const filterStatus = body.status || null;
  const filterRuangan = body.kode_ruangan || null;
  const tanggal_dari = body.tanggal_dari || null;
  const tanggal_sampai = body.tanggal_sampai || null;
  const page = parseInt(body.page) || 1;
  const perPage = parseInt(body.perPage) || 10;
  const offset = (page - 1) * perPage;

  try {
    const baseQuery = DB("trx_kunjungan as k")
      .leftJoin("mst_pasien as p", "k.no_rm", "p.no_rm")
      .modify((qb) => {
        if (branchCode) {
          qb.where("k.kode_cabang", branchCode);
        }
        if (tanggal_dari) {
          qb.whereRaw("DATE(k.tanggal_kunjungan) >= ?", [tanggal_dari]);
        }
        if (tanggal_sampai) {
          qb.whereRaw("DATE(k.tanggal_kunjungan) <= ?", [tanggal_sampai]);
        }
        if (filterRuangan) {
          qb.where("k.kode_ruangan", filterRuangan);
        }
        if (filterStatus) {
          if (Array.isArray(filterStatus) && filterStatus.length > 0) {
            qb.whereIn("k.status", filterStatus);
          } else if (typeof filterStatus === "string" && filterStatus.trim()) {
            qb.where("k.status", filterStatus.trim());
          }
        }
        if (keyword) {
          const lower = keyword.toLowerCase();
          qb.where(function () {
            this.whereRaw("LOWER(k.kode_kunjungan) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(k.no_rm) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(p.nama) LIKE ?", [`%${lower}%`]);
          });
        }
      });

    const countResult = await baseQuery.clone().count("k.id as total").first();
    const totalData = parseInt(countResult?.total || 0, 10);

    const rows = await baseQuery.clone()
      .select(
        "k.id",
        "k.kode_kunjungan",
        "k.no_rm",
        "p.nama as nama_pasien",
        "p.no_hp",
        "k.tanggal_kunjungan",
        "k.jam_datang",
        "k.status as status_kunjungan",
        "k.created_at",
        DB.raw("(SELECT COUNT(al.id) FROM trx_antrian_layanan al WHERE al.kode_kunjungan = k.kode_kunjungan) as total_antrian_layanan")
      )
      .orderBy("k.tanggal_kunjungan", "desc")
      .orderBy("k.jam_datang", "desc")
      .limit(perPage)
      .offset(offset);

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data Laporan Kunjungan berhasil dimuat",
      datetime: formatDateSystem(),
      data: rows,
      total_data: totalData,
    });
  } catch (err) {
    Logging(err, { file: "laporan_routes.js", func: "kunjungan", request: body });
    return res.status(500).json({ status: status.BAD_REQUEST, message: err.message });
  }
});

/**
 * 9. LAPORAN DOKTER
 */
router.post("/dokter", async (req, res) => {
  const { body } = req;
  const branchCode = getBranchScope(req, body.kode_cabang);
  const keyword = body.keyword || "";
  const filterStatus = body.status || null;

  try {
    const baseQuery = DB("mst_karyawan as k")
      .whereRaw("LOWER(k.jabatan) LIKE ?", ["%dokter%"])
      .modify((qb) => {
        if (branchCode) {
          qb.where("k.kode_cabang", branchCode);
        }
        if (filterStatus) {
          qb.where("k.status", filterStatus);
        }
        if (keyword) {
          const lower = keyword.toLowerCase();
          qb.where(function () {
            this.whereRaw("LOWER(k.kode_karyawan) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(k.nama) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(k.no_sip) LIKE ?", [`%${lower}%`]);
          });
        }
      });

    const rows = await baseQuery
      .select(
        "k.id",
        "k.kode_karyawan",
        "k.nama as nama_dokter",
        "k.no_sip",
        "k.no_hp",
        "k.email",
        "k.status",
        DB.raw("(SELECT COUNT(DISTINCT rm.id) FROM trx_rekam_medis rm WHERE rm.kode_karyawan = k.kode_karyawan OR rm.no_sip = k.no_sip) as total_konsultasi_rm"),
        DB.raw("(SELECT COUNT(DISTINCT al.id) FROM trx_antrian_layanan al LEFT JOIN trx_rekam_medis_ruangan rmr ON al.kode_antrian_layanan = rmr.kode_antrian_layanan WHERE al.kode_karyawan IN (k.kode_karyawan, k.no_sip, k.kode_user) OR rmr.kode_karyawan IN (k.kode_karyawan, k.no_sip, k.kode_user)) as total_tindakan_layanan")
      )
      .orderBy("k.nama", "asc");

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data Laporan Dokter berhasil dimuat",
      datetime: formatDateSystem(),
      data: rows,
      total_data: rows.length,
    });
  } catch (err) {
    Logging(err, { file: "laporan_routes.js", func: "dokter", request: body });
    return res.status(500).json({ status: status.BAD_REQUEST, message: err.message });
  }
});

/**
 * 10. LAPORAN BEAUTICIAN
 */
router.post("/beautician", async (req, res) => {
  const { body } = req;
  const branchCode = getBranchScope(req, body.kode_cabang);
  const keyword = body.keyword || "";
  const filterJabatan = body.jabatan || null;
  const filterStatus = body.status || null;

  try {
    const baseQuery = DB("mst_karyawan as k")
      .whereRaw("LOWER(k.jabatan) IN ('terapis', 'perawat', 'beautician')")
      .modify((qb) => {
        if (branchCode) {
          qb.where("k.kode_cabang", branchCode);
        }
        if (filterJabatan) {
          qb.whereRaw("LOWER(k.jabatan) = ?", [filterJabatan.toLowerCase()]);
        }
        if (filterStatus) {
          qb.where("k.status", filterStatus);
        }
        if (keyword) {
          const lower = keyword.toLowerCase();
          qb.where(function () {
            this.whereRaw("LOWER(k.kode_karyawan) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(k.nama) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(k.jabatan) LIKE ?", [`%${lower}%`]);
          });
        }
      });

    const rows = await baseQuery
      .select(
        "k.id",
        "k.kode_karyawan",
        "k.nama as nama_beautician",
        "k.jabatan",
        "k.no_hp",
        "k.email",
        "k.status",
        DB.raw("(SELECT COUNT(DISTINCT al.id) FROM trx_antrian_layanan al LEFT JOIN trx_rekam_medis_ruangan rmr ON al.kode_antrian_layanan = rmr.kode_antrian_layanan WHERE al.kode_karyawan IN (k.kode_karyawan, k.no_sip, k.kode_user) OR rmr.kode_karyawan IN (k.kode_karyawan, k.no_sip, k.kode_user)) as total_treatment_ditangani"),
        DB.raw("(SELECT COUNT(DISTINCT rmr.id) FROM trx_rekam_medis_ruangan rmr WHERE rmr.kode_karyawan IN (k.kode_karyawan, k.no_sip, k.kode_user)) as total_sesi_ruangan")
      )
      .orderBy("k.nama", "asc");

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data Laporan Beautician berhasil dimuat",
      datetime: formatDateSystem(),
      data: rows,
      total_data: rows.length,
    });
  } catch (err) {
    Logging(err, { file: "laporan_routes.js", func: "beautician", request: body });
    return res.status(500).json({ status: status.BAD_REQUEST, message: err.message });
  }
});

/**
 * 12. LAPORAN INVENTORY
 */
router.post("/inventory", async (req, res) => {
  const { body } = req;
  const branchCode = getBranchScope(req, body.kode_cabang);
  const keyword = body.keyword || "";
  const filterKategori = body.kode_kategori_produk || null;
  const filterStatusStok = body.status_stok || null;

  try {
    const baseQuery = DB("mst_produk as p")
      .leftJoin("mst_kategori_produk as kp", "p.kode_kategori_produk", "kp.kode_kategori_produk")
      .leftJoin("mst_supplier as s", "p.kode_supplier", "s.kode_supplier")
      .modify((qb) => {
        if (branchCode) {
          qb.where("p.kode_cabang", branchCode);
        }
        if (filterKategori) {
          qb.where("p.kode_kategori_produk", filterKategori);
        }
        if (filterStatusStok === "habis") {
          qb.where("p.stok_tersedia", "<=", 0);
        } else if (filterStatusStok === "menipis") {
          qb.where("p.stok_tersedia", ">", 0).whereRaw("p.stok_tersedia <= p.stok_minimum");
        } else if (filterStatusStok === "aman") {
          qb.whereRaw("p.stok_tersedia > p.stok_minimum");
        }
        if (keyword) {
          const lower = keyword.toLowerCase();
          qb.where(function () {
            this.whereRaw("LOWER(p.kode_produk) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(p.nama) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(kp.nama) LIKE ?", [`%${lower}%`])
              .orWhereRaw("LOWER(s.nama) LIKE ?", [`%${lower}%`]);
          });
        }
      });

    const rows = await baseQuery
      .select(
        "p.id",
        "p.kode_produk",
        "p.nama as nama_produk",
        "kp.nama as nama_kategori",
        "s.nama as nama_supplier",
        "p.satuan",
        "p.harga_beli",
        "p.harga_jual",
        "p.stok_tersedia",
        "p.stok_minimum",
        "p.status",
        DB.raw("(p.stok_tersedia * p.harga_beli) as total_nilai_aset_beli"),
        DB.raw("(p.stok_tersedia * p.harga_jual) as total_nilai_aset_jual")
      )
      .orderBy("p.stok_tersedia", "asc");

    const totalAsetBeli = rows.reduce((acc, r) => acc + parseFloat(r.total_nilai_aset_beli || 0), 0);
    const totalAsetJual = rows.reduce((acc, r) => acc + parseFloat(r.total_nilai_aset_jual || 0), 0);
    const produkMenipis = rows.filter((r) => r.stok_tersedia <= r.stok_minimum).length;

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data Laporan Inventory berhasil dimuat",
      datetime: formatDateSystem(),
      data: rows,
      total_data: rows.length,
      summary: {
        total_aset_beli: totalAsetBeli,
        total_aset_jual: totalAsetJual,
        produk_menipis: produkMenipis,
        total_produk: rows.length,
      },
    });
  } catch (err) {
    Logging(err, { file: "laporan_routes.js", func: "inventory", request: body });
    return res.status(500).json({ status: status.BAD_REQUEST, message: err.message });
  }
});

/**
 * 17. LAPORAN VOUCHER
 */
router.post("/voucher", async (req, res) => {
  const { body } = req;
  const branchCode = getBranchScope(req, body.kode_cabang);
  const keyword = body.keyword || "";
  const filterStatus = body.status || null;
  const filterJenisDiskon = body.jenis_diskon || null;

  try {
    const baseQuery = DB("mst_promo as pr").modify((qb) => {
      if (branchCode) {
        qb.where("pr.kode_cabang", branchCode);
      }
      if (filterStatus) {
        qb.where("pr.status", filterStatus);
      }
      if (filterJenisDiskon) {
        qb.where("pr.jenis_diskon", filterJenisDiskon);
      }
      if (keyword) {
        const lower = keyword.toLowerCase();
        qb.where(function () {
          this.whereRaw("LOWER(pr.kode_promo) LIKE ?", [`%${lower}%`])
            .orWhereRaw("LOWER(pr.nama) LIKE ?", [`%${lower}%`]);
        });
      }
    });

    const rows = await baseQuery
      .select(
        "pr.id",
        "pr.kode_promo",
        "pr.nama as nama_promo",
        "pr.jenis_diskon",
        "pr.nilai_diskon",
        "pr.tanggal_mulai",
        "pr.tanggal_selesai",
        "pr.status"
      )
      .orderBy("pr.created_at", "desc");

    // Ambil detail item promo
    const kodePromoList = rows.map((r) => r.kode_promo);
    let detailsMap = {};
    if (kodePromoList.length > 0) {
      const details = await DB("mst_detail_promo as dp")
        .whereIn("dp.kode_promo", kodePromoList)
        .select("dp.kode_promo", "dp.jenis_item", "dp.kode_item", "dp.status");

      details.forEach((d) => {
        if (!detailsMap[d.kode_promo]) {
          detailsMap[d.kode_promo] = [];
        }
        detailsMap[d.kode_promo].push(d);
      });
    }

    const formattedData = rows.map((p) => ({
      ...p,
      items: detailsMap[p.kode_promo] || [],
      total_item_terkait: (detailsMap[p.kode_promo] || []).length,
    }));

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data Laporan Voucher/Promo berhasil dimuat",
      datetime: formatDateSystem(),
      data: formattedData,
      total_data: formattedData.length,
    });
  } catch (err) {
    Logging(err, { file: "laporan_routes.js", func: "voucher", request: body });
    return res.status(500).json({ status: status.BAD_REQUEST, message: err.message });
  }
});

/**
 * 19. LAPORAN KEUANGAN
 */
router.post("/keuangan", async (req, res) => {
  const { body } = req;
  const branchCode = getBranchScope(req, body.kode_cabang);
  const tanggal_dari = body.tanggal_dari || null;
  const tanggal_sampai = body.tanggal_sampai || null;

  try {
    const baseQuery = DB("trx_transaksi as t").modify((qb) => {
      if (branchCode) {
        qb.where("t.kode_cabang", branchCode);
      }
      if (tanggal_dari) {
        qb.whereRaw("DATE(t.tanggal_transaksi) >= ?", [tanggal_dari]);
      }
      if (tanggal_sampai) {
        qb.whereRaw("DATE(t.tanggal_transaksi) <= ?", [tanggal_sampai]);
      }
      if (body.metode_bayar) {
        if (Array.isArray(body.metode_bayar) && body.metode_bayar.length > 0) {
          qb.whereIn("t.metode_bayar", body.metode_bayar);
        } else if (typeof body.metode_bayar === "string") {
          qb.where("t.metode_bayar", body.metode_bayar);
        }
      }
      if (body.status) {
        if (Array.isArray(body.status) && body.status.length > 0) {
          qb.whereIn("t.status", body.status);
        } else if (typeof body.status === "string") {
          qb.where("t.status", body.status);
        }
      }
    });

    const summaryTotal = await baseQuery.clone()
      .select(
        DB.raw("COALESCE(SUM(t.total_harga), 0) as total_bruto"),
        DB.raw("COALESCE(SUM(t.total_diskon), 0) as total_diskon"),
        DB.raw("COALESCE(SUM(t.total_bayar), 0) as total_netto"),
        DB.raw("COUNT(t.id) as total_transaksi")
      )
      .first();

    const perMetode = await baseQuery.clone()
      .select(
        DB.raw("LOWER(COALESCE(t.metode_bayar, 'tunai')) as metode_bayar"),
        DB.raw("COUNT(t.id) as jumlah_transaksi"),
        DB.raw("COALESCE(SUM(t.total_bayar), 0) as total_nominal")
      )
      .groupByRaw("LOWER(COALESCE(t.metode_bayar, 'tunai'))");

    const perTanggal = await baseQuery.clone()
      .select(
        DB.raw("DATE(t.tanggal_transaksi) as tanggal"),
        DB.raw("COUNT(t.id) as jumlah_transaksi"),
        DB.raw("COALESCE(SUM(t.total_harga), 0) as total_bruto"),
        DB.raw("COALESCE(SUM(t.total_diskon), 0) as total_diskon"),
        DB.raw("COALESCE(SUM(t.total_bayar), 0) as total_netto")
      )
      .groupByRaw("DATE(t.tanggal_transaksi)")
      .orderBy("tanggal", "desc");

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data Laporan Keuangan berhasil dimuat",
      datetime: formatDateSystem(),
      data: perTanggal,
      total_data: perTanggal.length,
      summary: {
        total_bruto: parseFloat(summaryTotal?.total_bruto || 0),
        total_diskon: parseFloat(summaryTotal?.total_diskon || 0),
        total_netto: parseFloat(summaryTotal?.total_netto || 0),
        total_transaksi: parseInt(summaryTotal?.total_transaksi || 0, 10),
        breakdown_metode: perMetode,
      },
    });
  } catch (err) {
    Logging(err, { file: "laporan_routes.js", func: "keuangan", request: body });
    return res.status(500).json({ status: status.BAD_REQUEST, message: err.message });
  }
});

export default router;

/**
 * @copyright (c) 2026 PT Marstech Global (info@marstech.co.id)
 * @project Sistem Klinik
 * @file pendaftaran_pasien_layanan_options.js
 * @description Endpoint untuk mengambil pilihan layanan aktif (per kategori) dan paket layanan aktif
 *
 * @author Antigravity
 * @created 2026-08-21
 */

import express from "express";
import DB from "../../../../core/config/knex.js";
import { formatDateSystem } from "../../components/tools/date_tools.js";
import { Logging } from "../../components/tools/servertool.js";
import { status } from "../../components/tools/general.js";

const router = express.Router();

const handleGetOptions = async (req, res) => {
  const oPayload = { ...req.query, ...req.body };
  const username = req?.auth?.username || "";

  try {
    // 1. Fetch ALL ruangan aktif from DB
    const vaRuangan = await DB("mst_ruangan")
      .where("status", "aktif")
      .select("kode_ruangan", "nama_ruangan", "is_konsultasi")
      .orderBy("id", "asc");

    // 2. Tentukan nama hari ini (WIB / sistem)
    const HARI_MAP = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
    const todayStr = formatDateSystem(new Date(), "yyyy-MM-dd");
    const [year, month, day] = todayStr.split("-").map(Number);
    const todayDay = HARI_MAP[new Date(year, month - 1, day).getDay()];

    // 3. Ambil jadwal aktif hari ini dari mst_jadwal_karyawan
    const activeSchedulesToday = await DB("mst_jadwal_karyawan as j")
      .leftJoin("mst_karyawan as k", "j.no_sip", "k.no_sip")
      .leftJoin("mst_ruangan as r", "j.kode_ruangan", "r.kode_ruangan")
      .where("j.status", "aktif")
      .where("j.hari", todayDay)
      .select(
        "j.id",
        "j.kode_jadwal",
        "j.kode_ruangan",
        "r.nama_ruangan",
        "j.no_sip",
        "j.is_penanggung_jawab",
        "j.jam_mulai",
        "j.jam_selesai",
        "k.nama as nama_petugas",
        "k.jabatan as jabatan_petugas"
      )
      .orderBy("j.is_penanggung_jawab", "desc")
      .orderBy("j.jam_mulai", "asc");

    // Kelompokkan jadwal hari ini per kode_ruangan
    const roomSchedulesMap = new Map();
    activeSchedulesToday.forEach((sch) => {
      if (!roomSchedulesMap.has(sch.kode_ruangan)) {
        roomSchedulesMap.set(sch.kode_ruangan, []);
      }
      roomSchedulesMap.get(sch.kode_ruangan).push(sch);
    });

    // Identifikasi Ruang Konsultasi aktif
    const ruangKonsul = vaRuangan.find((rng) => Number(rng.is_konsultasi) === 1);
    const kodeRuanganKonsul = ruangKonsul?.kode_ruangan || "RNG-007";
    const namaRuanganKonsul = ruangKonsul?.nama_ruangan || "Ruang Konsultasi";
    const schedulesKonsul = roomSchedulesMap.get(kodeRuanganKonsul) || [];
    const hasPetugasKonsulToday = schedulesKonsul.length > 0;

    // 4. Fetch layanan aktif
    const vaLayanan = await DB("mst_layanan as l")
      .leftJoin("mst_kategori_layanan as k", "l.kode_kategori_layanan", "k.kode_kategori_layanan")
      .leftJoin("mst_ruangan as r", "l.kode_ruangan", "r.kode_ruangan")
      .where("l.status", "aktif")
      .select(
        "l.kode_layanan",
        "l.kode_kategori_layanan",
        "k.nama as nama_kategori",
        "l.nama",
        "l.harga",
        "l.durasi_menit",
        "l.tipe",
        "l.kode_ruangan",
        "l.wajib_konsultasi",
        "l.kode_ruangan_konsultasi",
        "r.nama_ruangan as nama_ruangan",
        "r.is_konsultasi as is_konsultasi"
      )
      .orderBy("l.id", "asc");

    // Auto nonaktifkan paket yang sudah melewati tanggal_selesai
    await DB("mst_paket_layanan")
      .where("status", "aktif")
      .whereNotNull("tanggal_selesai")
      .whereRaw("DATE(tanggal_selesai) < ?", [todayStr])
      .update({
        status: "nonaktif",
        updated_at: formatDateSystem(),
      });

    // 5. Fetch paket layanan aktif
    const vaPaket = await DB("mst_paket_layanan as p")
      .leftJoin("mst_ruangan as r", "p.kode_ruangan", "r.kode_ruangan")
      .where("p.status", "aktif")
      .select("p.kode_paket_layanan", "p.nama", "p.harga_paket", "p.masa_berlaku_hari", "p.tanggal_mulai", "p.tanggal_selesai", "p.tipe", "p.kode_ruangan", "r.nama_ruangan as nama_ruangan", "r.is_konsultasi as is_konsultasi")
      .orderBy("p.id", "asc");

    // Map layanan & paket grouped by ruangan (initialized with ALL DB rooms)
    const ruanganMap = new Map();
    vaRuangan.forEach((rng) => {
      const roomSchedules = roomSchedulesMap.get(rng.kode_ruangan) || [];
      const hasPetugas = roomSchedules.length > 0;
      const pjStaff = roomSchedules.find((s) => s.is_penanggung_jawab === 1) || roomSchedules[0];

      ruanganMap.set(rng.kode_ruangan, {
        kode_ruangan: rng.kode_ruangan,
        nama_ruangan: rng.nama_ruangan || rng.kode_ruangan,
        deskripsi: "",
        is_konsultasi: Number(rng.is_konsultasi || 0),
        has_petugas_jaga_today: hasPetugas,
        petugas_jaga_count: roomSchedules.length,
        petugas_pj: pjStaff
          ? {
              nama: pjStaff.nama_petugas,
              jabatan: pjStaff.jabatan_petugas,
              no_sip: pjStaff.no_sip,
              jam_mulai: pjStaff.jam_mulai?.slice(0, 5),
              jam_selesai: pjStaff.jam_selesai?.slice(0, 5),
            }
          : null,
        petugas_jaga_names: roomSchedules.map((s) => s.nama_petugas).filter(Boolean),
        items: [],
      });
    });

    // Fetch active promos for today
    const activePromos = await DB("mst_promo as p")
      .join("mst_detail_promo as dp", "p.kode_promo", "dp.kode_promo")
      .where("p.status", "aktif")
      .where("dp.status", "aktif")
      .whereRaw("DATE(p.tanggal_mulai) <= ?", [todayStr])
      .whereRaw("DATE(p.tanggal_selesai) >= ?", [todayStr])
      .select(
        "p.kode_promo",
        "p.nama as nama_promo",
        "p.jenis_diskon",
        "p.nilai_diskon",
        "dp.jenis_item",
        "dp.kode_item"
      );

    const promoMap = {};
    activePromos.forEach((pr) => {
      const jenisClean = (pr.jenis_item || "").toLowerCase();
      const normJenis = jenisClean.includes("layanan")
        ? jenisClean.includes("paket") ? "paket" : "layanan"
        : jenisClean.includes("produk") ? jenisClean.includes("paket") ? "paket" : "produk" : jenisClean;

      const keys = [`${normJenis}_${pr.kode_item}`, `${jenisClean}_${pr.kode_item}`];
      keys.forEach((key) => {
        if (!promoMap[key]) {
          promoMap[key] = pr;
        } else {
          const curVal = parseFloat(promoMap[key].nilai_diskon || 0);
          const newVal = parseFloat(pr.nilai_diskon || 0);
          if (newVal > curVal) {
            promoMap[key] = pr;
          }
        }
      });
    });

    const applyPromo = (item) => {
      const jenisClean = (item.jenis || "").toLowerCase();
      const normJenis = jenisClean.includes("layanan")
        ? jenisClean.includes("paket") ? "paket" : "layanan"
        : jenisClean.includes("produk") ? jenisClean.includes("paket") ? "paket" : "produk" : jenisClean;

      const key1 = `${normJenis}_${item.kode_layanan}`;
      const key2 = `${jenisClean}_${item.kode_layanan}`;
      const promo = promoMap[key1] || promoMap[key2];

      if (promo) {
        const diskonNilai = parseFloat(promo.nilai_diskon || 0);
        let hargaDiskon = item.harga;
        if (promo.jenis_diskon === "persen") {
          hargaDiskon = Math.max(0, item.harga - (item.harga * diskonNilai) / 100);
        } else {
          hargaDiskon = Math.max(0, item.harga - diskonNilai);
        }

        return {
          ...item,
          is_promo: true,
          kode_promo: promo.kode_promo,
          nama_promo: promo.nama_promo,
          jenis_diskon: promo.jenis_diskon,
          nilai_diskon: diskonNilai,
          harga_asal: item.harga,
          harga: hargaDiskon,
        };
      }

      return {
        ...item,
        is_promo: false,
        harga_asal: item.harga,
      };
    };

    vaLayanan.forEach((lay) => {
      const kodeRuang = lay.kode_ruangan || "LAINNYA";
      let rngObj = ruanganMap.get(kodeRuang);

      // Tentukan validasi ketersediaan petugas hari ini:
      // Jika layanan wajib konsultasi (wajib_konsultasi = 'wajib' atau tipe = 'MEDICAL TREATMENT'),
      // tujuan antrean pertama adalah Ruang Konsultasi, sehingga yang divalidasi adalah Ruang Konsultasi!
      const isWajibKonsul =
        (lay.wajib_konsultasi || "").toString().trim().toLowerCase() === "wajib" ||
        (lay.tipe || "").toString().trim().toUpperCase() === "MEDICAL TREATMENT";

      const targetRuanganCek = isWajibKonsul
        ? (lay.kode_ruangan_konsultasi || kodeRuanganKonsul)
        : (lay.kode_ruangan || "");
      const namaRuanganCek = isWajibKonsul
        ? namaRuanganKonsul
        : (lay.nama_ruangan || lay.kode_ruangan || "Ruang Treatment");

      const targetSchedules = roomSchedulesMap.get(targetRuanganCek) || [];
      const isPetugasAvailable = targetSchedules.length > 0;
      const targetPj = targetSchedules.find((s) => s.is_penanggung_jawab === 1) || targetSchedules[0];

      let alasanTidakTersedia = null;
      if (!isPetugasAvailable) {
        if (isWajibKonsul) {
          alasanTidakTersedia = `Tidak ada dokter/petugas jaga di ${namaRuanganCek} hari ini (${todayDay})`;
        } else {
          alasanTidakTersedia = `Tidak ada petugas jaga di ${namaRuanganCek} hari ini (${todayDay})`;
        }
      }

      const rawItem = {
        jenis: "layanan",
        kode_layanan: lay.kode_layanan,
        kode_kategori: lay.kode_kategori_layanan,
        nama_kategori: lay.nama_kategori || "",
        nama: lay.nama,
        harga: parseFloat(lay.harga || 0),
        durasi_menit: parseInt(lay.durasi_menit || 30, 10),
        tipe: (lay.tipe || "BEAUTY TREATMENT").toString().trim().toUpperCase(),
        kode_ruangan: lay.kode_ruangan || "",
        nama_ruangan: lay.nama_ruangan || lay.kode_ruangan || "Ruang Treatment",
        wajib_konsultasi: lay.wajib_konsultasi || "tidak",
        kode_ruangan_konsultasi: lay.kode_ruangan_konsultasi || "",
        is_konsultasi: Number(lay.is_konsultasi || 0),
        // Validasi petugas jaga hari ini
        is_petugas_available: isPetugasAvailable,
        alasan_tidak_tersedia: alasanTidakTersedia,
        ruangan_cek: targetRuanganCek,
        nama_ruangan_cek: namaRuanganCek,
        petugas_jaga_count: targetSchedules.length,
        petugas_pj_nama: targetPj?.nama_petugas || null,
      };

      const itemData = applyPromo(rawItem);

      if (!rngObj) {
        rngObj = {
          kode_ruangan: kodeRuang,
          nama_ruangan: lay.nama_ruangan || "Ruangan Lainnya",
          deskripsi: "",
          is_konsultasi: Number(lay.is_konsultasi || 0),
          has_petugas_jaga_today: isPetugasAvailable,
          petugas_jaga_count: targetSchedules.length,
          petugas_pj: null,
          petugas_jaga_names: [],
          items: [],
        };
        ruanganMap.set(kodeRuang, rngObj);
      }
      rngObj.items.push(itemData);
    });

    // Format paket items & merge into ruanganMap
    const paketItems = [];
    for (const pkt of vaPaket) {
      const detailSesi = await DB("mst_detail_paket_layanan")
        .where("kode_paket_layanan", pkt.kode_paket_layanan)
        .sum("jumlah_sesi as total_sesi")
        .first();
      const totalSesi = parseInt(detailSesi?.total_sesi || 0, 10) || 1;

      // Pengecekan petugas untuk paket: jika tipe MEDICAL TREATMENT -> cek Ruang Konsultasi
      const isWajibKonsul = (pkt.tipe || "").toString().trim().toUpperCase() === "MEDICAL TREATMENT";
      const targetRuanganCek = isWajibKonsul ? kodeRuanganKonsul : (pkt.kode_ruangan || "");
      const namaRuanganCek = isWajibKonsul ? namaRuanganKonsul : (pkt.nama_ruangan || pkt.kode_ruangan || "Ruang Treatment");

      const targetSchedules = roomSchedulesMap.get(targetRuanganCek) || [];
      const isPetugasAvailable = targetSchedules.length > 0;
      const targetPj = targetSchedules.find((s) => s.is_penanggung_jawab === 1) || targetSchedules[0];

      let alasanTidakTersedia = null;
      if (!isPetugasAvailable) {
        if (isWajibKonsul) {
          alasanTidakTersedia = `Tidak ada dokter/petugas jaga di ${namaRuanganCek} hari ini (${todayDay})`;
        } else {
          alasanTidakTersedia = `Tidak ada petugas jaga di ${namaRuanganCek} hari ini (${todayDay})`;
        }
      }

      const rawItem = {
        jenis: "paket",
        kode_layanan: pkt.kode_paket_layanan,
        kode_kategori: "PAKET",
        nama_kategori: "Paket Layanan",
        nama: pkt.nama,
        harga: parseFloat(pkt.harga_paket || 0),
        durasi_menit: 60, // default estimasi durasi paket
        masa_berlaku_hari: pkt.masa_berlaku_hari,
        total_sesi: totalSesi,
        tipe: (pkt.tipe || "BEAUTY TREATMENT").toString().trim().toUpperCase(),
        kode_ruangan: pkt.kode_ruangan || "",
        nama_ruangan: pkt.nama_ruangan || pkt.kode_ruangan || "Ruang Treatment",
        is_konsultasi: Number(pkt.is_konsultasi || 0),
        // Validasi petugas jaga hari ini
        is_petugas_available: isPetugasAvailable,
        alasan_tidak_tersedia: alasanTidakTersedia,
        ruangan_cek: targetRuanganCek,
        nama_ruangan_cek: namaRuanganCek,
        petugas_jaga_count: targetSchedules.length,
        petugas_pj_nama: targetPj?.nama_petugas || null,
      };

      const itemData = applyPromo(rawItem);

      const kodeRuang = pkt.kode_ruangan || "LAINNYA";
      let rngObj = ruanganMap.get(kodeRuang);
      if (!rngObj) {
        rngObj = {
          kode_ruangan: kodeRuang,
          nama_ruangan: pkt.nama_ruangan || "Ruangan Lainnya",
          deskripsi: "",
          is_konsultasi: Number(pkt.is_konsultasi || 0),
          has_petugas_jaga_today: isPetugasAvailable,
          petugas_jaga_count: targetSchedules.length,
          petugas_pj: null,
          petugas_jaga_names: [],
          items: [],
        };
        ruanganMap.set(kodeRuang, rngObj);
      }
      rngObj.items.push(itemData);
      paketItems.push(itemData);
    }

    // Output all ruangan data from database (all rooms)
    const resultRuangan = Array.from(ruanganMap.values());
    const ruanganDenganPetugasCount = resultRuangan.filter((r) => r.has_petugas_jaga_today).length;

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data pilihan layanan dan paket ditemukan",
      datetime: formatDateSystem(),
      data: {
        today_info: {
          tanggal: todayStr,
          hari: todayDay,
          total_ruangan_aktif: vaRuangan.length,
          ruangan_dengan_petugas_count: ruanganDenganPetugasCount,
          has_petugas_konsul_today: hasPetugasKonsulToday,
        },
        ruangan_layanan: resultRuangan,
        kategori_layanan: resultRuangan,
        paket_layanan: paketItems,
      },
    });
  } catch (error) {
    const oResult = {
      status: status.BAD_REQUEST,
      message: "Sistem sedang maintenance harap tunggu sebentar",
      datetime: formatDateSystem(),
    };

    Logging(error, {
      file: "/master/pendaftaran_pasien/pendaftaran_pasien_layanan_options.js",
      func: "get_options",
      request: oPayload,
      response: oResult,
      user: username,
    });

    return res.status(500).json(oResult);
  }
};

router.get("/", handleGetOptions);
router.post("/", handleGetOptions);

export default router;

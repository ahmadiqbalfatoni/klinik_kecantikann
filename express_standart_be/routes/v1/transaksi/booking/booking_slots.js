/**
 * @copyright (c) 2026 PT Marstech Global (info@marstech.co.id)
 * @project Sistem Klinik
 * @file booking_slots.js
 * @description Endpoint untuk mengecek slot jadwal karyawan yang tersedia dan kuota booking
 *
 * @author Antigravity
 * @created 2026-09-07
 */

import express from "express";
import DB from "../../../../core/config/knex.js";
import { formatDateSystem } from "../../components/tools/date_tools.js";
import { Logging } from "../../components/tools/servertool.js";
import { status } from "../../components/tools/general.js";

const router = express.Router();

// Daftar hari dalam bahasa Indonesia (sesuai nilai kolom 'hari' di mst_jadwal_karyawan)
const HARI_MAP = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

// Default persentase DP (20%) - mudah dikonfigurasi
const DEFAULT_DP_PERCENTAGE = 20;

router.post("/", async (req, res) => {
  const { body } = req;
  const oPayload = body || {};
  const username = req?.auth?.username || "system";

  try {
    const tanggalBooking = (oPayload.tanggal_booking || "").trim();
    const kodeRuanganParam = (oPayload.kode_ruangan || "").trim();
    const jenisLayanan = (oPayload.jenis_layanan || "layanan").toLowerCase().trim();
    const kodeLayanan = (oPayload.kode_layanan || "").trim();

    if (!tanggalBooking) {
      return res.status(422).json({
        status: status.BAD_REQUEST,
        message: "Tanggal booking wajib dipilih",
        datetime: formatDateSystem(),
      });
    }

    if (!kodeRuanganParam && !kodeLayanan) {
      return res.status(422).json({
        status: status.BAD_REQUEST,
        message: "Ruangan atau layanan wajib dipilih",
        datetime: formatDateSystem(),
      });
    }

    // 1. Tentukan nama hari dari tanggal_booking
    // Gunakan split YYYY-MM-DD agar terhindar dari timezone shift
    const cleanDateStr = (tanggalBooking || "").slice(0, 10);
    const [year, month, day] = cleanDateStr.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayName = HARI_MAP[dateObj.getDay()];

    // 2. Ambil informasi layanan atau paket (jika ada) dan tentukan kode_ruangan
    let itemInfo = null;
    let targetKodeRuangan = kodeRuanganParam;
    let baseHarga = 0;
    let namaItem = "";

    if (kodeLayanan) {
      if (jenisLayanan === "paket") {
        const pkt = await DB("mst_paket_layanan as p")
          .leftJoin("mst_ruangan as r", "p.kode_ruangan", "r.kode_ruangan")
          .where("p.kode_paket_layanan", kodeLayanan)
          .where("p.status", "aktif")
          .select("p.kode_paket_layanan", "p.nama", "p.harga_paket", "p.kode_ruangan", "r.nama_ruangan")
          .first();

        if (pkt) {
          itemInfo = pkt;
          if (!targetKodeRuangan) targetKodeRuangan = pkt.kode_ruangan;
          baseHarga = parseFloat(pkt.harga_paket || 0);
          namaItem = pkt.nama;
        }
      } else {
        const lay = await DB("mst_layanan as l")
          .leftJoin("mst_ruangan as r", "l.kode_ruangan", "r.kode_ruangan")
          .where("l.kode_layanan", kodeLayanan)
          .where("l.status", "aktif")
          .select("l.kode_layanan", "l.nama", "l.harga", "l.durasi_menit", "l.kode_ruangan", "r.nama_ruangan")
          .first();

        if (lay) {
          itemInfo = lay;
          if (!targetKodeRuangan) targetKodeRuangan = lay.kode_ruangan;
          baseHarga = parseFloat(lay.harga || 0);
          namaItem = lay.nama;
        }
      }
    }

    // Ambil info nama ruangan jika belum ada
    let namaRuanganTarget = itemInfo?.nama_ruangan || "";
    if (!namaRuanganTarget && targetKodeRuangan) {
      const rng = await DB("mst_ruangan").where("kode_ruangan", targetKodeRuangan).first();
      namaRuanganTarget = rng?.nama_ruangan || targetKodeRuangan;
    }

    // 3. Query jadwal karyawan aktif pada hari yang sesuai dan ruangan terkait
    const queryJadwal = DB("mst_jadwal_karyawan as j")
      .leftJoin("mst_karyawan as k", "j.no_sip", "k.no_sip")
      .leftJoin("mst_ruangan as r", "j.kode_ruangan", "r.kode_ruangan")
      .where("j.status", "aktif")
      .where("j.hari", dayName);

    if (targetKodeRuangan) {
      queryJadwal.where("j.kode_ruangan", targetKodeRuangan);
    }

    const vaJadwal = await queryJadwal
      .select(
        "j.id",
        "j.kode_jadwal",
        "j.no_sip",
        "k.nama as nama_petugas",
        "k.jabatan as jabatan_petugas",
        "j.kode_ruangan",
        "r.nama_ruangan",
        "j.hari",
        "j.jam_mulai",
        "j.jam_selesai",
        "j.kuota"
      )
      .orderBy("j.jam_mulai", "asc");

    // 4. Hitung pemakaian kuota per jadwal pada tanggal tersebut
    const vaSlots = [];
    for (const jdw of vaJadwal) {
      const bookedRows = await DB("trx_booking")
        .where("kode_jadwal", jdw.kode_jadwal)
        .where("tanggal_booking", tanggalBooking)
        .whereNotIn("status", ["dibatalkan", "tidak_hadir"])
        .select("jam_booking");

      const terisi = bookedRows.length;
      const totalKuota = parseInt(jdw.kuota || 0, 10);
      const sisaKuota = Math.max(0, totalKuota - terisi);
      const isAvailable = sisaKuota > 0;
      const bookedTimes = bookedRows
        .map((b) => (b.jam_booking ? String(b.jam_booking).slice(0, 5) : ""))
        .filter(Boolean);

      vaSlots.push({
        kode_jadwal: jdw.kode_jadwal,
        no_sip: jdw.no_sip,
        nama_petugas: jdw.nama_petugas || "Petugas Medis",
        jabatan_petugas: jdw.jabatan_petugas || "Dokter / Terapis",
        kode_ruangan: jdw.kode_ruangan,
        nama_ruangan: jdw.nama_ruangan || jdw.kode_ruangan,
        hari: jdw.hari,
        jam_mulai: jdw.jam_mulai ? jdw.jam_mulai.slice(0, 5) : "08:00",
        jam_selesai: jdw.jam_selesai ? jdw.jam_selesai.slice(0, 5) : "16:00",
        jam_booking_default: jdw.jam_mulai ? jdw.jam_mulai.slice(0, 5) : "08:00",
        kuota_total: totalKuota,
        kuota_terisi: terisi,
        sisa_kuota: sisaKuota,
        is_available: isAvailable,
        booked_times: bookedTimes,
      });
    }

    // 5. Query jadwal dokter jaga di Ruang Konsultasi (is_konsultasi = 1) pada hari yang sama
    const dokterKonsulList = await DB("mst_jadwal_karyawan as j")
      .join("mst_ruangan as r", "j.kode_ruangan", "r.kode_ruangan")
      .join("mst_karyawan as k", "j.no_sip", "k.no_sip")
      .where("r.is_konsultasi", 1)
      .where("j.hari", dayName)
      .where("j.status", "aktif")
      .select(
        "j.kode_jadwal",
        "j.jam_mulai",
        "j.jam_selesai",
        "k.nama as nama_dokter",
        "k.jabatan as jabatan_petugas",
        "r.nama_ruangan"
      );

    // 6. Kalkulasi default DP
    const dpNominal = Math.round((baseHarga * DEFAULT_DP_PERCENTAGE) / 100);

    return res.status(200).json({
      status: status.SUKSES,
      message: vaSlots.length > 0 ? "Slot jadwal ditemukan" : "Tidak ada jadwal petugas pada hari dan ruangan ini",
      datetime: formatDateSystem(),
      data: {
        item: {
          jenis_layanan: jenisLayanan,
          kode_layanan: kodeLayanan,
          nama: namaItem,
          harga: baseHarga,
          kode_ruangan: targetKodeRuangan,
          nama_ruangan: namaRuanganTarget || targetKodeRuangan,
        },
        tanggal_booking: tanggalBooking,
        hari: dayName,
        dp_percentage_default: DEFAULT_DP_PERCENTAGE,
        dp_nominal_default: dpNominal,
        slots: vaSlots,
        dokter_konsul: dokterKonsulList,
      },
    });
  } catch (error) {
    const oResult = {
      status: status.BAD_REQUEST,
      message: "Terjadi kesalahan saat memuat slot booking",
      datetime: formatDateSystem(),
    };

    Logging(error, {
      file: "/transaksi/booking/booking_slots.js",
      func: "get_slots",
      request: oPayload,
      response: oResult,
      user: username,
    });

    return res.status(500).json(oResult);
  }
});

export default router;

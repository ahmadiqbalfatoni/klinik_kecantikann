/**
 * @copyright (c) 2026 PT Marstech Global (info@marstech.co.id)
 * @project Sistem Klinik
 * @file pendaftaran_pasien_ambil_antrian_layanan.js
 * @description Endpoint terpadu untuk menerbitkan trx_kunjungan + trx_antrian_awal + trx_antrian_layanan dalam 1 transaksi DB tunggal
 *
 * @author Antigravity
 * @created 2026-08-21
 */

import express from "express";
import DB from "../../../../core/config/knex.js";
import { formatDateSystem } from "../../components/tools/date_tools.js";
import { Logging, ChangesLog } from "../../components/tools/servertool.js";
import { status } from "../../components/tools/general.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { body } = req;
  const oPayload = body || {};
  const username = req?.auth?.username || "system";

  try {
    const no_rm = (oPayload.no_rm || "").trim();
    const items = Array.isArray(oPayload.items) ? oPayload.items : [];

    if (!no_rm) {
      return res.status(422).json({
        status: status.BAD_REQUEST,
        message: "Nomor RM pasien wajib diisi",
        datetime: formatDateSystem(),
      });
    }

    // 1. Validasi Pasien Aktif
    const pasien = await DB("mst_pasien")
      .where("no_rm", no_rm)
      .where("status", "aktif")
      .first();

    if (!pasien) {
      return res.status(404).json({
        status: status.BAD_REQUEST,
        message: `Pasien dengan Nomor RM ${no_rm} tidak ditemukan atau tidak aktif`,
        datetime: formatDateSystem(),
      });
    }

    let resultData = null;
    const vaCreatedAntrianLayanan = [];

    // 2. Eksekusi 1 Transaksi DB Atomic
    await DB.transaction(async (trx) => {
      const now = new Date();
      const todayYmd = formatDateSystem(now, "yyyy-MM-dd") || now.toISOString().slice(0, 10);
      const todayStr = todayYmd.replace(/-/g, "");

      const HARI_MAP = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
      const [year, month, day] = todayYmd.split("-").map(Number);
      const todayDay = HARI_MAP[new Date(year, month - 1, day).getDay()];

      // A. Generate Kode Kunjungan (KJ-YYYYMMDD-001)
      const prefixKunjungan = `KJ-${todayStr}-`;
      const lastKunjungan = await trx("trx_kunjungan")
        .where("kode_kunjungan", "like", `${prefixKunjungan}%`)
        .orderBy("id", "desc")
        .first();

      let nextKjSeq = 1;
      if (lastKunjungan && lastKunjungan.kode_kunjungan) {
        const parts = lastKunjungan.kode_kunjungan.split("-");
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num)) {
          nextKjSeq = num + 1;
        }
      }
      const cKodeKunjungan = `${prefixKunjungan}${String(nextKjSeq).padStart(3, "0")}`;
      const jamDatang = now.toTimeString().slice(0, 8);

      // B. Insert trx_kunjungan
      const oKunjunganData = {
        kode_kunjungan: cKodeKunjungan,
        no_rm: pasien.no_rm,
        tanggal_kunjungan: todayYmd,
        jam_datang: jamDatang,
        status: "berlangsung",
        tz: oPayload.tz || "Asia/Jakarta",
        created_by: username,
        created_at: formatDateSystem(),
        updated_by: username,
        updated_at: formatDateSystem(),
      };

      await trx("trx_kunjungan").insert(oKunjunganData);

      // C. Alokasi 1 trx_antrian_awal status 'tersedia' terkecil (Auto-generate jika belum ada)
      let antrianAwalTersedia = await trx("trx_antrian_awal")
        .where("status", "tersedia")
        .orderBy("id", "asc")
        .first();

      if (!antrianAwalTersedia) {
        const lastRecord = await trx("trx_antrian_awal")
          .where("created_at", ">=", todayYmd + " 00:00:00")
          .orderBy("id", "desc")
          .first();

        let nextNum = 1;
        if (lastRecord && lastRecord.nomor_antrian) {
          const parsed = parseInt(lastRecord.nomor_antrian, 10);
          if (!isNaN(parsed)) nextNum = parsed + 1;
        }

        const cNoAntrianAwal = String(nextNum).padStart(2, "0");
        const prefixAntrianAwal = `A-${todayStr}-`;
        const cKodeAntrianAwal = `${prefixAntrianAwal}${String(nextNum).padStart(3, "0")}`;

        const [newAntrianAwalId] = await trx("trx_antrian_awal").insert({
          kode_antrian_awal: cKodeAntrianAwal,
          nomor_antrian: cNoAntrianAwal,
          status: "terpakai",
          diambil_at: formatDateSystem(),
          no_rm: pasien.no_rm,
          kode_kunjungan: cKodeKunjungan,
          tz: oPayload.tz || "Asia/Jakarta",
          created_by: username,
          created_at: formatDateSystem(),
          updated_by: username,
          updated_at: formatDateSystem(),
        });

        antrianAwalTersedia = {
          id: newAntrianAwalId,
          kode_antrian_awal: cKodeAntrianAwal,
          nomor_antrian: cNoAntrianAwal,
        };
      } else {
        await trx("trx_antrian_awal")
          .where("id", antrianAwalTersedia.id)
          .update({
            status: "terpakai",
            diambil_at: formatDateSystem(),
            no_rm: pasien.no_rm,
            kode_kunjungan: cKodeKunjungan,
            updated_by: username,
            updated_at: formatDateSystem(),
          });
      }

      // D. Insert trx_antrian_layanan (jika ada items, diproses & dikelompokkan per ruangan)
      if (items.length > 0) {
        const prefixAntrianLayanan = `AL-${todayStr}-`;

        // Ambil promo aktif hari ini untuk referensi kasir
        const activePromos = await trx("mst_promo as p")
          .join("mst_detail_promo as dp", "p.kode_promo", "dp.kode_promo")
          .where("p.status", "aktif")
          .where("dp.status", "aktif")
          .whereRaw("DATE(p.tanggal_mulai) <= ?", [todayYmd])
          .whereRaw("DATE(p.tanggal_selesai) >= ?", [todayYmd])
          .select(
            "p.kode_promo",
            "p.nama as nama_promo",
            "p.jenis_diskon",
            "p.nilai_diskon",
            "dp.jenis_item",
            "dp.kode_item"
          );

        // Bangun promoMap: key = `{jenis}_{kode_item}`
        const promoMap = {};
        for (const pr of activePromos) {
          const jenisClean = (pr.jenis_item || "").toLowerCase();
          const normJenis = jenisClean.includes("layanan")
            ? jenisClean.includes("paket") ? "paket" : "layanan"
            : jenisClean.includes("produk") ? jenisClean.includes("paket") ? "paket" : "produk" : jenisClean;
          const keys = [`${normJenis}_${pr.kode_item}`, `${jenisClean}_${pr.kode_item}`];
          for (const key of keys) {
            if (!promoMap[key]) {
              promoMap[key] = pr;
            } else {
              if (parseFloat(pr.nilai_diskon || 0) > parseFloat(promoMap[key].nilai_diskon || 0)) {
                promoMap[key] = pr;
              }
            }
          }
        }

        // Ambil data ruangan konsul aktif (is_konsultasi = 1)
        const ruangKonsul = await trx("mst_ruangan")
          .where("is_konsultasi", 1)
          .where("status", "aktif")
          .first();

        // 1. Validasi & Ambil Detail Semua Item (harga ASLI dari master, promo disimpan sebagai referensi)
        const checkedRoomsToday = new Map();
        const processedItems = [];
        for (const item of items) {
          const jenis = (item.jenis_layanan || item.jenis || "layanan").toLowerCase();
          const kodeLayanan = (item.kode_layanan || item.kode || "").trim();

          if (!["layanan", "paket", "klaim_paket"].includes(jenis) || !kodeLayanan) {
            continue;
          }

          let namaLayanan = "";
          let hargaLayanan = 0; // Selalu harga ASLI dari master
          let kodeRuanganTarget = "";
          let namaRuanganTarget = "";
          let tipeLayanan = "";

          if (jenis === "klaim_paket" || item.is_klaim === true || item.kode_kepemilikan_paket_layanan) {
            const kodeKpl = item.kode_kepemilikan_paket_layanan || item.kode_kepemilikan;
            const kpl = await trx("trx_kepemilikan_paket_layanan")
              .where("kode_kepemilikan_paket_layanan", kodeKpl)
              .where("no_rm", pasien.no_rm)
              .first();

            if (!kpl) {
              const err = new Error(`Data kepemilikan paket ${kodeKpl} tidak ditemukan untuk pasien ${pasien.no_rm}`);
              err.statusCode = 422;
              throw err;
            }

            if (kpl.status !== "aktif") {
              const err = new Error(`Paket ${kpl.kode_kepemilikan_paket_layanan} sudah ${kpl.status}`);
              err.statusCode = 422;
              throw err;
            }

            // Cari detail layanan dalam paket
            let dkpl = null;
            if (kodeLayanan) {
              dkpl = await trx("trx_detail_kepemilikan_paket_layanan")
                .where("kode_kepemilikan_paket_layanan", kodeKpl)
                .where("kode_layanan", kodeLayanan)
                .whereRaw("sesi_total - sesi_terpakai > 0")
                .first();
            }

            if (!dkpl) {
              dkpl = await trx("trx_detail_kepemilikan_paket_layanan")
                .where("kode_kepemilikan_paket_layanan", kodeKpl)
                .whereRaw("sesi_total - sesi_terpakai > 0")
                .first();
            }

            if (!dkpl) {
              const err = new Error(`Sesi layanan paket untuk ${kodeLayanan || kodeKpl} sudah habis`);
              err.statusCode = 422;
              throw err;
            }

            // Potong 1 sesi (sesi_terpakai + 1)
            await trx("trx_detail_kepemilikan_paket_layanan")
              .where("id", dkpl.id)
              .update({
                sesi_terpakai: dkpl.sesi_terpakai + 1,
                updated_at: formatDateSystem(),
              });

            // Cek apakah seluruh detail sesi sudah habis (sisa_sesi === 0)
            const allDetails = await trx("trx_detail_kepemilikan_paket_layanan")
              .where("kode_kepemilikan_paket_layanan", kodeKpl)
              .select("sesi_total", "sesi_terpakai");

            const totalRemaining = allDetails.reduce((sum, d) => sum + Math.max(0, d.sesi_total - d.sesi_terpakai), 0);
            if (totalRemaining <= 0) {
              await trx("trx_kepemilikan_paket_layanan")
                .where("kode_kepemilikan_paket_layanan", kodeKpl)
                .update({
                  status: "habis",
                  updated_at: formatDateSystem(),
                });
            }

            // Ambil info master layanan & paket asal yang diklaim
            const targetLayKode = dkpl.kode_layanan || kodeLayanan;
            const lay = await trx("mst_layanan as l")
              .leftJoin("mst_ruangan as r", "l.kode_ruangan", "r.kode_ruangan")
              .where("l.kode_layanan", targetLayKode)
              .select("l.nama", "l.tipe", "l.kode_ruangan", "r.nama_ruangan as nama_ruangan")
              .first();

            const pktAsal = await trx("mst_paket_layanan as p")
              .leftJoin("mst_ruangan as r", "p.kode_ruangan", "r.kode_ruangan")
              .where("p.kode_paket_layanan", kpl.kode_paket_layanan)
              .select("p.nama as nama_paket", "p.tipe", "p.kode_ruangan", "r.nama_ruangan as nama_ruangan")
              .first();

            namaLayanan = lay ? `${lay.nama} (Klaim Sesi Paket)` : `Klaim Sesi Paket (${targetLayKode})`;
            hargaLayanan = 0; // Klaim paket -> Rp 0 pada kunjungan ini
            tipeLayanan = (pktAsal?.tipe || lay?.tipe || "BEAUTY TREATMENT").toUpperCase();
            kodeRuanganTarget = lay?.kode_ruangan || pktAsal?.kode_ruangan || "RNG-002";
            namaRuanganTarget = lay?.nama_ruangan || pktAsal?.nama_ruangan || "Ruangan Facial & Peeling";
          } else if (jenis === "layanan") {
            const lay = await trx("mst_layanan as l")
              .leftJoin("mst_ruangan as r", "l.kode_ruangan", "r.kode_ruangan")
              .where("l.kode_layanan", kodeLayanan)
              .where("l.status", "aktif")
              .select("l.nama", "l.harga", "l.tipe", "l.kode_ruangan", "l.wajib_konsultasi", "l.kode_ruangan_konsultasi", "r.nama_ruangan as nama_ruangan")
              .first();

            if (!lay) {
              const err = new Error(`Layanan ${kodeLayanan} tidak ditemukan atau nonaktif`);
              err.statusCode = 422;
              throw err;
            }
            namaLayanan = lay.nama;
            hargaLayanan = parseFloat(lay.harga || 0); // harga ASLI
            tipeLayanan = (lay.tipe || "BEAUTY TREATMENT").toUpperCase();
            kodeRuanganTarget = lay.kode_ruangan || "";
            namaRuanganTarget = lay.nama_ruangan || lay.kode_ruangan || "Ruang Treatment";
          } else {
            const pkt = await trx("mst_paket_layanan as p")
              .leftJoin("mst_ruangan as r", "p.kode_ruangan", "r.kode_ruangan")
              .where("p.kode_paket_layanan", kodeLayanan)
              .where("p.status", "aktif")
              .select("p.nama", "p.harga_paket", "p.tipe", "p.masa_berlaku_hari", "p.is_selamanya", "p.tanggal_selesai", "p.kode_ruangan", "r.nama_ruangan as nama_ruangan")
              .first();

            if (!pkt) {
              const err = new Error(`Paket ${kodeLayanan} tidak ditemukan atau nonaktif`);
              err.statusCode = 422;
              throw err;
            }
            namaLayanan = pkt.nama;
            hargaLayanan = parseFloat(pkt.harga_paket || 0); // harga ASLI
            tipeLayanan = (pkt.tipe || "BEAUTY TREATMENT").toUpperCase();
            kodeRuanganTarget = pkt.kode_ruangan || "";
            namaRuanganTarget = pkt.nama_ruangan || pkt.kode_ruangan || "Ruang Treatment";

            // Catat Kepemilikan Paket ke DB jika item ini ber-jenis "paket"
            const pktDetails = await trx("mst_detail_paket_layanan")
              .where("kode_paket_layanan", kodeLayanan)
              .select("kode_layanan", "jumlah_sesi");

            const totalSesiPaket = pktDetails.reduce((sum, d) => sum + parseInt(d.jumlah_sesi || 0, 10), 0);

            if (totalSesiPaket >= 1) {
              const prefixKpl = `KPL-${todayStr}-`;
              const prefixDkpl = `DKPL-${todayStr}-`;

              const lastKpl = await trx("trx_kepemilikan_paket_layanan")
                .where("kode_kepemilikan_paket_layanan", "like", `${prefixKpl}%`)
                .orderBy("id", "desc")
                .first();

              const lastDkpl = await trx("trx_detail_kepemilikan_paket_layanan")
                .where("kode_detail_kepemilikan_paket_layanan", "like", `${prefixDkpl}%`)
                .orderBy("id", "desc")
                .first();

              let seq1 = 0;
              if (lastKpl && lastKpl.kode_kepemilikan_paket_layanan) {
                const parts = lastKpl.kode_kepemilikan_paket_layanan.split("-");
                const num = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(num)) seq1 = num;
              }

              let seq2 = 0;
              if (lastDkpl && lastDkpl.kode_detail_kepemilikan_paket_layanan) {
                const parts = lastDkpl.kode_detail_kepemilikan_paket_layanan.split("-");
                if (parts.length >= 3) {
                  const num = parseInt(parts[2], 10);
                  if (!isNaN(num)) seq2 = num;
                }
              }

              const nextKplSeq = Math.max(seq1, seq2) + 1;
              const cKodeKpl = `${prefixKpl}${String(nextKplSeq).padStart(3, "0")}`;

              let tglExpired = "2099-12-31";
              const masaBerlakuHari = parseInt(pkt.masa_berlaku_hari || 0, 10);
              if (!Boolean(pkt.is_selamanya) && masaBerlakuHari > 0) {
                const dExp = new Date();
                dExp.setDate(dExp.getDate() + masaBerlakuHari);
                tglExpired = formatDateSystem(dExp, "yyyy-MM-dd");
              }

              const oKepemilikan = {
                kode_kepemilikan_paket_layanan: cKodeKpl,
                no_rm: pasien.no_rm,
                kode_paket_layanan: kodeLayanan,
                tanggal_beli: todayYmd,
                tanggal_expired: tglExpired,
                status: "aktif",
                tz: oPayload.tz || "Asia/Jakarta",
                created_by: username,
                created_at: formatDateSystem(),
                updated_by: username,
                updated_at: formatDateSystem(),
              };

              await trx("trx_kepemilikan_paket_layanan").insert(oKepemilikan);

              let dkSeq = 1;
              const vaDetailKpl = [];
              for (const det of pktDetails) {
                const cKodeDkpl = `DKPL-${todayStr}-${String(nextKplSeq).padStart(3, "0")}-${String(dkSeq).padStart(2, "0")}`;
                dkSeq++;
                const jSesi = parseInt(det.jumlah_sesi || 0, 10);
                vaDetailKpl.push({
                  kode_detail_kepemilikan_paket_layanan: cKodeDkpl,
                  kode_kepemilikan_paket_layanan: cKodeKpl,
                  kode_layanan: det.kode_layanan,
                  sesi_total: jSesi,
                  sesi_terpakai: 1, // 1 sesi terpakai pada antrean pendaftaran ini
                  tz: oPayload.tz || "Asia/Jakarta",
                  created_by: username,
                  created_at: formatDateSystem(),
                  updated_by: username,
                  updated_at: formatDateSystem(),
                });
              }
              if (vaDetailKpl.length > 0) {
                await trx("trx_detail_kepemilikan_paket_layanan").insert(vaDetailKpl);
              }
            }
          }

          // Logika Penentuan Konsultasi:
          // 1. Prioritas utama: Jika item berstatus WAJIB / MEDICAL TREATMENT -> needsConsult = true
          // 2. Jika butuh_konsul / lewat_konsultasi dikirimkan secara eksplisit (user memilih Ya/Tidak di dialog/step) -> ikuti pilihan user!
          // 3. Jika TIDAK PERLU KONSUL / SERVICE TREATMENT -> needsConsult = false
          // 4. Default: false
          let needsConsult = false;
          if (item.wajib_konsultasi === "wajib" || item.wajib_konsultasi === "WAJIB" || tipeLayanan === "MEDICAL TREATMENT") {
            needsConsult = true;
          } else if (item.butuh_konsul !== undefined && item.butuh_konsul !== null) {
            needsConsult = item.butuh_konsul === true || item.butuh_konsul === 1 || item.butuh_konsul === "true";
          } else if (item.lewat_konsultasi !== undefined && item.lewat_konsultasi !== null) {
            needsConsult = item.lewat_konsultasi === true || item.lewat_konsultasi === 1 || item.lewat_konsultasi === "true";
          } else if (item.wajib_konsultasi === "tidak" || item.wajib_konsultasi === "TIDAK" || tipeLayanan === "SERVICE TREATMENT") {
            needsConsult = false;
          } else {
            needsConsult = item.pilih_konsul === true || item.is_konsul === 1;
          }

          let kodeRuanganFinal = kodeRuanganTarget;
          let namaRuanganFinal = namaRuanganTarget;

          if (needsConsult && ruangKonsul) {
            kodeRuanganFinal = ruangKonsul.kode_ruangan;
            namaRuanganFinal = ruangKonsul.nama_ruangan || "Ruang Konsultasi";
          }

          // Validasi Ketersediaan Petugas Jaga Hari Ini (Walk-In)
          if (!kodeRuanganFinal) {
            const err = new Error(`Layanan "${namaLayanan}" belum memiliki konfigurasi ruangan tujuan yang valid`);
            err.statusCode = 422;
            throw err;
          }

          if (!checkedRoomsToday.has(kodeRuanganFinal)) {
            const activeSchedulesInRoom = await trx("mst_jadwal_karyawan")
              .where("kode_ruangan", kodeRuanganFinal)
              .where("hari", todayDay)
              .where("status", "aktif")
              .select("id", "no_sip", "is_penanggung_jawab");
            checkedRoomsToday.set(kodeRuanganFinal, activeSchedulesInRoom);
          }

          const activeSchedulesInRoom = checkedRoomsToday.get(kodeRuanganFinal);
          if (!activeSchedulesInRoom || activeSchedulesInRoom.length === 0) {
            const ruangLabel = needsConsult
              ? `Ruang Konsultasi (${kodeRuanganFinal})`
              : `${namaRuanganFinal} (${kodeRuanganFinal})`;

            const err = new Error(
              `Layanan "${namaLayanan}" tidak dapat dipilih karena ruangan ${ruangLabel} tidak memiliki petugas/dokter jaga aktif hari ini (${todayDay.toUpperCase()})`
            );
            err.statusCode = 422;
            throw err;
          }

          // Cari promo aktif untuk item ini (disimpan sebagai referensi kasir, tidak mengubah harga)
          const promoKey1 = `${jenis}_${kodeLayanan}`;
          const promoItem = promoMap[promoKey1] || null;

          processedItems.push({
            jenis_layanan: jenis,
            kode_layanan: kodeLayanan,
            nama_layanan: namaLayanan,
            harga: hargaLayanan,         // harga ASLI — diskon diterapkan di kasir
            kode_promo: promoItem?.kode_promo || null,
            nama_promo: promoItem?.nama_promo || null,
            jenis_diskon: promoItem?.jenis_diskon || null,
            nilai_diskon: promoItem ? parseFloat(promoItem.nilai_diskon || 0) : null,
            kode_ruangan: kodeRuanganFinal,
            nama_ruangan: namaRuanganFinal,
            kode_ruangan_tujuan: kodeRuanganTarget,
            nama_ruangan_tujuan: namaRuanganTarget,
            tipe_layanan: tipeLayanan,
            needs_consult: needsConsult,
          });
        }

        // 2. Kelompokkan item berdasarkan kode_ruangan agar tiap ruangan mendapat nomor antrean tersendiri
        const groupsByRuangan = {};
        for (const pi of processedItems) {
          const key = pi.kode_ruangan || "UNASSIGNED";
          if (!groupsByRuangan[key]) {
            groupsByRuangan[key] = {
              kode_ruangan: pi.kode_ruangan,
              nama_ruangan: pi.nama_ruangan,
              items: [],
            };
          }
          groupsByRuangan[key].items.push(pi);
        }

        // 3. Insert trx_antrian_layanan per kelompok ruangan
        for (const key of Object.keys(groupsByRuangan)) {
          const group = groupsByRuangan[key];
          const groupItems = group.items;

          // Dapatkan urutan kode_antrian_layanan (global)
          const lastAntrianLayanan = await trx("trx_antrian_layanan")
            .where("kode_antrian_layanan", "like", `${prefixAntrianLayanan}%`)
            .orderBy("id", "desc")
            .first();

          let nextSeq = 1;
          if (lastAntrianLayanan && lastAntrianLayanan.kode_antrian_layanan) {
            const parts = lastAntrianLayanan.kode_antrian_layanan.split("-");
            const num = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(num)) {
              nextSeq = num + 1;
            }
          }
          const seqPadded = String(nextSeq).padStart(3, "0");
          const cKodeAntrianLayanan = `${prefixAntrianLayanan}${seqPadded}`;

          // Hitung nomor_antrian KHUSUS PER RUANGAN HARI INI
          let lastNoQuery = trx("trx_antrian_layanan")
            .where("created_at", ">=", todayYmd + " 00:00:00");

          if (group.kode_ruangan) {
            lastNoQuery = lastNoQuery.where("kode_ruangan", group.kode_ruangan);
          } else {
            lastNoQuery = lastNoQuery.where(function () {
              this.whereNull("kode_ruangan").orWhere("kode_ruangan", "");
            });
          }

          const lastNoAntrian = await lastNoQuery.orderBy("id", "desc").first();

          let nextNo = 1;
          if (lastNoAntrian && lastNoAntrian.nomor_antrian) {
            const num = parseInt(lastNoAntrian.nomor_antrian, 10);
            if (!isNaN(num)) {
              nextNo = num + 1;
            }
          }
          const cNomorAntrianSesi = String(nextNo).padStart(2, "0");

          const combinedNamaLayanan = groupItems.map((d) => d.nama_layanan).join(", ");
          const combinedKodeLayanan = groupItems.map((d) => d.kode_layanan).join(", ");
          const totalHargaGroup = groupItems.reduce((sum, d) => sum + d.harga, 0);

          const oInsertLayanan = {
            kode_antrian_layanan: cKodeAntrianLayanan,
            kode_kunjungan: cKodeKunjungan,
            nomor_antrian: cNomorAntrianSesi,
            kode_ruangan: group.kode_ruangan,
            nama_ruangan: group.nama_ruangan,
            status: "menunggu",
            tz: oPayload.tz || "Asia/Jakarta",
            created_by: username,
            created_at: formatDateSystem(),
            updated_by: username,
            updated_at: formatDateSystem(),
          };

          await trx("trx_antrian_layanan").insert(oInsertLayanan);

          // Insert detail rows into trx_detail_antrian_layanan for each selected service
          let dSeq = 1;
          const vaInsertDetail = [];
          for (const item of groupItems) {
            const cKodeDetailAntrian = `DAL-${todayStr}-${seqPadded}-${String(dSeq).padStart(2, "0")}`;
            dSeq++;
            vaInsertDetail.push({
              kode_detail_antrian_layanan: cKodeDetailAntrian,
              kode_antrian_layanan: cKodeAntrianLayanan,
              kode_kunjungan: cKodeKunjungan,
              jenis_layanan: item.jenis_layanan || "layanan",
              kode_layanan: item.kode_layanan,
              nama_layanan: item.nama_layanan,
              harga: item.harga || 0,         // harga ASLI — diskon diterapkan di kasir
              kode_promo: item.kode_promo || null,
              nama_promo: item.nama_promo || null,
              jenis_diskon: item.jenis_diskon || null,
              nilai_diskon: item.nilai_diskon ?? null,
              kode_ruangan: group.kode_ruangan,
              nama_ruangan: group.nama_ruangan,
              tz: oPayload.tz || "Asia/Jakarta",
              created_by: username,
              created_at: formatDateSystem(),
              updated_by: username,
              updated_at: formatDateSystem(),
            });
          }
          if (vaInsertDetail.length > 0) {
            await trx("trx_detail_antrian_layanan").insert(vaInsertDetail);
          }

          vaCreatedAntrianLayanan.push({
            ...oInsertLayanan,
            nama_layanan: combinedNamaLayanan,
            harga: totalHargaGroup,
            detail_items: groupItems,
            details: vaInsertDetail,
          });
        }
      }

      // Audit Log
      await ChangesLog(
        {
          description: `Pendaftaran Kunjungan Pasien (${pasien.no_rm} - ${pasien.nama}) Kunjungan (${cKodeKunjungan}) Total ${vaCreatedAntrianLayanan.length} Layanan/Paket`,
          tableName: "trx_kunjungan",
          referenceCode: cKodeKunjungan,
          action: "CREATE",
          dataBefore: null,
          dataAfter: {
            kunjungan: oKunjunganData,
            antrian_awal: antrianAwalTersedia,
            antrian_layanan: vaCreatedAntrianLayanan,
          },
          user: username,
          tz: oPayload.tz || "Asia/Jakarta",
        },
        trx
      );

      resultData = {
        kode_kunjungan: cKodeKunjungan,
        no_rm: pasien.no_rm,
        nama_pasien: pasien.nama,
        nomor_antrian_awal: antrianAwalTersedia.nomor_antrian,
        kode_antrian_awal: antrianAwalTersedia.kode_antrian_awal,
        tanggal_kunjungan: todayYmd,
        jam_datang: jamDatang,
        antrian_layanan: vaCreatedAntrianLayanan,
      };
    });

    const msg = items.length > 0
      ? `Pendaftaran kunjungan & ${vaCreatedAntrianLayanan.length} nomor antrean layanan berhasil diterbitkan`
      : `Pendaftaran kunjungan pasien ${pasien.nama} berhasil diterbitkan (Tanpa Layanan)`;

    return res.status(200).json({
      status: status.SUKSES,
      message: msg,
      datetime: formatDateSystem(),
      data: resultData,
    });
  } catch (error) {
    if (error.statusCode === 422) {
      return res.status(422).json({
        status: status.BAD_REQUEST,
        message: error.message,
        datetime: formatDateSystem(),
      });
    }

    const oResult = {
      status: status.BAD_REQUEST,
      message: error.message || "Sistem sedang maintenance harap tunggu sebentar",
      datetime: formatDateSystem(),
    };

    Logging(error, {
      file: "/master/pendaftaran_pasien/pendaftaran_pasien_ambil_antrian_layanan.js",
      func: "ambil_antrian_layanan_terpadu",
      request: body,
      response: oResult,
      user: username,
    });

    return res.status(500).json(oResult);
  }
});

export default router;

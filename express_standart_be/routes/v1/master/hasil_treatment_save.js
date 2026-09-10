/**
 * @copyright (c) 2026 PT Marstech Global (info@marstech.co.id)
 * @project Sistem Klinik Kecantikan
 * @file hasil_treatment_save.js
 * @description Endpoint dokter untuk menyimpan hasil treatment (foto after, catatan hasil treatment, dan daftar produk)
 *              Menyimpan foto after & catatan_hasil_treatment ke trx_rekam_medis_ruangan
 *              dan buat/update draft transaksi kasir.
 *
 * @author Antigravity
 * @created 2026-08-27
 */

import express from "express";
import DB from "../../../core/config/knex.js";
import { formatDateSystem } from "../components/tools/date_tools.js";
import { Logging } from "../components/tools/servertool.js";
import { status } from "../components/tools/general.js";
import { syncRekamMedisPerAntrian } from "./ruangan/rekam_medis_service.js";

const router = express.Router();

const handleHasilTreatmentSave = async (req, res) => {
  const oPayload = req.body || {};
  const username = req?.auth?.username || "system";

  const {
    kode_kunjungan,
    no_rm,
    kode_rekam_medis,
    kode_ruangan = "",
    nama_ruangan = "Ruangan Treatment",
    foto_before = "",
    foto_after = "",
    catatan = "",
    produk_items = [], // [{ kode_produk, qty }] — produk tambahan dari dokter
    tz = "Asia/Jakarta",
  } = oPayload;

  if (!kode_kunjungan) {
    return res.status(422).json({
      status: status.BAD_REQUEST,
      message: "kode_kunjungan wajib diisi",
      datetime: formatDateSystem(),
    });
  }

  const produkItems = Array.isArray(produk_items) ? produk_items : [];

  try {
    let createdTransaksiKode = "";
    let grandTotal = 0;

    await DB.transaction(async (trx) => {
      const now = new Date();
      const todayYmd = now.toISOString().slice(0, 10);
      const todayStr = todayYmd.replace(/-/g, "");

      // ─── 1. RESOLVE KODE ANTRIAN LAYANAN & BARIS REKAM MEDIS RUANGAN ─────────
      let resolvedKodeAntrian = oPayload.kode_antrian_layanan;
      if (!resolvedKodeAntrian) {
        const lastAntrian = await trx("trx_antrian_layanan")
          .where("kode_kunjungan", kode_kunjungan)
          .orderBy("id", "desc")
          .first();
        if (lastAntrian) resolvedKodeAntrian = lastAntrian.kode_antrian_layanan;
      }

      let currentAL = null;
      if (resolvedKodeAntrian) {
        currentAL = await trx("trx_antrian_layanan")
          .where("kode_antrian_layanan", resolvedKodeAntrian)
          .first();
      }

      const targetKodeRuangan = kode_ruangan || currentAL?.kode_ruangan || "RNG-000";

      const formPayload = {
        ...(oPayload.hasil_form || {}),
        ...(foto_before ? { foto_before } : {}),
        ...(foto_after ? { foto_after } : {}),
      };

      // Panggil syncRekamMedisPerAntrian untuk memastikan baris ruangan ada & ter-update
      const rmSyncResult = await syncRekamMedisPerAntrian({
        kode_kunjungan,
        kode_antrian_layanan: resolvedKodeAntrian,
        kode_ruangan: targetKodeRuangan,
        nama_ruangan,
        hasil_form: Object.keys(formPayload).length > 0 ? formPayload : null,
        catatan_hasil_treatment: catatan || null,
        kode_karyawan: oPayload.kode_karyawan || currentAL?.kode_karyawan,
        username,
      });

      const id_rekam_medis = rmSyncResult?.id_rekam_medis;
      const id_rekam_medis_ruangan = rmSyncResult?.id_rekam_medis_ruangan;

      // ─── 2. UPDATE CATATAN HASIL TREATMENT & FOTO AFTER (OVERWRITE, TANPA CONCAT ---) ──
      if (id_rekam_medis_ruangan && catatan) {
        await trx("trx_rekam_medis_ruangan")
          .where("id", id_rekam_medis_ruangan)
          .update({
            catatan_hasil_treatment: catatan,
            updated_by: username,
            updated_at: new Date(),
          });
      }

      let resolvedKodeRM = kode_rekam_medis || (id_rekam_medis ? String(id_rekam_medis) : null);

      // ─── 3. AMBIL LAYANAN DARI PENDAFTARAN (trx_detail_antrian_layanan) ──────
      // Ambil hanya dari antrian asal (kode_antrian_asal IS NULL) dan deduplicate per kode_layanan
      let layananPendaftaran = await trx("trx_detail_antrian_layanan as dal")
        .join("trx_antrian_layanan as al", "dal.kode_antrian_layanan", "al.kode_antrian_layanan")
        .where("al.kode_kunjungan", kode_kunjungan)
        .whereNull("al.kode_antrian_asal")
        .groupBy("dal.kode_layanan")
        .select(
          "dal.kode_layanan",
          trx.raw("MAX(dal.nama_layanan) as nama_layanan"),
          trx.raw("MIN(dal.harga) as harga"),  // MIN agar klaim_paket (Rp 0) diutamakan
          trx.raw("MAX(dal.jenis_layanan) as jenis_layanan")
        );

      // Fallback jika tidak ada antrian asal (misal semua sudah punya asal)
      if (layananPendaftaran.length === 0) {
        layananPendaftaran = await trx("trx_detail_antrian_layanan as dal")
          .where("dal.kode_kunjungan", kode_kunjungan)
          .groupBy("dal.kode_layanan")
          .select(
            "dal.kode_layanan",
            trx.raw("MAX(dal.nama_layanan) as nama_layanan"),
            trx.raw("MIN(dal.harga) as harga"),  // MIN agar klaim_paket (Rp 0) diutamakan
            trx.raw("MAX(dal.jenis_layanan) as jenis_layanan")
          );
      }

      // ─── 4. GABUNGKAN LAYANAN PENDAFTARAN + PRODUK DOKTER ────────────────────
      const hasItems = layananPendaftaran.length > 0 || produkItems.length > 0;

      if (hasItems) {
        let existingTrx = await trx("trx_transaksi")
          .where("kode_kunjungan", kode_kunjungan)
          .where("status", "draft")
          .first();

        if (existingTrx) {
          createdTransaksiKode = existingTrx.kode_transaksi;
          if (resolvedKodeRM) {
            await trx("trx_transaksi")
              .where("kode_transaksi", createdTransaksiKode)
              .update({
                kode_rekam_medis: resolvedKodeRM,
                updated_by: username,
                updated_at: formatDateSystem(),
              });
          }
        } else {
          const prefixTrx = `TRX-${todayStr}-`;
          const lastTrx = await trx("trx_transaksi")
            .where("kode_transaksi", "like", `${prefixTrx}%`)
            .orderBy("id", "desc")
            .first();

          let nextTrxSeq = 1;
          if (lastTrx && lastTrx.kode_transaksi) {
            const parts = lastTrx.kode_transaksi.split("-");
            const num = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(num)) nextTrxSeq = num + 1;
          }
          createdTransaksiKode = `${prefixTrx}${String(nextTrxSeq).padStart(3, "0")}`;

          const kunjunganData = await trx("trx_kunjungan")
            .where("kode_kunjungan", kode_kunjungan)
            .select("no_rm")
            .first();
          const resolvedNoRm = no_rm || (kunjunganData ? kunjunganData.no_rm : null);

          const newTrx = {
            kode_transaksi: createdTransaksiKode,
            kode_kunjungan: kode_kunjungan,
            no_rm: resolvedNoRm,
            kode_rekam_medis: resolvedKodeRM || null,
            tanggal_transaksi: todayYmd,
            total_harga: 0,
            total_diskon: 0,
            total_bayar: 0,
            metode_bayar: "tunai",
            status: "draft",
            tz: tz,
            created_by: username,
            created_at: formatDateSystem(),
            updated_by: username,
            updated_at: formatDateSystem(),
          };

          await trx("trx_transaksi").insert(newTrx);
        }

        // Hapus detail lama untuk sync ulang
        await trx("trx_detail_transaksi")
          .where("kode_transaksi", createdTransaksiKode)
          .delete();

        const prefixDetail = `DT-${todayStr}-`;
        const lastDetail = await trx("trx_detail_transaksi")
          .where("kode_detail_transaksi", "like", `${prefixDetail}%`)
          .orderBy("id", "desc")
          .first();

        let nextDetailSeq = 1;
        if (lastDetail && lastDetail.kode_detail_transaksi) {
          const parts = lastDetail.kode_detail_transaksi.split("-");
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num)) nextDetailSeq = num + 1;
        }

        // Insert layanan pendaftaran
        for (const layanan of layananPendaftaran) {
          const cKodeDetail = `${prefixDetail}${String(nextDetailSeq).padStart(3, "0")}`;
          nextDetailSeq++;
          const hargaSatuan = parseFloat(layanan.harga || 0);

          await trx("trx_detail_transaksi").insert({
            kode_detail_transaksi: cKodeDetail,
            kode_transaksi: createdTransaksiKode,
            kode_layanan: layanan.kode_layanan,
            kode_produk: null,
            qty: 1,
            harga_satuan: hargaSatuan,
            subtotal: hargaSatuan,
            is_from_pendaftaran: 1,
            tz: tz,
            created_by: username,
            created_at: formatDateSystem(),
            updated_by: username,
            updated_at: formatDateSystem(),
          });
        }

        // Insert produk dokter
        const kodeProdukList = produkItems.map((i) => i.kode_produk).filter(Boolean);
        let produkPriceMap = {};
        if (kodeProdukList.length > 0) {
          const mstProdukList = await trx("mst_produk")
            .whereIn("kode_produk", kodeProdukList)
            .select("kode_produk", "nama", "harga_jual");
          mstProdukList.forEach((p) => {
            produkPriceMap[p.kode_produk] = parseFloat(p.harga_jual || 0);
          });
        }

        for (const item of produkItems) {
          const isCustom = item.kode_produk && (String(item.kode_produk).startsWith("CUSTOM-") || String(item.kode_produk).startsWith("CST-"));
          if (isCustom && item.nama) {
            const existP = await trx("mst_produk").where("kode_produk", item.kode_produk).first();
            if (!existP) {
              const kat = await trx("mst_kategori_produk").where("status", "aktif").first();
              const defaultKatKode = kat?.kode_kategori_produk || "KATPRD-001";

              await trx("mst_produk").insert({
                kode_produk: item.kode_produk,
                kode_kategori_produk: defaultKatKode,
                nama: item.nama,
                satuan: item.satuan || "item",
                harga_beli: 0,
                harga_jual: parseFloat(item.harga_jual || item.harga_satuan || 0),
                stok_minimum: 0,
                stok_tersedia: 999,
                status: "nonaktif", // Diset nonaktif agar hanya berlaku per transaksi dan tidak mencemari master data produk
                tz: tz || "Asia/Jakarta",
                created_by: username,
                created_at: formatDateSystem(),
                updated_by: username,
                updated_at: formatDateSystem(),
              });
            }
            produkPriceMap[item.kode_produk] = parseFloat(item.harga_jual || item.harga_satuan || 0);
          }

          const cKodeDetail = `${prefixDetail}${String(nextDetailSeq).padStart(3, "0")}`;
          nextDetailSeq++;
          const qty = Math.max(1, parseInt(item.qty || 1, 10));
          const hargaSatuan = produkPriceMap[item.kode_produk] !== undefined
            ? produkPriceMap[item.kode_produk]
            : parseFloat(item.harga_jual || item.harga_satuan || 0);
          const subtotal = qty * hargaSatuan;

          await trx("trx_detail_transaksi").insert({
            kode_detail_transaksi: cKodeDetail,
            kode_transaksi: createdTransaksiKode,
            kode_layanan: null,
            kode_produk: item.kode_produk,
            qty: qty,
            harga_satuan: hargaSatuan,
            subtotal: subtotal,
            is_from_pendaftaran: 0,
            tz: tz,
            created_by: username,
            created_at: formatDateSystem(),
            updated_by: username,
            updated_at: formatDateSystem(),
          });
        }

        // Recalculate total
        const allDetails = await trx("trx_detail_transaksi")
          .where("kode_transaksi", createdTransaksiKode)
          .sum("subtotal as total");

        grandTotal = parseFloat(allDetails[0]?.total || 0);

        await trx("trx_transaksi")
          .where("kode_transaksi", createdTransaksiKode)
          .update({
            total_harga: grandTotal,
            total_bayar: grandTotal,
            updated_by: username,
            updated_at: formatDateSystem(),
          });
      }

      // ─── UPDATE STATUS ANTRIAN MENJADI SELESAI ────────────────────────────────
      if (resolvedKodeAntrian) {
        await trx("trx_antrian_layanan")
          .where("kode_antrian_layanan", resolvedKodeAntrian)
          .update({
            status: "selesai",
            selesai_at: formatDateSystem(),
            updated_by: username,
            updated_at: formatDateSystem(),
          });
      }

      // ─── CEK APAKAH SEMUA ANTRIAN DI KUNJUNGAN INI SUDAH SELESAI ─────────────
      const allAntrianKunjungan = await trx("trx_antrian_layanan")
        .where("kode_kunjungan", kode_kunjungan)
        .select("status");

      const allSelesai = allAntrianKunjungan.every(
        (a) => a.status === "selesai" || a.status === "batal"
      );

      if (allSelesai && allAntrianKunjungan.length > 0) {
        // Tandai kunjungan sebagai selesai jika tabel trx_kunjungan ada kolom status
        try {
          await trx("trx_kunjungan")
            .where("kode_kunjungan", kode_kunjungan)
            .update({
              status: "selesai",
              updated_by: username,
              updated_at: formatDateSystem(),
            });
        } catch (_) {
          // Jika kolom/tabel tidak ada, abaikan
        }
      }

    });

    return res.status(200).json({
      status: status.SUKSES,
      message: "Hasil treatment berhasil disimpan",
      datetime: formatDateSystem(),
      data: {
        kode_kunjungan,
        kode_transaksi: createdTransaksiKode,
        total_bayar: grandTotal,
      },
    });
  } catch (error) {
    Logging(error, {
      file: "/master/hasil_treatment_save.js",
      func: "handleHasilTreatmentSave",
      request: oPayload,
      user: username,
    });
    return res.status(500).json({
      status: status.BAD_REQUEST,
      message: error.message || "Gagal menyimpan hasil treatment",
      datetime: formatDateSystem(),
    });
  }
};

router.post("/", handleHasilTreatmentSave);

export default router;

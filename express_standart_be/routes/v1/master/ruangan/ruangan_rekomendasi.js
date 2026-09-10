/**
 * @copyright (c) 2026 PT Marstech Global (info@marstech.co.id)
 * @project Sistem Klinik
 * @file ruangan_rekomendasi.js
 * @description Endpoint opsi rekomendasi & pemrosesan rekomendasi treatment (layanan & paket) + produk (produk & paket produk) dari ruang konsultasi
 *
 * @author Antigravity
 * @created 2026-08-27
 */

import express from "express";
import DB from "../../../../core/config/knex.js";
import { formatDateSystem } from "../../components/tools/date_tools.js";
import { Logging, ChangesLog } from "../../components/tools/servertool.js";
import { status } from "../../components/tools/general.js";
import { syncRekamMedisPerAntrian } from "./rekam_medis_service.js";

const router = express.Router();

/**
 * ─── 1. FETCH OPSIONAL REKOMENDASI (LAYANAN, PAKET LAYANAN, PRODUK, PAKET PRODUK) ───
 */
const handleGetRekomendasiOptions = async (req, res) => {
  const oPayload = { ...req.query, ...req.body };
  const username = req?.auth?.username || "system";

  try {
    // A. Fetch Layanan Biasa (status aktif)
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
        "l.kode_ruangan",
        "r.nama_ruangan as nama_ruangan"
      )
      .orderBy("l.nama", "asc");

    // B. Fetch Paket Layanan (status aktif)
    const vaPaketLayanan = await DB("mst_paket_layanan as p")
      .leftJoin("mst_ruangan as r", "p.kode_ruangan", "r.kode_ruangan")
      .where("p.status", "aktif")
      .select(
        "p.kode_paket_layanan",
        "p.nama",
        "p.harga_paket as harga",
        "p.masa_berlaku_hari",
        "p.kode_ruangan",
        "r.nama_ruangan as nama_ruangan"
      )
      .orderBy("p.nama", "asc");

    // C. Fetch Produk (status aktif)
    const vaProduk = await DB("mst_produk as pr")
      .leftJoin("mst_kategori_produk as kp", "pr.kode_kategori_produk", "kp.kode_kategori_produk")
      .where("pr.status", "aktif")
      .whereRaw("pr.kode_produk NOT LIKE 'CUSTOM-%' AND pr.kode_produk NOT LIKE 'CST-%'")
      .select(
        "pr.kode_produk",
        "pr.kode_kategori_produk",
        "kp.nama as nama_kategori",
        "pr.nama",
        "pr.satuan",
        "pr.harga_jual as harga",
        "pr.stok_minimum"
      )
      .orderBy("pr.nama", "asc");

    // D. Fetch Paket Produk (status aktif)
    const vaPaketProduk = await DB("mst_paket_produk as pp")
      .where("pp.status", "aktif")
      .select(
        "pp.kode_paket_produk",
        "pp.nama",
        "pp.harga_paket as harga",
        "pp.masa_berlaku_hari"
      )
      .orderBy("pp.nama", "asc");

    // Fetch active promos for today
    const todayYmd = new Date().toISOString().slice(0, 10);
    const activePromos = await DB("mst_promo as p")
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
      const normJenis = item.jenis.includes("layanan")
        ? item.jenis.includes("paket") ? "paket" : "layanan"
        : item.jenis.includes("produk") ? item.jenis.includes("paket") ? "paket" : "produk" : item.jenis;

      const key = `${normJenis}_${item.kode}`;
      const keyFull = `${item.jenis}_${item.kode}`;
      const promo = promoMap[key] || promoMap[keyFull];

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

    // Format output items with promo info applied
    const listLayanan = vaLayanan.map((item) =>
      applyPromo({
        jenis: "layanan",
        tipe: "layanan_biasa",
        kode: item.kode_layanan,
        kode_layanan: item.kode_layanan,
        nama: item.nama,
        harga: parseFloat(item.harga || 0),
        kode_kategori: item.kode_kategori_layanan,
        nama_kategori: item.nama_kategori || "Layanan",
        durasi_menit: parseInt(item.durasi_menit || 30, 10),
        kode_ruangan: item.kode_ruangan || "",
        nama_ruangan: item.nama_ruangan || item.kode_ruangan || "Ruang Treatment",
      })
    );

    const listPaketLayanan = vaPaketLayanan.map((item) =>
      applyPromo({
        jenis: "paket_layanan",
        tipe: "paket_layanan",
        kode: item.kode_paket_layanan,
        kode_layanan: item.kode_paket_layanan,
        nama: item.nama,
        harga: parseFloat(item.harga || 0),
        kode_kategori: "PAKET_LAYANAN",
        nama_kategori: "Paket Layanan",
        masa_berlaku_hari: item.masa_berlaku_hari,
        kode_ruangan: item.kode_ruangan || "",
        nama_ruangan: item.nama_ruangan || item.kode_ruangan || "Ruang Treatment",
      })
    );

    const listProduk = vaProduk.map((item) =>
      applyPromo({
        jenis: "produk",
        tipe: "produk_biasa",
        kode: item.kode_produk,
        kode_produk: item.kode_produk,
        nama: item.nama,
        satuan: item.satuan || "pcs",
        harga: parseFloat(item.harga || 0),
        kode_kategori: item.kode_kategori_produk,
        nama_kategori: item.nama_kategori || "Produk",
      })
    );

    const listPaketProduk = vaPaketProduk.map((item) =>
      applyPromo({
        jenis: "paket_produk",
        tipe: "paket_produk",
        kode: item.kode_paket_produk,
        kode_produk: item.kode_paket_produk,
        nama: item.nama,
        satuan: "paket",
        harga: parseFloat(item.harga || 0),
        kode_kategori: "PAKET_PRODUK",
        nama_kategori: "Paket Produk",
        masa_berlaku_hari: item.masa_berlaku_hari,
      })
    );

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data opsi rekomendasi berhasil dimuat",
      datetime: formatDateSystem(),
      data: {
        layanan: listLayanan,
        paket_layanan: listPaketLayanan,
        produk: listProduk,
        paket_produk: listPaketProduk,
      },
    });
  } catch (error) {
    Logging(error, {
      file: "/master/ruangan/ruangan_rekomendasi.js",
      func: "ruangan-rekomendasi-options",
      request: oPayload,
      response: {},
      user: username,
    });
    return res.status(500).json({
      status: status.BAD_REQUEST,
      message: "Gagal mengambil data opsi rekomendasi",
      datetime: formatDateSystem(),
    });
  }
};

router.get("/ruangan-rekomendasi-options", handleGetRekomendasiOptions);
router.post("/ruangan-rekomendasi-options", handleGetRekomendasiOptions);

/**
 * ─── 2. SIMPAN FORM PENANGANAN & PROSES REKOMENDASI TREATMENT / PRODUK ───
 */
router.post("/antrian-layanan-simpan-rekomendasi", async (req, res) => {
  const oPayload = req.body || {};
  const {
    kode_antrian_layanan,
    hasil_form,
    catatan_petugas,
    status_tindakan,
    rekomendasi_items = [],
  } = oPayload;
  const username = req?.auth?.username || "system";

  try {
    if (!kode_antrian_layanan) {
      return res.status(422).json({
        status: status.BAD_REQUEST,
        message: "kode_antrian_layanan wajib diisi",
        datetime: formatDateSystem(),
      });
    }

    const currentAntrian = await DB("trx_antrian_layanan")
      .where("kode_antrian_layanan", kode_antrian_layanan)
      .first();

    if (!currentAntrian) {
      return res.status(404).json({
        status: status.BAD_REQUEST,
        message: "Data antrian layanan tidak ditemukan",
        datetime: formatDateSystem(),
      });
    }

    const kodeKunjungan = currentAntrian.kode_kunjungan;
    let kunjungan = null;
    if (kodeKunjungan) {
      kunjungan = await DB("trx_kunjungan").where("kode_kunjungan", kodeKunjungan).first();
    }

    const createdAntrianLayanan = [];
    let createdTransaksi = null;

    // Direct DB Transaction for consistency
    await DB.transaction(async (trx) => {
      const now = new Date();
      const todayYmd = now.toISOString().slice(0, 10);
      const todayStr = todayYmd.replace(/-/g, "");

      // ─── A. Update status antrian saat ini ───
      const updateObj = {
        updated_by: username,
        updated_at: formatDateSystem(),
      };
      if (oPayload.kode_karyawan || oPayload.no_sip) {
        const rawCode = oPayload.kode_karyawan || oPayload.no_sip;
        updateObj.kode_karyawan = String(rawCode).split("#")[0].trim();
      }
      if (hasil_form) {
        updateObj.hasil_form = typeof hasil_form === "object" ? JSON.stringify(hasil_form) : hasil_form;
      }
      if (catatan_petugas) {
        updateObj.catatan_petugas = catatan_petugas;
      }
      if (status_tindakan && ["menunggu", "dipanggil", "selesai", "batal"].includes(status_tindakan)) {
        updateObj.status = status_tindakan;
        if (status_tindakan === "selesai") {
          updateObj.selesai_at = formatDateSystem();
        }
      }
      const isLanjut = oPayload.lanjut_ke_tindakan !== undefined ? (oPayload.lanjut_ke_tindakan ? 1 : 0) : 1;
      updateObj.lanjut_ke_tindakan = isLanjut;

      await trx("trx_antrian_layanan")
        .where("kode_antrian_layanan", kode_antrian_layanan)
        .update(updateObj);

      if (oPayload.diubah_dari_booking) {
        await ChangesLog({
          description: `Perubahan Petugas Tindakan Booking: ${oPayload.petugas_asal_booking || ''} (${oPayload.no_sip_asal_booking || ''}) diubah ke ${oPayload.petugas_pengganti || oPayload.kode_karyawan} (${oPayload.kode_karyawan}) pada antrean ${kode_antrian_layanan}`,
          tableName: "trx_antrian_layanan",
          referenceCode: kode_antrian_layanan,
          action: "UPDATE",
          dataBefore: { kode_karyawan: oPayload.no_sip_asal_booking, nama: oPayload.petugas_asal_booking },
          dataAfter: { kode_karyawan: oPayload.kode_karyawan, nama: oPayload.petugas_pengganti, catatan: oPayload.catatan_perubahan_petugas },
          user: username,
          tz: oPayload.tz || "Asia/Jakarta"
        }, trx);
      }

      // ─── B. Memisahkan rekomendasi Layanan vs Produk ───
      const items = Array.isArray(rekomendasi_items) ? rekomendasi_items : [];
      const layananItems = [];
      const produkItems = [];

      items.forEach((item) => {
        const j = (item.jenis || "").toLowerCase();
        if (["layanan", "paket_layanan", "paket"].includes(j)) {
          layananItems.push(item);
        } else if (["produk", "paket_produk"].includes(j)) {
          produkItems.push(item);
        }
      });

      // Jika lanjut_ke_tindakan == 1 dan tidak ada rekomendasi layanan baru yang dipilih,
      // cari layanan pendaftaran asli yang punya kode_ruangan tindakan
      if (isLanjut === 1 && layananItems.length === 0 && kodeKunjungan) {
        const detailAsal = await trx("trx_detail_antrian_layanan as dal")
          .leftJoin("mst_layanan as l", "dal.kode_layanan", "l.kode_layanan")
          .leftJoin("mst_ruangan as r", "l.kode_ruangan", "r.kode_ruangan")
          .where("dal.kode_kunjungan", kodeKunjungan)
          .where(function() {
            this.whereNull("r.is_konsultasi").orWhere("r.is_konsultasi", 0);
          })
          .select("dal.*", "l.kode_ruangan", "r.nama_ruangan")
          .first();

        if (detailAsal && detailAsal.kode_ruangan) {
          layananItems.push({
            jenis: detailAsal.jenis_layanan || "layanan",
            kode: detailAsal.kode_layanan,
            nama: detailAsal.nama_layanan,
            harga: detailAsal.harga,
            kode_ruangan: detailAsal.kode_ruangan,
            nama_ruangan: detailAsal.nama_ruangan || "Ruang Treatment",
          });
        }
      }

      // ─── C. PROSES REKOMENDASI LAYANAN → TERBITKAN NOMOR ANTREAN KHUSUS PER RUANGAN ───
      if (isLanjut === 1 && layananItems.length > 0 && kodeKunjungan) {
        const prefixAntrianLayanan = `AL-${todayStr}-`;
        const groupsByRuangan = {};

        for (const item of layananItems) {
          const targetKodeRuang = item.kode_ruangan || "UNASSIGNED";
          const targetNamaRuang = item.nama_ruangan || item.kode_ruangan || "Ruang Treatment";

          if (!groupsByRuangan[targetKodeRuang]) {
            groupsByRuangan[targetKodeRuang] = {
              kode_ruangan: item.kode_ruangan || "",
              nama_ruangan: targetNamaRuang,
              items: [],
            };
          }
          groupsByRuangan[targetKodeRuang].items.push(item);
        }

        // Validasi: Layanan & Paket Layanan wajib dalam 1 ruangan yang sama per transaksi antrean
        const roomKeys = Object.keys(groupsByRuangan);
        if (roomKeys.length > 1) {
          const err = new Error("Layanan dan paket layanan yang direkomendasikan harus berasal dari 1 ruangan yang sama.");
          err.statusCode = 422;
          throw err;
        }

        for (const key of Object.keys(groupsByRuangan)) {
          const group = groupsByRuangan[key];
          const groupItems = group.items;

          // Sequential kode_antrian_layanan global
          const lastAntrianLayanan = await trx("trx_antrian_layanan")
            .where("kode_antrian_layanan", "like", `${prefixAntrianLayanan}%`)
            .orderBy("id", "desc")
            .first();

          let nextSeq = 1;
          if (lastAntrianLayanan && lastAntrianLayanan.kode_antrian_layanan) {
            const parts = lastAntrianLayanan.kode_antrian_layanan.split("-");
            const num = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(num)) nextSeq = num + 1;
          }
          const cKodeAntrianLayanan = `${prefixAntrianLayanan}${String(nextSeq).padStart(3, "0")}`;

          // Nomor antrian KHUSUS PER RUANGAN HARI INI
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
            if (!isNaN(num)) nextNo = num + 1;
          }
          const cNomorAntrianSesi = String(nextNo).padStart(2, "0");

          const combinedNamaLayanan = groupItems.map((d) => d.nama).join(", ");
          const combinedKodeLayanan = groupItems.map((d) => d.kode || d.kode_layanan).join(", ");

          const oInsertLayanan = {
            kode_antrian_layanan: cKodeAntrianLayanan,
            kode_kunjungan: kodeKunjungan,
            kode_antrian_asal: currentAntrian.kode_antrian_layanan,
            nomor_antrian: cNomorAntrianSesi,
            kode_ruangan: group.kode_ruangan,
            nama_ruangan: group.nama_ruangan,
            status: "menunggu",
            tz: currentAntrian.tz || "Asia/Jakarta",
            created_by: username,
            created_at: formatDateSystem(),
            updated_by: username,
            updated_at: formatDateSystem(),
          };

          await trx("trx_antrian_layanan").insert(oInsertLayanan);

          // Insert detail rows into trx_detail_antrian_layanan
          let dSeq = 1;
          const vaInsertDetail = [];
          for (const item of groupItems) {
            const cKodeDetailAntrian = `DAL-${todayStr}-${String(nextSeq).padStart(3, "0")}-${String(dSeq).padStart(2, "0")}`;
            dSeq++;
            vaInsertDetail.push({
              kode_detail_antrian_layanan: cKodeDetailAntrian,
              kode_antrian_layanan: cKodeAntrianLayanan,
              kode_kunjungan: kodeKunjungan,
              jenis_layanan: item.jenis === "paket_layanan" ? "paket" : "layanan",
              kode_layanan: item.kode || item.kode_layanan,
              nama_layanan: item.nama || item.nama_layanan,
              harga: item.harga || 0,
              kode_ruangan: group.kode_ruangan,
              nama_ruangan: group.nama_ruangan,
              tz: currentAntrian.tz || "Asia/Jakarta",
              created_by: username,
              created_at: formatDateSystem(),
              updated_by: username,
              updated_at: formatDateSystem(),
            });
          }
          if (vaInsertDetail.length > 0) {
            await trx("trx_detail_antrian_layanan").insert(vaInsertDetail);
          }

          createdAntrianLayanan.push({
            ...oInsertLayanan,
            details: vaInsertDetail,
          });
        }
      }

      // ─── D. PROSES REKOMENDASI PRODUK → MASUK KE DRAF TRANSAKSI PENJUALAN ───
      if (produkItems.length > 0 && kodeKunjungan && kunjungan) {
        const prefixTrx = `TRX-${todayStr}-`;

        // Cek apakah transaksi draft sudah ada untuk kunjungan ini
        let existingTrx = await trx("trx_transaksi")
          .where("kode_kunjungan", kodeKunjungan)
          .where("status", "draft")
          .first();

        let kodeTransaksi = "";
        if (existingTrx) {
          kodeTransaksi = existingTrx.kode_transaksi;
        } else {
          // Generate kode_transaksi baru
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
          kodeTransaksi = `${prefixTrx}${String(nextTrxSeq).padStart(3, "0")}`;

          const newTrx = {
            kode_transaksi: kodeTransaksi,
            kode_kunjungan: kodeKunjungan,
            no_rm: kunjungan.no_rm,
            tanggal_transaksi: todayYmd,
            total_harga: 0,
            total_diskon: 0,
            total_bayar: 0,
            metode_bayar: "tunai",
            status: "draft",
            tz: kunjungan.tz || "Asia/Jakarta",
            created_by: username,
            created_at: formatDateSystem(),
            updated_by: username,
            updated_at: formatDateSystem(),
          };

          await trx("trx_transaksi").insert(newTrx);
          existingTrx = newTrx;
        }

        // Generate detail transaksi
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

        let tambahanTotal = 0;
        for (const prd of produkItems) {
          const cKodeDetail = `${prefixDetail}${String(nextDetailSeq).padStart(3, "0")}`;
          nextDetailSeq++;

          const qty = Math.max(1, parseInt(prd.qty || 1, 10));
          const hargaSatuan = parseFloat(prd.harga || 0);
          const subtotal = qty * hargaSatuan;
          tambahanTotal += subtotal;

          const oDetail = {
            kode_detail_transaksi: cKodeDetail,
            kode_transaksi: kodeTransaksi,
            kode_layanan: null,
            kode_produk: prd.kode || prd.kode_produk,
            qty: qty,
            harga_satuan: hargaSatuan,
            subtotal: subtotal,
            tz: kunjungan.tz || "Asia/Jakarta",
            created_by: username,
            created_at: formatDateSystem(),
            updated_by: username,
            updated_at: formatDateSystem(),
          };

          await trx("trx_detail_transaksi").insert(oDetail);
        }

        // Recalculate total_harga & total_bayar for trx_transaksi
        const allDetails = await trx("trx_detail_transaksi")
          .where("kode_transaksi", kodeTransaksi)
          .sum("subtotal as total");

        const grandTotal = parseFloat(allDetails[0]?.total || 0);

        await trx("trx_transaksi")
          .where("kode_transaksi", kodeTransaksi)
          .update({
            total_harga: grandTotal,
            total_bayar: grandTotal,
            updated_by: username,
            updated_at: formatDateSystem(),
          });

        createdTransaksi = {
          kode_transaksi: kodeTransaksi,
          total_bayar: grandTotal,
          jumlah_produk: produkItems.length,
        };
      }

      // ─── E. SIMPAN & SYNC REKAM MEDIS ───
      if (kodeKunjungan) {
        let textRekomendasi = "";
        if (layananItems.length > 0) {
          textRekomendasi += `Rekomendasi Treatment: ${layananItems.map((l) => `${l.nama} (${l.nama_ruangan || "Ruangan"})`).join(", ")}\n`;
        }
        if (produkItems.length > 0) {
          textRekomendasi += `Rekomendasi Produk (Draf Transaksi): ${produkItems.map((p) => `${p.nama} (${p.qty || 1}x)`).join(", ")}`;
        }

        const combinedCatatan = [
          catatan_petugas ? catatan_petugas : null,
          textRekomendasi ? textRekomendasi.trim() : null,
        ]
          .filter(Boolean)
          .join("\n\n---\n");

        await syncRekamMedisPerAntrian({
          kode_kunjungan: kodeKunjungan,
          kode_antrian_layanan: kode_antrian_layanan,
          kode_ruangan: currentAntrian.kode_ruangan,
          nama_ruangan: currentAntrian.nama_ruangan,
          hasil_form: hasil_form,
          header_data: oPayload.header_data,
          catatan_petugas: combinedCatatan,
          kode_karyawan: updateObj.kode_karyawan || currentAntrian.kode_karyawan,
          username: username,
          trx: trx,
        });
      }
    });

    let msg = "Hasil penanganan & catatan ruangan berhasil disimpan";
    if (createdAntrianLayanan.length > 0 && createdTransaksi) {
      msg = `Berhasil disimpan! Menerbitkan ${createdAntrianLayanan.length} antrean layanan & 1 draf transaksi produk.`;
    } else if (createdAntrianLayanan.length > 0) {
      msg = `Berhasil disimpan & menerbitkan ${createdAntrianLayanan.length} antrean layanan baru!`;
    } else if (createdTransaksi) {
      msg = `Berhasil disimpan & rekomendasi produk masuk ke draf transaksi!`;
    }

    return res.status(200).json({
      status: status.SUKSES,
      message: msg,
      datetime: formatDateSystem(),
      data: {
        kode_kunjungan: kodeKunjungan,
        no_rm: kunjungan?.no_rm || '',
        antrian_layanan_baru: createdAntrianLayanan,
        transaksi_draft: createdTransaksi,
      },
    });
  } catch (error) {
    Logging(error, {
      file: "/master/ruangan/ruangan_rekomendasi.js",
      func: "antrian-layanan-simpan-rekomendasi",
      request: oPayload,
      response: {},
      user: username,
    });
    return res.status(500).json({
      status: status.BAD_REQUEST,
      message: error.message || "Gagal menyimpan rekomendasi & penanganan pasien",
      datetime: formatDateSystem(),
    });
  }
});

/**
 * ─── 3. FETCH PRE-SELECTED ITEMS DARI PENDAFTARAN (UNLOCKED / LOCKED) ───
 */
router.post("/antrian-layanan-pendaftaran-items", async (req, res) => {
  const { kode_kunjungan, kode_antrian_layanan } = req.body || {};
  const username = req?.auth?.username || "system";

  try {
    if (!kode_kunjungan && !kode_antrian_layanan) {
      return res.status(422).json({
        status: status.BAD_REQUEST,
        message: "kode_kunjungan atau kode_antrian_layanan wajib diisi",
        datetime: formatDateSystem(),
      });
    }

    let query = DB("trx_detail_antrian_layanan as dal")
      .leftJoin("mst_layanan as l", "dal.kode_layanan", "l.kode_layanan")
      .leftJoin("mst_paket_layanan as p", "dal.kode_layanan", "p.kode_paket_layanan")
      .leftJoin("mst_ruangan as r_lay", "l.kode_ruangan", "r_lay.kode_ruangan")
      .leftJoin("mst_ruangan as r_pkt", "p.kode_ruangan", "r_pkt.kode_ruangan");

    if (kode_kunjungan) {
      query = query.where("dal.kode_kunjungan", kode_kunjungan);
    } else {
      query = query.where("dal.kode_antrian_layanan", kode_antrian_layanan);
    }

    const rawItems = await query.select(
      "dal.*",
      "l.kode_ruangan as lay_ruangan",
      "r_lay.nama_ruangan as lay_nama_ruangan",
      "r_lay.is_konsultasi as lay_is_konsul",
      "p.kode_ruangan as pkt_ruangan",
      "r_pkt.nama_ruangan as pkt_nama_ruangan",
      "r_pkt.is_konsultasi as pkt_is_konsul"
    );

    const formatted = rawItems
      .filter((i) => !Boolean(i.lay_is_konsul) && !Boolean(i.pkt_is_konsul))
      .map((i) => {
        const jenisStr = (i.jenis_layanan || "").toLowerCase();
        const isPaket = jenisStr.includes("paket");
        const roomCode = isPaket ? (i.pkt_ruangan || i.kode_ruangan) : (i.lay_ruangan || i.kode_ruangan);
        const roomName = isPaket ? (i.pkt_nama_ruangan || i.nama_ruangan) : (i.lay_nama_ruangan || i.nama_ruangan);

        return {
          jenis: isPaket ? "paket_layanan" : (jenisStr || "layanan"),
          tipe: isPaket ? "paket_layanan" : "layanan_biasa",
          kode: i.kode_layanan,
          nama: i.nama_layanan,
          harga: parseFloat(i.harga || 0),
          kode_ruangan: roomCode || "RNG-001",
          nama_ruangan: roomName || "Ruang Treatment",
          is_locked: true,
          is_pendaftaran: true,
        };
      });

    // Deduplicate unique pendaftaran items by (jenis, kode)
    const uniqueItemsMap = new Map();
    formatted.forEach((item) => {
      const normJenis = (item.jenis || "").includes("paket") ? "paket_layanan" : item.jenis;
      const key = `${normJenis}_${item.kode}`;
      if (!uniqueItemsMap.has(key)) {
        uniqueItemsMap.set(key, item);
      }
    });
    const uniqueFormatted = Array.from(uniqueItemsMap.values());

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data item pendaftaran berhasil dimuat",
      datetime: formatDateSystem(),
      data: uniqueFormatted,
    });
  } catch (error) {
    Logging(error, {
      file: "/master/ruangan/ruangan_rekomendasi.js",
      func: "antrian-layanan-pendaftaran-items",
      request: req.body,
      response: {},
      user: username,
    });
    return res.status(500).json({
      status: status.BAD_REQUEST,
      message: "Gagal mengambil data item pendaftaran",
      datetime: formatDateSystem(),
    });
  }
});

export default router;

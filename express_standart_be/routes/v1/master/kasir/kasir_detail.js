/**
 * @project Sistem Klinik Kecantikan
 * @file kasir_detail.js
 * @description Endpoint detail transaksi kasir dengan auto-select idempotent layanan/paket antrian pendaftaran
 */
import express from "express";
import DB from "../../../../core/config/knex.js";
import { formatDateSystem } from "../../components/tools/date_tools.js";
import { Logging } from "../../components/tools/servertool.js";
import { status } from "../../components/tools/general.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { body } = req;
  const username = req?.auth?.username || "";
  const kode_transaksi = body.kode_transaksi || "";

  if (!kode_transaksi) {
    return res.status(400).json({ status: status.BAD_REQUEST, message: "kode_transaksi wajib diisi", datetime: formatDateSystem() });
  }

  try {
    const trx = await DB("trx_transaksi as t")
      .leftJoin("mst_pasien as p", "t.no_rm", "p.no_rm")
      .leftJoin("trx_kunjungan as k", "t.kode_kunjungan", "k.kode_kunjungan")
      .leftJoin("trx_booking as b", "k.kode_booking", "b.kode_booking")
      .leftJoin("mst_promo as pr", "t.kode_promo", "pr.kode_promo")
      .where("t.kode_transaksi", kode_transaksi)
      .select(
        "t.*",
        "p.nama as nama_pasien",
        "p.no_hp",
        "k.kode_booking",
        "b.dp_nominal as booking_dp_nominal",
        "b.dp_status as booking_dp_status",
        "b.metode_pembayaran_dp as booking_metode_dp",
        "pr.nama as nama_promo",
        "pr.jenis_diskon",
        "pr.nilai_diskon as nilai_diskon_promo"
      )
      .first();

    if (!trx) {
      return res.status(404).json({ status: status.BAD_REQUEST, message: "Transaksi tidak ditemukan", datetime: formatDateSystem() });
    }

    // Resolusi DP & sisa bayar
    const resolvedDpNominal = parseFloat(trx.dp_nominal || 0) > 0
      ? parseFloat(trx.dp_nominal)
      : (["sudah_bayar", "dipotong_treatment"].includes(trx.booking_dp_status) ? parseFloat(trx.booking_dp_nominal || 0) : 0);
    const resolvedMetodeDp = trx.metode_pembayaran_dp || (resolvedDpNominal > 0 ? trx.booking_metode_dp : null);
    const resolvedSisaBayar = Math.max(0, parseFloat(trx.total_bayar || 0) - resolvedDpNominal);

    trx.dp_nominal = resolvedDpNominal;
    trx.metode_pembayaran_dp = resolvedMetodeDp;
    trx.sisa_bayar = resolvedSisaBayar;

    // ─── AUTO-SELECT IDEMPOTENT LAYANAN/PAKET DARI ANTRIAN (JIKA DRAFT & KODE_KUNJUNGAN ADA) ───
    if (trx.kode_kunjungan && trx.status === "draft") {
      const antrianItems = await DB("trx_detail_antrian_layanan as dal")
        .join("trx_antrian_layanan as al", "dal.kode_antrian_layanan", "al.kode_antrian_layanan")
        .where("al.kode_kunjungan", trx.kode_kunjungan)
        .where("al.status", "selesai")
        .select(
          "dal.id",
          "dal.kode_detail_antrian_layanan",
          "dal.kode_antrian_layanan",
          "dal.kode_layanan",
          "dal.nama_layanan",
          "dal.harga",
          "dal.jenis_layanan",
          "dal.kode_promo",
          "dal.nama_promo",
          "dal.jenis_diskon",
          "dal.nilai_diskon"
        )
        .orderBy("dal.id", "asc");

      if (antrianItems.length > 0) {
        const existingDetails = await DB("trx_detail_transaksi")
          .where("kode_transaksi", kode_transaksi)
          .select("kode_layanan");

        const existingCounts = {};
        existingDetails.forEach((d) => {
          if (d.kode_layanan) {
            existingCounts[d.kode_layanan] = (existingCounts[d.kode_layanan] || 0) + 1;
          }
        });

        const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const prefixDetail = `DT-${today}-`;
        const lastDetail = await DB("trx_detail_transaksi")
          .where("kode_detail_transaksi", "like", `${prefixDetail}%`)
          .orderBy("id", "desc")
          .first();

        let dtSeq = 1;
        if (lastDetail && lastDetail.kode_detail_transaksi) {
          const parts = lastDetail.kode_detail_transaksi.split("-");
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num)) dtSeq = num + 1;
        }

        let insertedAny = false;
        for (const item of antrianItems) {
          if (item.kode_layanan) {
            const currentCount = existingCounts[item.kode_layanan] || 0;
            if (currentCount > 0) {
              existingCounts[item.kode_layanan]--;
            } else {
              const cKodeDetail = `${prefixDetail}${String(dtSeq).padStart(3, "0")}`;
              dtSeq++;

              const isKlaim = (item.jenis_layanan || "").toLowerCase() === "klaim_paket";
              const hargaSatuan = isKlaim ? 0 : parseFloat(item.harga || 0);

              await DB("trx_detail_transaksi").insert({
                kode_detail_transaksi: cKodeDetail,
                kode_transaksi: kode_transaksi,
                kode_layanan: item.kode_layanan,
                kode_produk: null,
                qty: 1,
                harga_satuan: hargaSatuan,
                subtotal: hargaSatuan,
                is_from_pendaftaran: 1,
                tz: trx.tz || "Asia/Jakarta",
                created_by: username || "system",
                created_at: formatDateSystem(),
                updated_by: username || "system",
                updated_at: formatDateSystem(),
              });

              insertedAny = true;
            }
          }
        }

        // Jika ada item baru yang disisipkan, hitung ulang total_harga & total_bayar
        if (insertedAny) {
          const sumResult = await DB("trx_detail_transaksi")
            .where("kode_transaksi", kode_transaksi)
            .sum("subtotal as total");

          const newTotalHarga = parseFloat(sumResult[0]?.total || 0);
          let newTotalDiskon = parseFloat(trx.total_diskon || 0);

          if (trx.kode_promo) {
            const rawCodes = String(trx.kode_promo).split(",").map((s) => s.trim()).filter(Boolean);
            const activePromos = await DB("mst_promo")
              .whereIn("kode_promo", rawCodes)
              .where("status", "aktif");

            const allDetails = await DB("trx_detail_transaksi")
              .where("kode_transaksi", kode_transaksi)
              .select("kode_layanan", "kode_produk", "qty", "harga_satuan");

            let calculatedDiskon = 0;
            for (const promoData of activePromos) {
              const nilDiskon = parseFloat(promoData.nilai_diskon || 0);
              const detailPromo = await DB("mst_detail_promo")
                .where("kode_promo", promoData.kode_promo)
                .where("status", "aktif")
                .select("kode_item");

              if (detailPromo.length === 0) {
                calculatedDiskon += promoData.jenis_diskon === "persen"
                  ? (newTotalHarga * nilDiskon) / 100
                  : nilDiskon;
              } else {
                const promoKodeSet = new Set(detailPromo.map((dp) => dp.kode_item));
                let baseDiskon = 0;
                for (const d of allDetails) {
                  const kode = d.kode_layanan || d.kode_produk;
                  if (kode && promoKodeSet.has(kode)) {
                    baseDiskon += parseFloat(d.harga_satuan || 0) * parseInt(d.qty || 1);
                  }
                }
                calculatedDiskon += promoData.jenis_diskon === "persen"
                  ? (baseDiskon * nilDiskon) / 100
                  : Math.min(nilDiskon, baseDiskon);
              }
            }
            newTotalDiskon = Math.min(calculatedDiskon, newTotalHarga);
          }

          const newTotalBayar = Math.max(0, newTotalHarga - newTotalDiskon);
          const newSisaBayar = Math.max(0, newTotalBayar - resolvedDpNominal);

          await DB("trx_transaksi")
            .where("kode_transaksi", kode_transaksi)
            .update({
              total_harga: newTotalHarga,
              total_diskon: newTotalDiskon,
              total_bayar: newTotalBayar,
              dp_nominal: resolvedDpNominal,
              metode_pembayaran_dp: resolvedMetodeDp,
              sisa_bayar: newSisaBayar,
              updated_by: username,
              updated_at: DB.fn.now(),
            });

          // Update local trx object
          trx.total_harga = newTotalHarga;
          trx.total_diskon = newTotalDiskon;
          trx.total_bayar = newTotalBayar;
          trx.dp_nominal = resolvedDpNominal;
          trx.metode_pembayaran_dp = resolvedMetodeDp;
          trx.sisa_bayar = newSisaBayar;
        }
      }
    }

    // Ambil detail item dengan flag is_from_pendaftaran
    const details = await DB("trx_detail_transaksi as dt")
      .leftJoin("trx_transaksi as t", "t.kode_transaksi", "dt.kode_transaksi")
      .leftJoin("mst_layanan as l", "dt.kode_layanan", "l.kode_layanan")
      .leftJoin("mst_paket_layanan as pl", "dt.kode_layanan", "pl.kode_paket_layanan")
      .leftJoin("mst_produk as prod", "dt.kode_produk", "prod.kode_produk")
      .leftJoin(
        "trx_detail_antrian_layanan as dal",
        function () {
          this.on("dal.kode_kunjungan", "t.kode_kunjungan")
            .andOn("dal.kode_layanan", "dt.kode_layanan");
        }
      )
      .where("dt.kode_transaksi", kode_transaksi)
      .groupBy("dt.id")
      .select(
        "dt.kode_detail_transaksi",
        "dt.kode_layanan",
        "dt.kode_produk",
        "l.nama as nama_layanan_single",
        "pl.nama as nama_paket_layanan",
        "prod.nama as nama_produk",
        "prod.satuan",
        "dt.qty",
        "dt.harga_satuan",
        "dt.subtotal",
        DB.raw("COALESCE(dt.is_from_pendaftaran, 0) as is_from_pendaftaran"),
        DB.raw("MAX(dal.kode_promo) as kode_promo"),
        DB.raw("MAX(dal.nama_promo) as nama_promo"),
        DB.raw("MAX(dal.jenis_diskon) as jenis_diskon"),
        DB.raw("MAX(dal.nilai_diskon) as nilai_diskon")
      )
      .orderBy("dt.is_from_pendaftaran", "desc")
      .orderBy("dt.id", "asc");

    const detailsMapped = details.map((d) => ({
      ...d,
      jenis: d.kode_layanan ? "layanan" : "produk",
      kode: d.kode_layanan || d.kode_produk,
      nama: d.nama_layanan_single || d.nama_paket_layanan || d.nama_produk || "-",
      satuan: d.satuan || (d.kode_layanan ? "tindakan" : "pcs"),
      is_from_pendaftaran: Boolean(d.is_from_pendaftaran),
    }));

    return res.status(200).json({
      status: status.SUKSES,
      message: "Detail transaksi ditemukan",
      datetime: formatDateSystem(),
      data: { ...trx, details: detailsMapped },
    });
  } catch (error) {
    const oResult = {
      status: status.BAD_REQUEST,
      message: "Sistem sedang maintenance harap tunggu sebentar",
      datetime: formatDateSystem(),
    };
    Logging(error, { file: "/master/kasir/kasir_detail.js", func: "detail", user: username });
    return res.status(500).json(oResult);
  }
});

export default router;

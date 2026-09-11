/**
 * @copyright (c) 2026 PT Marstech Global (info@marstech.co.id)
 * @project Sistem Klinik
 * @file antrian_layanan_panggil.js
 * @description Endpoint untuk mengupdate status antrian layanan (dipanggil, selesai, batal, menunggu)
 *
 * @author Antigravity
 * @created 2026-08-21
 */

import express from "express";
import Joi from "joi";
import DB from "../../../../core/config/knex.js";
import { formatDateSystem } from "../../components/tools/date_tools.js";
import { Logging, ChangesLog } from "../../components/tools/servertool.js";
import { status } from "../../components/tools/general.js";
import { syncRekamMedisPerAntrian } from "../ruangan/rekam_medis_service.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const oPayload = { ...req.query, ...req.body };
  const username = req?.auth?.username || "";

  try {
    const cValidation = await Joi.object({
      kode_antrian_layanan: Joi.string().required().label("Kode Antrian Layanan"),
      aksi: Joi.string().valid("dipanggil", "selesai", "batal", "menunggu").required().label("Aksi"),
    }).validateAsync(
      {
        kode_antrian_layanan: oPayload.kode_antrian_layanan || oPayload.kode_antrian,
        aksi: oPayload.aksi || oPayload.status,
      },
      { allowUnknown: true }
    );

    const kodeAntrian = cValidation.kode_antrian_layanan;
    const aksi = cValidation.aksi;
    let updatedRecord = null;

    await DB.transaction(async (trx) => {
      const record = await trx("trx_antrian_layanan")
        .where("kode_antrian_layanan", kodeAntrian)
        .forUpdate()
        .first();

      if (!record) {
        const error = new Error("Data antrian layanan tidak ditemukan");
        error.statusCode = 404;
        throw error;
      }

      const updateData = {
        status: aksi,
        updated_by: username,
        updated_at: formatDateSystem(),
      };

      if (oPayload.kode_karyawan) {
        updateData.kode_karyawan = oPayload.kode_karyawan;
      }

      if (aksi === "dipanggil") {
        updateData.dipanggil_at = formatDateSystem();
      } else if (aksi === "selesai") {
        const resolvedKaryawan = oPayload.kode_karyawan || record.kode_karyawan;
        if (!resolvedKaryawan) {
          const error = new Error("Petugas / karyawan wajib dipilih sebelum antrian dapat diselesaikan");
          error.statusCode = 422;
          throw error;
        }
        updateData.selesai_at = formatDateSystem();
      }

      await trx("trx_antrian_layanan")
        .where("kode_antrian_layanan", kodeAntrian)
        .update(updateData);

      updatedRecord = { ...record, ...updateData };

      // ─── BUAT / SINKRONKAN DRAFT TRANSAKSI KASIR SAAT STATUS SELESAI ───────────
      if (aksi === "selesai" && record.kode_kunjungan) {
        const kodeKunjungan = record.kode_kunjungan;
        const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const todayYmd = new Date().toISOString().slice(0, 10);

        // 1. Cek apakah sudah ada transaksi lunas untuk kunjungan ini
        const lunasTrx = await trx("trx_transaksi")
          .where("kode_kunjungan", kodeKunjungan)
          .where("status", "lunas")
          .first();

        if (!lunasTrx) {
          // 2. Cari atau buat draf transaksi
          let draftTrx = await trx("trx_transaksi")
            .where("kode_kunjungan", kodeKunjungan)
            .where("status", "draft")
            .first();

          let createdTransaksiKode = "";

          if (draftTrx) {
            createdTransaksiKode = draftTrx.kode_transaksi;
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
              .where("kode_kunjungan", kodeKunjungan)
              .select("no_rm")
              .first();
            const resolvedNoRm = kunjunganData ? kunjunganData.no_rm : null;

            const newTrx = {
              kode_transaksi: createdTransaksiKode,
              kode_kunjungan: kodeKunjungan,
              no_rm: resolvedNoRm,
              kode_rekam_medis: null,
              tanggal_transaksi: todayYmd,
              total_harga: 0,
              total_diskon: 0,
              total_bayar: 0,
              metode_bayar: "tunai",
              status: "draft",
              tz: oPayload.tz || record.tz || "Asia/Jakarta",
              created_by: username,
              created_at: formatDateSystem(),
              updated_by: username,
              updated_at: formatDateSystem(),
            };

            await trx("trx_transaksi").insert(newTrx);
          }

          // 3. Ambil SEMUA item layanan dari antrian kunjungan ini yang berstatus 'selesai'
          const completedItems = await trx("trx_detail_antrian_layanan as dal")
            .join("trx_antrian_layanan as al", "dal.kode_antrian_layanan", "al.kode_antrian_layanan")
            .where("al.kode_kunjungan", kodeKunjungan)
            .where("al.status", "selesai")
            .select(
              "dal.id",
              "dal.kode_detail_antrian_layanan",
              "dal.kode_antrian_layanan",
              "dal.kode_layanan",
              "dal.nama_layanan",
              "dal.harga",
              "dal.jenis_layanan"
            )
            .orderBy("dal.id", "asc");

          // 4. Sinkronkan ke trx_detail_transaksi secara idempotent (lacak kuantitas)
          const existingDetails = await trx("trx_detail_transaksi")
            .where("kode_transaksi", createdTransaksiKode);

          const existingCounts = {};
          existingDetails.forEach((d) => {
            if (d.kode_layanan) {
              existingCounts[d.kode_layanan] = (existingCounts[d.kode_layanan] || 0) + 1;
            }
          });

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

          for (const item of completedItems) {
            if (item.kode_layanan) {
              const currentCount = existingCounts[item.kode_layanan] || 0;
              if (currentCount > 0) {
                existingCounts[item.kode_layanan]--;
              } else {
                const cKodeDetail = `${prefixDetail}${String(nextDetailSeq).padStart(3, "0")}`;
                nextDetailSeq++;
                const isKlaim = (item.jenis_layanan || "").toLowerCase() === "klaim_paket";
                const hargaSatuan = isKlaim ? 0 : parseFloat(item.harga || 0);

                await trx("trx_detail_transaksi").insert({
                  kode_detail_transaksi: cKodeDetail,
                  kode_transaksi: createdTransaksiKode,
                  kode_layanan: item.kode_layanan,
                  kode_produk: null,
                  qty: 1,
                  harga_satuan: hargaSatuan,
                  subtotal: hargaSatuan,
                  is_from_pendaftaran: 1,
                  tz: oPayload.tz || record.tz || "Asia/Jakarta",
                  created_by: username,
                  created_at: formatDateSystem(),
                  updated_by: username,
                  updated_at: formatDateSystem(),
                });
              }
            }
          }

          // 5. Hitung total_harga & total_bayar
          const sumResult = await trx("trx_detail_transaksi")
            .where("kode_transaksi", createdTransaksiKode)
            .sum("subtotal as total");

          const grandTotal = parseFloat(sumResult[0]?.total || 0);

          await trx("trx_transaksi")
            .where("kode_transaksi", createdTransaksiKode)
            .update({
              total_harga: grandTotal,
              total_bayar: grandTotal,
              updated_by: username,
              updated_at: formatDateSystem(),
            });
        }

        // 6. Cek apakah SEMUA antrean kunjungan ini sudah selesai/batal, update trx_kunjungan
        const allAntrian = await trx("trx_antrian_layanan")
          .where("kode_kunjungan", kodeKunjungan)
          .select("status");

        if (allAntrian.length > 0 && allAntrian.every((a) => a.status === "selesai" || a.status === "batal")) {
          await trx("trx_kunjungan")
            .where("kode_kunjungan", kodeKunjungan)
            .update({
              status: "selesai",
              updated_by: username,
              updated_at: formatDateSystem(),
            });
        }
      }

      await ChangesLog(
        {
          description: `Update status antrian layanan ${record.nomor_antrian} ke ${aksi}`,
          tableName: "trx_antrian_layanan",
          referenceCode: kodeAntrian,
          action: "UPDATE",
          dataBefore: record,
          dataAfter: updatedRecord,
          user: username,
          tz: oPayload.tz || "UTC",
        },
        trx
      );
    });

    if (aksi === "selesai" && updatedRecord?.kode_kunjungan) {
      await syncRekamMedisPerAntrian({
        kode_kunjungan: updatedRecord.kode_kunjungan,
        kode_antrian_layanan: kodeAntrian,
        kode_ruangan: updatedRecord.kode_ruangan,
        nama_ruangan: updatedRecord.nama_ruangan,
        hasil_form: updatedRecord.hasil_form,
        catatan_petugas: updatedRecord.catatan_petugas,
        kode_karyawan: updatedRecord.kode_karyawan,
        username: username,
      });
    }

    const pesanAksi = {
      dipanggil: `Nomor antrian layanan ${updatedRecord.nomor_antrian} dipanggil`,
      selesai: `Nomor antrian layanan ${updatedRecord.nomor_antrian} selesai`,
      batal: `Nomor antrian layanan ${updatedRecord.nomor_antrian} dibatalkan`,
      menunggu: `Nomor antrian layanan ${updatedRecord.nomor_antrian} dikembalikan ke menunggu`,
    };

    return res.status(200).json({
      status: status.SUKSES,
      message: pesanAksi[aksi] || "Berhasil mengubah status antrian",
      datetime: formatDateSystem(),
      data: updatedRecord,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        status: status.NOT_FOUND,
        message: error.message,
        datetime: formatDateSystem(),
      });
    }

    Logging(error, { file: "/master/antrian_layanan/antrian_layanan_panggil.js", func: "panggil", request: oPayload, response: {}, user: username });
    return res.status(500).json({
      status: status.BAD_REQUEST,
      message: error.message || "Gagal mengubah status antrian layanan",
      datetime: formatDateSystem(),
    });
  }
});

export default router;

/**
 * @copyright (c) 2026 PT Marstech Global (info@marstech.co.id)
 * @project Sistem Klinik
 * @file antrian_awal_ambil.js
 * @description Endpoint untuk mengambil nomor antrian pendaftaran berikutnya yang berstatus tersedia
 *
 * @author Antigravity
 * @created 2026-09-03
 * @version 1.0.0
 */

import express from "express";
import { status } from "../../components/tools/general.js";
import DB from "../../../../core/config/knex.js";
import {
  Logging,
  ChangesLog,
} from "../../components/tools/servertool.js";
import { formatDateSystem } from "../../components/tools/date_tools.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { body } = req;
  const oPayload = body || {};
  const username = req?.auth?.username || "";

  try {
    let resultData = null;

    await DB.transaction(async (trx) => {
      const now = formatDateSystem();
      const todayYmd = formatDateSystem(new Date(), "yyyy-MM-dd");
      const todayStr = todayYmd.replace(/-/g, "");
      const prefixAntrian = `A-${todayStr}-`;

      let record = await trx("trx_antrian_awal")
        .where("status", "tersedia")
        .where(function () {
          this.where("created_at", ">=", todayYmd + " 00:00:00")
            .orWhere("kode_antrian_awal", "like", `${prefixAntrian}%`);
        })
        .orderByRaw("CAST(nomor_antrian AS UNSIGNED) ASC, nomor_antrian ASC")
        .forUpdate()
        .first();

      let isNewInsert = false;
      let finalKodeAntrian = "";
      let finalNoAntrian = "";

      if (record) {
        // 2a. Jika ada nomor tersedia, ubah status nomor antrean menjadi 'terpakai' (diambil)
        finalKodeAntrian = record.kode_antrian_awal;
        finalNoAntrian = record.nomor_antrian;

        const updateData = {
          status: "terpakai",
          diambil_at: now,
          dipanggil_at: null,
          updated_by: username,
          updated_at: now,
        };

        await trx("trx_antrian_awal")
          .where("kode_antrian_awal", record.kode_antrian_awal)
          .update(updateData);

        await ChangesLog(
          {
            description: `Ambil Tiket Antrean Pendaftaran - Nomor ${record.nomor_antrian}`,
            tableName: "trx_antrian_awal",
            referenceCode: record.kode_antrian_awal,
            action: "UPDATE",
            dataBefore: record,
            dataAfter: { ...record, ...updateData },
            user: username,
            tz: oPayload.tz || "UTC",
          },
          trx
        );
      } else {
        // 2b. Jika TIDAK ada nomor tersedia (kuota habis / master kosong), otomatis insert nomor baru hari ini
        isNewInsert = true;

        const maxRecord = await trx("trx_antrian_awal")
          .where(function () {
            this.where("created_at", ">=", todayYmd + " 00:00:00")
              .orWhere("kode_antrian_awal", "like", `${prefixAntrian}%`);
          })
          .orderByRaw("CAST(nomor_antrian AS UNSIGNED) DESC, id DESC")
          .first();

        let nextNum = 1;
        let padLen = 2;
        if (maxRecord && maxRecord.nomor_antrian) {
          const digits = parseInt(String(maxRecord.nomor_antrian).replace(/\D/g, ""), 10);
          if (!isNaN(digits)) {
            nextNum = digits + 1;
          }
          if (String(maxRecord.nomor_antrian).startsWith("0")) {
            padLen = String(maxRecord.nomor_antrian).length;
          } else if (nextNum >= 100) {
            padLen = 3;
          } else if (String(maxRecord.nomor_antrian).length >= 2) {
            padLen = String(maxRecord.nomor_antrian).length;
          } else {
            padLen = 2;
          }
        }

        finalNoAntrian = String(nextNum).padStart(padLen, "0");

        const lastRecordCode = await trx("trx_antrian_awal")
          .where("kode_antrian_awal", "like", `${prefixAntrian}%`)
          .orderBy("id", "desc")
          .first();

        let nextSeq = 1;
        if (lastRecordCode && lastRecordCode.kode_antrian_awal) {
          const parts = lastRecordCode.kode_antrian_awal.split("-");
          const lastSeqNum = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastSeqNum)) nextSeq = lastSeqNum + 1;
        }

        finalKodeAntrian = `${prefixAntrian}${String(nextSeq).padStart(3, "0")}`;

        const oNewData = {
          kode_antrian_awal: finalKodeAntrian,
          nomor_antrian: finalNoAntrian,
          status: "terpakai",
          diambil_at: now,
          dipanggil_at: null,
          tz: oPayload.tz || "UTC",
          created_by: username,
          created_at: now,
          updated_by: username,
          updated_at: now,
        };

        await trx("trx_antrian_awal").insert(oNewData);

        await ChangesLog(
          {
            description: `Auto-Insert & Ambil Tiket Antrean Pendaftaran - Nomor ${finalNoAntrian}`,
            tableName: "trx_antrian_awal",
            referenceCode: finalKodeAntrian,
            action: "CREATE",
            dataBefore: null,
            dataAfter: oNewData,
            user: username,
            tz: oPayload.tz || "UTC",
          },
          trx
        );
      }

      // 4. Hitung jumlah antrean yang sedang menunggu di depannya
      const waitingCount = await trx("trx_antrian_awal")
        .where(function () {
          this.where("status", "terpakai")
            .whereNull("dipanggil_at")
            .where("kode_antrian_awal", "!=", finalKodeAntrian);
        })
        .orWhere("status", "dipanggil")
        .count("* as total")
        .first();

      const totalMenunggu = parseInt(waitingCount?.total || 0);

      resultData = {
        kode_antrian: finalKodeAntrian,
        no_antrian: finalNoAntrian,
        diambil_at: now,
        antrean_menunggu: totalMenunggu,
        nama_klinik: "Klinik Kecantikan",
      };
    });

    return res.status(200).json({
      status: status.SUKSES,
      message: `Nomor antrean ${resultData.no_antrian} berhasil diambil`,
      datetime: formatDateSystem(),
      data: resultData,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        status: status.NOT_FOUND,
        message: error.message,
        datetime: formatDateSystem(),
      });
    }

    if (error.statusCode === 422) {
      return res.status(422).json({
        status: status.BAD_REQUEST,
        message: error.message,
        datetime: formatDateSystem(),
      });
    }

    const oResult = {
      status: status.BAD_REQUEST,
      message: "Sistem sedang maintenance harap tunggu sebentar",
      datetime: formatDateSystem(),
    };

    Logging(error, {
      file: "/master/antrian_awal/antrian_awal_ambil.js",
      func: "ambil",
      request: oPayload,
      response: oResult,
      user: username,
    });

    return res.status(500).json(oResult);
  }
});

export default router;

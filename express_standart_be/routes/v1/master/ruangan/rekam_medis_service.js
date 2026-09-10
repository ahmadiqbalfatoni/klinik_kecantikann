import DB from "../../../../core/config/knex.js";
import { formatDateSystem } from "../../components/tools/date_tools.js";
import {
  mapAcneToEnum,
  mapInflammationToEnum,
  mapSkinTypeToEnum,
  mapPigmentationToEnum,
  mapSensitivityToEnum,
  mapKondisiKulitRuanganToEnum,
} from "./rekam_medis_enum_helper.js";

/**
 * Sync rekam medis per ruangan untuk kunjungan pasien (kode_kunjungan & kode_ruangan).
 * Menyimpan data penanganan per ruangan secara terstruktur ke `trx_rekam_medis_ruangan`
 * serta dokumentasi foto ke `trx_rekam_medis_foto`.
 *
 * JANGAN LAGI MENULIS/APPEND STRINGS KE KOLOM LAMA TRX_REKAM_MEDIS.
 */
export async function syncRekamMedisPerAntrian({
  kode_kunjungan,
  kode_antrian_layanan,
  kode_ruangan,
  nama_ruangan,
  hasil_form,
  header_data,
  skin_analysis,
  catatan_petugas,
  catatan_tindakan,
  catatan_hasil_treatment,
  kode_karyawan,
  username = "system",
  trx,
}) {
  if (!kode_kunjungan) return null;

  const db = trx || DB;

  try {
    // 1. Pastikan Header Record di `trx_rekam_medis` ADA (sebagai parent FK id_rekam_medis)
    const kunjungan = await db("trx_kunjungan")
      .where("kode_kunjungan", kode_kunjungan)
      .first();

    const no_rm = kunjungan ? kunjungan.no_rm : null;

    let existingHeaderRM = await db("trx_rekam_medis")
      .where("kode_kunjungan", kode_kunjungan)
      .first();

    let id_rekam_medis = existingHeaderRM?.id;

    let resolvedKodeKaryawan = null;
    let resolvedNoSip = "-";

    const targetKaryawanParam = kode_karyawan || existingHeaderRM?.kode_karyawan || hasil_form?.dokter_pelaksana?.no_sip || hasil_form?.dokter_pelaksana?.nama;
    if (targetKaryawanParam) {
      const cleanSip = String(targetKaryawanParam).split("#")[0].trim();
      const karyawanRec = await db("mst_karyawan")
        .where("kode_karyawan", targetKaryawanParam)
        .orWhere("kode_karyawan", cleanSip)
        .orWhere("no_sip", targetKaryawanParam)
        .orWhere("no_sip", cleanSip)
        .orWhere("kode_user", targetKaryawanParam)
        .orWhere("kode_user", cleanSip)
        .orWhere("nama", targetKaryawanParam)
        .orWhere("nama", "like", `%${cleanSip.replace(/^dr\.\s*/i, "")}%`)
        .first();

      if (karyawanRec) {
        resolvedKodeKaryawan = karyawanRec.kode_karyawan;
        resolvedNoSip = karyawanRec.no_sip || cleanSip;
      } else {
        resolvedKodeKaryawan = cleanSip;
        resolvedNoSip = cleanSip;
      }
    }

    const now = formatDateSystem();
    if (!existingHeaderRM) {
      const [insertedHeaderId] = await db("trx_rekam_medis").insert({
        kode_rekam_medis: `RKM-${Date.now()}`,
        kode_kunjungan,
        kode_antrian_layanan: kode_antrian_layanan || null,
        no_rm: no_rm || "RM-UNKNOWN",
        no_sip: resolvedNoSip,
        kode_karyawan: resolvedKodeKaryawan,
        created_by: username,
        created_at: now,
        updated_by: username,
        updated_at: now,
      });
      id_rekam_medis = insertedHeaderId;
    }

    if (!id_rekam_medis) {
      throw new Error("Gagal memperoleh id_rekam_medis header");
    }

    // Update fields header trx_rekam_medis jika dikirim
    const headerUpdate = {
      updated_by: username,
      updated_at: new Date(),
    };
    if (resolvedKodeKaryawan) headerUpdate.kode_karyawan = resolvedKodeKaryawan;
    if (resolvedNoSip !== "-") headerUpdate.no_sip = resolvedNoSip;

    const headerFields = [
      "keluhan", "durasi_keluhan", "riwayat_alergi", "riwayat_treatment",
      "pemeriksaan_acne", "pemeriksaan_inflammation", "pemeriksaan_skin_type", "pemeriksaan_pigmentation", "pemeriksaan_sensitivity",
      "diagnosis", "subjective", "objective", "assessment", "plan"
    ];
    let hasHeaderFields = false;
    headerFields.forEach((f) => {
      let val = header_data?.[f] !== undefined ? header_data[f] : hasil_form?.[f];
      if (val !== undefined) {
        if (f === "pemeriksaan_acne") val = mapAcneToEnum(val);
        else if (f === "pemeriksaan_inflammation") val = mapInflammationToEnum(val);
        else if (f === "pemeriksaan_skin_type") val = mapSkinTypeToEnum(val);
        else if (f === "pemeriksaan_pigmentation") val = mapPigmentationToEnum(val);
        else if (f === "pemeriksaan_sensitivity") val = mapSensitivityToEnum(val);

        headerUpdate[f] = val;
        hasHeaderFields = true;
      }
    });

    if (hasHeaderFields || resolvedKodeKaryawan) {
      await db("trx_rekam_medis").where("id", id_rekam_medis).update(headerUpdate);
    }

    // Sync trx_skin_analysis jika dikirim
    const skinData = skin_analysis || hasil_form?.skin_analysis;
    if (skinData && typeof skinData === "object") {
      const existingSa = await db("trx_skin_analysis").where("id_rekam_medis", id_rekam_medis).first();
      const saObj = {
        id_rekam_medis,
        kode_kunjungan,
        skin_type: skinData.skin_type ?? null,
        hydration: skinData.hydration ?? null,
        oil_level: skinData.oil_level ?? null,
        acne: skinData.acne ?? null,
        pigmentation: skinData.pigmentation ?? null,
        pore: skinData.pore ?? null,
        sensitivity: skinData.sensitivity ?? null,
        skin_score: skinData.skin_score ?? null,
        catatan: skinData.catatan || null,
        tz: "Asia/Jakarta",
        updated_by: username,
        updated_at: new Date(),
      };
      if (existingSa) {
        await db("trx_skin_analysis").where("id", existingSa.id).update(saObj);
      } else {
        saObj.kode_skin_analysis = `SA-${kode_kunjungan}-${Date.now().toString().slice(-4)}`;
        saObj.created_by = username;
        saObj.created_at = new Date();
        await db("trx_skin_analysis").insert(saObj);
      }
    }

    // Resolve nama_ruangan jika tidak terisi
    let resolvedNamaRuangan = nama_ruangan;
    if (!resolvedNamaRuangan && kode_ruangan) {
      const masterRoom = await db("mst_ruangan").where("kode_ruangan", kode_ruangan).first();
      if (masterRoom) resolvedNamaRuangan = masterRoom.nama_ruangan;
    }
    resolvedNamaRuangan = resolvedNamaRuangan || "Ruangan Treatment";

    // 2. Extract foto (before/after) & pisahkan field non-foto untuk data_form
    let extractedFotos = [];
    let cleanDataForm = {};

    if (header_data?.foto_before) {
      extractedFotos.push({ tipe: "before", url_foto: header_data.foto_before });
    }

    if (hasil_form && typeof hasil_form === "object") {
      Object.entries(hasil_form).forEach(([key, val]) => {
        if (val && typeof val === "object" && (val.before || val.after)) {
          if (val.before) extractedFotos.push({ tipe: "before", url_foto: val.before });
          if (val.after) extractedFotos.push({ tipe: "after", url_foto: val.after });
        } else if (key === "foto_before" && typeof val === "string" && val) {
          extractedFotos.push({ tipe: "before", url_foto: val });
        } else if (key === "foto_after" && typeof val === "string" && val) {
          extractedFotos.push({ tipe: "after", url_foto: val });
        } else {
          cleanDataForm[key] = val;
        }
      });
    }

    // 3. Cek apakah sudah ada baris `trx_rekam_medis_ruangan` untuk (id_rekam_medis, kode_ruangan)
    const roomCodeParam = kode_ruangan || "RNG-000";

    let existingRoomRM = await db("trx_rekam_medis_ruangan")
      .where("id_rekam_medis", id_rekam_medis)
      .where("kode_ruangan", roomCodeParam)
      .first();

    if (!existingRoomRM && kode_antrian_layanan) {
      existingRoomRM = await db("trx_rekam_medis_ruangan")
        .where("kode_antrian_layanan", kode_antrian_layanan)
        .first();
    }

    let id_rekam_medis_ruangan = existingRoomRM?.id;

    // Merge data_form yang ada jika update
    let mergedDataForm = cleanDataForm;
    if (existingRoomRM && existingRoomRM.data_form) {
      let existingFormObj = {};
      try {
        existingFormObj = typeof existingRoomRM.data_form === "string"
          ? JSON.parse(existingRoomRM.data_form)
          : existingRoomRM.data_form;
      } catch (_) {
        existingFormObj = {};
      }
      mergedDataForm = { ...existingFormObj, ...cleanDataForm };
    }

    const resolvedCatatanTindakan = catatan_tindakan !== undefined
      ? catatan_tindakan
      : (cleanDataForm.catatan_tindakan || existingRoomRM?.catatan_tindakan || null);

    const resolvedCatatanPetugas = catatan_petugas !== undefined
      ? catatan_petugas
      : (existingRoomRM?.catatan_petugas || null);

    const resolvedCatatanHasil = catatan_hasil_treatment !== undefined
      ? catatan_hasil_treatment
      : (existingRoomRM?.catatan_hasil_treatment || null);

    const areaYangDitangani = cleanDataForm.area_yang_ditangani || existingRoomRM?.area_yang_ditangani || null;
    const kondisiKulit = cleanDataForm.kondisi_kulit ? mapKondisiKulitRuanganToEnum(cleanDataForm.kondisi_kulit) : (existingRoomRM?.kondisi_kulit || null);
    const produkBahanDigunakan = cleanDataForm.produk_bahan_digunakan || existingRoomRM?.produk_bahan_digunakan || null;
    const jumlahSatuan = cleanDataForm.jumlah_satuan ? (parseInt(cleanDataForm.jumlah_satuan, 10) || null) : (existingRoomRM?.jumlah_satuan || null);
    const kondisiSetelahTindakan = cleanDataForm.kondisi_setelah_tindakan || existingRoomRM?.kondisi_setelah_tindakan || null;
    const persetujuanTindakan = cleanDataForm.persetujuan_tindakan !== undefined
      ? (cleanDataForm.persetujuan_tindakan ? 1 : 0)
      : (existingRoomRM?.persetujuan_tindakan ?? 0);

    const roomColsData = {
      kode_antrian_layanan: kode_antrian_layanan || existingRoomRM?.kode_antrian_layanan || null,
      nama_ruangan: resolvedNamaRuangan,
      kode_karyawan: resolvedKodeKaryawan || resolvedNoSip || kode_karyawan || existingRoomRM?.kode_karyawan || null,
      area_yang_ditangani: areaYangDitangani,
      kondisi_kulit: kondisiKulit,
      produk_bahan_digunakan: produkBahanDigunakan,
      jumlah_satuan: jumlahSatuan,
      catatan_tindakan: resolvedCatatanTindakan,
      catatan_petugas: resolvedCatatanPetugas,
      catatan_hasil_treatment: resolvedCatatanHasil,
      kondisi_setelah_tindakan: kondisiSetelahTindakan,
      persetujuan_tindakan: persetujuanTindakan,
      data_form: JSON.stringify(mergedDataForm),
      updated_by: username,
      updated_at: new Date(),
    };

    if (existingRoomRM) {
      // UPDATE baris ruangan yang sudah ada
      await db("trx_rekam_medis_ruangan")
        .where("id", existingRoomRM.id)
        .update(roomColsData);
    } else {
      // INSERT baris ruangan baru
      const kodeRMR = `RMR-${kode_kunjungan}-${roomCodeParam}-${Date.now().toString().slice(-4)}`;
      const [insertedRoomId] = await db("trx_rekam_medis_ruangan").insert({
        kode_rekam_medis_ruangan: kodeRMR,
        id_rekam_medis: id_rekam_medis,
        kode_kunjungan: kode_kunjungan,
        kode_ruangan: roomCodeParam,
        status: "berlangsung",
        created_by: username,
        created_at: new Date(),
        ...roomColsData,
      });
      id_rekam_medis_ruangan = insertedRoomId;
    }

    // 4. Simpan/link foto ke trx_rekam_medis_foto dengan id_rekam_medis_ruangan (Upsert per tipe)
    if (id_rekam_medis_ruangan && extractedFotos.length > 0) {
      for (const foto of extractedFotos) {
        const existingFotoSameTipe = await db("trx_rekam_medis_foto")
          .where("id_rekam_medis_ruangan", id_rekam_medis_ruangan)
          .where("tipe", foto.tipe)
          .first();

        if (existingFotoSameTipe) {
          await db("trx_rekam_medis_foto")
            .where("id", existingFotoSameTipe.id)
            .update({ url_foto: foto.url_foto });
        } else {
          await db("trx_rekam_medis_foto").insert({
            id_rekam_medis: id_rekam_medis,
            id_rekam_medis_ruangan: id_rekam_medis_ruangan,
            tipe: foto.tipe,
            url_foto: foto.url_foto,
          });
        }
      }
    }

    return {
      id_rekam_medis,
      id_rekam_medis_ruangan,
      kode_kunjungan,
      kode_ruangan: roomCodeParam,
    };
  } catch (err) {
    console.error("Error in syncRekamMedisPerAntrian:", err);
    throw err;
  }
}

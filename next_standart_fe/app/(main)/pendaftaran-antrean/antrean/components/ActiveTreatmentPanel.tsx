'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Checkbox } from 'primereact/checkbox';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import postData from '@/lib/axios/postData';
import { showError, showSuccess } from '@/lib/tools/generalTools';
import { Dialog } from 'primereact/dialog';
import { AntrianLayananData, RuanganFormField } from './interfaces';
import { FormRuanganFotoUploader } from './FormRuanganFotoUploader';
import { RekomendasiTreatmentPanel, RekomendasiItem } from './RekomendasiTreatmentPanel';
import { DialogHasilTerbitAntrian } from './DialogHasilTerbitAntrian';
import { HasilTreatmentPanel } from './HasilTreatmentPanel';
import { DrawerRiwayatPasien } from './DrawerRiwayatPasien';
import {
    Briefcase,
    Building2,
    User,
    History,
    Volume2,
    Ban,
    CheckCircle2,
} from 'lucide-react';

interface ActiveTreatmentPanelProps {
    activePatient: AntrianLayananData | null;
    nextWaitingPatient: AntrianLayananData | null;
    kodeRuangan: string;
    namaRuangan: string;
    isKonsultasi?: boolean;
    toast: React.RefObject<Toast>;
    getGridData: () => void;
    handleAksi: (item: AntrianLayananData, customAksi?: string, skipFormValidation?: boolean) => void;
    playChime: () => void;
    speakNomorLayanan: (noAntrian: string, namaPasien?: string, namaRuangan?: string) => void;
    onManageFormClick?: () => void;
    petugasJagaList?: any[];
}

export const ActiveTreatmentPanel: React.FC<ActiveTreatmentPanelProps> = ({
    activePatient,
    nextWaitingPatient,
    kodeRuangan,
    namaRuangan,
    isKonsultasi = false,
    toast,
    getGridData,
    handleAksi,
    playChime,
    speakNomorLayanan,
    petugasJagaList,
}) => {
    const [fields, setFields] = useState<RuanganFormField[]>([]);
    const [loadingFields, setLoadingFields] = useState<boolean>(false);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [catatanPetugas, setCatatanPetugas] = useState<string>('');
    const [rekomendasiItems, setRekomendasiItems] = useState<RekomendasiItem[]>([]);
    const [saving, setSaving] = useState<boolean>(false);
    const [drawerRiwayatVisible, setDrawerRiwayatVisible] = useState<boolean>(false);

    // Rekam Medis (trx_rekam_medis) Header Data State
    const [headerRMData, setHeaderRMData] = useState({
        foto_before: '',
        keluhan: '',
        durasi_keluhan: '',
        riwayat_alergi: '',
        riwayat_treatment: '',
        pemeriksaan_acne: 'Tidak Ada',
        pemeriksaan_inflammation: 'Tidak Ada',
        pemeriksaan_skin_type: 'Normal',
        pemeriksaan_pigmentation: 'Tidak Ada',
        pemeriksaan_sensitivity: 'Rendah',
        diagnosis: '',
        subjective: '',
        objective: '',
        assessment: '',
        plan: '',
    });
    const [lanjutKeTindakan, setLanjutKeTindakan] = useState<boolean>(true);
    const [uploadingBefore, setUploadingBefore] = useState<boolean>(false);

    // Dropdown Petugas / Dokter (SIP) State
    const [karyawanOptions, setKaryawanOptions] = useState<any[]>([]);
    const [selectedPetugas, setSelectedPetugas] = useState<string>('');

    // Hitung options petugas: prioritaskan petugas piket hari ini di ruangan ini
    const availablePetugasOptions = useMemo(() => {
        if (petugasJagaList && petugasJagaList.length > 0) {
            return petugasJagaList.map((p: any) => {
                const isPj = p.is_penanggung_jawab === 1 || p.is_penanggung_jawab === true;
                return {
                    label: `${p.nama_karyawan || p.nama}${p.jabatan ? ` (${p.jabatan.toUpperCase()})` : ''}${isPj ? ' ★ [PJ]' : ''}`,
                    value: p.no_sip,
                    nama: p.nama_karyawan || p.nama,
                    jabatan: p.jabatan,
                    no_sip: p.no_sip,
                    is_penanggung_jawab: isPj,
                };
            });
        }
        return karyawanOptions;
    }, [petugasJagaList, karyawanOptions]);

    // Step state: 'form' (Form Penanganan) vs 'hasil' (Hasil Treatment & Produk Kasir)
    const [activeStep, setActiveStep] = useState<'form' | 'hasil'>('form');
    // Setelah simpan, kunci semua input form agar tidak bisa diubah lagi
    const [isFormSaved, setIsFormSaved] = useState<boolean>(false);
    const [isHasilSaved, setIsHasilSaved] = useState<boolean>(false);

    // Modal Sukses Terbit Antrean & Transaksi
    const [showHasilModal, setShowHasilModal] = useState<boolean>(false);
    const [hasilAntrianList, setHasilAntrianList] = useState<any[]>([]);
    const [hasilTransaksiDraft, setHasilTransaksiDraft] = useState<any | null>(null);
    const [hasilKodeKunjungan, setHasilKodeKunjungan] = useState<string>('');
    const [hasilPasienNama, setHasilPasienNama] = useState<string>('');
    const [hasilNoRm, setHasilNoRm] = useState<string>('');

    useEffect(() => {
        loadKaryawan();
    }, []);

    useEffect(() => {
        if (kodeRuangan) {
            loadFormFields();
        }
    }, [kodeRuangan]);

    const [currentAntrianId, setCurrentAntrianId] = useState<string>('');

    useEffect(() => {
        if (activePatient?.kode_antrian_layanan) {
            if (activePatient.kode_antrian_layanan !== currentAntrianId) {
                setCurrentAntrianId(activePatient.kode_antrian_layanan);
                let initialForm = {};
                let hasForm = false;
                if (activePatient.hasil_form) {
                    try {
                        initialForm = typeof activePatient.hasil_form === 'string' ? JSON.parse(activePatient.hasil_form) : activePatient.hasil_form;
                        hasForm = Object.keys(initialForm).length > 0;
                    } catch (_) {}
                }
                setFormData(initialForm);
                setCatatanPetugas(activePatient.catatan_petugas || '');
                let defaultPetugas = activePatient.kode_karyawan || '';
                if (!defaultPetugas && petugasJagaList && petugasJagaList.length > 0) {
                    const pj = petugasJagaList.find((p: any) => p.is_penanggung_jawab === 1 || p.is_penanggung_jawab === true);
                    defaultPetugas = pj?.no_sip || petugasJagaList[0]?.no_sip || '';
                }
                setSelectedPetugas(defaultPetugas);

                const ap = activePatient as any;
                setHeaderRMData({
                    foto_before: ap.foto_before || ap.data_konsultasi_foto_before || '',
                    keluhan: ap.keluhan || ap.data_konsultasi_keluhan || '',
                    durasi_keluhan: ap.durasi_keluhan || ap.data_konsultasi_durasi_keluhan || '',
                    riwayat_alergi: ap.riwayat_alergi || ap.data_konsultasi_riwayat_alergi || '',
                    riwayat_treatment: ap.riwayat_treatment || ap.data_konsultasi_riwayat_treatment || '',
                    pemeriksaan_acne: ap.pemeriksaan_acne || ap.data_konsultasi_pemeriksaan_acne || 'Tidak Ada',
                    pemeriksaan_inflammation: ap.pemeriksaan_inflammation || ap.data_konsultasi_pemeriksaan_inflammation || 'Tidak Ada',
                    pemeriksaan_skin_type: ap.pemeriksaan_skin_type || ap.data_konsultasi_pemeriksaan_skin_type || 'Normal',
                    pemeriksaan_pigmentation: ap.pemeriksaan_pigmentation || ap.data_konsultasi_pemeriksaan_pigmentation || 'Tidak Ada',
                    pemeriksaan_sensitivity: ap.pemeriksaan_sensitivity || ap.data_konsultasi_pemeriksaan_sensitivity || 'Rendah',
                    diagnosis: ap.diagnosis || ap.data_konsultasi_diagnosis || '',
                    subjective: ap.subjective || ap.data_konsultasi_subjective || '',
                    objective: ap.objective || ap.data_konsultasi_objective || '',
                    assessment: ap.assessment || ap.data_konsultasi_assessment || '',
                    plan: ap.plan || ap.data_konsultasi_plan || '',
                });

                setActiveStep(hasForm ? 'hasil' : 'form');
                setIsFormSaved(hasForm);
                setIsHasilSaved(false);

                if (isKonsultasi) {
                    loadPendaftaranItems(activePatient.kode_kunjungan);
                } else {
                    setRekomendasiItems([]);
                }
            } else if (activePatient.kode_karyawan && !selectedPetugas) {
                setSelectedPetugas(activePatient.kode_karyawan);
            } else if (!selectedPetugas && petugasJagaList && petugasJagaList.length > 0) {
                const pj = petugasJagaList.find((p: any) => p.is_penanggung_jawab === 1 || p.is_penanggung_jawab === true);
                setSelectedPetugas(pj?.no_sip || petugasJagaList[0]?.no_sip || '');
            }
        } else {
            setCurrentAntrianId('');
            setFormData({});
            setCatatanPetugas('');
            setRekomendasiItems([]);
            setSelectedPetugas('');
            setActiveStep('form');
            setIsFormSaved(false);
            setIsHasilSaved(false);
        }
    }, [activePatient?.kode_antrian_layanan, isKonsultasi, petugasJagaList]);

    useEffect(() => {
        if (!selectedPetugas && petugasJagaList && petugasJagaList.length > 0) {
            const pj = petugasJagaList.find((p: any) => p.is_penanggung_jawab === 1 || p.is_penanggung_jawab === true);
            const chosen = pj?.no_sip || petugasJagaList[0]?.no_sip || '';
            if (chosen) setSelectedPetugas(chosen);
        }
    }, [petugasJagaList, selectedPetugas]);

    const loadPendaftaranItems = async (kodeKunjungan?: string) => {
        if (!kodeKunjungan) return;
        try {
            const res = await postData('/master/antrian-layanan-pendaftaran-items', {
                kode_kunjungan: kodeKunjungan,
            });
            if (['00', '0000'].includes(res.data.status) && res.data.data?.length > 0) {
                setRekomendasiItems(res.data.data);
            } else {
                setRekomendasiItems([]);
            }
        } catch (e) {
            setRekomendasiItems([]);
        }
    };

    const handleBeforePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showError(toast, 'File harus berupa gambar (JPG, PNG, WEBP, dll)');
            return;
        }
        setUploadingBefore(true);
        try {
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = (err) => reject(err);
                reader.readAsDataURL(file);
            });
            const res = await postData('/master/ruangan-form-upload-foto', {
                image_base64: base64,
                file_name: file.name,
                prefix: 'before',
            });
            if (res?.data?.status === 200 || res?.status === 200) {
                const filePath = res.data?.data?.file_path || res.data?.file_path || '';
                setHeaderRMData((prev) => ({ ...prev, foto_before: filePath }));
                showSuccess(toast, 'Foto Before berhasil diunggah!');
            } else {
                showError(toast, res?.data?.message || 'Gagal mengunggah foto');
            }
        } catch (_) {
            showError(toast, 'Gagal mengunggah foto');
        } finally {
            setUploadingBefore(false);
        }
    };

    const loadKaryawan = async () => {
        try {
            const res = await postData('/master/karyawan-data', { page: 1, perPage: 100 });
            const list = res.data?.data || [];
            const opts = list.map((k: any) => ({
                label: `${k.nama}${k.jabatan ? ` (${k.jabatan.toUpperCase()})` : ''}`,
                value: k.no_sip,
                nama: k.nama,
                jabatan: k.jabatan,
                no_sip: k.no_sip,
            }));
            setKaryawanOptions(opts);
        } catch (_) {
            // silent fail
        }
    };

    const loadFormFields = async () => {
        if (!kodeRuangan) return;
        setLoadingFields(true);
        try {
            const res = await postData('/master/ruangan-form-data', { kode_ruangan: kodeRuangan });
            setFields(res.data.data || []);
        } catch (_) {
            // silent fail
        } finally {
            setLoadingFields(false);
        }
    };

    const handleFieldChange = (key: string, value: any) => {
        if (isFormSaved) return;
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const executeSaveForm = async (targetStatus?: string) => {
        if (!activePatient) return;
        setSaving(true);
        try {
            const payload: any = {
                kode_antrian_layanan: activePatient.kode_antrian_layanan,
                kode_karyawan: selectedPetugas,
                no_sip: selectedPetugas,
                hasil_form: formData,
                header_data: headerRMData,
                lanjut_ke_tindakan: lanjutKeTindakan ? 1 : 0,
                catatan_petugas: catatanPetugas,
                rekomendasi_items: rekomendasiItems,
            };
            if (targetStatus) {
                payload.status_tindakan = targetStatus;
            }

            const res = await postData('/master/antrian-layanan-simpan-rekomendasi', payload);
            showSuccess(toast, res.data.message || 'Form penanganan berhasil disimpan.');

            const antrianBaru = res.data?.data?.antrian_layanan_baru || [];
            const trxDraft = res.data?.data?.transaksi_draft || null;
            const kodeKunjungan = res.data?.data?.kode_kunjungan || '';

            // Simpan info pasien SEBELUM getGridData() mengosongkan activePatient
            if (antrianBaru.length > 0 || trxDraft) {
                setHasilPasienNama(activePatient?.nama_pasien || '');
                setHasilNoRm(activePatient?.no_rm || '');
                setHasilAntrianList(antrianBaru);
                setHasilTransaksiDraft(trxDraft);
                setHasilKodeKunjungan(kodeKunjungan);
            }

            // Update local officer info so header badge displays doctor name immediately
            if (selectedPetugas) {
                const foundKaryawan = availablePetugasOptions.find((k) => k.value === selectedPetugas) || karyawanOptions.find((k) => k.value === selectedPetugas);
                if (foundKaryawan) {
                    activePatient.nama_petugas = foundKaryawan.nama;
                    activePatient.kode_karyawan = selectedPetugas;
                }
            }

            // Kunci form setelah berhasil simpan tanpa mengosongkan nilainya (form tidak bisa diotak-atik)
            setIsFormSaved(true);

            // Refresh data
            getGridData();

            if (antrianBaru.length > 0 || trxDraft) {
                setShowHasilModal(true);
            }
        } catch (error: any) {
            showError(toast, error?.response?.data?.message || 'Gagal menyimpan catatan & rekomendasi penanganan');
        } finally {
            setSaving(false);
        }
    };

    // State Konfirmasi Simpan
    const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
    const [targetStatusToSave, setTargetStatusToSave] = useState<string | undefined>(undefined);

    const handleSaveForm = (targetStatus?: string) => {
        if (!activePatient) return;

        // Validation: Petugas / Dokter Examiner wajib dipilih
        if (!selectedPetugas) {
            showError(toast, 'Petugas / Dokter Penanggung Jawab wajib dipilih!');
            return;
        }

        // Check mandatory fields
        for (const f of fields) {
            if (f.is_required) {
                const val = formData[f.label_field];
                if (f.tipe_field === 'upload_foto') {
                    const hasBefore = val && typeof val === 'object' && val.before;
                    if (!hasBefore) {
                        showError(toast, `Field '${f.label_field}' wajib mengunggah foto!`);
                        return;
                    }
                } else if (!val) {
                    showError(toast, `Field '${f.label_field}' wajib diisi!`);
                    return;
                }
            }
        }

        setTargetStatusToSave(targetStatus);
        setShowConfirmModal(true);
    };

    const handleConfirmAccept = () => {
        setShowConfirmModal(false);
        executeSaveForm(targetStatusToSave);
    };

    // ─── IF NO PATIENT IS CURRENTLY IN TREATMENT ─────────────────────────────
    if (!activePatient) {
        return (
            <>
                <div className="card shadow-2 border-round-xl p-4 surface-card border-top-3 border-teal-500 mb-4">
                    <div className="flex flex-column sm:flex-row align-items-start sm:align-items-center justify-content-between gap-3">
                        <div className="flex align-items-center gap-3">
                            <div className="w-3rem h-3rem border-circle bg-teal-100 text-teal-700 flex align-items-center justify-content-center text-xl font-bold flex-shrink-0">
                                👨‍⚕️
                            </div>
                            <div>
                                <span className="text-xs font-bold text-teal-700 bg-teal-100 px-2 py-1 border-round-md inline-block mb-1">
                                    Sesi Penanganan Ruangan: {namaRuangan}
                                </span>
                                <h3 className="text-xl font-bold text-900 m-0">Belum Ada Pasien Yang Sedang Ditangani</h3>
                                <p className="text-xs text-500 m-0 mt-1">
                                    {nextWaitingPatient
                                        ? `Pasien berikutnya: No. #${nextWaitingPatient.nomor_antrian} — ${nextWaitingPatient.nama_pasien} (${nextWaitingPatient.nama_layanan})`
                                        : 'Tidak ada antrean pasien yang sedang menunggu di ruangan ini.'}
                                </p>
                            </div>
                        </div>

                        <div className="flex align-items-center gap-2 flex-wrap">
                            {nextWaitingPatient && (
                                <Button
                                    label={`📢 Panggil Pasien Next (#${nextWaitingPatient.nomor_antrian})`}
                                    icon="pi pi-megaphone"
                                    size="small"
                                    className="font-bold bg-teal-600 border-none text-white"
                                    onClick={() => handleAksi(nextWaitingPatient, 'dipanggil')}
                                />
                            )}
                        </div>
                    </div>
                </div>

                <DialogHasilTerbitAntrian
                    visible={showHasilModal}
                    onHide={() => setShowHasilModal(false)}
                    pasienNama={hasilPasienNama}
                    noRm={hasilNoRm}
                    kodeKunjungan={hasilKodeKunjungan}
                    antrianList={hasilAntrianList}
                    transaksiDraft={hasilTransaksiDraft}
                />
            </>
        );
    }

    const dataKonsul = activePatient as any;
    const hasDataKonsul = !!(
        dataKonsul?.kode_antrian_asal ||
        (dataKonsul?.data_konsultasi_keluhan && dataKonsul?.data_konsultasi_keluhan !== '-') ||
        (dataKonsul?.data_konsultasi_diagnosis && dataKonsul?.data_konsultasi_diagnosis !== '-') ||
        dataKonsul?.data_konsultasi_hasil_form
    );

    let extraFormFields: Array<{ label: string; value: any }> = [];
    if (dataKonsul?.data_konsultasi_hasil_form) {
        try {
            const rawObj = typeof dataKonsul.data_konsultasi_hasil_form === 'string'
                ? JSON.parse(dataKonsul.data_konsultasi_hasil_form)
                : dataKonsul.data_konsultasi_hasil_form;
            if (rawObj && typeof rawObj === 'object') {
                Object.entries(rawObj).forEach(([k, v]) => {
                    if (v && typeof v !== 'object' && !['area_yang_ditangani', 'kondisi_kulit', 'produk_bahan_digunakan', 'jumlah_satuan', 'catatan_tindakan', 'catatan_petugas', 'kondisi_setelah_tindakan', 'catatan_hasil_treatment', 'persetujuan_tindakan'].includes(k)) {
                        const label = k.replace(/_/g, ' ').toUpperCase();
                        extraFormFields.push({ label, value: String(v) });
                    }
                });
            }
        } catch (_) {}
    }

    return (
        <>
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* SATU CARD TERPADU: STATUS PASIEN + FORM PENANGANAN (MENYATU)        */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div className="card shadow-2 border-round-xl p-0 mb-4 surface-card overflow-hidden border-1 surface-border">
                {/* SECTION 1: NO. ANTREAN & INFO PASIEN (SOLID TEAL-700 GRADIENT - SAMA DENGAN TAB FORM PENANGANAN) */}
                <div
                    className="p-4 sm:p-5 text-white"
                    style={{
                        background: 'linear-gradient(135deg, #0e8174 0%, #084a42 100%)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.12)'
                    }}
                >
                    {/* 1. TOP ROW: NO. ANTREAN WHITE CARD + PATIENT INFO */}
                    <div className="flex flex-column sm:flex-row align-items-start sm:align-items-center gap-4 mb-4">
                        {/* Nomor Antrean: KOTAK PUTIH SOLID (fokus utama kontras tinggi vs dark green) */}
                        <div
                            className="bg-white border-round-xl flex flex-column align-items-center justify-content-center px-4 py-3 shadow-3 flex-shrink-0"
                            style={{ minWidth: '108px' }}
                        >
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                                NO. ANTREAN
                            </span>
                            <span className="text-4xl sm:text-5xl font-black text-gray-900 line-height-1 tracking-tight">
                                {activePatient.nomor_antrian}
                            </span>
                        </div>

                        {/* Detail Pasien & Metadata */}
                        <div className="flex-1 flex flex-column gap-1">
                            {/* Status Badge (BENAR-BENAR TANPA BORDER / OUTLINE) */}
                            <div className="flex align-items-center gap-2.5 flex-wrap mb-1">
                                {/* Badge Status: Background hijau lebih terang dari card, BENAR-BENAR TANPA BORDER / OUTLINE */}
                                <span
                                    className="inline-flex align-items-center gap-2 text-xs font-bold px-3 py-1 border-none outline-none"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.22)',
                                        color: '#ffffff',
                                        border: 'none',
                                        outline: 'none',
                                        boxShadow: 'none',
                                        borderRadius: '6px'
                                    }}
                                >
                                    <span
                                        className="w-2 h-2 border-round-circle inline-block flex-shrink-0 bg-white"
                                        style={{ boxShadow: '0 0 6px rgba(255, 255, 255, 0.8)' }}
                                    />
                                    <span>SEDANG DITANGANI</span>
                                </span>
                            </div>

                            {/* Nama Pasien & No. RM */}
                            <div className="flex align-items-baseline gap-2.5 flex-wrap mt-0.5">
                                <h2 className="text-2xl sm:text-3xl font-black text-white m-0 tracking-tight">
                                    {activePatient.nama_pasien || 'Pasien'}
                                </h2>
                                <span
                                    className="text-xs font-medium px-2 py-0.5"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        borderRadius: '4px',
                                        color: '#a7f3d0'
                                    }}
                                >
                                    RM: <strong className="text-white">{activePatient.no_rm}</strong>
                                </span>
                            </div>

                            {/* Metadata Tags: Layanan, Ruangan, Petugas (Halus, Semi-transparan, Bebas dari Kotak Berat) */}
                            <div className="flex align-items-center gap-2 flex-wrap text-xs mt-3">
                                <span
                                    className="inline-flex align-items-center gap-2 px-3 py-1.5 font-medium"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.14)',
                                        borderRadius: '6px',
                                        color: 'rgba(255, 255, 255, 0.92)'
                                    }}
                                >
                                    <Briefcase size={14} style={{ color: '#a7f3d0' }} className="flex-shrink-0" />
                                    <span>{activePatient.nama_layanan}</span>
                                </span>
                                <span
                                    className="inline-flex align-items-center gap-2 px-3 py-1.5 font-medium"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.14)',
                                        borderRadius: '6px',
                                        color: 'rgba(255, 255, 255, 0.92)'
                                    }}
                                >
                                    <Building2 size={14} style={{ color: '#a7f3d0' }} className="flex-shrink-0" />
                                    <span>{namaRuangan}</span>
                                </span>
                                {(activePatient.nama_petugas || availablePetugasOptions.find((k) => k.value === selectedPetugas)?.nama || karyawanOptions.find((k) => k.value === selectedPetugas)?.nama) && (
                                    <span
                                        className="inline-flex align-items-center gap-2 px-3 py-1.5 font-medium"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.08)',
                                            border: '1px solid rgba(255, 255, 255, 0.14)',
                                            borderRadius: '6px',
                                            color: 'rgba(255, 255, 255, 0.92)'
                                        }}
                                    >
                                        <User size={14} style={{ color: '#a7f3d0' }} className="flex-shrink-0" />
                                        <span>Petugas: <strong className="text-white">{availablePetugasOptions.find((k) => k.value === selectedPetugas)?.nama || karyawanOptions.find((k) => k.value === selectedPetugas)?.nama || activePatient.nama_petugas}</strong></span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2. BOTTOM ROW: ACTION BUTTONS WITH CLEAR VISUAL HIERARCHY */}
                    <div
                        className="flex flex-column sm:flex-row align-items-stretch sm:align-items-center justify-content-between gap-3 pt-3 mt-1"
                        style={{ borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}
                    >
                        {/* Tombol Batalkan: Outline merah tipis di atas background gelap card */}
                        <div>
                            <Button
                                type="button"
                                size="small"
                                className="text-xs font-semibold px-3 py-2 transition-all flex align-items-center gap-2 border-1"
                                style={{
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    borderColor: 'rgba(248, 113, 113, 0.35)',
                                    color: '#fca5a5',
                                    borderRadius: '8px'
                                }}
                                onClick={() => handleAksi(activePatient, 'batal')}
                            >
                                <Ban size={15} style={{ color: '#fca5a5' }} />
                                <span>Batalkan</span>
                            </Button>
                        </div>

                        {/* Tombol Sekunder & Utama: di ujung kanan dengan hierarki visual */}
                        <div className="flex align-items-center gap-2.5 flex-wrap justify-content-end">
                            {/* Tombol Sekunder 1: Riwayat Pasien (Outline putih tipis, semi-transparan gelap) */}
                            <Button
                                type="button"
                                size="small"
                                className="text-xs font-semibold px-3 py-2 transition-all flex align-items-center gap-2 border-1"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    borderColor: 'rgba(255, 255, 255, 0.22)',
                                    color: '#ffffff',
                                    borderRadius: '8px'
                                }}
                                onClick={() => setDrawerRiwayatVisible(true)}
                            >
                                <History size={15} style={{ color: 'rgba(255, 255, 255, 0.75)' }} />
                                <span>Riwayat Pasien</span>
                            </Button>

                            {/* Tombol Sekunder 2: Panggil Ulang (Outline putih tipis, semi-transparan gelap) */}
                            <Button
                                type="button"
                                size="small"
                                className="text-xs font-semibold px-3 py-2 transition-all flex align-items-center gap-2 border-1"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    borderColor: 'rgba(255, 255, 255, 0.22)',
                                    color: '#ffffff',
                                    borderRadius: '8px'
                                }}
                                onClick={() => {
                                    playChime();
                                    speakNomorLayanan(activePatient.nomor_antrian, activePatient.nama_pasien, namaRuangan);
                                }}
                            >
                                <Volume2 size={15} style={{ color: 'rgba(255, 255, 255, 0.75)' }} />
                                <span>Panggil Ulang</span>
                            </Button>

                            {/* Tombol Utama (PRIMARY HERO CTA): Selesaikan Konsultasi / Tindakan (SATU-SATUNYA SOLID TERANG/PUTIH) */}
                            <Button
                                type="button"
                                disabled={
                                    isKonsultasi
                                        ? (!isFormSaved && !activePatient?.hasil_form)
                                        : ((!isFormSaved && !activePatient?.hasil_form) || !isHasilSaved)
                                }
                                className="text-xs font-bold px-4 py-2.5 transition-all flex align-items-center gap-2 border-1"
                                style={
                                    (isKonsultasi
                                        ? (!isFormSaved && !activePatient?.hasil_form)
                                        : ((!isFormSaved && !activePatient?.hasil_form) || !isHasilSaved))
                                        ? {
                                              background: 'rgba(255, 255, 255, 0.1)',
                                              borderColor: 'rgba(255, 255, 255, 0.15)',
                                              color: 'rgba(255, 255, 255, 0.4)',
                                              borderRadius: '8px',
                                              cursor: 'not-allowed'
                                          }
                                        : {
                                              background: '#ffffff',
                                              borderColor: '#ffffff',
                                              color: '#064e3b',
                                              borderRadius: '8px',
                                              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.22)',
                                              fontWeight: 700,
                                              cursor: 'pointer'
                                          }
                                }
                                tooltip={
                                    !isKonsultasi && !isHasilSaved
                                        ? 'Tombol Selesaikan Tindakan baru bisa diklik setelah data Form Hasil Treatment (Step 2) disimpan'
                                        : ''
                                }
                                tooltipOptions={{ position: 'bottom' }}
                                onClick={() => {
                                    if (!isKonsultasi && !isHasilSaved) {
                                        showError(toast, 'Selesaikan Tindakan baru bisa diklik setelah data Form Hasil Treatment (Step 2) disimpan!');
                                        return;
                                    }
                                    handleAksi(activePatient, 'selesai', true);
                                }}
                            >
                                <CheckCircle2
                                    size={16}
                                    style={{
                                        color: (isKonsultasi
                                            ? (!isFormSaved && !activePatient?.hasil_form)
                                            : ((!isFormSaved && !activePatient?.hasil_form) || !isHasilSaved))
                                            ? 'rgba(255, 255, 255, 0.4)'
                                            : '#064e3b'
                                    }}
                                />
                                <span>{isKonsultasi ? "Selesaikan Konsultasi" : "Selesaikan Tindakan"}</span>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* 2. FORM PENANGANAN (FLOW MENYATU LANGSUNG DALAM 1 CARD CONTAINER)   */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                {isKonsultasi ? (
                /* RUANG KONSULTASI DOKTER VIEW */
                <div className="p-3 sm:p-4 flex flex-column gap-4 bg-white">
                    {/* SECTION PETUGAS / DOKTER PENANGGUNG JAWAB (SESUAI SIP) */}
                    <div className="p-3 border-round-xl border-1 surface-border bg-white">
                        <div className="flex align-items-center justify-content-between mb-2 pb-2 border-bottom-1 surface-border">
                            <label className="text-xs font-extrabold text-700 uppercase tracking-wider flex align-items-center gap-2 m-0">
                                <i className="pi pi-user text-500 text-sm" />
                                PETUGAS / DOKTER PELAKSANA TINDAKAN (SESUAI SIP)
                            </label>
                            <span className="text-[10px] text-500 font-semibold">
                                {petugasJagaList && petugasJagaList.length > 0 ? `${petugasJagaList.length} Petugas Piket` : 'Tersimpan berdasar No. SIP'}
                            </span>
                        </div>
                        {petugasJagaList && petugasJagaList.length > 1 && (
                            <div className="mb-2 text-xs text-600 bg-amber-50 border-1 border-amber-200 border-round p-2 flex align-items-center gap-2">
                                <i className="pi pi-info-circle text-amber-600 text-xs" />
                                <span>Tersedia {petugasJagaList.length} petugas piket hari ini. Penanggung Jawab ruangan dipilih default; silakan ubah jika tindakan dilakukan oleh petugas pendamping.</span>
                            </div>
                        )}
                        <div className="p-fluid">
                            <Dropdown
                                value={selectedPetugas}
                                options={availablePetugasOptions}
                                onChange={(e) => setSelectedPetugas(e.value)}
                                placeholder="-- Pilih Nama Petugas / Dokter --"
                                filter
                                filterBy="label,value,nama"
                                showClear
                                disabled={isFormSaved}
                                className="w-full text-sm border-round-md shadow-1 bg-white"
                                valueTemplate={(option) => {
                                    if (option) {
                                        return (
                                            <div className="flex align-items-center gap-2">
                                                <span className="font-bold text-900">{option.nama || option.label}</span>
                                                {option.is_penanggung_jawab && (
                                                    <span className="text-[10px] bg-amber-100 text-amber-900 border-1 border-amber-400 font-extrabold px-1.5 py-0.5 border-round inline-flex align-items-center gap-1">
                                                        <i className="pi pi-star-fill text-[9px] text-amber-600" />
                                                        PJ
                                                    </span>
                                                )}
                                                {option.value && (
                                                    <span className="text-xs text-500 font-normal">(No. SIP: {option.value})</span>
                                                )}
                                            </div>
                                        );
                                    }
                                    return <span>-- Pilih Nama Petugas / Dokter --</span>;
                                }}
                                itemTemplate={(option) => (
                                    <div className="flex align-items-center justify-content-between py-1 w-full">
                                        <div>
                                            <div className="flex align-items-center gap-2">
                                                <span className="font-bold text-900 text-sm">{option.nama || option.label}</span>
                                                {option.is_penanggung_jawab && (
                                                    <span className="text-[10px] bg-amber-100 text-amber-900 border-1 border-amber-400 font-extrabold px-1.5 py-0.5 border-round inline-flex align-items-center gap-1">
                                                        <i className="pi pi-star-fill text-[9px] text-amber-600" />
                                                        PJ
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-500 block">
                                                {option.jabatan ? `${option.jabatan.toUpperCase()} • ` : ''}No. SIP: {option.value || '-'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            />
                        </div>
                    </div>

                    {/* SECTION FOTO BEFORE (SEBELUM TREATMENT / KONSULTASI) */}
                    <div className="p-3 border-round-xl border-1 surface-border bg-white">
                        <label className="block text-xs font-extrabold text-700 uppercase tracking-wider mb-2 flex align-items-center gap-2">
                            <i className="pi pi-camera text-500 text-sm" />
                            FOTO BEFORE (SEBELUM TREATMENT / KONSULTASI)
                        </label>
                        <div className="flex flex-column sm:flex-row align-items-center gap-3">
                            {headerRMData.foto_before ? (
                                <div className="relative border-round-lg overflow-hidden border-1 surface-border" style={{ width: '120px', height: '120px' }}>
                                    <img
                                        src={headerRMData.foto_before}
                                        alt="Foto Before"
                                        className="w-full h-full object-cover"
                                    />
                                    {!isFormSaved && (
                                        <Button
                                            icon="pi pi-trash"
                                            severity="danger"
                                            rounded
                                            size="small"
                                            className="absolute top-0 right-0 m-1 p-button-sm"
                                            onClick={() => setHeaderRMData({ ...headerRMData, foto_before: '' })}
                                        />
                                    )}
                                </div>
                            ) : (
                                <div
                                    className="border-2 border-dashed border-300 border-round-xl flex flex-column align-items-center justify-content-center p-3 text-center cursor-pointer hover:border-500 bg-white"
                                    style={{ width: '100%', maxWidth: '240px', minHeight: '100px' }}
                                    onClick={() => !isFormSaved && document.getElementById('before_photo_input')?.click()}
                                >
                                    <i className="pi pi-upload text-500 text-2xl mb-1" />
                                    <span className="text-xs font-bold text-700">Unggah Foto Before</span>
                                    <span className="text-[10px] text-400">Format: JPG, PNG, WEBP</span>
                                </div>
                            )}
                            <input
                                id="before_photo_input"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleBeforePhotoUpload}
                                disabled={isFormSaved || uploadingBefore}
                            />
                        </div>
                    </div>

                    {/* 1. ANAMNESIS & RIWAYAT PASIEN */}
                    <div className="p-3 border-round-xl border-1 surface-border bg-white">
                        <label className="block text-xs font-extrabold text-700 uppercase tracking-wider mb-2 pb-2 border-bottom-1 surface-border flex align-items-center gap-2">
                            <i className="pi pi-book text-500 text-sm" />
                            1. ANAMNESIS &amp; RIWAYAT PASIEN (REKAM MEDIS)
                        </label>
                        <div className="grid formgrid p-fluid text-sm">
                            <div className="col-12 md:col-6 mb-3">
                                <label className="block text-xs font-semibold mb-1">Keluhan Utama Pasien</label>
                                <InputTextarea
                                    value={headerRMData.keluhan}
                                    onChange={(e) => setHeaderRMData({ ...headerRMData, keluhan: e.target.value })}
                                    rows={2}
                                    placeholder="Tuliskan keluhan utama pasien..."
                                    disabled={isFormSaved}
                                    className="w-full text-sm border-round-md"
                                />
                            </div>
                            <div className="col-12 md:col-6 mb-3">
                                <label className="block text-xs font-semibold mb-1">Durasi Keluhan</label>
                                <InputText
                                    value={headerRMData.durasi_keluhan}
                                    onChange={(e) => setHeaderRMData({ ...headerRMData, durasi_keluhan: e.target.value })}
                                    placeholder="Misal: 2 minggu, 1 bulan..."
                                    disabled={isFormSaved}
                                    className="w-full text-sm border-round-md"
                                />
                            </div>
                            <div className="col-12 md:col-6 mb-3">
                                <label className="block text-xs font-semibold mb-1">Riwayat Alergi Pasien</label>
                                <InputTextarea
                                    value={headerRMData.riwayat_alergi}
                                    onChange={(e) => setHeaderRMData({ ...headerRMData, riwayat_alergi: e.target.value })}
                                    rows={2}
                                    placeholder="Riwayat alergi obat / kosmetik / bahan..."
                                    disabled={isFormSaved}
                                    className="w-full text-sm border-round-md"
                                />
                            </div>
                            <div className="col-12 md:col-6 mb-3">
                                <label className="block text-xs font-semibold mb-1">Riwayat Treatment Sebelumnya</label>
                                <InputTextarea
                                    value={headerRMData.riwayat_treatment}
                                    onChange={(e) => setHeaderRMData({ ...headerRMData, riwayat_treatment: e.target.value })}
                                    rows={2}
                                    placeholder="Perawatan kulit/klinik yang pernah dikunjungi..."
                                    disabled={isFormSaved}
                                    className="w-full text-sm border-round-md"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. HASIL PEMERIKSAAN KULIT */}
                    <div className="p-3 border-round-xl border-1 surface-border bg-white">
                        <label className="block text-xs font-extrabold text-700 uppercase tracking-wider mb-2 pb-2 border-bottom-1 surface-border flex align-items-center gap-2">
                            <i className="pi pi-check-circle text-500 text-sm" />
                            2. HASIL PEMERIKSAAN KULIT
                        </label>
                        <div className="grid formgrid p-fluid text-sm">
                            <div className="col-12 md:col-4 mb-3">
                                <label className="block text-xs font-semibold mb-1">Pemeriksaan Acne</label>
                                <Dropdown
                                    value={headerRMData.pemeriksaan_acne}
                                    options={[
                                        { label: 'Tidak Ada', value: 'Tidak Ada' },
                                        { label: 'Ringan', value: 'Ringan' },
                                        { label: 'Sedang', value: 'Sedang' },
                                        { label: 'Berat', value: 'Berat' },
                                    ]}
                                    onChange={(e) => setHeaderRMData({ ...headerRMData, pemeriksaan_acne: e.value })}
                                    disabled={isFormSaved}
                                    className="w-full text-sm border-round-md"
                                />
                            </div>
                            <div className="col-12 md:col-4 mb-3">
                                <label className="block text-xs font-semibold mb-1">Pemeriksaan Inflammation</label>
                                <Dropdown
                                    value={headerRMData.pemeriksaan_inflammation}
                                    options={[
                                        { label: 'Tidak Ada', value: 'Tidak Ada' },
                                        { label: 'Ringan', value: 'Ringan' },
                                        { label: 'Sedang', value: 'Sedang' },
                                        { label: 'Berat', value: 'Berat' },
                                    ]}
                                    onChange={(e) => setHeaderRMData({ ...headerRMData, pemeriksaan_inflammation: e.value })}
                                    disabled={isFormSaved}
                                    className="w-full text-sm border-round-md"
                                />
                            </div>
                            <div className="col-12 md:col-4 mb-3">
                                <label className="block text-xs font-semibold mb-1">Jenis / Tipe Kulit</label>
                                <Dropdown
                                    value={headerRMData.pemeriksaan_skin_type}
                                    options={[
                                        { label: 'Normal', value: 'Normal' },
                                        { label: 'Kering', value: 'Kering' },
                                        { label: 'Berminyak', value: 'Berminyak' },
                                        { label: 'Kombinasi', value: 'Kombinasi' },
                                        { label: 'Sensitif', value: 'Sensitif' },
                                    ]}
                                    onChange={(e) => setHeaderRMData({ ...headerRMData, pemeriksaan_skin_type: e.value })}
                                    disabled={isFormSaved}
                                    className="w-full text-sm border-round-md"
                                />
                            </div>
                            <div className="col-12 md:col-6 mb-3">
                                <label className="block text-xs font-semibold mb-1">Pemeriksaan Pigmentasi</label>
                                <Dropdown
                                    value={headerRMData.pemeriksaan_pigmentation}
                                    options={[
                                        { label: 'Tidak Ada', value: 'Tidak Ada' },
                                        { label: 'Melasma', value: 'Melasma' },
                                        { label: 'PIH', value: 'PIH' },
                                        { label: 'Freckles', value: 'Freckles' },
                                        { label: 'Lentigo', value: 'Lentigo' },
                                    ]}
                                    onChange={(e) => setHeaderRMData({ ...headerRMData, pemeriksaan_pigmentation: e.value })}
                                    disabled={isFormSaved}
                                    className="w-full text-sm border-round-md"
                                />
                            </div>
                            <div className="col-12 md:col-6 mb-3">
                                <label className="block text-xs font-semibold mb-1">Sensitivitas Kulit</label>
                                <Dropdown
                                    value={headerRMData.pemeriksaan_sensitivity}
                                    options={[
                                        { label: 'Rendah', value: 'Rendah' },
                                        { label: 'Sedang', value: 'Sedang' },
                                        { label: 'Tinggi', value: 'Tinggi' },
                                    ]}
                                    onChange={(e) => setHeaderRMData({ ...headerRMData, pemeriksaan_sensitivity: e.value })}
                                    disabled={isFormSaved}
                                    className="w-full text-sm border-round-md"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. DIAGNOSIS DOKTER & SOAP MEDIS */}
                    <div className="p-3 border-round-xl border-1 surface-border bg-white">
                        <label className="block text-xs font-extrabold text-700 uppercase tracking-wider mb-2 pb-2 border-bottom-1 surface-border flex align-items-center gap-2">
                            <i className="pi pi-file-edit text-500 text-sm" />
                            3. DIAGNOSIS DOKTER &amp; SOAP MEDIS
                        </label>
                        <div className="grid formgrid p-fluid text-sm">
                            <div className="col-12 md:col-6 mb-3">
                                <label className="block text-xs font-semibold mb-1">Diagnosis Dokter</label>
                                <InputText
                                    value={headerRMData.diagnosis}
                                    onChange={(e) => setHeaderRMData({ ...headerRMData, diagnosis: e.target.value })}
                                    placeholder="Diagnosis medis..."
                                    disabled={isFormSaved}
                                    className="w-full text-sm border-round-md"
                                />
                            </div>
                            <div className="col-12 md:col-6 mb-3">
                                <label className="block text-xs font-semibold mb-1">SOAP (Plan / Perencanaan)</label>
                                <InputText
                                    value={headerRMData.plan}
                                    onChange={(e) => setHeaderRMData({ ...headerRMData, plan: e.target.value })}
                                    placeholder="Rencana penanganan / treatment..."
                                    disabled={isFormSaved}
                                    className="w-full text-sm border-round-md"
                                />
                            </div>
                            <div className="col-12 md:col-4 mb-3">
                                <label className="block text-xs font-semibold mb-1">SOAP (Subjective)</label>
                                <InputTextarea
                                    value={headerRMData.subjective}
                                    onChange={(e) => setHeaderRMData({ ...headerRMData, subjective: e.target.value })}
                                    rows={2}
                                    placeholder="Catatan subjektif pasien..."
                                    disabled={isFormSaved}
                                    className="w-full text-sm border-round-md"
                                />
                            </div>
                            <div className="col-12 md:col-4 mb-3">
                                <label className="block text-xs font-semibold mb-1">SOAP (Objective)</label>
                                <InputTextarea
                                    value={headerRMData.objective}
                                    onChange={(e) => setHeaderRMData({ ...headerRMData, objective: e.target.value })}
                                    rows={2}
                                    placeholder="Catatan objektif fisik..."
                                    disabled={isFormSaved}
                                    className="w-full text-sm border-round-md"
                                />
                            </div>
                            <div className="col-12 md:col-4 mb-3">
                                <label className="block text-xs font-semibold mb-1">SOAP (Assessment)</label>
                                <InputTextarea
                                    value={headerRMData.assessment}
                                    onChange={(e) => setHeaderRMData({ ...headerRMData, assessment: e.target.value })}
                                    rows={2}
                                    placeholder="Penilaian klinis dokter..."
                                    disabled={isFormSaved}
                                    className="w-full text-sm border-round-md"
                                />
                            </div>
                        </div>
                    </div>

                    {/* KONTROL UI: LANJUT KE TREATMENT? (HANYA JIKA BUKAN DARI KONSULTASI WAJIB) */}
                    {!((activePatient as any)?.wajib_konsultasi === 'wajib' || (activePatient?.nama_layanan && !activePatient.nama_layanan.toLowerCase().includes('konsul'))) && (
                        <div className="p-3 surface-50 border-round-lg border-1 surface-border flex align-items-center justify-content-between">
                            <div>
                                <span className="font-bold text-sm text-900 block">Lanjut ke Treatment Sesi Ini?</span>
                                <span className="text-xs text-500">Jika Ya, sistem otomatis menerbitkan antrean di ruang tindakan pasien tanpa daftar ulang.</span>
                            </div>
                            <div className="flex align-items-center gap-3">
                                <div className="flex align-items-center gap-1">
                                    <Checkbox
                                        inputId="lanjut_ya_active"
                                        checked={lanjutKeTindakan}
                                        disabled={isFormSaved}
                                        onChange={(e) => setLanjutKeTindakan(true)}
                                    />
                                    <label htmlFor="lanjut_ya_active" className="text-sm font-bold text-700 cursor-pointer">Ya (Lanjut Treatment)</label>
                                </div>
                                <div className="flex align-items-center gap-1">
                                    <Checkbox
                                        inputId="lanjut_tidak_active"
                                        checked={!lanjutKeTindakan}
                                        disabled={isFormSaved}
                                        onChange={(e) => {
                                            setLanjutKeTindakan(false);
                                            setRekomendasiItems((prev) => prev.filter((i) => ['produk', 'paket_produk'].includes(i.jenis)));
                                        }}
                                    />
                                    <label htmlFor="lanjut_tidak_active" className="text-sm font-bold text-500 cursor-pointer">Tidak</label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION INFORMASI TERDAFTAR TREATMENT ATAU PILIH REKOMENDASI */}
                    {lanjutKeTindakan && (
                        ((activePatient as any)?.wajib_konsultasi === 'wajib' || (activePatient?.nama_layanan && !activePatient.nama_layanan.toLowerCase().includes('konsul'))) ? (
                            <div className="surface-card p-4 border-round-xl border-1 surface-border bg-teal-50/80 shadow-1 flex align-items-center justify-content-between">
                                <div className="flex align-items-center gap-3">
                                    <div className="w-3rem h-3rem border-circle bg-teal-100 flex align-items-center justify-content-center text-teal-700">
                                        <i className="pi pi-check-circle text-2xl" />
                                    </div>
                                    <div>
                                        <span className="font-extrabold text-teal-900 text-sm block">PASIEN TERDAFTAR TREATMENT: {activePatient.nama_layanan}</span>
                                        <span className="text-xs text-teal-700">Setelah sesi konsultasi disimpan, sistem otomatis menerbitkan antrean ke ruang tindakan untuk perawatan ini.</span>
                                    </div>
                                </div>
                                <Tag value="Treatment Terdaftar" severity="info" className="px-3 py-1 font-bold text-xs" />
                            </div>
                        ) : (
                            <RekomendasiTreatmentPanel
                                toast={toast}
                                selectedItems={rekomendasiItems}
                                onChangeSelectedItems={setRekomendasiItems}
                                disabled={isFormSaved}
                            />
                        )
                    )}

                    {/* SECTION CATATAN DOKTER / OBSERVASI KONSULTASI */}
                    <div className="p-3 border-round-xl border-1 surface-border bg-white">
                        <label className="block text-xs font-extrabold text-700 uppercase tracking-wider mb-2 flex align-items-center gap-2">
                            <i className="pi pi-pencil text-500 text-sm" />
                            CATATAN DOKTER &amp; OBSERVASI KONSULTASI
                        </label>
                        <InputTextarea
                            value={catatanPetugas}
                            onChange={(e) => setCatatanPetugas(e.target.value)}
                            rows={4}
                            placeholder="Tuliskan rincian hasil konsultasi, resep, atau catatan khusus observasi pasien..."
                            disabled={isFormSaved}
                            className="w-full text-sm border-round-md bg-white border-300"
                        />
                    </div>

                    {/* SAVE ACTION FOOTER BAR */}
                    <div className="flex align-items-center justify-content-end gap-3 mt-2 pt-3 border-top-1 surface-border">
                        {isFormSaved ? (
                            <Tag value="✅ Form Penanganan & Konsultasi Telah Disimpan & Dikunci" severity="success" className="px-3 py-2 text-xs font-bold" />
                        ) : (
                            <Button
                                label="Simpan Form & Selesaikan Konsultasi"
                                icon="pi pi-check-circle"
                                severity="success"
                                size="small"
                                loading={saving}
                                onClick={() => handleSaveForm('selesai')}
                                className="font-bold text-xs bg-teal-600 border-none border-round-lg px-4 text-white shadow-2"
                            />
                        )}
                    </div>
                </div>
            ) : (
                /* RUANG TINDAKAN VIEW */
                <div className="flex flex-column gap-0">
                    {/* TAB HEADER FOR TREATMENT ROOM */}
                    <div className="flex flex-column sm:flex-row align-items-center justify-content-between p-3 bg-white border-bottom-1 surface-border gap-2">
                        <div className="flex align-items-center gap-2 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={() => setActiveStep('form')}
                                className={`flex align-items-center gap-2 px-3 py-2 border-round-lg font-bold text-xs cursor-pointer border-none transition-all ${
                                    activeStep === 'form'
                                        ? 'bg-teal-700 text-white shadow-2'
                                        : 'surface-card text-700 hover:surface-200 border-1 surface-border'
                                }`}
                            >
                                <span>1. Form Penanganan Ruangan</span>
                            </button>

                            <i className="pi pi-chevron-right text-400 text-sm hidden sm:inline-block" />

                            <button
                                type="button"
                                onClick={() => setActiveStep('hasil')}
                                className={`flex align-items-center gap-2 px-3 py-2 border-round-lg font-bold text-xs cursor-pointer border-none transition-all ${
                                    activeStep === 'hasil'
                                        ? 'bg-teal-700 text-white shadow-2'
                                        : 'surface-card text-700 hover:surface-200 border-1 surface-border'
                                }`}
                            >
                                <span>2. Hasil Treatment (Foto After) &amp; Rekomendasi Produk</span>
                            </button>
                        </div>

                        {activeStep === 'hasil' && (
                            <Button
                                label="Kembali ke Form Penanganan"
                                icon="pi pi-arrow-left"
                                outlined
                                size="small"
                                severity="secondary"
                                className="text-xs font-bold border-round-lg"
                                onClick={() => setActiveStep('form')}
                            />
                        )}
                    </div>

                    {activeStep === 'form' ? (
                        /* TAB 1: FORM PENANGANAN RUANGAN TINDAKAN */
                        <div className="p-3 sm:p-4 flex flex-column gap-4 bg-white">
                            {/* SECTION PETUGAS / DOKTER PENANGGUNG JAWAB (SESUAI SIP) */}
                            <div className="p-3 border-round-xl border-1 surface-border bg-white">
                                <div className="flex align-items-center justify-content-between mb-2 pb-2 border-bottom-1 surface-border">
                                    <label className="text-xs font-extrabold text-700 uppercase tracking-wider flex align-items-center gap-2 m-0">
                                        <i className="pi pi-user text-500 text-sm" />
                                        PETUGAS / DOKTER PELAKSANA TINDAKAN (SESUAI SIP)
                                    </label>
                                    <span className="text-[10px] text-500 font-semibold">
                                        {petugasJagaList && petugasJagaList.length > 0 ? `${petugasJagaList.length} Petugas Piket` : 'Tersimpan berdasar No. SIP'}
                                    </span>
                                </div>
                                {petugasJagaList && petugasJagaList.length > 1 && (
                                    <div className="mb-2 text-xs text-600 bg-amber-50 border-1 border-amber-200 border-round p-2 flex align-items-center gap-2">
                                        <i className="pi pi-info-circle text-amber-600 text-xs" />
                                        <span>Tersedia {petugasJagaList.length} petugas piket hari ini. Penanggung Jawab ruangan dipilih default; silakan ubah jika tindakan dilakukan oleh petugas pendamping.</span>
                                    </div>
                                )}
                                <div className="p-fluid">
                                    <Dropdown
                                        value={selectedPetugas}
                                        options={availablePetugasOptions}
                                        onChange={(e) => setSelectedPetugas(e.value)}
                                        placeholder="-- Pilih Nama Petugas / Dokter --"
                                        filter
                                        filterBy="label,value,nama"
                                        showClear
                                        disabled={isFormSaved}
                                        className="w-full text-sm border-round-md shadow-1 bg-white"
                                        valueTemplate={(option) => {
                                            if (option) {
                                                return (
                                                    <div className="flex align-items-center gap-2">
                                                        <span className="font-bold text-900">{option.nama || option.label}</span>
                                                        {option.is_penanggung_jawab && (
                                                            <span className="text-[10px] bg-amber-100 text-amber-900 border-1 border-amber-400 font-extrabold px-1.5 py-0.5 border-round inline-flex align-items-center gap-1">
                                                                <i className="pi pi-star-fill text-[9px] text-amber-600" />
                                                                PJ
                                                            </span>
                                                        )}
                                                        {option.value && (
                                                            <span className="text-xs text-500 font-normal">(No. SIP: {option.value})</span>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            return <span>-- Pilih Nama Petugas / Dokter --</span>;
                                        }}
                                        itemTemplate={(option) => (
                                            <div className="flex align-items-center justify-content-between py-1 w-full">
                                                <div>
                                                    <div className="flex align-items-center gap-2">
                                                        <span className="font-bold text-900 text-sm">{option.nama || option.label}</span>
                                                        {option.is_penanggung_jawab && (
                                                            <span className="text-[10px] bg-amber-100 text-amber-900 border-1 border-amber-400 font-extrabold px-1.5 py-0.5 border-round inline-flex align-items-center gap-1">
                                                                <i className="pi pi-star-fill text-[9px] text-amber-600" />
                                                                PJ
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-500 block">
                                                        {option.jabatan ? `${option.jabatan.toUpperCase()} • ` : ''}No. SIP: {option.value || '-'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* 1. DISPLAY FORM HASIL KONSULTASI DOKTER DI RUANG TINDAKAN (READ-ONLY) */}
                            {hasDataKonsul && (
                                <div className="p-3 border-round-xl border-1 surface-border bg-white">
                                    <div className="flex align-items-center gap-2 mb-3 pb-2 border-bottom-1 surface-border">
                                        <i className="pi pi-file-edit text-500 text-sm" />
                                        <span className="font-extrabold text-700 text-xs uppercase tracking-wider">FORM HASIL KONSULTASI DOKTER (DARI SESI KONSULTASI)</span>
                                    </div>
                                    <div className="grid text-xs">
                                        {(dataKonsul.data_konsultasi_foto_before || dataKonsul.foto_before) && (
                                            <div className="col-12 mb-3">
                                                <span className="font-semibold text-color-secondary block mb-1">Foto Before (Sebelum Treatment):</span>
                                                <img
                                                    src={dataKonsul.data_konsultasi_foto_before || dataKonsul.foto_before}
                                                    alt="Foto Before"
                                                    className="border-round-lg border-1 surface-border shadow-1"
                                                    style={{ maxWidth: '160px', maxHeight: '160px', objectFit: 'cover' }}
                                                />
                                            </div>
                                        )}
                                        <div className="col-12 md:col-6 mb-3">
                                            <span className="font-semibold text-color-secondary block mb-1">Keluhan Utama Pasien:</span>
                                            <span className="font-bold text-900 text-sm block">{dataKonsul.data_konsultasi_keluhan || '-'}</span>
                                        </div>
                                        <div className="col-12 md:col-6 mb-3">
                                            <span className="font-semibold text-color-secondary block mb-1">Riwayat Alergi:</span>
                                            <span className="font-bold text-red-600 text-sm block">{dataKonsul.data_konsultasi_riwayat_alergi || 'Tidak Ada'}</span>
                                        </div>
                                        <div className="col-12 md:col-6 mb-3">
                                            <span className="font-semibold text-color-secondary block mb-1">Diagnosis Dokter:</span>
                                            <span className="font-bold text-900 text-sm block">{dataKonsul.data_konsultasi_diagnosis || '-'}</span>
                                        </div>
                                        <div className="col-12 md:col-6 mb-3">
                                            <span className="font-semibold text-color-secondary block mb-1">Rencana Penanganan (SOAP Plan):</span>
                                            <span className="font-bold text-900 text-sm block">{dataKonsul.data_konsultasi_plan || dataKonsul.data_konsultasi_assessment || '-'}</span>
                                        </div>

                                        {extraFormFields.length > 0 && (
                                            <div className="col-12 mt-2 pt-2 border-top-1 surface-border grid">
                                                <span className="font-bold text-700 block col-12 mb-1">Catatan Isian Tambahan Konsultasi:</span>
                                                {extraFormFields.map((ef, idx) => (
                                                    <div key={idx} className="col-12 md:col-6 mb-1">
                                                        <span className="font-semibold text-color-secondary block">{ef.label}:</span>
                                                        <span className="font-bold text-900">{ef.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* SECTION CATATAN PETUGAS / OBSERVASI RUANGAN */}
                            <div className="p-3 border-round-xl border-1 surface-border bg-white">
                                <label className="block text-xs font-extrabold text-700 uppercase tracking-wider mb-2 flex align-items-center gap-2">
                                    <i className="pi pi-pencil text-500 text-sm" />
                                    CATATAN PETUGAS &amp; OBSERVASI TINDAKAN RUANGAN
                                </label>
                                <InputTextarea
                                    value={catatanPetugas}
                                    onChange={(e) => setCatatanPetugas(e.target.value)}
                                    rows={4}
                                    placeholder="Tuliskan rincian hasil tindakan, obat/alat yang digunakan, resep, atau catatan khusus observasi pasien saat berada di ruangan ini..."
                                    disabled={isFormSaved}
                                    className="w-full text-sm border-round-md bg-white border-300"
                                />
                            </div>

                            {/* ACTION FOOTER BAR: LANJUT KE STEP 2 */}
                            <div className="flex align-items-center justify-content-end gap-3 mt-2 pt-3 border-top-1 surface-border">
                                <Button
                                    label="Selanjutnya →"
                                    icon="pi pi-arrow-right"
                                    iconPos="right"
                                    severity="success"
                                    size="small"
                                    onClick={() => {
                                        if (!selectedPetugas) {
                                            showError(toast, 'Petugas / Dokter Penanggung Jawab wajib dipilih!');
                                            return;
                                        }
                                        setActiveStep('hasil');
                                    }}
                                    className="font-bold text-xs bg-teal-600 border-none border-round-lg px-4 text-white shadow-2"
                                />
                            </div>
                        </div>
                    ) : (
                        /* TAB 2: PANEL HASIL TREATMENT & REKOMENDASI PRODUK KASIR */
                        <div className="p-3 sm:p-4 bg-white">
                            <HasilTreatmentPanel
                                activePatient={activePatient}
                                toast={toast}
                                getGridData={getGridData}
                                kodeRuangan={kodeRuangan}
                                namaRuangan={namaRuangan}
                                savedFormData={formData}
                                savedCatatanPetugas={catatanPetugas}
                                savedPetugasNama={karyawanOptions.find((k) => k.value === selectedPetugas)?.nama}
                                selectedPetugas={selectedPetugas}
                                onHasilSavedChange={(saved) => setIsHasilSaved(saved)}
                            />
                        </div>
                    )}
                </div>
            )}
            </div>

            {/* CONFIRM DIALOG & HASIL MODAL */}
            <Dialog
                visible={showConfirmModal && !showHasilModal}
                onHide={() => setShowConfirmModal(false)}
                header="Konfirmasi Penanganan & Rekomendasi"
                style={{ width: '480px' }}
                modal
                className="p-fluid"
                footer={
                    <div className="flex justify-content-end gap-2">
                        <Button
                            label="Batal"
                            icon="pi pi-times"
                            className="p-button-outlined p-button-secondary text-xs"
                            onClick={() => setShowConfirmModal(false)}
                        />
                        <Button
                            label="Ya, Simpan & Terbitkan"
                            icon="pi pi-check"
                            className="p-button-success font-bold text-xs"
                            onClick={handleConfirmAccept}
                        />
                    </div>
                }
            >
                <div className="flex flex-column gap-3 py-1 text-left">
                    <div className="p-3 border-round-xl" style={{ background: '#f0fdfa', border: '1.5px solid #99f6e4' }}>
                        <span className="text-[10px] font-bold uppercase block" style={{ color: '#0d9488' }}>Pasien Aktif</span>
                        <span className="font-extrabold text-sm block" style={{ color: '#134e4a' }}>{activePatient?.nama_pasien || hasilPasienNama || 'Pasien'}</span>
                        <span className="text-xs" style={{ color: '#0f766e' }}>No. RM: {activePatient?.no_rm || hasilNoRm} | Ruangan: {namaRuangan}</span>
                    </div>

                    <div className="flex flex-column gap-2">
                        {rekomendasiItems.filter((i) => ['layanan', 'paket_layanan'].includes(i.jenis)).length > 0 && (
                            <div className="p-3 border-round-xl text-xs" style={{ background: '#f0fdfa', border: '1.5px solid #5eead4' }}>
                                <span className="font-bold block mb-1" style={{ color: '#0f766e' }}>
                                    <i className="pi pi-ticket mr-1" />
                                    Menerbitkan {rekomendasiItems.filter((i) => ['layanan', 'paket_layanan'].includes(i.jenis)).length} Nomor Antrean Layanan:
                                </span>
                                <span className="font-semibold" style={{ color: '#115e59' }}>{rekomendasiItems.filter((i) => ['layanan', 'paket_layanan'].includes(i.jenis)).map((l) => l.nama).join(', ')}</span>
                            </div>
                        )}

                        {rekomendasiItems.filter((i) => ['produk', 'paket_produk'].includes(i.jenis)).length > 0 && (
                            <div className="p-3 border-round-xl text-xs" style={{ background: '#fffbeb', border: '1.5px solid #fcd34d' }}>
                                <span className="font-bold block mb-1" style={{ color: '#b45309' }}>
                                    <i className="pi pi-shopping-bag mr-1" />
                                    Memasukkan {rekomendasiItems.filter((i) => ['produk', 'paket_produk'].includes(i.jenis)).length} Produk ke Draf Transaksi Kasir:
                                </span>
                                <span className="font-semibold" style={{ color: '#78350f' }}>{rekomendasiItems.filter((i) => ['produk', 'paket_produk'].includes(i.jenis)).map((p) => `${p.nama} (${p.qty || 1}x)`).join(', ')}</span>
                            </div>
                        )}
                    </div>

                    <p className="text-xs text-gray-700 m-0">
                        Apakah Anda yakin ingin menyimpan hasil penanganan &amp; menerbitkan nomor antrean/transaksi untuk pasien ini?
                    </p>
                </div>
            </Dialog>

            <DialogHasilTerbitAntrian
                visible={showHasilModal}
                onHide={() => setShowHasilModal(false)}
                pasienNama={hasilPasienNama}
                noRm={hasilNoRm}
                kodeKunjungan={hasilKodeKunjungan}
                antrianList={hasilAntrianList}
                transaksiDraft={hasilTransaksiDraft}
            />

            {/* DRAWER PANEL RIWAYAT PASIEN */}
            <DrawerRiwayatPasien
                visible={drawerRiwayatVisible}
                onHide={() => setDrawerRiwayatVisible(false)}
                noRm={activePatient?.no_rm || ''}
                namaPasien={activePatient?.nama_pasien || ''}
                excludeKodeKunjungan={activePatient?.kode_kunjungan || ''}
                toast={toast}
            />
        </>
    );
};

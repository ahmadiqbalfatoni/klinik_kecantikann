'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Checkbox } from 'primereact/checkbox';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import { OverlayPanel } from 'primereact/overlaypanel';
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
    Users,
    ChevronDown,
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
    const [isEditingBookingPetugas, setIsEditingBookingPetugas] = useState<boolean>(false);

    const isBookingPatient = Boolean(activePatient?.kode_booking);
    const bookingNoSip = (activePatient as any)?.booking_no_sip || (isBookingPatient ? activePatient?.kode_karyawan : null);
    const bookingNamaPetugas = (activePatient as any)?.booking_nama_petugas || (isBookingPatient ? activePatient?.nama_petugas : null);
    const bookingKodeJadwal = (activePatient as any)?.booking_kode_jadwal;

    // State & Ref Petugas Pendamping
    const [companionList, setCompanionList] = useState<any[]>([]);
    const companionOpRef = useRef<OverlayPanel>(null);

    // Helper untuk mengekstrak no_sip murni dari value option (bisa berupa no_sip atau no_sip#kode_jadwal)
    const extractNoSip = (val?: string) => (val ? String(val).split('#')[0] : '');

    const isDoctorChangedFromBooking = isBookingPatient && Boolean(selectedPetugas) && extractNoSip(selectedPetugas) !== bookingNoSip;


    // Hitung options petugas: prioritaskan petugas piket hari ini di ruangan ini & dokter booking
    const availablePetugasOptions = useMemo(() => {
        let baseList: any[] = [];
        if (petugasJagaList && petugasJagaList.length > 0) {
            // Deduplikasi defensif per sesi (no_sip + jam_mulai + jam_selesai)
            // Sesi yang jamnya sama persis digabung jadi 1 entri (dengan mempertahankan is_penanggung_jawab = 1)
            // Shift kerja yang berbeda di hari yang sama tetap terhitung dan muncul sebagai entri terpisah
            const shiftMap = new Map<string, any>();
            for (const p of petugasJagaList) {
                const jmMulai = (p.jam_mulai || '').slice(0, 5);
                const jmSelesai = (p.jam_selesai || '').slice(0, 5);
                const shiftKey = `${p.no_sip || p.kode_jadwal}_${jmMulai}_${jmSelesai}`;
                if (!shiftMap.has(shiftKey)) {
                    shiftMap.set(shiftKey, { ...p, jam_mulai_clean: jmMulai, jam_selesai_clean: jmSelesai });
                } else {
                    const existing = shiftMap.get(shiftKey);
                    if ((p.is_penanggung_jawab === 1 || p.is_penanggung_jawab === true) && !existing.is_penanggung_jawab) {
                        existing.is_penanggung_jawab = 1;
                    }
                }
            }

            baseList = Array.from(shiftMap.values()).map((p: any) => {
                const isPj = p.is_penanggung_jawab === 1 || p.is_penanggung_jawab === true;
                const isBooking = isBookingPatient && bookingNoSip && p.no_sip === bookingNoSip;
                const jamLabel = p.jam_mulai_clean && p.jam_selesai_clean ? ` [${p.jam_mulai_clean} - ${p.jam_selesai_clean}]` : '';

                // Label lengkap: jika dokter booking kebetulan adalah PJ ruangan, tampilkan KEDUA badge secara harmonis
                let tagStr = '';
                if (isBooking) tagStr += ' ★ [Pilihan Booking]';
                if (isPj) tagStr += ' ★ [PJ]';

                const optValue = p.kode_jadwal ? `${p.no_sip}#${p.kode_jadwal}` : p.no_sip;

                return {
                    label: `${p.nama_karyawan || p.nama}${p.jabatan ? ` (${p.jabatan.toUpperCase()})` : ''}${jamLabel}${tagStr}`,
                    value: optValue,
                    nama: p.nama_karyawan || p.nama,
                    jabatan: p.jabatan,
                    no_sip: p.no_sip,
                    kode_jadwal: p.kode_jadwal,
                    jam_mulai: p.jam_mulai,
                    jam_selesai: p.jam_selesai,
                    is_penanggung_jawab: isPj,
                    is_booking_choice: Boolean(isBooking),
                };
            });
        } else {
            baseList = (karyawanOptions || []).map((k: any) => {
                const isBooking = isBookingPatient && bookingNoSip && k.value === bookingNoSip;
                return {
                    ...k,
                    label: `${k.nama}${k.jabatan ? ` (${k.jabatan.toUpperCase()})` : ''}${isBooking ? ' ★ [Pilihan Booking]' : ''}`,
                    is_booking_choice: Boolean(isBooking),
                };
            });
        }

        // Jika pasien berasal dari booking dan dokter booking belum ada di baseList, sisipkan di awal
        if (isBookingPatient && bookingNoSip && !baseList.some((opt) => (opt.no_sip || opt.value) === bookingNoSip)) {
            baseList.unshift({
                label: `${bookingNamaPetugas || 'Petugas/Dokter Booking'}${activePatient?.booking_jabatan_petugas ? ` (${activePatient.booking_jabatan_petugas.toUpperCase()})` : ''} ★ [Pilihan Booking]`,
                value: bookingNoSip,
                nama: bookingNamaPetugas || 'Petugas/Dokter Booking',
                jabatan: activePatient?.booking_jabatan_petugas || 'Dokter',
                no_sip: bookingNoSip,
                is_penanggung_jawab: false,
                is_booking_choice: true,
            });
        }

        return baseList;
    }, [petugasJagaList, karyawanOptions, isBookingPatient, bookingNoSip, bookingNamaPetugas, activePatient]);

    const currentSelectedOfficer = useMemo(() => {
        const selNoSip = extractNoSip(selectedPetugas);
        return (
            availablePetugasOptions.find((opt) => opt.value === selectedPetugas) ||
            availablePetugasOptions.find((opt) => opt.no_sip === selNoSip || opt.value === selNoSip) ||
            karyawanOptions.find((k) => k.value === selNoSip || k.no_sip === selNoSip) ||
            (selNoSip === bookingNoSip ? {
                nama: bookingNamaPetugas || 'Dokter Pilihan Booking',
                value: bookingNoSip,
                no_sip: bookingNoSip,
                jabatan: (activePatient as any)?.booking_jabatan_petugas || 'Dokter',
                is_booking_choice: true,
                is_penanggung_jawab: false,
            } : null)
        );
    }, [availablePetugasOptions, karyawanOptions, selectedPetugas, bookingNoSip, bookingNamaPetugas, activePatient]);

    // Load Daftar Petugas Pendamping untuk sesi ini (kode_ruangan + hari + jam_mulai + jam_selesai sama dengan PJ)
    useEffect(() => {
        let isMounted = true;

        const loadCompanions = async () => {
            if (!isBookingPatient) {
                setCompanionList([]);
                return;
            }

            // 1. Inisialisasi awal dari field booking_petugas_pendamping jika sudah dibawa oleh activePatient
            const directCompanions = (activePatient as any)?.booking_petugas_pendamping;
            if (Array.isArray(directCompanions) && directCompanions.length > 0) {
                if (isMounted) setCompanionList(directCompanions);
            }

            // 2. Query data petugas dengan is_penanggung_jawab = 0 yang memiliki kombinasi kode_ruangan + hari + jam_mulai + jam_selesai sama persis
            try {
                const room = kodeRuangan || activePatient?.kode_ruangan || (activePatient as any)?.booking_kode_ruangan;
                const days = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
                let dayName = (activePatient as any)?.booking_hari;
                if (!dayName && (activePatient as any)?.booking_tanggal_booking) {
                    dayName = days[new Date((activePatient as any).booking_tanggal_booking).getDay()];
                }
                if (!dayName) {
                    dayName = days[new Date().getDay()];
                }

                if (!room || !dayName) return;

                const res = await postData('/master/jadwal-karyawan-data', {
                    kode_ruangan: room,
                    hari: dayName.toLowerCase(),
                    status: 'aktif',
                });

                if (!isMounted) return;

                const allSchedules: any[] = res.data?.data || [];
                const targetMulai = (currentSelectedOfficer?.jam_mulai || (activePatient as any)?.booking_jam_mulai || '').slice(0, 5);
                const targetSelesai = (currentSelectedOfficer?.jam_selesai || (activePatient as any)?.booking_jam_selesai || '').slice(0, 5);
                const targetSip = currentSelectedOfficer?.no_sip || bookingNoSip;

                const matched = allSchedules.filter((item: any) => {
                    const isPj = item.is_penanggung_jawab === 1 || item.is_penanggung_jawab === true;
                    const itmMulai = (item.jam_mulai || '').slice(0, 5);
                    const itmSelesai = (item.jam_selesai || '').slice(0, 5);
                    const itmSip = item.no_sip;

                    return (
                        !isPj &&
                        itmMulai === targetMulai &&
                        itmSelesai === targetSelesai &&
                        itmSip !== targetSip
                    );
                });

                // Deduplikasi unik berdasarkan no_sip / kode_jadwal
                const seen = new Set<string>();
                const deduped: any[] = [];
                for (const c of matched) {
                    const key = c.no_sip || c.kode_jadwal || c.nama_karyawan;
                    if (key && !seen.has(key)) {
                        seen.add(key);
                        deduped.push({
                            kode_jadwal: c.kode_jadwal,
                            no_sip: c.no_sip,
                            nama_petugas: c.nama_karyawan || c.nama,
                            jabatan_petugas: c.jabatan,
                        });
                    }
                }

                setCompanionList(deduped);
            } catch (_) {
                // Fallback ke petugasJagaList jika network query gagal
                if (petugasJagaList && petugasJagaList.length > 0) {
                    const targetMulai = (currentSelectedOfficer?.jam_mulai || (activePatient as any)?.booking_jam_mulai || '').slice(0, 5);
                    const targetSelesai = (currentSelectedOfficer?.jam_selesai || (activePatient as any)?.booking_jam_selesai || '').slice(0, 5);
                    const targetSip = currentSelectedOfficer?.no_sip || bookingNoSip;

                    const matched = petugasJagaList.filter((item: any) => {
                        const isPj = item.is_penanggung_jawab === 1 || item.is_penanggung_jawab === true;
                        const itmMulai = (item.jam_mulai || '').slice(0, 5);
                        const itmSelesai = (item.jam_selesai || '').slice(0, 5);
                        const itmSip = item.no_sip;
                        return (
                            !isPj &&
                            itmMulai === targetMulai &&
                            itmSelesai === targetSelesai &&
                            itmSip !== targetSip
                        );
                    }).map((c: any) => ({
                        kode_jadwal: c.kode_jadwal,
                        no_sip: c.no_sip,
                        nama_petugas: c.nama_karyawan || c.nama,
                        jabatan_petugas: c.jabatan,
                    }));

                    if (isMounted) setCompanionList(matched);
                }
            }
        };

        loadCompanions();

        return () => {
            isMounted = false;
        };
    }, [isBookingPatient, activePatient, currentSelectedOfficer, kodeRuangan, bookingNoSip, petugasJagaList]);

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
            const ap = activePatient as any;
            const isBooking = Boolean(ap.kode_booking);
            const bookingSip = ap.booking_no_sip || (isBooking ? ap.kode_karyawan : null);

            if (activePatient.kode_antrian_layanan !== currentAntrianId) {
                setCurrentAntrianId(activePatient.kode_antrian_layanan);
                setIsEditingBookingPetugas(false);
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

                let defaultPetugas = '';
                if (isBooking && bookingSip) {
                    const matched = availablePetugasOptions.find((opt) => 
                        (bookingKodeJadwal && opt.kode_jadwal === bookingKodeJadwal) ||
                        (opt.no_sip === bookingSip)
                    );
                    defaultPetugas = matched?.value || bookingSip;
                } else if (activePatient.kode_karyawan) {
                    const matched = availablePetugasOptions.find((opt) => opt.no_sip === activePatient.kode_karyawan);
                    defaultPetugas = matched?.value || activePatient.kode_karyawan;
                } else if (availablePetugasOptions.length > 0) {
                    const pj = availablePetugasOptions.find((p: any) => p.is_penanggung_jawab) || availablePetugasOptions[0];
                    defaultPetugas = pj?.value || '';
                }
                setSelectedPetugas(defaultPetugas);

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
            } else if (isBooking && bookingSip && (!selectedPetugas || extractNoSip(selectedPetugas) !== bookingSip) && !isFormSaved && !isEditingBookingPetugas && !isDoctorChangedFromBooking) {
                const matched = availablePetugasOptions.find((opt) => 
                    (bookingKodeJadwal && opt.kode_jadwal === bookingKodeJadwal) ||
                    (opt.no_sip === bookingSip)
                );
                setSelectedPetugas(matched?.value || bookingSip);
            } else if (activePatient.kode_karyawan && !selectedPetugas) {
                const matched = availablePetugasOptions.find((opt) => opt.no_sip === activePatient.kode_karyawan);
                setSelectedPetugas(matched?.value || activePatient.kode_karyawan);
            } else if (!selectedPetugas && availablePetugasOptions.length > 0) {
                const pj = availablePetugasOptions.find((p: any) => p.is_penanggung_jawab) || availablePetugasOptions[0];
                setSelectedPetugas(pj?.value || '');
            }
        } else {
            setCurrentAntrianId('');
            setIsEditingBookingPetugas(false);
            setFormData({});
            setCatatanPetugas('');
            setRekomendasiItems([]);
            setSelectedPetugas('');
            setActiveStep('form');
            setIsFormSaved(false);
            setIsHasilSaved(false);
        }
    }, [activePatient?.kode_antrian_layanan, activePatient, isKonsultasi, availablePetugasOptions, currentAntrianId, selectedPetugas, isFormSaved]);

    useEffect(() => {
        if (!selectedPetugas) {
            if (isBookingPatient && bookingNoSip) {
                const matched = availablePetugasOptions.find((opt) => 
                    (bookingKodeJadwal && opt.kode_jadwal === bookingKodeJadwal) ||
                    (opt.no_sip === bookingNoSip)
                );
                setSelectedPetugas(matched?.value || bookingNoSip);
            } else if (availablePetugasOptions.length > 0) {
                const pj = availablePetugasOptions.find((p: any) => p.is_penanggung_jawab) || availablePetugasOptions[0];
                if (pj?.value) setSelectedPetugas(pj.value);
            }
        }
    }, [availablePetugasOptions, selectedPetugas, isBookingPatient, bookingNoSip, bookingKodeJadwal]);

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
            const finalNoSip = currentSelectedOfficer?.no_sip || extractNoSip(selectedPetugas) || selectedPetugas;
            const payload: any = {
                kode_antrian_layanan: activePatient.kode_antrian_layanan,
                kode_karyawan: finalNoSip,
                no_sip: finalNoSip,
                hasil_form: formData,
                header_data: headerRMData,
                lanjut_ke_tindakan: lanjutKeTindakan ? 1 : 0,
                catatan_petugas: catatanPetugas,
                rekomendasi_items: rekomendasiItems,
                diubah_dari_booking: isDoctorChangedFromBooking,
                petugas_asal_booking: bookingNamaPetugas || null,
                no_sip_asal_booking: bookingNoSip || null,
                petugas_pengganti: currentSelectedOfficer?.nama || selectedPetugas,
                catatan_perubahan_petugas: isDoctorChangedFromBooking
                    ? `Petugas diubah dari jadwal booking (${bookingNamaPetugas} - ${bookingNoSip}) ke (${currentSelectedOfficer?.nama || selectedPetugas} - ${finalNoSip})`
                    : null,
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
                activePatient.nama_petugas = currentSelectedOfficer?.nama || activePatient.nama_petugas;
                activePatient.kode_karyawan = finalNoSip;
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

    const renderPetugasSelector = () => (
        <div className="p-3 border-round-xl border-1 surface-border bg-white">
            <div className="flex align-items-center justify-content-between mb-3 pb-2 border-bottom-1 surface-border">
                <label className="text-xs font-extrabold text-700 uppercase tracking-wider flex align-items-center gap-2 m-0">
                    <i className="pi pi-user text-500 text-sm" />
                    PETUGAS / DOKTER PELAKSANA TINDAKAN (SESUAI SIP)
                </label>
                <span className="text-[10px] text-500 font-semibold">
                    {isBookingPatient ? (
                        <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 border-round border-1 border-blue-200">
                            Booking: {activePatient?.kode_booking}
                        </span>
                    ) : petugasJagaList && petugasJagaList.length > 0 ? (
                        `${petugasJagaList.length} Petugas Piket`
                    ) : (
                        'Tersimpan berdasar No. SIP'
                    )}
                </span>
            </div>

            {/* ALERT JIKA DOKTER TELAH DIUBAH DARI PILIHAN BOOKING */}
            {isBookingPatient && isDoctorChangedFromBooking && (
                <div className="mb-3 text-xs text-amber-900 bg-amber-50 border-1 border-amber-300 border-round-lg p-2.5 flex align-items-center justify-content-between gap-2">
                    <div className="flex align-items-center gap-2">
                        <i className="pi pi-exclamation-triangle text-amber-600 text-sm flex-shrink-0" />
                        <span>
                            Petugas pelaksana telah diubah dari dokter booking asal (<strong>{bookingNamaPetugas}</strong>) menjadi <strong>{currentSelectedOfficer?.nama || selectedPetugas}</strong>.
                        </span>
                    </div>
                    <span className="text-[10px] bg-amber-100 text-amber-900 border-1 border-amber-400 font-extrabold px-2 py-0.5 border-round inline-flex align-items-center gap-1 flex-shrink-0">
                        Diubah dari Booking
                    </span>
                </div>
            )}

            {/* INFO UNTUK PASIEN WALK-IN DENGAN >1 PETUGAS PIKET */}
            {!isBookingPatient && petugasJagaList && petugasJagaList.length > 1 && (
                <div className="mb-3 text-xs text-600 bg-amber-50 border-1 border-amber-200 border-round-lg p-2.5 flex align-items-center gap-2">
                    <i className="pi pi-info-circle text-amber-600 text-xs flex-shrink-0" />
                    <span>Tersedia {petugasJagaList.length} petugas piket hari ini. Penanggung Jawab ruangan dipilih default; silakan ubah jika tindakan dilakukan oleh petugas pendamping.</span>
                </div>
            )}

            {/* FORM / KOTAK PILIHAN PETUGAS */}
            {isBookingPatient && !isEditingBookingPetugas ? (
                /* 1. TAMPILAN RINGKAS PETUGAS DARI BOOKING */
                <div className="flex flex-column sm:flex-row align-items-start sm:align-items-center justify-content-between p-3 border-round-lg border-1 surface-border bg-gray-50 gap-3">
                    <div className="flex align-items-center gap-3 flex-wrap">
                        <div className="w-2.5rem h-2.5rem border-circle bg-teal-50 border-1 border-teal-200 text-teal-700 flex align-items-center justify-content-center text-sm font-bold flex-shrink-0">
                            <i className="pi pi-user text-teal-600 text-base" />
                        </div>
                        <div>
                            <div className="flex align-items-center gap-2 flex-wrap">
                                <span className="font-bold text-900 text-sm">
                                    {currentSelectedOfficer?.nama || bookingNamaPetugas || 'Dokter Pemeriksa'}
                                </span>

                                <div className="flex align-items-center gap-1 ml-1">
                                    {!isDoctorChangedFromBooking ? (
                                        <span className="text-[10px] bg-blue-50 text-blue-700 border-1 border-blue-200 font-bold px-1.5 py-0.5 border-round inline-flex align-items-center gap-1 shadow-none">
                                            <i className="pi pi-check text-[9px] text-blue-600 font-bold" />
                                            Sesuai Booking
                                        </span>
                                    ) : (
                                        <span className="text-[10px] bg-amber-50 text-amber-800 border-1 border-amber-300 font-bold px-1.5 py-0.5 border-round inline-flex align-items-center gap-1 shadow-none">
                                            <i className="pi pi-exclamation-triangle text-[9px] text-amber-600 font-bold" />
                                            Diubah dari Booking
                                        </span>
                                    )}

                                    {currentSelectedOfficer?.is_penanggung_jawab && (
                                        <span className="text-[10px] bg-amber-50 text-amber-800 border-1 border-amber-200 font-bold px-1.5 py-0.5 border-round inline-flex align-items-center gap-1 shadow-none">
                                            <i className="pi pi-star-fill text-[9px] text-amber-500" />
                                            PJ
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex align-items-center gap-2 mt-1 text-xs text-500 flex-wrap">
                                {currentSelectedOfficer?.jabatan && (
                                    <span className="font-semibold text-600">{currentSelectedOfficer.jabatan.toUpperCase()}</span>
                                )}
                                {currentSelectedOfficer?.jabatan && (
                                    <span className="text-400 select-none">•</span>
                                )}
                                {currentSelectedOfficer?.jam_mulai && currentSelectedOfficer?.jam_selesai && (
                                    <>
                                        <span className="font-medium text-teal-700">
                                            [{currentSelectedOfficer.jam_mulai.slice(0, 5)} - {currentSelectedOfficer.jam_selesai.startsWith('24:00') ? '00:00' : currentSelectedOfficer.jam_selesai.slice(0, 5)}]
                                        </span>
                                        <span className="text-400 select-none">•</span>
                                    </>
                                )}
                                <span>No. SIP: <span className="text-700 font-medium">{currentSelectedOfficer?.no_sip || extractNoSip(selectedPetugas) || bookingNoSip || '-'}</span></span>
                                {isDoctorChangedFromBooking && (
                                    <>
                                        <span className="text-400 select-none">•</span>
                                        <span className="text-amber-700 italic">
                                            Asal Booking: {bookingNamaPetugas}
                                        </span>
                                    </>
                                )}

                                {companionList.length > 0 && (
                                    <>
                                        <span className="text-400 select-none">•</span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                companionOpRef.current?.toggle(e);
                                            }}
                                            className="group inline-flex align-items-center gap-1 text-teal-700 hover:text-teal-900 font-semibold cursor-pointer border-none bg-transparent p-0 transition-colors outline-none"
                                            title="Klik untuk melihat daftar petugas pendamping"
                                        >
                                            <Users size={12} className="text-teal-600 group-hover:text-teal-800 flex-shrink-0" />
                                            <span className="underline underline-offset-2 hover:text-teal-900">
                                                + {companionList.length} petugas pendamping
                                            </span>
                                            <ChevronDown size={11} className="text-teal-600 group-hover:text-teal-800 flex-shrink-0" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* TOMBOL UBAH PETUGAS & RESET */}
                    <div className="flex align-items-center gap-2 flex-shrink-0 self-start sm:self-center ml-auto">
                        {isDoctorChangedFromBooking && !isFormSaved && (
                            <Button
                                type="button"
                                label="Kembalikan ke Booking"
                                icon="pi pi-replay"
                                size="small"
                                text
                                severity="secondary"
                                className="text-xs font-semibold px-2.5 py-1.5"
                                tooltip={`Kembalikan ke dokter pilihan pasien (${bookingNamaPetugas})`}
                                tooltipOptions={{ position: 'bottom' }}
                                onClick={() => {
                                    const bookingOpt = availablePetugasOptions.find((opt) => opt.no_sip === bookingNoSip);
                                    setSelectedPetugas(bookingOpt?.value || bookingNoSip || '');
                                }}
                            />
                        )}
                        {!isFormSaved && (
                            <Button
                                type="button"
                                label="Ubah Petugas"
                                icon="pi pi-user-edit"
                                size="small"
                                outlined
                                severity="secondary"
                                className="text-xs font-semibold px-3 py-1.5 border-round-lg shadow-none border-300 hover:border-500 text-700 hover:text-900 bg-white"
                                tooltip="Gunakan jika dokter berhalangan mendadak"
                                tooltipOptions={{ position: 'bottom' }}
                                onClick={() => setIsEditingBookingPetugas(true)}
                            />
                        )}
                    </div>
                </div>
            ) : (
                /* 2. MODE EDIT PETUGAS / WALK-IN: SEARCH BOX & DROPDOWN LENGKAP */
                <div className="flex flex-column gap-2">
                    <div className="flex align-items-center gap-2">
                        <div className="flex-1 p-fluid">
                            <Dropdown
                                value={selectedPetugas}
                                options={availablePetugasOptions}
                                onChange={(e) => {
                                    if (e.value) {
                                        setSelectedPetugas(e.value);
                                        if (isBookingPatient) {
                                            setIsEditingBookingPetugas(false);
                                        }
                                    }
                                }}
                                placeholder="-- Pilih Nama Petugas / Dokter --"
                                filter
                                filterBy="label,value,nama"
                                showClear={false}
                                disabled={isFormSaved}
                                className="w-full text-sm border-round-md shadow-1 bg-white"
                                valueTemplate={(option) => {
                                    if (option) {
                                        const matchesBooking = isBookingPatient && bookingNoSip && (option.no_sip === bookingNoSip || extractNoSip(option.value) === bookingNoSip);
                                        return (
                                            <div className="flex align-items-center gap-2 flex-wrap">
                                                <span className="font-bold text-900">{option.nama || option.label}</span>
                                                {matchesBooking && (
                                                    <span className="text-[10px] bg-blue-100 text-blue-900 border-1 border-blue-400 font-extrabold px-1.5 py-0.5 border-round inline-flex align-items-center gap-1">
                                                        <i className="pi pi-check text-[9px] text-blue-600" />
                                                        Sesuai Booking
                                                    </span>
                                                )}
                                                {option.is_penanggung_jawab && (
                                                    <span className="text-[10px] bg-amber-100 text-amber-900 border-1 border-amber-400 font-extrabold px-1.5 py-0.5 border-round inline-flex align-items-center gap-1">
                                                        <i className="pi pi-star-fill text-[9px] text-amber-600" />
                                                        PJ
                                                    </span>
                                                )}
                                                <span className="text-xs text-500 font-normal">(No. SIP: {option.no_sip || extractNoSip(option.value) || '-'})</span>
                                            </div>
                                        );
                                    }
                                    return <span>-- Pilih Nama Petugas / Dokter --</span>;
                                }}
                                itemTemplate={(option) => (
                                    <div className="flex align-items-center justify-content-between py-1 w-full">
                                        <div>
                                            <div className="flex align-items-center gap-2 flex-wrap">
                                                <span className="font-bold text-900 text-sm">{option.nama || option.label}</span>
                                                {option.is_booking_choice && (
                                                    <span className="text-[10px] bg-blue-100 text-blue-900 border-1 border-blue-400 font-extrabold px-1.5 py-0.5 border-round inline-flex align-items-center gap-1">
                                                        <i className="pi pi-check text-[9px] text-blue-600" />
                                                        Sesuai Booking
                                                    </span>
                                                )}
                                                {option.is_penanggung_jawab && (
                                                    <span className="text-[10px] bg-amber-100 text-amber-900 border-1 border-amber-400 font-extrabold px-1.5 py-0.5 border-round inline-flex align-items-center gap-1">
                                                        <i className="pi pi-star-fill text-[9px] text-amber-600" />
                                                        PJ
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-500 block">
                                                {option.jabatan ? `${option.jabatan.toUpperCase()} • ` : ''}
                                                {option.jam_mulai && option.jam_selesai ? `Shift: ${option.jam_mulai.slice(0, 5)} - ${option.jam_selesai.slice(0, 5)} • ` : ''}
                                                No. SIP: {option.no_sip || extractNoSip(option.value) || '-'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            />
                        </div>
                        {isBookingPatient && (
                            <Button
                                type="button"
                                label="Batal"
                                icon="pi pi-times"
                                size="small"
                                outlined
                                severity="danger"
                                className="text-xs font-semibold px-3 py-2 border-round-md flex-shrink-0"
                                tooltip="Batalkan perubahan dan kembali ke dokter semula"
                                tooltipOptions={{ position: 'bottom' }}
                                onClick={() => setIsEditingBookingPetugas(false)}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Popover Detail Petugas Pendamping */}
            <OverlayPanel ref={companionOpRef} className="shadow-4 border-round-xl p-0" style={{ maxWidth: '340px' }}>
                <div className="p-3">
                    <div className="font-bold text-sm text-900 mb-1 flex align-items-center gap-1.5">
                        <Users size={16} className="text-teal-600" />
                        <span>Daftar Petugas Pendamping</span>
                    </div>
                    <div className="text-xs text-500 mb-2.5 pb-2 border-bottom-1 surface-border line-height-2">
                        PJ: <span className="font-semibold text-800">{currentSelectedOfficer?.nama || bookingNamaPetugas || 'Petugas PJ'}</span>
                        <br />
                        <span className="text-[11px] text-400">
                            {currentSelectedOfficer?.jam_mulai && currentSelectedOfficer?.jam_selesai
                                ? `[${currentSelectedOfficer.jam_mulai.slice(0, 5)} - ${currentSelectedOfficer.jam_selesai.startsWith('24:00') ? '00:00' : currentSelectedOfficer.jam_selesai.slice(0, 5)}]`
                                : (activePatient as any)?.booking_jam_mulai && (activePatient as any)?.booking_jam_selesai
                                ? `[${String((activePatient as any).booking_jam_mulai).slice(0, 5)} - ${String((activePatient as any).booking_jam_selesai).slice(0, 5)}]`
                                : ''} · {namaRuangan || activePatient?.nama_ruangan || 'Ruang Tindakan'}
                        </span>
                    </div>
                    <div className="flex flex-column gap-2 max-h-12rem overflow-y-auto pr-1">
                        {companionList.map((c, idx) => (
                            <div key={c.kode_jadwal || idx} className="flex align-items-center gap-2 p-2 border-round surface-50 text-xs">
                                <span className="w-1.5rem h-1.5rem border-circle bg-teal-100 text-teal-800 flex align-items-center justify-content-center font-bold text-xs flex-shrink-0">
                                    {idx + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-800 text-overflow-ellipsis overflow-hidden white-space-nowrap">
                                        {c.nama_petugas || c.nama_karyawan || c.nama}
                                    </div>
                                    <div className="text-[10px] text-500 flex align-items-center gap-1.5 mt-0.5 flex-wrap">
                                        {(c.jabatan_petugas || c.jabatan) && (
                                            <span className="font-medium text-600 uppercase">
                                                {c.jabatan_petugas || c.jabatan}
                                            </span>
                                        )}
                                        {(c.jabatan_petugas || c.jabatan) && c.no_sip && <span>•</span>}
                                        {c.no_sip && (
                                            <span>No. SIP: <span className="font-medium text-700">{c.no_sip}</span></span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </OverlayPanel>
        </div>
    );

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
                                        <span>Petugas: <strong className="text-white">{currentSelectedOfficer?.nama || activePatient.nama_petugas}</strong></span>
                                        {isDoctorChangedFromBooking && (
                                            <span className="text-[10px] bg-amber-500 text-white font-bold px-1.5 py-0.5 border-round">
                                                (Diubah)
                                            </span>
                                        )}
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
                    {renderPetugasSelector()}

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
                            {renderPetugasSelector()}

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

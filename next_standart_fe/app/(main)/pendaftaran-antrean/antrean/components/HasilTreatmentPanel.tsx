'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Toast } from 'primereact/toast';
import { Dialog } from 'primereact/dialog';
import { Tag } from 'primereact/tag';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import postData from '@/lib/axios/postData';
import { showError, showSuccess } from '@/lib/tools/generalTools';
import { AntrianLayananData } from './interfaces';
import {
    CheckCircle2,
    Trash2,
    Plus,
    Minus,
    Sparkles,
    ShoppingBag,
    Tag as TagIcon,
    Loader2,
    ShieldCheck,
    X,
    Ticket,
    User
} from 'lucide-react';

interface ProdukItem {
    kode_produk: string;
    nama: string;
    harga_jual: number;
    satuan?: string;
}

interface SelectedProduk {
    kode_produk: string;
    nama: string;
    harga_jual: number;
    satuan?: string;
    qty: number;
}

interface HasilTreatmentPanelProps {
    activePatient: AntrianLayananData | null;
    toast: React.RefObject<Toast>;
    getGridData: () => void;
    kodeRuangan: string;
    namaRuangan: string;
    savedFormData?: Record<string, any>;
    savedCatatanPetugas?: string;
    savedPetugasNama?: string;
    selectedPetugas?: string;
    initialFotoBeforeUrl?: string;
    onFotoBeforeChange?: (url: string) => void;
    onHasilSavedChange?: (saved: boolean) => void;
}

const formatRupiah = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);

export const HasilTreatmentPanel: React.FC<HasilTreatmentPanelProps> = ({
    activePatient,
    toast,
    getGridData,
    kodeRuangan,
    namaRuangan,
    savedFormData,
    savedCatatanPetugas,
    savedPetugasNama,
    selectedPetugas,
    initialFotoBeforeUrl = '',
    onFotoBeforeChange,
    onHasilSavedChange,
}) => {
    // Foto Before & After state
    const [fotoBeforeUrl, setFotoBeforeUrl] = useState<string>(initialFotoBeforeUrl || '');
    const [uploadingFotoBefore, setUploadingFotoBefore] = useState<boolean>(false);
    const fileInputBeforeRef = useRef<HTMLInputElement>(null);

    const [fotoAfterUrl, setFotoAfterUrl] = useState<string>('');
    const [uploadingFoto, setUploadingFoto] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Produk Dropdown & Selection state
    const [produkOptions, setProdukOptions] = useState<ProdukItem[]>([]);
    const [loadingProduk, setLoadingProduk] = useState<boolean>(false);
    const [searchProduk, setSearchProduk] = useState<string>('');
    const [selectedProdukList, setSelectedProdukList] = useState<SelectedProduk[]>([]);

    // State Biaya Custom
    const [showCustomFeeModal, setShowCustomFeeModal] = useState<boolean>(false);
    const [customFeeNama, setCustomFeeNama] = useState<string>('');
    const [customFeeHarga, setCustomFeeHarga] = useState<number | null>(null);

    // Layanan Pasien Pendaftaran State
    const [layananPasienList, setLayananPasienList] = useState<any[]>([]);
    const [loadingLayanan, setLoadingLayanan] = useState<boolean>(false);

    // Catatan treatment
    const [catatan, setCatatan] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);

    // Setelah submit, kunci semua input agar tidak bisa diubah lagi
    const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

    // Modal Konfirmasi Persetujuan
    const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

    const handleAddCustomFee = () => {
        if (isSubmitted) return;
        if (!customFeeNama.trim()) {
            showError(toast, 'Nama biaya / produk custom wajib diisi!');
            return;
        }
        if (!customFeeHarga || customFeeHarga <= 0) {
            showError(toast, 'Nominal harga wajib lebih dari 0!');
            return;
        }

        const customItem: SelectedProduk = {
            kode_produk: `CST-${Date.now().toString().slice(-10)}`,
            nama: customFeeNama.trim(),
            harga_jual: customFeeHarga,
            satuan: 'item',
            qty: 1,
        };

        setSelectedProdukList((prev) => [...prev, customItem]);
        setShowCustomFeeModal(false);
        setCustomFeeNama('');
        setCustomFeeHarga(null);
        showSuccess(toast, 'Biaya tambahan custom berhasil ditambahkan!');
    };

    useEffect(() => {
        fetchProdukOptions();
    }, []);

    const loadExistingRekomendasiProduk = async (kodeKunjungan: string) => {
        if (!kodeKunjungan) return;
        try {
            const res = await postData('/master/kunjungan-produk-rekomendasi', { kode_kunjungan: kodeKunjungan });
            const list = res.data?.data || [];
            if (list.length > 0) {
                const mapped: SelectedProduk[] = list.map((item: any) => ({
                    kode_produk: item.kode_produk,
                    nama: item.nama,
                    harga_jual: parseFloat(item.harga_jual || 0),
                    satuan: item.satuan || 'pcs',
                    qty: parseInt(item.qty || 1, 10),
                }));
                setSelectedProdukList(mapped);
            }
        } catch (_) {
            // silent fail
        }
    };

    const loadLayananPasien = async (kodeKunjungan: string) => {
        setLoadingLayanan(true);
        try {
            const res = await postData('/master/antrian-layanan-pendaftaran-items', {
                kode_kunjungan: kodeKunjungan,
            });
            if (['00', '0000'].includes(res.data?.status) && res.data?.data?.length > 0) {
                setLayananPasienList(res.data.data);
            } else if ((activePatient as any)?.details && (activePatient as any).details.length > 0) {
                setLayananPasienList((activePatient as any).details);
            } else {
                setLayananPasienList([]);
            }
        } catch (_) {
            if ((activePatient as any)?.details && (activePatient as any).details.length > 0) {
                setLayananPasienList((activePatient as any).details);
            } else {
                setLayananPasienList([]);
            }
        } finally {
            setLoadingLayanan(false);
        }
    };

    // Reset state & auto-load rekomendasi produk & layanan pasien saat pasien berganti
    useEffect(() => {
        setIsSubmitted(false);
        onHasilSavedChange?.(false);
        setFotoBeforeUrl(initialFotoBeforeUrl || savedFormData?.foto_before || (activePatient as any)?.foto_before || '');
        setFotoAfterUrl('');
        setCatatan('');
        setSelectedProdukList([]);

        if (activePatient?.kode_kunjungan) {
            loadExistingRekomendasiProduk(activePatient.kode_kunjungan);
            loadLayananPasien(activePatient.kode_kunjungan);
        } else if ((activePatient as any)?.details && (activePatient as any).details.length > 0) {
            setLayananPasienList((activePatient as any).details);
        } else {
            setLayananPasienList([]);
        }
    }, [activePatient?.kode_antrian_layanan, activePatient?.kode_kunjungan, initialFotoBeforeUrl]);

    const fetchProdukOptions = async (keyword = '') => {
        setLoadingProduk(true);
        try {
            const res = await postData('/master/produk-dropdown', { search: keyword });
            const list: ProdukItem[] = (res.data?.data || [])
                .filter((p: any) => !String(p.kode_produk || '').startsWith('CUSTOM-') && !String(p.kode_produk || '').startsWith('CST-'))
                .map((p: any) => ({
                    kode_produk: p.kode_produk,
                    nama: p.nama,
                    harga_jual: parseFloat(p.harga_jual || 0),
                    satuan: p.satuan || 'pcs',
                }));
            setProdukOptions(list);
        } catch (_) {
            showError(toast, 'Gagal memuat daftar produk');
        } finally {
            setLoadingProduk(false);
        }
    };

    // Upload Foto Before
    const handleBeforeFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isSubmitted) return;
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showError(toast, 'File harus berupa gambar (JPG, PNG, WEBP, dll)');
            return;
        }

        setUploadingFotoBefore(true);
        try {
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(file);
            });

            const res = await postData('/master/ruangan-form-upload-foto', {
                image_base64: base64,
                file_name: file.name,
                prefix: 'before',
            });

            if (res?.data?.status === 200 || res?.status === 200) {
                const filePath = res.data?.data?.file_path || res.data?.file_path || '';
                setFotoBeforeUrl(filePath);
                onFotoBeforeChange?.(filePath);
                showSuccess(toast, 'Foto Before berhasil diunggah!');
            } else {
                showError(toast, res?.data?.message || 'Gagal mengunggah foto');
            }
        } catch (_) {
            showError(toast, 'Gagal memproses gambar');
        } finally {
            setUploadingFotoBefore(false);
        }
    };

    // Upload Foto After
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isSubmitted) return;
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showError(toast, 'File harus berupa gambar (JPG, PNG, WEBP, dll)');
            return;
        }

        setUploadingFoto(true);
        try {
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(file);
            });

            const res = await postData('/master/ruangan-form-upload-foto', {
                image_base64: base64,
                file_name: file.name,
                prefix: 'after',
            });

            if (res?.data?.status === 200 || res?.status === 200) {
                const filePath = res.data?.data?.file_path || res.data?.file_path || '';
                setFotoAfterUrl(filePath);
                showSuccess(toast, 'Foto After berhasil diunggah!');
            } else {
                showError(toast, res?.data?.message || 'Gagal mengunggah foto');
            }
        } catch (_) {
            showError(toast, 'Gagal memproses gambar');
        } finally {
            setUploadingFoto(false);
        }
    };

    // Guard untuk mencegah double-trigger / duplicate click event
    const lastAddRef = useRef<{ kode: string; time: number }>({ kode: '', time: 0 });

    // Tambahkan produk ke daftar terpilih
    const handleAddProduk = (prod: ProdukItem) => {
        if (isSubmitted) return;

        // Cegah eksekusi ganda jika terpanggil lebih dari 1x dalam interval sangat cepat (< 250ms)
        const now = Date.now();
        if (lastAddRef.current.kode === prod.kode_produk && now - lastAddRef.current.time < 250) {
            return;
        }
        lastAddRef.current = { kode: prod.kode_produk, time: now };

        setSelectedProdukList((prev) => {
            const existingIndex = prev.findIndex((p) => p.kode_produk === prod.kode_produk);
            if (existingIndex > -1) {
                return prev.map((p, idx) =>
                    idx === existingIndex ? { ...p, qty: p.qty + 1 } : p
                );
            }
            return [...prev, { ...prod, qty: 1 }];
        });
    };

    // Update Qty produk
    const handleUpdateQty = (kode_produk: string, delta: number) => {
        if (isSubmitted) return;
        setSelectedProdukList((prev) =>
            prev
                .map((p) => {
                    if (p.kode_produk === kode_produk) {
                        const newQty = p.qty + delta;
                        return newQty > 0 ? { ...p, qty: newQty } : null;
                    }
                    return p;
                })
                .filter((p): p is SelectedProduk => p !== null)
        );
    };

    // Remove produk
    const handleRemoveProduk = (kode_produk: string) => {
        if (isSubmitted) return;
        setSelectedProdukList((prev) => prev.filter((p) => p.kode_produk !== kode_produk));
    };

    // Calculate Total
    const grandTotal = selectedProdukList.reduce((acc, curr) => acc + curr.qty * curr.harga_jual, 0);
    const totalHargaLayanan = layananPasienList.reduce((acc, curr) => acc + parseFloat(curr.harga || 0), 0);

    // Click Simpan & Setujui
    const handleSaveClick = () => {
        if (!activePatient) {
            showError(toast, 'Tidak ada pasien aktif yang dipilih');
            return;
        }
        setShowConfirmModal(true);
    };

    const handleConfirmSubmit = async () => {
        if (!activePatient) return;
        setShowConfirmModal(false);
        setSubmitting(true);

        try {
            const payload = {
                kode_kunjungan: activePatient.kode_kunjungan,
                no_rm: activePatient.no_rm,
                kode_rekam_medis: activePatient.kode_antrian_layanan,
                kode_antrian_layanan: activePatient.kode_antrian_layanan,
                kode_ruangan: kodeRuangan,
                nama_ruangan: namaRuangan,
                foto_before: fotoBeforeUrl,
                foto_after: fotoAfterUrl,
                catatan: catatan,
                catatan_petugas: savedCatatanPetugas,
                hasil_form: {
                    ...(savedFormData || {}),
                    ...(fotoBeforeUrl ? { foto_before: fotoBeforeUrl } : {}),
                    ...(fotoAfterUrl ? { foto_after: fotoAfterUrl } : {}),
                },
                kode_karyawan: selectedPetugas || activePatient.kode_karyawan,
                produk_items: selectedProdukList.map((p) => ({
                    kode_produk: p.kode_produk,
                    nama: p.nama,
                    qty: p.qty,
                    harga_jual: p.harga_jual,
                    satuan: p.satuan || 'pcs',
                })),
            };

            const res = await postData('/master/hasil-treatment-save', payload);

            if (res?.data?.status === 200 || res?.status === 200) {
                showSuccess(
                    toast,
                    res.data?.message || 'Hasil treatment & rekomendasi produk berhasil disimpan ke kasir!'
                );

                // Kunci form setelah berhasil simpan tanpa mengosongkan nilainya
                setIsSubmitted(true);
                onHasilSavedChange?.(true);

                // Refresh data grid
                getGridData();
            } else {
                showError(toast, res?.data?.message || 'Gagal menyimpan hasil treatment');
            }
        } catch (error: any) {
            showError(toast, error?.response?.data?.message || 'Terjadi kesalahan saat menyimpan');
        } finally {
            setSubmitting(false);
        }
    };

    // Filter produk options berdasarkan search text
    const filteredProdukOptions = produkOptions.filter(
        (p) =>
            !searchProduk ||
            p.nama.toLowerCase().includes(searchProduk.toLowerCase()) ||
            p.kode_produk.toLowerCase().includes(searchProduk.toLowerCase())
    );

    return (
        <div className="card shadow-2 border-round-xl p-4 surface-card border-top-3 border-teal-500 mb-4">
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .lucide-spin {
                    animation: spin 1s linear infinite;
                }
                .treatment-summary-card:hover {
                    border-color: #5eead4 !important;
                    box-shadow: 0 4px 10px rgba(13, 148, 136, 0.1) !important;
                    transform: translateY(-1px);
                }
                /* Custom Thin & Sleek Scrollbar */
                .custom-thin-scrollbar {
                    scrollbar-width: thin;
                    scrollbar-color: #cbd5e1 transparent;
                }
                .custom-thin-scrollbar::-webkit-scrollbar {
                    width: 5px;
                    height: 5px;
                }
                .custom-thin-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-thin-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 9999px;
                }
                .custom-thin-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: #94a3b8;
                }
            `}</style>
            {/* Header persis disamakan dengan Form Penanganan */}
            <div className="mb-3 border-bottom-1 surface-border pb-3">
                <h3 className="text-xl font-black text-teal-900 m-0 flex align-items-center gap-2">
                    <i className="pi pi-file-edit text-teal-600 text-2xl" />
                    Hasil Treatment &amp; Rekomendasi Produk Pasien
                </h3>
                <p className="text-xs text-500 m-0 mt-1">
                    Isi foto setelah tindakan (After), catatan hasil treatment, dan pilih produk tambahan untuk diteruskan langsung ke kasir.
                </p>
            </div>

            <div className="grid">
                {/* ── SEKSI KIRI: DOKUMENTASI FOTO BEFORE & AFTER + CATATAN ── */}
                <div className="col-12 lg:col-5 flex flex-column gap-3">
                    {/* Dokumentasi Foto Before & After Container */}
                    <div className="p-3 surface-50 border-round-xl border-1 surface-border flex flex-column gap-3">
                        <div className="flex align-items-center justify-content-between pb-2 border-bottom-1 surface-border">
                            <label className="text-xs font-extrabold text-teal-800 uppercase tracking-wider flex align-items-center gap-2 m-0">
                                <i className="pi pi-camera text-teal-600 text-sm" />
                                DOKUMENTASI FOTO BEFORE &amp; AFTER
                            </label>
                            <span className="text-[10px] text-500 font-semibold">Dokumentasi Tindakan</span>
                        </div>

                        {/* 1. Foto Before Box */}
                        <div className="surface-card p-3 border-round-lg border-1 surface-border">
                            <div className="flex align-items-center justify-content-between mb-2">
                                <span className="text-xs font-bold text-700 flex align-items-center gap-1.5">
                                    <span>📷</span> FOTO BEFORE (SEBELUM TINDAKAN)
                                </span>
                                {fotoBeforeUrl && (
                                    <Tag value="Tersedia" severity="success" className="text-[10px] px-2 py-0" />
                                )}
                            </div>

                            <input
                                type="file"
                                ref={fileInputBeforeRef}
                                onChange={handleBeforeFileSelect}
                                accept="image/*"
                                style={{ display: 'none' }}
                            />

                            {fotoBeforeUrl ? (
                                <div className="relative border-round-lg overflow-hidden border-1 border-teal-400 shadow-1 text-center bg-teal-50/40 p-2">
                                    <img
                                        src={fotoBeforeUrl}
                                        alt="Foto Before"
                                        style={{ maxHeight: '150px', width: '100%', objectFit: 'cover', borderRadius: '6px' }}
                                    />
                                    {!isSubmitted && (
                                        <div className="flex gap-2 mt-2 justify-content-center">
                                            <Button
                                                label="Ganti Foto"
                                                icon="pi pi-refresh"
                                                size="small"
                                                outlined
                                                severity="info"
                                                onClick={() => fileInputBeforeRef.current?.click()}
                                                loading={uploadingFotoBefore}
                                                className="text-xs font-bold p-1 px-2"
                                            />
                                            <Button
                                                label="Hapus"
                                                icon="pi pi-trash"
                                                size="small"
                                                outlined
                                                severity="danger"
                                                onClick={() => {
                                                    setFotoBeforeUrl('');
                                                    onFotoBeforeChange?.('');
                                                }}
                                                className="text-xs font-bold p-1 px-2"
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div
                                    onClick={() => !isSubmitted && fileInputBeforeRef.current?.click()}
                                    className={`border-2 border-dashed border-300 bg-white border-round-lg p-3 text-center transition-all ${
                                        isSubmitted ? 'opacity-60' : 'cursor-pointer hover:surface-100 hover:border-teal-400'
                                    }`}
                                >
                                    {uploadingFotoBefore ? (
                                        <div className="py-2">
                                            <ProgressSpinner style={{ width: '24px', height: '24px' }} />
                                            <p className="text-xs text-500 m-0 mt-1">Mengunggah Foto Before...</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <i className="pi pi-cloud-upload text-2xl text-teal-600 mb-1" />
                                            <p className="font-bold text-xs m-0 text-700">Unggah Foto Before (Sebelum Tindakan)</p>
                                            <p className="text-[10px] text-400 m-0 mt-0.5">Format JPG, PNG, WEBP (Maks 5MB)</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 2. Foto After Box */}
                        <div className="surface-card p-3 border-round-lg border-1 surface-border">
                            <div className="flex align-items-center justify-content-between mb-2">
                                <span className="text-xs font-bold text-700 flex align-items-center gap-1.5">
                                    <span>✨</span> FOTO AFTER (SESUDAH TINDAKAN)
                                </span>
                                {fotoAfterUrl && (
                                    <Tag value="Tersedia" severity="success" className="text-[10px] px-2 py-0" />
                                )}
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept="image/*"
                                style={{ display: 'none' }}
                            />

                            {fotoAfterUrl ? (
                                <div className="relative border-round-lg overflow-hidden border-1 border-teal-500 shadow-1 text-center bg-teal-50/40 p-2">
                                    <img
                                        src={fotoAfterUrl}
                                        alt="Foto After"
                                        style={{ maxHeight: '150px', width: '100%', objectFit: 'cover', borderRadius: '6px' }}
                                    />
                                    {!isSubmitted && (
                                        <div className="flex gap-2 mt-2 justify-content-center">
                                            <Button
                                                label="Ganti Foto"
                                                icon="pi pi-refresh"
                                                size="small"
                                                outlined
                                                severity="info"
                                                onClick={() => fileInputRef.current?.click()}
                                                loading={uploadingFoto}
                                                className="text-xs font-bold p-1 px-2"
                                            />
                                            <Button
                                                label="Hapus"
                                                icon="pi pi-trash"
                                                size="small"
                                                outlined
                                                severity="danger"
                                                onClick={() => setFotoAfterUrl('')}
                                                className="text-xs font-bold p-1 px-2"
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div
                                    onClick={() => !isSubmitted && fileInputRef.current?.click()}
                                    className={`border-2 border-dashed border-300 bg-white border-round-lg p-3 text-center transition-all ${
                                        isSubmitted ? 'opacity-60' : 'cursor-pointer hover:surface-100 hover:border-teal-400'
                                    }`}
                                >
                                    {uploadingFoto ? (
                                        <div className="py-2">
                                            <ProgressSpinner style={{ width: '24px', height: '24px' }} />
                                            <p className="text-xs text-500 m-0 mt-1">Mengunggah Foto After...</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <i className="pi pi-cloud-upload text-2xl text-teal-600 mb-1" />
                                            <p className="font-bold text-xs m-0 text-700">Unggah Foto After (Sesudah Tindakan)</p>
                                            <p className="text-[10px] text-400 m-0 mt-0.5">Format JPG, PNG, WEBP (Maks 5MB)</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Catatan Dokter Box */}
                    <div className="p-3 surface-50 border-round-xl border-1 surface-border flex-1 flex flex-column">
                        <label className="block text-xs font-extrabold text-teal-800 uppercase tracking-wider mb-2 flex align-items-center gap-2">
                            <i className="pi pi-pencil text-teal-600 text-sm" />
                            CATATAN HASIL TREATMENT (OPSIONAL)
                        </label>
                        <InputTextarea
                            value={catatan}
                            onChange={(e) => setCatatan(e.target.value)}
                            placeholder="Catatan hasil penanganan, kondisi kulit pasien setelah treatment, atau instruksi tindak lanjut..."
                            disabled={isSubmitted}
                            className="w-full text-sm border-round-md shadow-1 bg-white border-300 focus:border-teal-500 flex-1 p-3"
                            style={{ resize: 'none', minHeight: '90px' }}
                        />
                    </div>
                </div>

                {/* ── SEKSI KANAN: PRODUK TAMBAHAN KASIR ── */}
                <div className="col-12 lg:col-7">
                    <div className="p-3 surface-50 border-round-xl border-1 surface-border flex flex-column gap-3 h-full">
                        <div>
                            <div className="flex align-items-center justify-content-between mb-2">
                                <label className="block text-xs font-extrabold text-teal-800 uppercase tracking-wider flex align-items-center gap-2 m-0">
                                    <i className="pi pi-shopping-bag text-teal-600 text-sm" />
                                    PILIH PRODUK TAMBAHAN UNTUK KASIR
                                </label>
                                <Button
                                    type="button"
                                    label="Biaya Custom"
                                    icon="pi pi-plus"
                                    size="small"
                                    className="text-xs font-bold py-1.5 px-3 border-round-lg bg-teal-50 text-teal-700 border-1 border-teal-300 hover:bg-teal-100 hover:border-teal-400 shadow-none transition-all"
                                    disabled={isSubmitted}
                                    onClick={() => setShowCustomFeeModal(true)}
                                />
                            </div>

                            {/* Search Box */}
                            <div className="flex gap-2 mb-3">
                                <IconField iconPosition="left" className="w-full">
                                    <InputIcon className="pi pi-search text-xs text-400" />
                                    <InputText
                                        value={searchProduk}
                                        onChange={(e) => setSearchProduk(e.target.value)}
                                        placeholder="Cari nama atau kode produk..."
                                        disabled={isSubmitted}
                                        className="p-inputtext-sm w-full border-round-lg text-xs"
                                    />
                                </IconField>
                                <Button
                                    icon="pi pi-refresh"
                                    outlined
                                    size="small"
                                    severity="secondary"
                                    onClick={() => fetchProdukOptions(searchProduk)}
                                    loading={loadingProduk}
                                    disabled={isSubmitted}
                                    title="Refresh Produk"
                                />
                            </div>

                            {/* List Opsi Produk */}
                            <div
                                className="surface-card border-1 surface-border border-round-lg p-2 overflow-y-auto shadow-1 pr-1 custom-thin-scrollbar max-h-[180px]"
                                style={{ maxHeight: '180px' }}
                            >
                                {loadingProduk ? (
                                    <div className="text-center py-3">
                                        <ProgressSpinner style={{ width: '24px', height: '24px' }} />
                                    </div>
                                ) : filteredProdukOptions.length === 0 ? (
                                    <div className="text-center py-3 text-xs text-500">
                                        Tidak ada produk ditemukan
                                    </div>
                                ) : (
                                    <div className="flex flex-column gap-1">
                                        {filteredProdukOptions.map((prod) => (
                                            <div
                                                key={prod.kode_produk}
                                                className={`flex align-items-center justify-content-between p-2 border-round-lg transition-all ${
                                                    isSubmitted
                                                        ? 'opacity-60 cursor-not-allowed'
                                                        : 'cursor-pointer hover:surface-100'
                                                }`}
                                                style={{ transition: 'all 0.15s ease' }}
                                                onClick={() => !isSubmitted && handleAddProduk(prod)}
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <span className="font-bold text-xs text-900 block truncate">{prod.nama}</span>
                                                    <span className="text-[10px] text-500">
                                                        {prod.kode_produk} • {formatRupiah(prod.harga_jual)} / {prod.satuan || 'pcs'}
                                                    </span>
                                                </div>
                                                <div
                                                    className="flex align-items-center justify-content-center flex-shrink-0 text-teal-600 bg-teal-50 border-1 border-teal-200"
                                                    style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '6px',
                                                        pointerEvents: 'none'
                                                    }}
                                                    title="Tambah produk"
                                                >
                                                    <Plus size={13} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 1. LAYANAN / TINDAKAN YANG DIPILIH PASIEN DARI PENDAFTARAN */}
                        <div className="border-top-1 surface-border pt-3">
                            <div className="flex align-items-center justify-content-between mb-2">
                                <span className="text-xs font-bold text-teal-900 uppercase tracking-wider flex align-items-center gap-1.5">
                                    <TagIcon size={14} className="text-teal-600" />
                                    Layanan yang Dipilih Pasien ({layananPasienList.length > 0 ? layananPasienList.length : 1})
                                </span>
                                <span
                                    className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 border-1 border-teal-200"
                                    style={{ borderRadius: '9999px' }}
                                >
                                    Pendaftaran
                                </span>
                            </div>

                            {loadingLayanan ? (
                                <div
                                    className="p-3 text-center text-xs text-500 surface-card border-1 surface-border flex align-items-center justify-content-center gap-2"
                                    style={{ borderRadius: '13px' }}
                                >
                                    <Loader2 size={14} className="lucide-spin text-teal-600" />
                                    <span>Memuat layanan pasien...</span>
                                </div>
                            ) : layananPasienList.length === 0 ? (
                                <div
                                    className="treatment-summary-card surface-card border-1 surface-border p-3 flex flex-column sm:flex-row sm:align-items-center justify-content-between gap-2"
                                    style={{
                                        borderRadius: '13px',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div className="flex align-items-center gap-2.5 min-w-0">
                                        <div
                                            className="flex align-items-center justify-content-center flex-shrink-0"
                                            style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                background: '#ccfbf1',
                                                color: '#0f766e'
                                            }}
                                        >
                                            <CheckCircle2 size={15} />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="font-bold text-xs text-900 block overflow-hidden text-ellipsis white-space-nowrap">
                                                {activePatient?.nama_layanan || 'Layanan Pasien'}
                                            </span>
                                            <span className="text-[11px] text-teal-600 font-medium block">
                                                {activePatient?.nama_ruangan || namaRuangan || 'Ruangan Tindakan'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-left sm:text-right pl-5 sm:pl-0">
                                        <span className="font-bold text-xs text-500 block">Harga di Kasir</span>
                                        <span className="text-[10px] text-400 font-normal">Tarif Layanan</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-column gap-2">
                                    {layananPasienList.map((lay: any, idx: number) => {
                                        const hrg = parseFloat(lay.harga || 0);
                                        const isKlaim = (lay.jenis || lay.jenis_layanan || '').toLowerCase().includes('klaim');
                                        return (
                                            <div
                                                key={idx}
                                                className="treatment-summary-card surface-card border-1 surface-border p-3 flex flex-column sm:flex-row sm:align-items-center justify-content-between gap-2"
                                                style={{
                                                    borderRadius: '13px',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <div className="flex align-items-center gap-2.5 min-w-0">
                                                    <div
                                                        className="flex align-items-center justify-content-center flex-shrink-0"
                                                        style={{
                                                            width: '28px',
                                                            height: '28px',
                                                            borderRadius: '50%',
                                                            background: '#ccfbf1',
                                                            color: '#0f766e'
                                                        }}
                                                    >
                                                        <CheckCircle2 size={15} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="font-bold text-xs text-900 block overflow-hidden text-ellipsis white-space-nowrap">
                                                            {lay.nama_layanan || lay.nama}
                                                        </span>
                                                        <span className="text-[11px] text-teal-600 font-medium block">
                                                            {lay.nama_ruangan || namaRuangan || 'Ruangan Tindakan'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-left sm:text-right pl-5 sm:pl-0">
                                                    <span className="font-black text-xs text-teal-800 block">
                                                        {isKlaim ? 'Klaim Paket (Rp 0)' : formatRupiah(hrg)}
                                                    </span>
                                                    <span className="text-[10px] text-500 font-normal">
                                                        Tarif Layanan
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* 2. PRODUK REKOMENDASI DOKTER & TERPILIH */}
                        <div className="border-top-1 surface-border pt-3 flex-1 flex flex-column">
                            <div className="flex align-items-center justify-content-between mb-2">
                                <span className="text-xs font-bold text-teal-900 uppercase tracking-wider flex align-items-center gap-1.5">
                                    <Sparkles size={14} className="text-amber-500" />
                                    Produk Rekomendasi Dokter &amp; Terpilih ({selectedProdukList.length})
                                </span>
                                {selectedProdukList.length > 0 && !isSubmitted && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedProdukList([])}
                                        className="inline-flex align-items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 border-none bg-transparent cursor-pointer px-2 py-1 border-round"
                                        style={{ transition: 'all 0.15s ease' }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                        title="Kosongkan daftar produk terpilih"
                                    >
                                        <Trash2 size={12} className="text-red-600" />
                                        <span>Kosongkan</span>
                                    </button>
                                )}
                            </div>

                            {selectedProdukList.length === 0 ? (
                                <div
                                    className="text-center py-4 px-3 surface-card border-1 border-dashed surface-border flex-1 flex flex-column align-items-center justify-content-center gap-1.5"
                                    style={{ borderRadius: '13px', minHeight: '120px' }}
                                >
                                    <div
                                        className="flex align-items-center justify-content-center mb-1"
                                        style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            background: '#f1f5f9',
                                            color: '#94a3b8'
                                        }}
                                    >
                                        <ShoppingBag size={18} />
                                    </div>
                                    <span className="text-xs text-600 font-semibold">Belum ada produk tambahan terpilih</span>
                                    <span className="text-[11px] text-400">Pilih rekomendasi produk dokter di atas untuk menambahkan ke kasir</span>
                                </div>
                            ) : (
                                <div
                                    className="flex flex-column gap-2 overflow-y-auto pr-1 custom-thin-scrollbar max-h-[220px]"
                                    style={{ maxHeight: '220px' }}
                                >
                                    {selectedProdukList.map((item) => {
                                        const subtotal = item.qty * item.harga_jual;
                                        return (
                                            <div
                                                key={item.kode_produk}
                                                className="treatment-summary-card surface-card border-1 surface-border p-2.5 flex flex-column sm:flex-row sm:align-items-center justify-content-between gap-2"
                                                style={{
                                                    borderRadius: '13px',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <div className="flex-1 min-w-0 pr-1">
                                                    <span className="font-bold text-xs text-900 block overflow-hidden text-ellipsis white-space-nowrap" title={item.nama}>
                                                        {item.nama}
                                                    </span>
                                                    <span className="text-[11px] text-teal-700 font-medium block">
                                                        {formatRupiah(item.harga_jual)} &times; {item.qty} = <strong className="font-bold text-teal-900">{formatRupiah(subtotal)}</strong>
                                                    </span>
                                                </div>

                                                <div className="flex align-items-center justify-content-between sm:justify-content-end gap-2 flex-shrink-0">
                                                    {!isSubmitted ? (
                                                        <>
                                                            {/* Stepper Kuantitas: - outline, qty, + solid teal */}
                                                            <div
                                                                className="inline-flex align-items-center p-0.5 border-1 surface-border surface-ground"
                                                                style={{ borderRadius: '8px' }}
                                                            >
                                                                {/* Tombol - (outline) */}
                                                                <button
                                                                    type="button"
                                                                    disabled={isSubmitted}
                                                                    onClick={() => handleUpdateQty(item.kode_produk, -1)}
                                                                    className="flex align-items-center justify-content-center surface-card border-1 surface-border text-600 hover:text-900 cursor-pointer p-0"
                                                                    style={{
                                                                        width: '22px',
                                                                        height: '22px',
                                                                        borderRadius: '6px',
                                                                        transition: 'all 0.15s ease'
                                                                    }}
                                                                    title="Kurangi kuantitas"
                                                                >
                                                                    <Minus size={11} />
                                                                </button>

                                                                {/* Qty value */}
                                                                <span
                                                                    className="font-bold text-xs text-800 text-center select-none"
                                                                    style={{ minWidth: '24px' }}
                                                                >
                                                                    {item.qty}
                                                                </span>

                                                                {/* Tombol + (solid teal) */}
                                                                <button
                                                                    type="button"
                                                                    disabled={isSubmitted}
                                                                    onClick={() => handleUpdateQty(item.kode_produk, 1)}
                                                                    className="flex align-items-center justify-content-center text-white border-none cursor-pointer p-0 shadow-1"
                                                                    style={{
                                                                        width: '22px',
                                                                        height: '22px',
                                                                        borderRadius: '6px',
                                                                        background: '#0d9488',
                                                                        transition: 'all 0.15s ease'
                                                                    }}
                                                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#0f766e')}
                                                                    onMouseLeave={(e) => (e.currentTarget.style.background = '#0d9488')}
                                                                    title="Tambah kuantitas"
                                                                >
                                                                    <Plus size={11} />
                                                                </button>
                                                            </div>

                                                            {/* Tombol Hapus */}
                                                            <button
                                                                type="button"
                                                                disabled={isSubmitted}
                                                                onClick={() => handleRemoveProduk(item.kode_produk)}
                                                                className="flex align-items-center justify-content-center p-1 border-none bg-transparent text-red-500 hover:text-red-700 cursor-pointer border-round"
                                                                style={{
                                                                    width: '26px',
                                                                    height: '26px',
                                                                    borderRadius: '6px',
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                                onMouseEnter={(e) => (e.currentTarget.style.background = '#fee2e2')}
                                                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                                                title="Hapus produk ini"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span
                                                            className="font-bold text-xs text-teal-800 bg-teal-50 px-2 py-0.5 border-1 border-teal-200"
                                                            style={{ borderRadius: '6px' }}
                                                        >
                                                            x{item.qty}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* TOTAL & SUBMIT BUTTON FOOTER */}
                        <div className="border-top-1 surface-border pt-3 mt-auto">
                            {/* Card Ringkasan Biaya */}
                            <div
                                className="p-3 mb-3 flex flex-column gap-2 border-1"
                                style={{
                                    borderRadius: '14px',
                                    background: '#f0fdfa',
                                    borderColor: '#99f6e4',
                                    boxShadow: '0 1px 3px rgba(13,148,136,0.08)'
                                }}
                            >
                                {/* Baris 1: Biaya Layanan */}
                                <div className="flex align-items-center justify-content-between text-xs">
                                    <span className="text-600 font-medium">
                                        Biaya Layanan ({layananPasienList.length || 1} tindakan):
                                    </span>
                                    <span className="font-bold text-teal-900">
                                        {formatRupiah(totalHargaLayanan)}
                                    </span>
                                </div>

                                {/* Baris 2: Biaya Produk Tambahan */}
                                <div className="flex align-items-center justify-content-between text-xs">
                                    <span className="text-600 font-medium">
                                        Biaya Produk Tambahan ({selectedProdukList.length} item):
                                    </span>
                                    <span className="font-bold text-teal-900">
                                        {formatRupiah(grandTotal)}
                                    </span>
                                </div>

                                {/* Baris 3: Total Biaya ke Kasir */}
                                <div
                                    className="pt-2 mt-0.5 flex align-items-center justify-content-between"
                                    style={{ borderTop: '1px dashed #99f6e4' }}
                                >
                                    <div>
                                        <span className="font-black text-sm text-teal-950 block uppercase tracking-tight">
                                            Total Biaya ke Kasir:
                                        </span>
                                        <span className="text-[10px] text-teal-700 font-medium block">
                                            Diteruskan otomatis ke tagihan kasir
                                        </span>
                                    </div>
                                    <span
                                        className="font-black text-teal-700 tracking-tight"
                                        style={{ fontSize: '1.45rem', lineHeight: '1.2' }}
                                    >
                                        {formatRupiah(totalHargaLayanan + grandTotal)}
                                    </span>
                                </div>
                            </div>

                            {/* Tombol Submit Full Width */}
                            {isSubmitted ? (
                                <div
                                    className="flex align-items-center justify-content-center gap-2 p-3 text-center shadow-sm"
                                    style={{
                                        borderRadius: '13px',
                                        background: '#ecfdf5',
                                        border: '1px solid #a7f3d0'
                                    }}
                                >
                                    <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                                    <span className="text-xs font-bold text-green-800">
                                        Hasil Treatment &amp; Produk Telah Disimpan ke Kasir
                                    </span>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleSaveClick}
                                    disabled={submitting || !activePatient}
                                    className="w-full font-bold text-xs sm:text-sm text-white flex align-items-center justify-content-center gap-2 border-none cursor-pointer py-3 px-4 shadow-2"
                                    style={{
                                        borderRadius: '13px',
                                        background: '#0d9488',
                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 4px 12px rgba(13,148,136,0.25)',
                                        opacity: (!activePatient || submitting) ? 0.6 : 1,
                                        cursor: (!activePatient || submitting) ? 'not-allowed' : 'pointer'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!submitting && activePatient) {
                                            e.currentTarget.style.background = '#0f766e';
                                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(13,148,136,0.35)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!submitting && activePatient) {
                                            e.currentTarget.style.background = '#0d9488';
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(13,148,136,0.25)';
                                        }
                                    }}
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 size={16} className="lucide-spin" />
                                            <span>Menyimpan...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 size={16} />
                                            <span>Simpan &amp; Setujui Hasil Treatment</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL KONFIRMASI SIMPAN & PERSETUJUAN TINDAKAN */}
            <Dialog
                visible={showConfirmModal}
                onHide={() => setShowConfirmModal(false)}
                closable={false}
                header={
                    <div className="flex align-items-center justify-content-between w-full">
                        <div className="flex align-items-center gap-3">
                            <div
                                className="flex align-items-center justify-content-center flex-shrink-0"
                                style={{
                                    width: '42px',
                                    height: '42px',
                                    background: 'linear-gradient(135deg, #0d9488, #059669)',
                                    boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)',
                                    borderRadius: '12px',
                                }}
                            >
                                <ShieldCheck size={22} className="text-white" />
                            </div>
                            <div>
                                <span className="text-base sm:text-lg font-black text-900 block" style={{ lineHeight: 1.2 }}>
                                    Persetujuan &amp; Konfirmasi Hasil Tindakan
                                </span>
                                <span className="text-xs text-500 font-medium">
                                    Verifikasi rincian hasil treatment pasien sebelum disimpan ke Kasir
                                </span>
                            </div>
                        </div>

                        {/* Tombol Close (X) dengan area klik dan hover state bulat abu muda */}
                        <button
                            type="button"
                            onClick={() => setShowConfirmModal(false)}
                            className="flex align-items-center justify-content-center border-none bg-transparent text-500 hover:text-800 hover:surface-200 cursor-pointer p-0 flex-shrink-0"
                            style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                transition: 'all 0.15s ease',
                            }}
                            title="Tutup dialog"
                        >
                            <X size={18} />
                        </button>
                    </div>
                }
                style={{ width: '580px', maxWidth: '95vw' }}
                contentStyle={{ maxHeight: '72vh', overflowY: 'auto' }}
                modal
                className="p-fluid"
                footer={
                    <div className="flex align-items-center gap-3 pt-3 border-top-1 surface-border w-full">
                        <button
                            type="button"
                            onClick={() => setShowConfirmModal(false)}
                            disabled={submitting}
                            className="flex align-items-center justify-content-center gap-2 font-bold text-xs sm:text-sm text-700 surface-card border-1 surface-border py-3 px-3 cursor-pointer shadow-xs"
                            style={{
                                flex: 1,
                                borderRadius: '13px',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#f8fafc';
                                e.currentTarget.style.borderColor = '#cbd5e1';
                                e.currentTarget.style.color = '#0f172a';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#ffffff';
                                e.currentTarget.style.borderColor = '';
                                e.currentTarget.style.color = '';
                            }}
                        >
                            <X size={16} className="text-500" />
                            <span>Batal</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmSubmit}
                            disabled={submitting}
                            className="flex align-items-center justify-content-center gap-2 font-bold text-xs sm:text-sm text-white py-3 px-4 border-none cursor-pointer shadow-2"
                            style={{
                                flex: 2,
                                borderRadius: '13px',
                                background: '#0d9488',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 4px 14px rgba(13, 148, 136, 0.28)',
                                opacity: submitting ? 0.7 : 1,
                                cursor: submitting ? 'not-allowed' : 'pointer',
                            }}
                            onMouseEnter={(e) => {
                                if (!submitting) {
                                    e.currentTarget.style.background = '#0f766e';
                                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(13, 148, 136, 0.38)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!submitting) {
                                    e.currentTarget.style.background = '#0d9488';
                                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(13, 148, 136, 0.28)';
                                }
                            }}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 size={17} className="lucide-spin" />
                                    <span>Menyimpan...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={17} />
                                    <span>Setuju &amp; Simpan ke Kasir</span>
                                </>
                            )}
                        </button>
                    </div>
                }
            >
                <div className="flex flex-column gap-3 py-1 text-left custom-thin-scrollbar pr-0.5">
                    {/* PASIEN BANNER CARD */}
                    <div
                        className="p-3 border-round-2xl relative overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg, #f0fdfa, #ccfbf1)',
                            border: '1.5px solid #99f6e4',
                            borderRadius: '14px',
                        }}
                    >
                        <div className="flex align-items-center justify-content-between gap-2">
                            <div>
                                <div className="flex align-items-center gap-2 mb-1.5 flex-wrap">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800">
                                        PASIEN AKTIF TINDAKAN
                                    </span>
                                    <span
                                        className="text-[10px] font-bold text-teal-800 bg-white px-2 py-0.5 border-1 border-teal-200 shadow-xs flex align-items-center gap-1"
                                        style={{ borderRadius: '9999px' }}
                                    >
                                        <User size={10} className="text-teal-600" />
                                        {activePatient?.nama_pasien || 'Pasien Baru'}
                                    </span>
                                </div>
                                <div className="text-xs text-teal-800 font-medium flex align-items-center gap-2 flex-wrap">
                                    <span>No. RM: <strong className="font-bold text-teal-950">{activePatient?.no_rm}</strong></span>
                                    <span className="text-teal-400">•</span>
                                    <span>Ruangan: <strong className="font-bold text-teal-950">{namaRuangan}</strong></span>
                                </div>
                            </div>

                            {/* Badge No. Antrean dengan border tipis putih semi-transparan */}
                            <div
                                className="text-sm font-extrabold text-white px-3 py-1.5 flex align-items-center justify-content-center shadow-1 flex-shrink-0"
                                style={{
                                    background: '#0d9488',
                                    border: '1.5px solid rgba(255, 255, 255, 0.45)',
                                    borderRadius: '12px',
                                    boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)'
                                }}
                            >
                                No. #{activePatient?.nomor_antrian}
                            </div>
                        </div>
                    </div>

                    {/* RINCIAN HASIL & PRODUK CARD */}
                    <div
                        className="surface-card p-3 border-1 surface-border shadow-1 flex flex-column gap-2"
                        style={{ borderRadius: '14px' }}
                    >
                        {/* Layanan Pasien Dari Pendaftaran */}
                        {layananPasienList.length > 0 && (
                            <div className="flex flex-column gap-2">
                                <div className="flex align-items-center justify-content-between text-xs">
                                    <span className="font-bold text-700 flex align-items-center gap-2">
                                        <Ticket size={15} className="text-teal-600" />
                                        Layanan Pasien ({layananPasienList.length} Tindakan)
                                    </span>
                                    <span className="font-extrabold text-teal-800">{formatRupiah(totalHargaLayanan)}</span>
                                </div>
                                <div className="flex flex-column gap-1 max-h-8rem overflow-y-auto pr-1 custom-thin-scrollbar">
                                    {layananPasienList.map((lay: any, idx: number) => {
                                        const hrg = parseFloat(lay.harga || 0);
                                        const isKlaim = (lay.jenis || lay.jenis_layanan || '').toLowerCase().includes('klaim');
                                        const isEven = idx % 2 === 1;
                                        return (
                                            <div
                                                key={idx}
                                                className={`flex align-items-center justify-content-between text-xs p-2 border-round-lg border-1 ${
                                                    isEven ? 'surface-100 border-200' : 'surface-50 surface-border'
                                                }`}
                                            >
                                                <span className="font-medium text-800">{lay.nama_layanan || lay.nama}</span>
                                                <span className="font-bold text-teal-700">{isKlaim ? 'Klaim (Rp 0)' : formatRupiah(hrg)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Produk Tambahan */}
                        {selectedProdukList.length > 0 && (
                            <div className={`flex flex-column gap-2 ${layananPasienList.length > 0 ? 'mt-2 pt-2 border-top-1 surface-border' : ''}`}>
                                <div className="flex align-items-center justify-content-between text-xs">
                                    <span className="font-bold text-700 flex align-items-center gap-2">
                                        <ShoppingBag size={15} className="text-amber-600" />
                                        Produk Tambahan ({selectedProdukList.length} Item)
                                    </span>
                                    <span className="font-extrabold text-teal-700">{formatRupiah(grandTotal)}</span>
                                </div>
                                <div className="flex flex-column gap-1 max-h-8rem overflow-y-auto pr-1 custom-thin-scrollbar">
                                    {selectedProdukList.map((p, idx) => {
                                        const isEven = idx % 2 === 1;
                                        return (
                                            <div
                                                key={idx}
                                                className={`flex align-items-center justify-content-between text-xs p-2 border-round-lg border-1 ${
                                                    isEven ? 'surface-100 border-200' : 'surface-50 surface-border'
                                                }`}
                                            >
                                                <div className="flex align-items-center gap-2 min-w-0">
                                                    <span className="font-medium text-800 truncate">{p.nama}</span>
                                                    <span
                                                        className="text-[10px] font-bold text-600 surface-200 px-1.5 py-0.5 border-round flex-shrink-0"
                                                    >
                                                        {p.qty}x
                                                    </span>
                                                </div>
                                                <span className="font-bold text-teal-700 flex-shrink-0">
                                                    {formatRupiah(p.harga_jual * p.qty)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Catatan Observasi */}
                        {catatan && (
                            <div className="p-2.5 surface-50 border-round-xl border-1 surface-border text-xs mt-1">
                                <span className="font-bold text-700 block mb-1">Catatan Observasi:</span>
                                <span className="text-600 italic block border-left-3 border-teal-500 pl-2 py-0.5">&quot;{catatan}&quot;</span>
                            </div>
                        )}

                        {/* Total Keseluruhan Baris */}
                        <div
                            className="mt-2 pt-2 flex align-items-center justify-content-between"
                            style={{ borderTop: '2px dashed #99f6e4' }}
                        >
                            <div>
                                <span className="font-black text-sm text-teal-950 block uppercase tracking-tight">
                                    Total Keseluruhan:
                                </span>
                                <span className="text-[10px] text-teal-700 font-medium block">
                                    Biaya layanan &amp; produk ke Kasir
                                </span>
                            </div>
                            <span className="font-black text-lg sm:text-xl text-teal-700 tracking-tight">
                                {formatRupiah(totalHargaLayanan + grandTotal)}
                            </span>
                        </div>
                    </div>

                    {/* PERNYATAAN INFORMED CONSENT / PERSETUJUAN */}
                    <div
                        className="p-3 border-round-2xl flex align-items-start gap-3"
                        style={{
                            background: '#f0fdfa',
                            border: '1.5px solid #99f6e4',
                            borderRadius: '14px',
                        }}
                    >
                        <CheckCircle2 size={20} className="text-teal-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <span className="font-extrabold text-xs text-teal-950 block mb-1">
                                Pernyataan Persetujuan Pasien (Verbal Consent)
                            </span>
                            <p className="text-xs text-teal-800 m-0 leading-relaxed font-medium">
                                Pasien/Wali telah menyetujui hasil tindakan serta daftar rincian produk yang akan diteruskan sebagai draf transaksi di Kasir.
                            </p>
                        </div>
                    </div>
                </div>
            </Dialog>

            {/* DIALOG TAMBAH BIAYA CUSTOM */}
            <Dialog
                visible={showCustomFeeModal}
                onHide={() => setShowCustomFeeModal(false)}
                header={
                    <div className="flex align-items-center gap-2">
                        <i className="pi pi-plus-circle text-teal-600 text-xl" />
                        <span className="font-bold text-base text-900">Tambah Biaya / Produk Custom</span>
                    </div>
                }
                style={{ width: '420px' }}
                modal
            >
                <div className="flex flex-column gap-3 pt-2">
                    <div>
                        <label className="block text-xs font-bold text-700 mb-1">Nama Biaya / Produk Custom *</label>
                        <InputText
                            value={customFeeNama}
                            onChange={(e) => setCustomFeeNama(e.target.value)}
                            placeholder="Contoh: Biaya Jarum Injeksi / Alat Tambahan"
                            className="w-full p-inputtext-sm text-sm border-round-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-700 mb-1">Nominal Harga (Rp) *</label>
                        <InputNumber
                            value={customFeeHarga}
                            onValueChange={(e) => setCustomFeeHarga(e.value ?? null)}
                            mode="currency"
                            currency="IDR"
                            locale="id-ID"
                            placeholder="Masukkan nominal harga..."
                            className="w-full text-sm"
                            inputClassName="p-inputtext-sm w-full text-sm border-round-lg font-bold text-teal-700"
                        />
                    </div>
                </div>

                <div className="flex justify-content-end gap-2 mt-4 pt-3 border-top-1 surface-border">
                    <Button
                        label="Batal"
                        icon="pi pi-times"
                        text
                        severity="secondary"
                        onClick={() => setShowCustomFeeModal(false)}
                    />
                    <Button
                        label="Tambahkan ke Daftar"
                        icon="pi pi-check"
                        severity="success"
                        className="bg-teal-600 border-none font-bold text-sm"
                        onClick={handleAddCustomFee}
                    />
                </div>
            </Dialog>
        </div>
    );
};

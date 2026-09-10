'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from 'primereact/sidebar';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Toast } from 'primereact/toast';
import { InputText } from 'primereact/inputtext';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import postData from '@/lib/axios/postData';
import { showError } from '@/lib/tools/generalTools';
import {
    ArrowLeft,
    Clock,
    User,
    AlertTriangle,
    FileText,
    Activity,
    Stethoscope,
    Sparkles,
    Building2,
    CheckCircle2,
    ClipboardList,
    Image as ImageIcon,
    ZoomIn,
    Printer,
} from 'lucide-react';
import { RMEReportPrint } from './RMEReportPrint';

export const IconMedicalRecord: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }> = ({
    size = 16,
    className = '',
    style,
}) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        className={className}
        style={style}
    >
        {/* Document outline with rounded corners and folded corner */}
        <path
            d="M14.5 1.5H6.5C4.6 1.5 3 3.1 3 5v14c0 1.9 1.6 3.5 3.5 3.5h11c1.9 0 3.5-1.6 3.5-3.5V7.5L14.5 1.5z"
            strokeWidth="1.8"
            strokeLinejoin="round"
        />
        <path
            d="M14.5 1.5V6c0 .8.7 1.5 1.5 1.5h4.5"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        {/* Avatar Head (Larger & Bolder on top-left) */}
        <circle cx="8.8" cy="6" r="2.2" fill="currentColor" stroke="none" />
        {/* Avatar Shoulders / Suit */}
        <path
            d="M5.5 13v-.3c0-1.8 1.4-2.8 3.3-2.8s3.3 1 3.3 2.8v.3h-1.4l-.7-1.4-.7 1.4z"
            fill="currentColor"
            stroke="none"
        />
        {/* Document Data Bars (Solid Bold Lines) */}
        <rect x="5.5" y="14.8" width="13" height="1.6" rx="0.8" fill="currentColor" stroke="none" />
        <rect x="5.5" y="17.4" width="13" height="1.6" rx="0.8" fill="currentColor" stroke="none" />
        <rect x="5.5" y="20" width="7.5" height="1.6" rx="0.8" fill="currentColor" stroke="none" />
    </svg>
);

interface DrawerRiwayatPasienProps {
    visible: boolean;
    onHide: () => void;
    noRm: string;
    namaPasien?: string;
    excludeKodeKunjungan?: string;
    toast?: React.RefObject<Toast>;
}

const getFullImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return url;
    }
    const clean = url.startsWith('/') ? url : `/${url}`;
    return `http://127.0.0.1:8000${clean}`;
};

export const DrawerRiwayatPasien: React.FC<DrawerRiwayatPasienProps> = ({
    visible,
    onHide,
    noRm,
    namaPasien = 'Pasien',
    excludeKodeKunjungan,
    toast,
}) => {
    const [loading, setLoading] = useState<boolean>(false);
    const [riwayatList, setRiwayatList] = useState<any[]>([]);
    const [totalRecords, setTotalRecords] = useState<number>(0);
    const [globalFilter, setGlobalFilter] = useState<string>('');

    // Selected visit for detailed EMR dossier view (null = Table view)
    const [selectedVisit, setSelectedVisit] = useState<any | null>(null);

    // Modal Print Laporan RME
    const [printModalVisible, setPrintModalVisible] = useState<boolean>(false);
    const [visitToPrint, setVisitToPrint] = useState<any | null>(null);

    // Modal Zoom Preview Foto
    const [previewModalVisible, setPreviewModalVisible] = useState<boolean>(false);
    const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string>('');
    const [previewPhotoTitle, setPreviewPhotoTitle] = useState<string>('');

    useEffect(() => {
        if (visible && noRm) {
            setSelectedVisit(null);
            setGlobalFilter('');
            fetchRiwayat();
        }
    }, [visible, noRm, excludeKodeKunjungan]);

    const fetchRiwayat = async () => {
        setLoading(true);
        try {
            const res = await postData('/master/pasien-rekam-medis', {
                no_rm: noRm,
                exclude_kode_kunjungan: excludeKodeKunjungan || '',
                only_selesai: true,
                page: 1,
                perPage: 100, // Load complete history for table view
            });

            const rawData = res.data?.data || [];
            // Filter agar HANYA kunjungan yang sudah 'selesai' yang ditampilkan (kunjungan yang sedang berlangsung tidak ditampilkan)
            const data = rawData.filter((item: any) => {
                const status = (item.status_kunjungan || '').toLowerCase();
                if (status !== 'selesai') return false;
                if (excludeKodeKunjungan && item.kode_kunjungan === excludeKodeKunjungan) return false;
                return true;
            });
            const total = data.length;

            setRiwayatList(data);
            setTotalRecords(total);
        } catch (error: any) {
            if (toast) {
                showError(toast, error?.response?.data?.message || 'Gagal memuat riwayat rekam medis pasien');
            }
        } finally {
            setLoading(false);
        }
    };

    const formatDateIndo = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        } catch (_) {
            return dateStr;
        }
    };

    const formatShortDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        } catch (_) {
            return dateStr;
        }
    };

    const openPhotoZoom = (url: string, title: string) => {
        setPreviewPhotoUrl(getFullImageUrl(url));
        setPreviewPhotoTitle(title);
        setPreviewModalVisible(true);
    };

    // Filtered data for DataTable search (hanya kunjungan selesai)
    const filteredRiwayatList = riwayatList.filter((item) => {
        if (item.status_kunjungan?.toLowerCase() !== 'selesai') return false;
        if (!globalFilter) return true;
        const q = globalFilter.toLowerCase();
        const tgl = item.tanggal_kunjungan || '';
        const kode = item.kode_kunjungan || '';
        const dokter = item.header_rekam_medis?.dokter_nama || '';
        const diagnosis = item.header_rekam_medis?.diagnosis || '';
        const layanan = (item.layanan || []).map((l: any) => l.nama_layanan).join(' ');
        return (
            tgl.toLowerCase().includes(q) ||
            kode.toLowerCase().includes(q) ||
            dokter.toLowerCase().includes(q) ||
            diagnosis.toLowerCase().includes(q) ||
            layanan.toLowerCase().includes(q)
        );
    });

    // Custom Header Drawer — clean & compact
    const customHeader = (
        <div className="flex align-items-center gap-2 w-full">
            <i className="pi pi-book text-teal-700 text-xl" />
            <div>
                <div className="text-lg font-bold text-900 line-height-1">{namaPasien}</div>
                <div className="flex align-items-center gap-2 mt-1 text-xs text-500">
                    <span className="font-mono font-bold">RM: {noRm || '-'}</span>
                    <span>•</span>
                    <span>{totalRecords} Riwayat Kunjungan</span>
                </div>
            </div>
        </div>
    );

    // Helper untuk membedakan visual data terisi vs data kosong/placeholder
    const renderFieldContent = (val?: string | null, fallbackText: string = 'Tidak ada catatan') => {
        const isBlank =
            !val ||
            val.trim() === '' ||
            val.trim() === '-' ||
            val.toLowerCase() === 'tidak ada' ||
            val.toLowerCase().startsWith('tidak') ||
            val.toLowerCase().startsWith('belum') ||
            val.toLowerCase().startsWith('(tidak');

        if (isBlank) {
            return (
                <span
                    style={{
                        color: '#94a3b8',
                        fontStyle: 'italic',
                        fontSize: '11px',
                        display: 'block',
                        lineHeight: 1.5,
                    }}
                >
                    {val && val.trim() !== '' && val.trim() !== '-' ? val : fallbackText}
                </span>
            );
        }
        return (
            <span
                style={{
                    color: '#0f172a',
                    fontWeight: 500,
                    fontSize: '12px',
                    display: 'block',
                    lineHeight: 1.5,
                }}
            >
                {val}
            </span>
        );
    };

    // ==========================================
    // RENDER DETAIL VIEW FOR SELECTED VISIT
    // ==========================================
    const renderDetailView = () => {
        if (!selectedVisit) return null;

        const origIdx = riwayatList.findIndex(
            (k) => k.kode_kunjungan === selectedVisit.kode_kunjungan
        );
        const visitNumber = riwayatList.length - (origIdx !== -1 ? origIdx : 0);
        const headerRM = selectedVisit.header_rekam_medis || {};
        const layananList = selectedVisit.layanan || [];
        const isSelesai = selectedVisit.status_kunjungan === 'selesai';

        // Cek foto before awal
        let beforeFotoUrl = headerRM.foto_before || '';
        if (!beforeFotoUrl && layananList.length > 0) {
            for (const lay of layananList) {
                const foundBefore = (lay.rekam_medis?.fotos || []).find(
                    (f: any) => f.tipe === 'before' || f.tipe === 'foto_before'
                );
                if (foundBefore?.url_foto) {
                    beforeFotoUrl = foundBefore.url_foto;
                    break;
                }
            }
        }

        const hasAllergy =
            headerRM.riwayat_alergi &&
            headerRM.riwayat_alergi.trim() !== '' &&
            headerRM.riwayat_alergi.trim() !== '-' &&
            headerRM.riwayat_alergi.toLowerCase() !== 'tidak ada';

        return (
            <div className="flex flex-column gap-3 animate-fadein">
                {/* ── TOP BAR: Back + Status Visit ── */}
                <div className="flex align-items-center justify-content-between pb-2 border-bottom-1 surface-border">
                    <button
                        type="button"
                        onClick={() => setSelectedVisit(null)}
                        className="p-button p-button-text p-button-secondary p-button-sm text-xs font-semibold px-2 py-1.5 flex align-items-center gap-1.5 hover:surface-100 border-round cursor-pointer"
                        style={{ border: 'none', background: 'transparent' }}
                    >
                        <ArrowLeft size={16} className="text-500" />
                        <span>Kembali ke Tabel Riwayat</span>
                    </button>
                    <div className="flex align-items-center gap-2">
                        <Button
                            label="Cetak RME"
                            icon={<IconMedicalRecord size={15} className="mr-1" />}
                            severity="success"
                            size="small"
                            className="font-bold border-round-lg text-xs px-2.5 py-1.5 shadow-1"
                            onClick={() => {
                                setVisitToPrint(selectedVisit);
                                setPrintModalVisible(true);
                            }}
                        />
                        <span className="text-xs font-mono font-semibold text-500 bg-surface-100 border-round px-2 py-1 border-1 surface-border">
                            {selectedVisit.kode_kunjungan}
                        </span>
                        {isSelesai ? (
                            <span
                                className="text-[11px] font-bold px-2.5 py-1 border-round-pill uppercase"
                                style={{ backgroundColor: '#f0fdfa', color: '#0f766e', border: '1px solid #99f6e4' }}
                            >
                                Selesai
                            </span>
                        ) : (
                            <span
                                className="text-[11px] font-bold px-2.5 py-1 border-round-pill uppercase"
                                style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                            >
                                Sedang Berlangsung
                            </span>
                        )}
                    </div>
                </div>

                {/* ── VISIT INFO CARD ── */}
                <div className="surface-card border-round-xl border-1 surface-border p-3 shadow-none">
                    <div className="grid formgrid align-items-center">
                        <div className="col-12 md:col-8">
                            <div className="flex align-items-center gap-3">
                                <div
                                    className="text-white border-round-xl px-3 py-2 text-center flex-shrink-0 flex flex-column justify-content-center"
                                    style={{ backgroundColor: '#0f766e', minWidth: '64px' }}
                                >
                                    <span className="font-bold text-[9px] uppercase tracking-wider block" style={{ opacity: 0.9 }}>
                                        VISIT
                                    </span>
                                    <span className="text-xl font-black block line-height-1 mt-1">
                                        #{visitNumber}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-900 m-0 mb-1">
                                        {formatDateIndo(selectedVisit.tanggal_kunjungan)}
                                    </h3>
                                    <div className="flex align-items-center gap-3 flex-wrap text-xs text-500">
                                        <span className="flex align-items-center gap-1.5 font-medium">
                                            <Clock size={14} className="text-400" />
                                            {selectedVisit.jam_datang || '-'} WIB
                                        </span>
                                        <span>•</span>
                                        <span className="flex align-items-center gap-1.5 font-medium">
                                            <ClipboardList size={14} className="text-400" />
                                            {layananList.length} Sesi Layanan
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-12 md:col-4 mt-2 md:mt-0">
                            {headerRM.dokter_nama ? (
                                <div className="surface-50 border-round-lg border-1 surface-border p-2.5 flex align-items-center gap-2.5">
                                    <div
                                        className="border-round-circle flex align-items-center justify-content-center flex-shrink-0"
                                        style={{ width: '36px', height: '36px', backgroundColor: '#f0fdfa', color: '#0f766e' }}
                                    >
                                        <User size={16} />
                                    </div>
                                    <div className="overflow-hidden">
                                        <span className="block text-500 font-bold uppercase tracking-wider" style={{ fontSize: '10px' }}>
                                            Dokter Penanggung Jawab
                                        </span>
                                        <span className="font-semibold text-900 text-xs block text-truncate">
                                            dr. {headerRM.dokter_nama.replace(/^dr\.\s*/i, '')}
                                        </span>
                                        {headerRM.no_sip && (
                                            <span className="font-mono text-400 block" style={{ fontSize: '11px' }}>
                                                SIP: {headerRM.no_sip}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="surface-50 border-round-lg border-1 surface-border p-2.5 flex align-items-center gap-2 text-400 text-xs italic">
                                    <User size={16} className="text-400" />
                                    <span>Dokter belum ditentukan</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── ALLERGY ALERT (Aksen Medis: Soft Rose) ── */}
                {hasAllergy && (
                    <div
                        className="p-3 border-round-lg border-1 flex align-items-center gap-3"
                        style={{
                            backgroundColor: '#fff1f2',
                            borderColor: '#fecdd3',
                            borderLeft: '4px solid #e11d48',
                        }}
                    >
                        <AlertTriangle size={18} style={{ color: '#e11d48' }} className="flex-shrink-0" />
                        <div className="flex flex-column">
                            <span
                                className="text-xs font-bold uppercase tracking-wider"
                                style={{ color: '#be123c' }}
                            >
                                Peringatan Alergi Pasien
                            </span>
                            <span
                                className="text-xs font-semibold"
                                style={{ color: '#881337' }}
                            >
                                {headerRM.riwayat_alergi}
                            </span>
                        </div>
                    </div>
                )}

                {/* ── SECTION 1: ANAMNESIS & RIWAYAT PASIEN ── */}
                <div className="surface-card border-round-xl border-1 surface-border overflow-hidden">
                    <div className="px-3 py-2.5 surface-100 border-bottom-1 surface-border flex align-items-center gap-2">
                        <FileText size={16} className="text-teal-700" />
                        <span className="text-xs font-bold text-700 uppercase tracking-wider">
                            Anamnesis & Riwayat Pasien
                        </span>
                    </div>
                    <div className="p-3">
                        <div className="grid formgrid text-xs">
                            <div className="col-12 md:col-4 mb-2 md:mb-0">
                                <div className="surface-50 border-round-lg border-1 surface-border p-3 h-full">
                                    <span className="text-500 font-bold uppercase block mb-1.5" style={{ fontSize: '10px' }}>
                                        Keluhan Utama
                                    </span>
                                    {renderFieldContent(headerRM.keluhan, 'Tidak ada keluhan khusus')}
                                </div>
                            </div>
                            <div className="col-12 md:col-4 mb-2 md:mb-0">
                                <div className="surface-50 border-round-lg border-1 surface-border p-3 h-full">
                                    <span className="text-500 font-bold uppercase block mb-1.5" style={{ fontSize: '10px' }}>
                                        Durasi Keluhan
                                    </span>
                                    {renderFieldContent(headerRM.durasi_keluhan, 'Tidak disebutkan')}
                                </div>
                            </div>
                            <div className="col-12 md:col-4">
                                <div className="surface-50 border-round-lg border-1 surface-border p-3 h-full">
                                    <span className="text-500 font-bold uppercase block mb-1.5" style={{ fontSize: '10px' }}>
                                        Treatment Sebelumnya
                                    </span>
                                    {renderFieldContent(headerRM.riwayat_treatment, 'Belum pernah treatment sebelumnya')}
                                </div>
                            </div>
                        </div>

                        {/* Foto Before Awal */}
                        {beforeFotoUrl && (
                            <div className="mt-3 pt-3 border-top-1 surface-border flex align-items-center gap-3">
                                <div
                                    className="relative border-round-lg overflow-hidden border-1 surface-border cursor-pointer shadow-1 flex-shrink-0"
                                    style={{ width: '64px', height: '64px' }}
                                    onClick={() => openPhotoZoom(beforeFotoUrl, `Foto Kondisi Awal — ${formatDateIndo(selectedVisit.tanggal_kunjungan)}`)}
                                >
                                    <img
                                        src={getFullImageUrl(beforeFotoUrl)}
                                        alt="Foto Awal"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            if (!target.src.includes('/api/assets')) {
                                                target.src = `/api/assets${beforeFotoUrl}`;
                                            }
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-black-alpha-30 opacity-0 hover:opacity-100 flex align-items-center justify-content-center transition-all">
                                        <ZoomIn size={16} className="text-white" />
                                    </div>
                                </div>
                                <div className="text-xs">
                                    <span className="font-semibold text-900 block mb-0.5">Foto Kondisi Awal Pasien</span>
                                    <span className="text-400 text-[11px]">Klik untuk melihat foto ukuran penuh</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── SECTION 2: EVALUASI KULIT (5 Card Konsisten) ── */}
                <div className="surface-card border-round-xl border-1 surface-border overflow-hidden">
                    <div className="px-3 py-2.5 surface-100 border-bottom-1 surface-border flex align-items-center gap-2">
                        <Activity size={16} className="text-teal-700" />
                        <span className="text-xs font-bold text-700 uppercase tracking-wider">
                            Hasil Evaluasi Kulit
                        </span>
                    </div>
                    <div className="p-3">
                        <div className="grid formgrid text-xs">
                            {(() => {
                                const items = [
                                    {
                                        label: 'Jenis Kulit',
                                        value: headerRM.pemeriksaan_skin_type || 'Normal',
                                        isFinding:
                                            Boolean(headerRM.pemeriksaan_skin_type) &&
                                            headerRM.pemeriksaan_skin_type !== '-' &&
                                            headerRM.pemeriksaan_skin_type.toLowerCase() !== 'normal',
                                    },
                                    {
                                        label: 'Acne',
                                        value:
                                            headerRM.pemeriksaan_acne && headerRM.pemeriksaan_acne !== '-'
                                                ? headerRM.pemeriksaan_acne
                                                : 'Tidak Ada',
                                        isFinding:
                                            Boolean(headerRM.pemeriksaan_acne) &&
                                            headerRM.pemeriksaan_acne !== '-' &&
                                            headerRM.pemeriksaan_acne.toLowerCase() !== 'tidak ada',
                                    },
                                    {
                                        label: 'Inflamasi',
                                        value:
                                            headerRM.pemeriksaan_inflammation && headerRM.pemeriksaan_inflammation !== '-'
                                                ? headerRM.pemeriksaan_inflammation
                                                : 'Tidak Ada',
                                        isFinding:
                                            Boolean(headerRM.pemeriksaan_inflammation) &&
                                            headerRM.pemeriksaan_inflammation !== '-' &&
                                            headerRM.pemeriksaan_inflammation.toLowerCase() !== 'tidak ada',
                                    },
                                    {
                                        label: 'Pigmentasi',
                                        value:
                                            headerRM.pemeriksaan_pigmentation && headerRM.pemeriksaan_pigmentation !== '-'
                                                ? headerRM.pemeriksaan_pigmentation
                                                : 'Tidak Ada',
                                        isFinding:
                                            Boolean(headerRM.pemeriksaan_pigmentation) &&
                                            headerRM.pemeriksaan_pigmentation !== '-' &&
                                            headerRM.pemeriksaan_pigmentation.toLowerCase() !== 'tidak ada',
                                    },
                                    {
                                        label: 'Sensitivitas',
                                        value: headerRM.pemeriksaan_sensitivity || 'Rendah',
                                        isFinding:
                                            headerRM.pemeriksaan_sensitivity === 'Tinggi' ||
                                            headerRM.pemeriksaan_sensitivity === 'Sedang',
                                    },
                                ];

                                return items.map((item, idx) => {
                                    let badgeStyle: React.CSSProperties = {
                                        backgroundColor: '#f8fafc',
                                        color: '#94a3b8',
                                        border: '1px solid #e2e8f0',
                                        fontWeight: 500,
                                    };

                                    if (item.isFinding) {
                                        if (item.label === 'Jenis Kulit') {
                                            badgeStyle = {
                                                backgroundColor: '#f1f5f9',
                                                color: '#334155',
                                                border: '1px solid #cbd5e1',
                                                fontWeight: 600,
                                            };
                                        } else {
                                            badgeStyle = {
                                                backgroundColor: '#f0fdfa',
                                                color: '#0f766e',
                                                border: '1px solid #99f6e4',
                                                fontWeight: 600,
                                            };
                                        }
                                    }

                                    return (
                                        <div key={idx} className="col-6 sm:col-4 md:col mb-2 md:mb-0">
                                            <div className="surface-50 border-round-lg border-1 surface-border p-3 text-center flex flex-column justify-content-between h-full">
                                                <span
                                                    className="text-500 font-bold uppercase block mb-2"
                                                    style={{ fontSize: '10px' }}
                                                >
                                                    {item.label}
                                                </span>
                                                <span
                                                    className="block text-center text-xs border-round py-1.5 px-2"
                                                    style={badgeStyle}
                                                >
                                                    {item.value}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>

                {/* ── SECTION 3: SOAP KLINIS (1 Grid Setara 4 Kolom: S, O, A, P) ── */}
                <div className="surface-card border-round-xl border-1 surface-border overflow-hidden">
                    <div className="px-3 py-2.5 surface-100 border-bottom-1 surface-border flex align-items-center gap-2">
                        <Stethoscope size={16} className="text-teal-700" />
                        <span className="text-xs font-bold text-700 uppercase tracking-wider">
                            SOAP Klinis & Diagnosis
                        </span>
                    </div>
                    <div className="p-3">
                        <div className="grid formgrid text-xs">
                            {/* S — Subjective */}
                            <div className="col-12 sm:col-6 lg:col-3 mb-2 lg:mb-0">
                                <div
                                    className="surface-50 border-round-lg border-1 surface-border p-3 h-full flex flex-column border-left-3"
                                    style={{ borderLeftColor: '#0f766e' }}
                                >
                                    <div className="flex align-items-center gap-1.5 pb-2 mb-2 border-bottom-1 surface-border">
                                        <FileText size={15} className="text-500" />
                                        <span className="text-xs font-bold text-700 uppercase">S — Subjective</span>
                                    </div>
                                    <div className="flex-grow-1">
                                        {renderFieldContent(headerRM.subjective || headerRM.keluhan, '(Tidak dicatat)')}
                                    </div>
                                </div>
                            </div>

                            {/* O — Objective */}
                            <div className="col-12 sm:col-6 lg:col-3 mb-2 lg:mb-0">
                                <div
                                    className="surface-50 border-round-lg border-1 surface-border p-3 h-full flex flex-column border-left-3"
                                    style={{ borderLeftColor: '#0f766e' }}
                                >
                                    <div className="flex align-items-center gap-1.5 pb-2 mb-2 border-bottom-1 surface-border">
                                        <Activity size={15} className="text-500" />
                                        <span className="text-xs font-bold text-700 uppercase">O — Objective</span>
                                    </div>
                                    <div className="flex-grow-1">
                                        {renderFieldContent(headerRM.objective, '(Tidak dicatat)')}
                                    </div>
                                </div>
                            </div>

                            {/* A — Assessment & Diagnosis */}
                            <div className="col-12 sm:col-6 lg:col-3 mb-2 lg:mb-0">
                                <div
                                    className="surface-50 border-round-lg border-1 surface-border p-3 h-full flex flex-column border-left-3"
                                    style={{ borderLeftColor: '#0f766e' }}
                                >
                                    <div className="flex align-items-center gap-1.5 pb-2 mb-2 border-bottom-1 surface-border">
                                        <Stethoscope size={15} className="text-500" />
                                        <span className="text-xs font-bold text-700 uppercase">A — Assessment</span>
                                    </div>
                                    <div className="flex-grow-1">
                                        {(() => {
                                            const dx =
                                                headerRM.diagnosis &&
                                                headerRM.diagnosis !== '-' &&
                                                headerRM.diagnosis.trim() !== ''
                                                    ? headerRM.diagnosis
                                                    : null;
                                            const assess =
                                                headerRM.assessment &&
                                                headerRM.assessment !== '-' &&
                                                headerRM.assessment.trim() !== ''
                                                    ? headerRM.assessment
                                                    : null;

                                            if (!dx && !assess) {
                                                return renderFieldContent(null, '(Tidak dicatat)');
                                            }

                                            return (
                                                <div className="flex flex-column gap-1.5">
                                                    {dx && (
                                                        <div>
                                                            <span className="text-[10px] font-bold text-500 uppercase block mb-0.5">
                                                                Dx Medis:
                                                            </span>
                                                            {renderFieldContent(dx)}
                                                        </div>
                                                    )}
                                                    {assess && (
                                                        <div>
                                                            <span className="text-[10px] font-bold text-500 uppercase block mb-0.5">
                                                                Keterangan:
                                                            </span>
                                                            {renderFieldContent(assess)}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* P — Plan */}
                            <div className="col-12 sm:col-6 lg:col-3">
                                <div
                                    className="surface-50 border-round-lg border-1 surface-border p-3 h-full flex flex-column border-left-3"
                                    style={{ borderLeftColor: '#0f766e' }}
                                >
                                    <div className="flex align-items-center gap-1.5 pb-2 mb-2 border-bottom-1 surface-border">
                                        <ClipboardList size={15} className="text-500" />
                                        <span className="text-xs font-bold text-700 uppercase">P — Plan</span>
                                    </div>
                                    <div className="flex-grow-1">
                                        {renderFieldContent(headerRM.plan, 'Tidak ada rencana khusus')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── SECTION 4: SESI TINDAKAN & HASIL TREATMENT ── */}
                <div className="surface-card border-round-xl border-1 surface-border overflow-hidden">
                    <div className="px-3 py-2.5 surface-100 border-bottom-1 surface-border flex align-items-center justify-content-between">
                        <span className="text-xs font-bold text-700 uppercase tracking-wider flex align-items-center gap-2">
                            <Sparkles size={16} className="text-teal-700" />
                            Sesi Tindakan & Hasil Treatment
                        </span>
                        <span
                            className="text-xs font-bold px-2.5 py-0.5 border-round-pill"
                            style={{ backgroundColor: '#f0fdfa', color: '#0f766e', border: '1px solid #99f6e4' }}
                        >
                            {layananList.length} Sesi
                        </span>
                    </div>
                    <div className="p-3">
                        {layananList.length === 0 ? (
                            <div className="p-4 text-center text-xs text-400 italic surface-50 border-round-lg border-1 surface-border">
                                <FileText size={16} className="block mx-auto mb-2 text-400" />
                                Tidak ada catatan tindakan pada kunjungan ini.
                            </div>
                        ) : (
                            <div className="flex flex-column gap-3">
                                {layananList.map((layanan: any, lIdx: number) => {
                                    const isKonsul =
                                        (layanan.nama_ruangan &&
                                            layanan.nama_ruangan.toLowerCase().includes('konsul')) ||
                                        layanan.jenis_layanan === 'konsultasi';
                                    const fotos = layanan.rekam_medis?.fotos || [];

                                    const validFormData = (
                                        layanan.rekam_medis?.formatted_data_form || []
                                    ).filter(
                                        (f: any) =>
                                            f.key &&
                                            f.key !== 'undefined' &&
                                            f.key !== 'null' &&
                                            f.value &&
                                            f.value !== '-' &&
                                            f.value !== ''
                                    );

                                    const hasAnyContent =
                                        layanan.catatan_petugas ||
                                        layanan.catatan_tindakan ||
                                        layanan.catatan_hasil_treatment ||
                                        validFormData.length > 0 ||
                                        fotos.length > 0;

                                    return (
                                        <div
                                            key={layanan.kode_antrian_layanan || lIdx}
                                            className="border-round-lg border-1 surface-border overflow-hidden"
                                        >
                                            {/* Sesi Header */}
                                            <div className="surface-50 px-3 py-2.5 border-bottom-1 surface-border flex align-items-center justify-content-between flex-wrap gap-2">
                                                <div className="flex align-items-center gap-2">
                                                    <span
                                                        className="text-[10px] font-bold px-2 py-0.5 border-round-pill uppercase"
                                                        style={
                                                            isKonsul
                                                                ? {
                                                                      backgroundColor: '#f1f5f9',
                                                                      color: '#475569',
                                                                      border: '1px solid #cbd5e1',
                                                                  }
                                                                : {
                                                                      backgroundColor: '#f0fdfa',
                                                                      color: '#0f766e',
                                                                      border: '1px solid #99f6e4',
                                                                  }
                                                        }
                                                    >
                                                        {isKonsul ? 'Konsultasi' : 'Tindakan'}
                                                    </span>
                                                    <span className="font-bold text-900 text-sm">
                                                        {layanan.nama_layanan || 'Pelayanan Klinis'}
                                                    </span>
                                                </div>
                                                <div className="flex align-items-center gap-2">
                                                    {layanan.status && (
                                                        <span
                                                            className="text-[10px] font-bold px-2 py-0.5 border-round-pill uppercase"
                                                            style={
                                                                layanan.status.toLowerCase() === 'selesai'
                                                                    ? {
                                                                          backgroundColor: '#f0fdfa',
                                                                          color: '#0f766e',
                                                                          border: '1px solid #99f6e4',
                                                                      }
                                                                    : {
                                                                          backgroundColor: '#eff6ff',
                                                                          color: '#1d4ed8',
                                                                          border: '1px solid #bfdbfe',
                                                                      }
                                                            }
                                                        >
                                                            {layanan.status}
                                                        </span>
                                                    )}
                                                    {layanan.nama_ruangan && (
                                                        <span className="text-xs text-500 font-medium flex align-items-center gap-1 ml-1">
                                                            <Building2 size={13} className="text-400" />
                                                            {layanan.nama_ruangan}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Sesi Body */}
                                            <div className="p-3 flex flex-column gap-3 text-xs">
                                                {/* Petugas & Terapis Lengkap Row */}
                                                {(() => {
                                                    const terapisList: any[] = Array.isArray(layanan.terapis_pendamping) && layanan.terapis_pendamping.length > 0
                                                        ? layanan.terapis_pendamping
                                                        : (Array.isArray(layanan.daftar_petugas) && layanan.daftar_petugas.length > 0
                                                            ? layanan.daftar_petugas.filter((p: any) => !p.is_dokter_pj && p.role !== 'DOKTER')
                                                            : (Array.isArray(headerRM.terapis_list) ? headerRM.terapis_list : []));

                                                    const dokterPelaksana = layanan.petugas || layanan.rekam_medis?.dokter_penanggung_jawab || (
                                                        Array.isArray(layanan.daftar_petugas) ? layanan.daftar_petugas.find((p: any) => p.is_dokter_pj || p.role === 'DOKTER') : null
                                                    ) || (headerRM.dokter_nama ? { nama: headerRM.dokter_nama, jabatan: headerRM.dokter_jabatan || 'Dokter', no_sip: headerRM.no_sip } : null);

                                                    return (
                                                        <div className="surface-50 p-2.5 border-round-lg border-1 surface-border flex flex-column gap-2">
                                                            <div className="flex align-items-center justify-content-between">
                                                                <span className="text-[10px] font-bold text-500 uppercase tracking-wider flex align-items-center gap-1.5">
                                                                    <User size={13} className="text-teal-700" />
                                                                    <span>Dokter &amp; Petugas Pelaksana Ruangan:</span>
                                                                </span>
                                                                <span className="text-[10px] font-semibold text-500 bg-surface-100 px-2 py-0.5 border-round">
                                                                    {(terapisList.length > 0 ? terapisList.length + 1 : (dokterPelaksana ? 1 : 0))} Petugas
                                                                </span>
                                                            </div>
                                                            <div className="grid formgrid m-0">
                                                                {/* 1. Dokter / PJ Medis */}
                                                                {dokterPelaksana && (
                                                                    <div className="col-12 md:col-6 p-1">
                                                                        <div className="bg-white p-2 border-round-md border-1 surface-border flex align-items-center gap-2">
                                                                            <div className="w-2rem h-2rem border-round-md bg-teal-50 border-1 border-teal-100 text-teal-700 flex align-items-center justify-content-center text-xs flex-shrink-0">
                                                                                👨‍⚕️
                                                                            </div>
                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="flex align-items-center gap-1.5 flex-wrap">
                                                                                    <span className="font-bold text-900 text-xs line-height-2 text-overflow-ellipsis overflow-hidden">
                                                                                        {dokterPelaksana?.nama || 'Dokter Penanggung Jawab'}
                                                                                    </span>
                                                                                    <span className="text-[9px] font-semibold bg-teal-50 text-teal-700 border-1 border-teal-200 px-1.5 py-0.5 border-round">
                                                                                        {(dokterPelaksana?.jabatan || 'DOKTER/PJ').toUpperCase()}
                                                                                    </span>
                                                                                </div>
                                                                                <span className="text-[10px] text-500 block">
                                                                                    SIP: {dokterPelaksana?.kode_karyawan || dokterPelaksana?.no_sip || headerRM.no_sip || '-'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* 2. Terapis / Petugas Pendamping (1, 2, 3 atau lebih) */}
                                                                {terapisList.length > 0 && (
                                                                    terapisList.map((terapis: any, tIdx: number) => {
                                                                        const roleBadge = (terapis.role || terapis.jabatan || 'TERAPIS').toUpperCase();
                                                                        let jamText = '';
                                                                        if (terapis.jam_mulai && terapis.jam_selesai) {
                                                                            const start = terapis.jam_mulai.slice(0, 5);
                                                                            const end = terapis.jam_selesai.startsWith('24:00') ? '00:00' : terapis.jam_selesai.slice(0, 5);
                                                                            jamText = `${start} - ${end}`;
                                                                        } else if (terapis.shift) {
                                                                            jamText = String(terapis.shift).replace(/[\[\]]/g, '').trim();
                                                                        }

                                                                        return (
                                                                            <div key={`t-${tIdx}`} className="col-12 md:col-6 p-1">
                                                                                <div className="bg-white p-2 border-round-md border-1 surface-border flex align-items-center gap-2">
                                                                                    <div className="w-2rem h-2rem border-round-md bg-purple-50 border-1 border-purple-100 text-purple-700 flex align-items-center justify-content-center text-xs flex-shrink-0">
                                                                                        💆‍♀️
                                                                                    </div>
                                                                                    <div className="min-w-0 flex-1">
                                                                                        <div className="flex align-items-center gap-1.5 flex-wrap">
                                                                                            <span className="font-bold text-900 text-xs line-height-2 text-overflow-ellipsis overflow-hidden">
                                                                                                {terapis.nama || terapis.nama_petugas}
                                                                                            </span>
                                                                                            <span className="text-[9px] font-semibold bg-purple-50 text-purple-700 border-1 border-purple-200 px-1.5 py-0.5 border-round">
                                                                                                {roleBadge}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="text-[10px] text-500 flex align-items-center gap-1.5 flex-wrap">
                                                                                            <span>SIP: {terapis.no_sip || terapis.sip || '-'}</span>
                                                                                            {jamText && (
                                                                                                <>
                                                                                                    <span className="text-300">•</span>
                                                                                                    <span>{jamText}</span>
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Catatan Petugas */}
                                                {layanan.catatan_petugas && (
                                                    <div
                                                        className="surface-50 p-3 border-round-lg border-1 surface-border border-left-3"
                                                        style={{ borderLeftColor: '#0f766e' }}
                                                    >
                                                        <span className="text-[10px] font-bold text-500 uppercase block mb-1 flex align-items-center gap-1">
                                                            <FileText size={12} className="text-teal-700" />
                                                            Catatan Petugas:
                                                        </span>
                                                        <div className="white-space-pre-line">
                                                            {renderFieldContent(layanan.catatan_petugas)}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Catatan Tindakan & Hasil Treatment */}
                                                {(layanan.catatan_tindakan || layanan.catatan_hasil_treatment) && (
                                                    <div className="grid formgrid">
                                                        {layanan.catatan_tindakan && (
                                                            <div className="col-12 md:col-6 mb-2 md:mb-0">
                                                                <div className="surface-50 p-3 border-round-lg border-1 surface-border h-full">
                                                                    <span className="text-[10px] font-bold text-500 uppercase block mb-1">
                                                                        Catatan Tindakan:
                                                                    </span>
                                                                    {renderFieldContent(layanan.catatan_tindakan)}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {layanan.catatan_hasil_treatment && (
                                                            <div className="col-12 md:col-6">
                                                                <div className="surface-50 p-3 border-round-lg border-1 surface-border h-full">
                                                                    <span className="text-[10px] font-bold text-500 uppercase block mb-1">
                                                                        Hasil Treatment:
                                                                    </span>
                                                                    {renderFieldContent(layanan.catatan_hasil_treatment)}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Data Form Klinis */}
                                                {validFormData.length > 0 && (
                                                    <div className="surface-50 p-3 border-round-lg border-1 surface-border">
                                                        <span className="text-[10px] font-bold text-500 uppercase block mb-2 flex align-items-center gap-1">
                                                            <ClipboardList size={13} className="text-teal-700" />
                                                            Data Klinis Ruangan:
                                                        </span>
                                                        <div className="grid formgrid">
                                                            {validFormData.map((f: any, fIdx: number) => (
                                                                <div key={fIdx} className="col-12 sm:col-6 mb-1.5">
                                                                    <span className="text-400 text-[10px] block font-medium">
                                                                        {f.label}
                                                                    </span>
                                                                    <span className="font-medium text-900 text-xs">
                                                                        {String(f.value)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Foto Before & After */}
                                                {fotos && fotos.length > 0 && (
                                                    <div className="pt-2 border-top-1 surface-border">
                                                        <span className="text-[10px] font-bold text-500 uppercase block mb-2 flex align-items-center gap-1">
                                                            <ImageIcon size={13} className="text-teal-700" />
                                                            Dokumentasi Foto Sesi:
                                                        </span>
                                                        <div className="flex gap-3 flex-wrap">
                                                            {fotos.map((foto: any, fIdx: number) => {
                                                                const isBefore =
                                                                    foto.tipe === 'before' || foto.tipe === 'foto_before';
                                                                const isAfter =
                                                                    foto.tipe === 'after' || foto.tipe === 'foto_after';
                                                                const badgeLabel = isBefore
                                                                    ? 'BEFORE'
                                                                    : isAfter
                                                                    ? 'AFTER'
                                                                    : foto.tipe;
                                                                const fullUrl = getFullImageUrl(foto.url_foto);

                                                                return (
                                                                    <div
                                                                        key={foto.id || fIdx}
                                                                        className="flex flex-column align-items-center gap-1.5 cursor-pointer"
                                                                        onClick={() =>
                                                                            openPhotoZoom(
                                                                                foto.url_foto,
                                                                                `${badgeLabel} — ${layanan.nama_layanan || 'Treatment'}`
                                                                            )
                                                                        }
                                                                    >
                                                                        <div
                                                                            className="relative border-round-lg overflow-hidden border-1 surface-border shadow-1 hover:shadow-2 transition-all"
                                                                            style={{ width: '80px', height: '80px' }}
                                                                        >
                                                                            <img
                                                                                src={fullUrl}
                                                                                alt={badgeLabel}
                                                                                className="w-full h-full object-cover"
                                                                                onError={(e) => {
                                                                                    const target = e.target as HTMLImageElement;
                                                                                    if (
                                                                                        !target.src.includes('/api/assets') &&
                                                                                        foto.url_foto
                                                                                    ) {
                                                                                        target.src = `/api/assets${foto.url_foto}`;
                                                                                    }
                                                                                }}
                                                                            />
                                                                            <div className="absolute inset-0 bg-black-alpha-30 opacity-0 hover:opacity-100 flex align-items-center justify-content-center transition-all">
                                                                                <ZoomIn size={16} className="text-white" />
                                                                            </div>
                                                                        </div>
                                                                        <span
                                                                            className="text-[9px] font-bold px-1.5 py-0.5 border-round uppercase"
                                                                            style={
                                                                                isBefore
                                                                                    ? {
                                                                                          backgroundColor: '#f1f5f9',
                                                                                          color: '#475569',
                                                                                          border: '1px solid #cbd5e1',
                                                                                      }
                                                                                    : {
                                                                                          backgroundColor: '#f0fdfa',
                                                                                          color: '#0f766e',
                                                                                          border: '1px solid #99f6e4',
                                                                                      }
                                                                            }
                                                                        >
                                                                            {badgeLabel}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Fallback jika tidak ada catatan/foto khusus */}
                                                {!hasAnyContent && (
                                                    <div className="surface-50 border-round p-2 text-xs text-400 italic flex align-items-center gap-1.5">
                                                        <CheckCircle2 size={14} className="text-teal-600" />
                                                        <span>
                                                            Pelayanan sesi telah diselesaikan tanpa catatan klinis tambahan.
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // ==========================================
    // RENDER TABLE VIEW (DEFAULT LIST)
    // ==========================================
    const renderTableView = () => {
        // DataTable header matching master-data format exactly
        const tableHeader = (
            <div className="flex flex-column gap-3">
                <div className="flex flex-wrap align-items-center justify-content-between gap-2">
                    <span className="text-xl font-bold">Riwayat Kunjungan Pasien</span>
                    <div className="flex align-items-center gap-2 ml-auto w-full md:w-auto">
                        <IconField iconPosition="left" className="w-full md:w-20rem">
                            <InputIcon className="pi pi-search" />
                            <InputText
                                value={globalFilter}
                                onChange={(e) => setGlobalFilter(e.target.value)}
                                placeholder="Cari Data..."
                                className="w-full text-sm"
                            />
                        </IconField>
                        <Button
                            type="button"
                            icon="pi pi-filter-slash"
                            outlined
                            severity="danger"
                            tooltip="Reset Filter"
                            tooltipOptions={{ position: 'bottom' }}
                            onClick={() => setGlobalFilter('')}
                        />
                    </div>
                </div>
                <div className="flex flex-wrap align-items-center gap-3 px-1 py-2 border-round-md surface-100 text-xs font-medium text-color-secondary">
                    <span className="flex align-items-center gap-1">
                        <i className="pi pi-info-circle" />
                        <span className="font-semibold">KETERANGAN STATUS:</span>
                    </span>
                    <span className="flex align-items-center gap-1">
                        <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#22c55e', boxShadow: '0 1px 3px #22c55e55' }} />
                        Selesai
                    </span>
                </div>
            </div>
        );

        return (
            <DataTable
                value={filteredRiwayatList}
                loading={loading}
                emptyMessage="Tidak ada data riwayat kunjungan pasien ditemukan."
                className="p-datatable-sm"
                rowHover
                stripedRows
                paginator
                rows={10}
                rowsPerPageOptions={[5, 10, 20]}
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                currentPageReportTemplate="Menampilkan {first} - {last} dari {totalRecords} data"
                header={tableHeader}
                responsiveLayout="scroll"
            >
                {/* No */}
                <Column
                    header="No"
                    align="center"
                    alignHeader="center"
                    headerStyle={{ width: '50px', textAlign: 'center', fontWeight: 'bold' }}
                    style={{ width: '50px', textAlign: 'center' }}
                    body={(_, options) => (
                        <span className="font-semibold text-color-secondary">
                            {options.rowIndex + 1}
                        </span>
                    )}
                />

                {/* Status Indicator (Hanya Warna Sesuai Master Data) */}
                <Column
                    header=""
                    headerStyle={{ width: '3rem' }}
                    align="center"
                    body={(rowData) => {
                        const isSelesai = rowData.status_kunjungan === 'selesai';
                        return (
                            <span
                                style={{
                                    display: 'inline-block',
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '3px',
                                    backgroundColor: isSelesai ? '#22c55e' : '#f59e0b',
                                    boxShadow: isSelesai ? '0 1px 3px #22c55e55' : '0 1px 3px #f59e0b55',
                                    verticalAlign: 'middle',
                                }}
                                title={isSelesai ? 'Status: Selesai' : 'Status: Dalam Proses'}
                            />
                        );
                    }}
                />

                {/* Tanggal Kunjungan */}
                <Column
                    header="Tanggal Kunjungan"
                    sortable
                    sortField="tanggal_kunjungan"
                    headerStyle={{ fontWeight: 'bold' }}
                    style={{ minWidth: '160px' }}
                    body={(rowData) => (
                        <div>
                            <div className="font-bold text-900">
                                {formatShortDate(rowData.tanggal_kunjungan)}
                            </div>
                            <div className="text-xs text-500 mt-1">
                                {rowData.jam_datang || '-'} WIB
                            </div>
                        </div>
                    )}
                />

                {/* Kode Kunjungan */}
                <Column
                    header="Kode"
                    headerStyle={{ fontWeight: 'bold' }}
                    style={{ width: '130px' }}
                    body={(rowData) => (
                        <span className="font-mono font-semibold text-color-secondary text-xs">
                            {rowData.kode_kunjungan || '-'}
                        </span>
                    )}
                />

                {/* Dokter & Petugas Pelaksana */}
                <Column
                    header="Dokter / Petugas"
                    sortable
                    sortField="header_rekam_medis.dokter_nama"
                    headerStyle={{ fontWeight: 'bold' }}
                    style={{ minWidth: '180px' }}
                    body={(rowData) => {
                        let dokter = rowData.header_rekam_medis?.dokter_nama;
                        const layList = rowData.layanan || [];

                        if (!dokter && layList.length > 0) {
                            for (const lay of layList) {
                                if (lay.petugas?.nama) {
                                    dokter = lay.petugas.nama;
                                    break;
                                }
                                if (Array.isArray(lay.daftar_petugas)) {
                                    const pj = lay.daftar_petugas.find((p: any) => p.is_dokter_pj || p.role === 'DOKTER');
                                    if (pj?.nama) {
                                        dokter = pj.nama;
                                        break;
                                    }
                                }
                                if (lay.rekam_medis?.dokter_penanggung_jawab?.nama) {
                                    dokter = lay.rekam_medis.dokter_penanggung_jawab.nama;
                                    break;
                                }
                            }
                        }

                        // Kumpulkan nama terapis pendamping jika ada
                        const terapisNames: string[] = [];
                        if (Array.isArray(rowData.header_rekam_medis?.terapis_list)) {
                            rowData.header_rekam_medis.terapis_list.forEach((t: any) => {
                                const tName = t?.nama || t?.nama_petugas;
                                if (tName && !terapisNames.includes(tName)) terapisNames.push(tName);
                            });
                        }
                        layList.forEach((lay: any) => {
                            if (Array.isArray(lay.terapis_pendamping)) {
                                lay.terapis_pendamping.forEach((t: any) => {
                                    const tName = t?.nama || t?.nama_petugas;
                                    if (tName && !terapisNames.includes(tName)) terapisNames.push(tName);
                                });
                            }
                            if (Array.isArray(lay.daftar_petugas)) {
                                lay.daftar_petugas.forEach((p: any) => {
                                    if (!p.is_dokter_pj && p.role !== 'DOKTER' && p.nama && !terapisNames.includes(p.nama)) {
                                        terapisNames.push(p.nama);
                                    }
                                });
                            }
                        });

                        if (!dokter && terapisNames.length === 0) {
                            return <span className="text-500">-</span>;
                        }

                        const cleanDokter = dokter
                            ? (dokter.toLowerCase().startsWith('dr') || dokter.includes(',') ? dokter : `dr. ${dokter}`)
                            : null;

                        return (
                            <div className="flex flex-column gap-1">
                                {cleanDokter && (
                                    <span className="font-semibold text-900 text-sm">
                                        {cleanDokter}
                                    </span>
                                )}
                                {terapisNames.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1">
                                        <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 font-medium">
                                            Terapis: {terapisNames.join(', ')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    }}
                />

                {/* Layanan */}
                <Column
                    header="Layanan"
                    headerStyle={{ fontWeight: 'bold' }}
                    style={{ minWidth: '180px' }}
                    body={(rowData) => {
                        const layList = rowData.layanan || [];
                        if (layList.length === 0) return <span className="text-500">-</span>;

                        // Ambil nama layanan unik agar layanan yang sama pada sesi Konsultasi & Tindakan tidak tampil dobel
                        const uniqueLayananNames = Array.from(
                            new Set(layList.map((l: any) => l.nama_layanan).filter(Boolean))
                        );

                        return (
                            <div className="flex flex-column gap-1">
                                {uniqueLayananNames.slice(0, 2).map((nama: any, lIdx: number) => (
                                    <span
                                        key={lIdx}
                                        className="text-900 text-truncate block font-medium"
                                        title={nama}
                                        style={{ maxWidth: '200px' }}
                                    >
                                        {nama}
                                    </span>
                                ))}
                                {uniqueLayananNames.length > 2 && (
                                    <span className="text-xs text-teal-700 font-bold">
                                        +{uniqueLayananNames.length - 2} lainnya
                                    </span>
                                )}
                            </div>
                        );
                    }}
                />

                {/* Diagnosis */}
                <Column
                    header="Diagnosis"
                    headerStyle={{ fontWeight: 'bold' }}
                    style={{ minWidth: '150px' }}
                    body={(rowData) => {
                        const diag = rowData.header_rekam_medis?.diagnosis;
                        return diag && diag !== '-' ? (
                            <span className="font-semibold text-900 text-truncate block" title={diag} style={{ maxWidth: '180px' }}>
                                {diag}
                            </span>
                        ) : (
                            <span className="text-500">-</span>
                        );
                    }}
                />


                {/* Aksi */}
                <Column
                    header="Aksi"
                    align="center"
                    alignHeader="center"
                    headerStyle={{ width: '110px', textAlign: 'center', fontWeight: 'bold' }}
                    style={{ width: '110px', textAlign: 'center' }}
                    body={(rowData) => (
                        <div className="flex align-items-center justify-content-center gap-2">
                            <Button
                                icon="pi pi-eye"
                                outlined
                                severity="info"
                                className="p-button-sm border-round-md"
                                tooltip="Lihat Detail RME"
                                tooltipOptions={{ position: 'top' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedVisit(rowData);
                                }}
                            />
                            <Button
                                icon={<IconMedicalRecord size={16} />}
                                outlined
                                severity="success"
                                className="p-button-sm border-round-md"
                                tooltip="Cetak Laporan RME"
                                tooltipOptions={{ position: 'top' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setVisitToPrint(rowData);
                                    setPrintModalVisible(true);
                                }}
                            />
                        </div>
                    )}
                />
            </DataTable>
        );
    };

    return (
        <>
            <Sidebar
                visible={visible}
                position="right"
                onHide={onHide}
                header={customHeader}
                className="w-full md:w-11 lg:w-10 xl:w-9"
                style={{ maxWidth: '1280px' }}
            >
                <div className="p-1 md:p-3 pb-6">
                    {loading ? (
                        <div className="flex flex-column align-items-center justify-content-center p-6 text-center surface-card border-round-2xl border-1 surface-border my-4 shadow-1">
                            <ProgressSpinner style={{ width: '44px', height: '44px' }} strokeWidth="4" />
                            <div className="text-sm font-bold text-700 mt-3">Memuat riwayat rekam medis pasien...</div>
                            <span className="text-xs text-500 mt-1">Mengambil data kunjungan, konsultasi dokter, dan tindakan</span>
                        </div>
                    ) : riwayatList.length === 0 ? (
                        <div className="flex flex-column align-items-center justify-content-center p-6 text-center surface-card border-round-2xl border-1 surface-border my-4 shadow-1">
                            <div className="w-4rem h-4rem bg-teal-50 border-circle flex align-items-center justify-content-center mb-3 text-teal-600 shadow-1">
                                <i className="pi pi-folder-open text-3xl" />
                            </div>
                            <h3 className="text-lg font-black text-800 m-0">Belum Ada Riwayat Rekam Medis</h3>
                            <p className="text-xs text-500 mt-2 line-height-3 max-w-24rem m-0">
                                Pasien ini belum memiliki catatan rekam medis atau riwayat tindakan tersimpan di sistem.
                            </p>
                        </div>
                    ) : selectedVisit ? (
                        renderDetailView()
                    ) : (
                        renderTableView()
                    )}
                </div>
            </Sidebar>

            {/* MODAL ZOOM PREVIEW FOTO HIGH RESOLUTION */}
            <Dialog
                header={previewPhotoTitle || 'Dokumentasi Foto Treatment'}
                visible={previewModalVisible}
                onHide={() => setPreviewModalVisible(false)}
                className="w-full max-w-30rem mx-3"
                contentClassName="p-0 text-center bg-black-alpha-90 flex align-items-center justify-content-center"
                dismissableMask
            >
                {previewPhotoUrl ? (
                    <div className="p-3 w-full flex flex-column align-items-center justify-content-center">
                        <img
                            src={previewPhotoUrl}
                            alt="Foto Treatment Preview"
                            className="w-full border-round-xl shadow-4"
                            style={{ maxHeight: '75vh', objectFit: 'contain' }}
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (previewPhotoUrl && !target.src.includes('/api/assets')) {
                                    target.src = `/api/assets${previewPhotoUrl.replace('http://127.0.0.1:8000', '')}`;
                                }
                            }}
                        />
                    </div>
                ) : null}
            </Dialog>
            {/* MODAL PRINT LAPORAN REKAM MEDIS ELEKTRONIK (RME) */}
            <RMEReportPrint
                visible={printModalVisible}
                onHide={() => setPrintModalVisible(false)}
                visitData={visitToPrint}
            />
        </>
    );
};

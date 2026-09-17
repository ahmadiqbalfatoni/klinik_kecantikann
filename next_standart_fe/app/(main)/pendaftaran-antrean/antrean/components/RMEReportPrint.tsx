'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Printer, Download, X, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import postData from '@/lib/axios/postData';

import { IconMedicalRecord } from './DrawerRiwayatPasien';

interface RMEReportPrintProps {
    visible: boolean;
    onHide: () => void;
    visitData: any | null;
}

export const RMEReportPrint: React.FC<RMEReportPrintProps> = ({
    visible,
    onHide,
    visitData,
}) => {
    const printRef = useRef<HTMLDivElement>(null);

    const [clinicConfig, setClinicConfig] = useState<any>({
        msNamaPerusahaan: 'KLINIK KECANTIKAN ESTETIKA',
        msIzinOperasional: 'No. 440/012/Dinkes/Klinik-Estetika/2026',
        msAlamatPerusahaan: 'Jl. Boulevard Raya Barat Blok A No. 18',
        msKotaPerusahaan: 'Kota Madiun 63126',
        msTeleponPerusahaan: '(0351) 456-789',
        msWaKlinik: '0812-3456-7890',
        msEmailPerusahaan: 'info@klinikkecantikan.co.id',
        msWebsitePerusahaan: 'www.klinikkecantikan.co.id',
        msLogoPerusahaan: '',
    });

    useEffect(() => {
        if (visible) {
            postData('/setup/config-data', {
                kode: [
                    'msNamaPerusahaan',
                    'msIzinOperasional',
                    'msAlamatPerusahaan',
                    'msKotaPerusahaan',
                    'msTeleponPerusahaan',
                    'msWaKlinik',
                    'msEmailPerusahaan',
                    'msWebsitePerusahaan',
                    'msLogoPerusahaan',
                ]
            }).then((res) => {
                if (res?.data?.data) {
                    setClinicConfig((prev: any) => ({
                        ...prev,
                        ...res.data.data
                    }));
                }
            }).catch(() => {});
        }
    }, [visible]);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: visitData?.kode_kunjungan ? `RME-${visitData.kode_kunjungan}-${visitData.no_rm || ''}` : 'Laporan-Rekam-Medis',
    });

    if (!visitData) return null;

    // Helper functions
    const headerRM = visitData.header_rekam_medis || {};
    const layananList = visitData.layanan || [];
    const patientName = visitData.nama_pasien || '-';
    const noRm = visitData.no_rm || '-';

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

    const formatDateSimple = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        } catch (_) {
            return dateStr;
        }
    };

    const calculateAge = (birthDateStr?: string) => {
        if (!birthDateStr) return '';
        try {
            const birth = new Date(birthDateStr);
            const now = new Date();
            let age = now.getFullYear() - birth.getFullYear();
            const m = now.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
                age--;
            }
            return age > 0 ? ` (${age} Thn)` : '';
        } catch (_) {
            return '';
        }
    };

    // Format address components
    const formatFullAddress = () => {
        const parts = [
            visitData.patokan,
            visitData.kelurahan_desa ? `Kel. ${visitData.kelurahan_desa}` : '',
            visitData.kecamatan ? `Kec. ${visitData.kecamatan}` : '',
            visitData.kota_kabupaten,
            visitData.provinsi,
            visitData.kode_pos,
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : '-';
    };

    // Format gender
    const formatGender = (g?: string) => {
        if (!g) return '-';
        const up = g.toUpperCase();
        if (up === 'L' || up === 'LAKI-LAKI' || up === 'PRIA') return 'Laki-Laki';
        if (up === 'P' || up === 'PEREMPUAN' || up === 'WANITA') return 'Perempuan';
        return g;
    };

    // Extract vital signs and structured form entries
    const formFieldsCombined: { label: string; value: any }[] = [];
    layananList.forEach((lay: any) => {
        const formItems = lay.rekam_medis?.formatted_data_form || [];
        formItems.forEach((f: any) => {
            if (f.label && f.value !== undefined && f.value !== null && String(f.value).trim() !== '') {
                formFieldsCombined.push({
                    label: f.label,
                    value: f.value,
                });
            }
        });
    });

    let resolvedDokterName = headerRM.dokter_nama || visitData.dokter_nama;
    if (!resolvedDokterName && layananList.length > 0) {
        for (const lay of layananList) {
            if (lay.petugas?.nama) {
                resolvedDokterName = lay.petugas.nama;
                break;
            }
            if (Array.isArray(lay.daftar_petugas)) {
                const pj = lay.daftar_petugas.find((p: any) => p.is_dokter_pj || p.role === 'DOKTER');
                if (pj?.nama) {
                    resolvedDokterName = pj.nama;
                    break;
                }
            }
            if (lay.rekam_medis?.dokter_penanggung_jawab?.nama) {
                resolvedDokterName = lay.rekam_medis.dokter_penanggung_jawab.nama;
                break;
            }
        }
    }
    const dokterName = resolvedDokterName || 'dr. Penanggung Jawab';
    const dokterFormatted = dokterName.toLowerCase().startsWith('dr.') || dokterName.includes(',')
        ? dokterName
        : `dr. ${dokterName}`;

    return (
        <Dialog
            visible={visible}
            onHide={onHide}
            header={
                <div className="flex align-items-center justify-content-between w-full pr-3">
                    <div className="flex align-items-center gap-2">
                        <div className="w-2rem h-2rem border-round-lg bg-teal-50 text-teal-700 flex align-items-center justify-content-center shadow-1">
                            <IconMedicalRecord size={20} className="text-teal-700" />
                        </div>
                        <div>
                            <span className="font-bold text-base text-900 block">Cetak Laporan Rekam Medis Pasien (RME)</span>
                            <span className="text-xs text-500 font-mono">No. RM: {noRm} • Kunjungan: {visitData.kode_kunjungan}</span>
                        </div>
                    </div>
                    <div className="flex align-items-center gap-2">
                        <Button
                            label="Cetak Dokumen"
                            icon="pi pi-print"
                            severity="success"
                            size="small"
                            className="font-bold border-round-lg px-3 shadow-1"
                            onClick={() => handlePrint()}
                        />
                    </div>
                </div>
            }
            modal
            style={{ width: '90vw', maxWidth: '960px' }}
            contentClassName="p-0 bg-gray-100"
            footer={
                <div className="flex justify-content-between align-items-center px-3 py-2 bg-white border-top-1 surface-border">
                    <span className="text-xs text-500">
                        Pastikan ukuran kertas printer diatur ke <strong>A4</strong> (Portrait) dengan Margin Default/Minimum.
                    </span>
                    <div className="flex gap-2">
                        <Button
                            label="Tutup"
                            icon="pi pi-times"
                            severity="secondary"
                            outlined
                            size="small"
                            className="border-round-lg"
                            onClick={onHide}
                        />
                        <Button
                            label="Cetak Sekarang"
                            icon="pi pi-print"
                            severity="success"
                            size="small"
                            className="font-bold border-round-lg px-4"
                            onClick={() => handlePrint()}
                        />
                    </div>
                </div>
            }
        >
            {/* PREVIEW CONTAINER */}
            <div className="p-3 md:p-5 flex justify-content-center overflow-auto" style={{ maxHeight: '76vh' }}>
                <div
                    ref={printRef}
                    className="rme-print-document bg-white text-900 shadow-3 p-4 md:p-6 border-round-md"
                    style={{
                        width: '210mm',
                        minHeight: '297mm',
                        margin: '0 auto',
                        fontSize: '11px',
                        lineHeight: '1.4',
                        fontFamily: "'Inter', Arial, Helvetica, sans-serif",
                        color: '#0f172a',
                        boxSizing: 'border-box',
                    }}
                >
                    {/* CSS FOR PRINT */}
                    <style>{`
                        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
                        @media print {
                            @page {
                                size: A4 portrait;
                                margin: 7mm 8mm 7mm 8mm;
                            }
                            body {
                                background: #ffffff !important;
                                print-color-adjust: exact;
                                -webkit-print-color-adjust: exact;
                            }
                            .rme-print-document {
                                width: 100% !important;
                                min-height: auto !important;
                                padding: 0 !important;
                                margin: 0 !important;
                                box-shadow: none !important;
                                border-radius: 0 !important;
                                font-size: 8.5px !important;
                                line-height: 1.25 !important;
                            }
                            .no-print {
                                display: none !important;
                            }
                        }
                        .rme-table-info td {
                            padding: 1px 3px;
                            vertical-align: top;
                            line-height: 1.25;
                        }
                        .rme-section-header {
                            background-color: #f1f5f9;
                            border-left: 2.5px solid #0d9488;
                            padding: 2px 5px;
                            font-weight: 700;
                            font-size: 8.5px;
                            text-transform: uppercase;
                            letter-spacing: 0.3px;
                            color: #0f172a;
                            margin-top: 3px;
                            margin-bottom: 2px;
                        }
                        .rme-border-box {
                            border: 1px solid #cbd5e1;
                            border-radius: 3px;
                            padding: 3px 5px;
                        }
                        .rme-data-table {
                            width: 100%;
                            border-collapse: collapse;
                        }
                        .rme-data-table th {
                            background-color: #f8fafc;
                            border: 1px solid #cbd5e1;
                            padding: 2px 4px;
                            font-size: 8px;
                            font-weight: 700;
                            text-align: left;
                        }
                        .rme-data-table td {
                            border: 1px solid #cbd5e1;
                            padding: 2px 4px;
                            font-size: 8.5px;
                            vertical-align: top;
                            line-height: 1.2;
                        }
                    `}</style>

                    {/* 1. HEADER / KOP KLINIK */}
                    <div className="flex align-items-center justify-content-between pb-1 mb-1" style={{ borderBottom: '1.5px solid #0f172a' }}>
                        <div className="flex align-items-center gap-2">
                            {clinicConfig.msLogoPerusahaan ? (
                                <img
                                    src={clinicConfig.msLogoPerusahaan}
                                    alt="Logo Klinik"
                                    style={{
                                        width: '38px',
                                        height: '38px',
                                        borderRadius: '8px',
                                        objectFit: 'contain',
                                        flexShrink: 0,
                                    }}
                                    onError={(e: any) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: '38px',
                                        height: '38px',
                                        borderRadius: '8px',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#ffffff',
                                        boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                                        flexShrink: 0,
                                    }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                        spa
                                    </span>
                                </div>
                            )}
                            <div>
                                <h1 style={{ margin: 0, fontSize: '14px', fontWeight: 800, letterSpacing: '0.3px', color: '#0f172a', lineHeight: 1.15 }}>
                                    {clinicConfig.msNamaPerusahaan || 'KLINIK KECANTIKAN ESTETIKA'}
                                </h1>
                                <p style={{ margin: 0, fontSize: '8px', color: '#475569', fontWeight: 600 }}>
                                    {clinicConfig.msIzinOperasional ? `Izin Operasional Klinik: ${clinicConfig.msIzinOperasional}` : 'Izin Operasional Klinik: No. 440/012/Dinkes/Klinik-Estetika/2026'}
                                </p>
                                <p style={{ margin: 0, fontSize: '7.5px', color: '#64748b' }}>
                                    {[clinicConfig.msAlamatPerusahaan, clinicConfig.msKotaPerusahaan].filter(Boolean).join(', ') || 'Jl. Boulevard Raya Barat Blok A No. 18, Kota Madiun 63126'}
                                    {clinicConfig.msTeleponPerusahaan ? ` • Telp: ${clinicConfig.msTeleponPerusahaan}` : ' • Telp: (0351) 456-789'}
                                    {clinicConfig.msWaKlinik ? ` • WA: ${clinicConfig.msWaKlinik}` : ' • WA: 0812-3456-7890'}
                                </p>
                                <p style={{ margin: 0, fontSize: '7.5px', color: '#64748b' }}>
                                    {clinicConfig.msEmailPerusahaan ? `Email: ${clinicConfig.msEmailPerusahaan}` : 'Email: info@klinikkecantikan.co.id'}
                                    {clinicConfig.msWebsitePerusahaan ? ` • Website: ${clinicConfig.msWebsitePerusahaan}` : ' • Website: www.klinikkecantikan.co.id'}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div style={{ fontSize: '7.5px', color: '#94a3b8', fontStyle: 'italic' }}>Rekam Medis Elektronik (RME)</div>
                            <div style={{ fontSize: '11px', fontWeight: 800, fontFamily: 'monospace', color: '#0d9488', lineHeight: 1.1 }}>
                                {visitData.kode_kunjungan || '-'}
                            </div>
                            <div style={{ fontSize: '7.5px', color: '#64748b' }}>
                                Status: <strong style={{ color: '#059669', textTransform: 'uppercase' }}>{visitData.status_kunjungan || 'SELESAI'}</strong>
                            </div>
                        </div>
                    </div>

                    {/* 2. JUDUL DOKUMEN */}
                    <div className="text-center" style={{ margin: '1px 0 3px 0' }}>
                        <h2 style={{ margin: 0, fontSize: '10.5px', fontWeight: 800, textDecoration: 'underline', letterSpacing: '0.5px' }}>
                            LAPORAN DATA REKAM MEDIS PASIEN
                        </h2>
                    </div>

                    {/* 3. INFORMASI KUNJUNGAN & IDENTITAS PASIEN (2 KOLOM SEJAJAR) */}
                    <div className="grid mb-1" style={{ margin: '0 -3px' }}>
                        {/* Kolom Kiri: Informasi Kunjungan */}
                        <div className="col-6 p-1">
                            <div className="rme-border-box h-full" style={{ backgroundColor: '#fafafa' }}>
                                <div style={{ fontSize: '8.5px', fontWeight: 800, color: '#0d9488', borderBottom: '1px solid #e2e8f0', paddingBottom: '2px', marginBottom: '2px' }}>
                                    INFORMASI KUNJUNGAN
                                </div>
                                <table className="rme-table-info w-full" style={{ fontSize: '8.5px' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ width: '95px', color: '#64748b' }}>Tanggal Kunjungan</td>
                                            <td style={{ width: '6px' }}>:</td>
                                            <td className="font-bold">{formatDateIndo(visitData.tanggal_kunjungan)}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b' }}>No. Kunjungan</td>
                                            <td>:</td>
                                            <td className="font-mono font-bold text-teal-800">{visitData.kode_kunjungan || '-'}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b' }}>Jaminan / Penjamin</td>
                                            <td>:</td>
                                            <td>Umum / Mandiri</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b' }}>Nama Poli / Ruangan</td>
                                            <td>:</td>
                                            <td className="font-semibold">{layananList[0]?.nama_ruangan || 'Ruang Konsultasi & Treatment'}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b' }}>Dokter Pemeriksa</td>
                                            <td>:</td>
                                            <td className="font-bold">{dokterFormatted}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b' }}>Tanggal Pemeriksaan</td>
                                            <td>:</td>
                                            <td>{formatDateSimple(visitData.tanggal_kunjungan)} {visitData.jam_datang ? `(${visitData.jam_datang} WIB)` : ''}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Kolom Kanan: Identitas Pasien */}
                        <div className="col-6 p-1">
                            <div className="rme-border-box h-full" style={{ backgroundColor: '#fafafa' }}>
                                <div style={{ fontSize: '8.5px', fontWeight: 800, color: '#0d9488', borderBottom: '1px solid #e2e8f0', paddingBottom: '2px', marginBottom: '2px' }}>
                                    IDENTITAS PASIEN
                                </div>
                                <table className="rme-table-info w-full" style={{ fontSize: '8.5px' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ width: '85px', color: '#64748b' }}>No. Rekam Medis</td>
                                            <td style={{ width: '6px' }}>:</td>
                                            <td className="font-mono font-bold text-teal-800">{noRm}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b' }}>NIK / Identitas</td>
                                            <td>:</td>
                                            <td className="font-mono">{visitData.nik || '-'}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b' }}>Nama Pasien</td>
                                            <td>:</td>
                                            <td className="font-bold">{patientName}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b' }}>Jenis Kelamin / Usia</td>
                                            <td>:</td>
                                            <td>{formatGender(visitData.jenis_kelamin)}{calculateAge(visitData.tanggal_lahir)}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b' }}>Alamat</td>
                                            <td>:</td>
                                            <td>{formatFullAddress()}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b' }}>No. WA / HP</td>
                                            <td>:</td>
                                            <td>{visitData.no_hp || '-'}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b' }}>Alergi Obat / Zat</td>
                                            <td>:</td>
                                            <td className="font-semibold" style={{ color: (visitData.alergi || headerRM.riwayat_alergi) ? '#b91c1c' : '#475569' }}>
                                                {visitData.alergi || headerRM.riwayat_alergi || 'Tidak Ada Riwayat Alergi'}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* 4. SUBJEKTIF & OBJEKTIF (2 KOLOM SEJAJAR SIDE-BY-SIDE UNTUK MENGHEMAT RUANG VERTIKAL) */}
                    <div className="grid mb-1" style={{ margin: '0 -3px' }}>
                        {/* Kolom Kiri: I. SUBJEKTIF */}
                        <div className="col-6 p-1">
                            <div className="rme-section-header">
                                I. Subjektif (Anamnesis &amp; Keluhan)
                            </div>
                            <div className="rme-border-box h-full" style={{ minHeight: '85px' }}>
                                <table className="rme-table-info w-full" style={{ fontSize: '8.5px' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ width: '105px', color: '#64748b', fontWeight: 600 }}>Keluhan Utama</td>
                                            <td style={{ width: '6px' }}>:</td>
                                            <td className="font-semibold text-900">{headerRM.keluhan || headerRM.subjective || visitData.catatan_pasien || '-'}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b', fontWeight: 600 }}>Keluhan Tambahan</td>
                                            <td>:</td>
                                            <td>{headerRM.durasi_keluhan || '-'}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b', fontWeight: 600 }}>Riwayat Treatment</td>
                                            <td>:</td>
                                            <td>{headerRM.riwayat_treatment || '-'}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b', fontWeight: 600 }}>Riwayat Alergi</td>
                                            <td>:</td>
                                            <td style={{ color: headerRM.riwayat_alergi ? '#b91c1c' : '#475569' }}>
                                                {headerRM.riwayat_alergi || visitData.alergi || 'Tidak Ada'}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Kolom Kanan: II. OBJEKTIF */}
                        <div className="col-6 p-1">
                            <div className="rme-section-header">
                                II. Objektif (Pemeriksaan &amp; Kulit)
                            </div>
                            <div className="rme-border-box h-full" style={{ minHeight: '85px' }}>
                                <div style={{ fontSize: '8px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                                    Karakteristik Kulit Pasien:
                                </div>
                                <div className="grid" style={{ margin: '0 -2px' }}>
                                    <div className="col-4 p-1" style={{ padding: '1px 2px' }}>
                                        <div className="p-1 border-1 surface-border border-round" style={{ backgroundColor: '#f8fafc', fontSize: '8px', lineHeight: 1.2 }}>
                                            <span style={{ color: '#64748b' }}>Tipe:</span> <strong>{headerRM.pemeriksaan_skin_type || 'Normal'}</strong>
                                        </div>
                                    </div>
                                    <div className="col-4 p-1" style={{ padding: '1px 2px' }}>
                                        <div className="p-1 border-1 surface-border border-round" style={{ backgroundColor: '#f8fafc', fontSize: '8px', lineHeight: 1.2 }}>
                                            <span style={{ color: '#64748b' }}>Inflamasi:</span> <strong>{headerRM.pemeriksaan_inflammation || 'Tidak Ada'}</strong>
                                        </div>
                                    </div>
                                    <div className="col-4 p-1" style={{ padding: '1px 2px' }}>
                                        <div className="p-1 border-1 surface-border border-round" style={{ backgroundColor: '#f8fafc', fontSize: '8px', lineHeight: 1.2 }}>
                                            <span style={{ color: '#64748b' }}>Acne:</span> <strong>{headerRM.pemeriksaan_acne || 'Tidak Ada'}</strong>
                                        </div>
                                    </div>
                                    <div className="col-6 p-1" style={{ padding: '1px 2px' }}>
                                        <div className="p-1 border-1 surface-border border-round" style={{ backgroundColor: '#f8fafc', fontSize: '8px', lineHeight: 1.2 }}>
                                            <span style={{ color: '#64748b' }}>Pigmentasi:</span> <strong>{headerRM.pemeriksaan_pigmentation || 'Normal'}</strong>
                                        </div>
                                    </div>
                                    <div className="col-6 p-1" style={{ padding: '1px 2px' }}>
                                        <div className="p-1 border-1 surface-border border-round" style={{ backgroundColor: '#f8fafc', fontSize: '8px', lineHeight: 1.2 }}>
                                            <span style={{ color: '#64748b' }}>Sensitivitas:</span> <strong>{headerRM.pemeriksaan_sensitivity || 'Normal'}</strong>
                                        </div>
                                    </div>
                                </div>

                                {headerRM.objective && (
                                    <div className="mt-1 pt-1 border-top-1 surface-border" style={{ fontSize: '8px' }}>
                                        <span style={{ color: '#64748b', fontWeight: 600 }}>Temuan Fisik:</span> {headerRM.objective}
                                    </div>
                                )}

                                {formFieldsCombined.length > 0 && (
                                    <div className="mt-1 pt-1 border-top-1 surface-border">
                                        <div style={{ fontSize: '8px', fontWeight: 700, color: '#334155' }}>
                                            Form Ruangan:
                                        </div>
                                        <div className="grid" style={{ margin: '0 -2px' }}>
                                            {formFieldsCombined.slice(0, 4).map((f, fIdx) => (
                                                <div key={fIdx} className="col-6" style={{ padding: '1px 2px', fontSize: '7.5px' }}>
                                                    <span style={{ color: '#64748b' }}>{f.label}:</span> <strong>{String(f.value)}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 5. ASSESSMENT (DIAGNOSIS) & PLANNING (TINDAKAN) */}
                    <div className="rme-section-header">
                        III. Assessment &amp; Penatalaksanaan Tindakan (Planning)
                    </div>
                    <div className="rme-border-box mb-1">
                        {/* Diagnosis & Plan note in compact row */}
                        <div className="flex flex-wrap gap-2 justify-content-between align-items-center mb-1 pb-1 border-bottom-1 surface-border" style={{ fontSize: '8.5px' }}>
                            <div>
                                <span style={{ color: '#64748b', fontWeight: 600 }}>Diagnosis Utama:</span>{' '}
                                <strong className="text-teal-900" style={{ fontSize: '9px' }}>
                                    {headerRM.diagnosis || visitData.diagnosis || '-'}
                                </strong>
                                {headerRM.assessment && (
                                    <span style={{ color: '#475569', marginLeft: '6px' }}>
                                        ({headerRM.assessment})
                                    </span>
                                )}
                            </div>
                            {headerRM.plan && (
                                <div style={{ fontSize: '8px', color: '#334155' }}>
                                    <span style={{ color: '#64748b', fontWeight: 600 }}>Anjuran / Terapi:</span> {headerRM.plan}
                                </div>
                            )}
                        </div>

                        {/* Rincian Layanan & Tindakan */}
                        {layananList.length > 0 ? (
                            <table className="rme-data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '24px', textAlign: 'center' }}>No</th>
                                        <th>Nama Layanan / Tindakan</th>
                                        <th style={{ width: '110px' }}>Ruangan</th>
                                        <th style={{ width: '130px' }}>Petugas / Pelaksana</th>
                                        <th>Catatan Hasil Tindakan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {layananList.map((lay: any, idx: number) => {
                                        const dokterObj = lay.petugas || lay.rekam_medis?.dokter_penanggung_jawab || null;
                                        const terapisList: any[] = Array.isArray(lay.terapis_pendamping) ? lay.terapis_pendamping : [];
                                        const allDaftarPetugas: any[] = Array.isArray(lay.daftar_petugas) && lay.daftar_petugas.length > 0
                                            ? lay.daftar_petugas
                                            : [];
                                        const catatan = lay.catatan_hasil_treatment || lay.catatan_tindakan || lay.catatan_petugas || '-';

                                        return (
                                            <tr key={idx}>
                                                <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                                <td className="font-bold">{lay.nama_layanan || 'Pelayanan Klinik'}</td>
                                                <td>{lay.nama_ruangan || '-'}</td>
                                                <td>
                                                    {allDaftarPetugas.length > 0 ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', fontSize: '8px' }}>
                                                            {allDaftarPetugas.map((p: any, pIdx: number) => (
                                                                <div key={pIdx} style={{ lineHeight: '1.15' }}>
                                                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{p.nama}</span>
                                                                    <span style={{ color: p.is_dokter_pj ? '#0f766e' : '#6b21a8', fontSize: '7.5px', fontWeight: 600 }}> ({p.role || p.jabatan || 'PETUGAS'})</span>
                                                                    {p.no_sip && p.no_sip !== '-' && (
                                                                        <div style={{ fontSize: '7px', color: '#64748b' }}>SIP: {p.no_sip}</div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (dokterObj || terapisList.length > 0) ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', fontSize: '8px' }}>
                                                            {dokterObj && (
                                                                <div style={{ lineHeight: '1.15' }}>
                                                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{dokterObj.nama}</span>
                                                                    <span style={{ color: '#0f766e', fontSize: '7.5px', fontWeight: 600 }}> (Dokter/PJ)</span>
                                                                    {(dokterObj.kode_karyawan || dokterObj.no_sip) && (
                                                                        <div style={{ fontSize: '7px', color: '#64748b' }}>SIP: {dokterObj.kode_karyawan || dokterObj.no_sip}</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {terapisList.map((t: any, tIdx: number) => (
                                                                <div key={tIdx} style={{ lineHeight: '1.15' }}>
                                                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{t.nama || t.nama_petugas}</span>
                                                                    <span style={{ color: '#6b21a8', fontSize: '7.5px', fontWeight: 600 }}> ({(t.role || t.jabatan || 'TERAPIS').toUpperCase()})</span>
                                                                    {t.no_sip && t.no_sip !== '-' && (
                                                                        <div style={{ fontSize: '7px', color: '#64748b' }}>SIP: {t.no_sip}</div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: '8px' }}>{dokterFormatted}</span>
                                                    )}
                                                </td>
                                                <td>{catatan}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <p style={{ margin: 0, fontStyle: 'italic', color: '#94a3b8', fontSize: '8px' }}>
                                Tidak ada tindakan / konsultasi tercatat.
                            </p>
                        )}
                    </div>

                    {/* 6. PENGESAHAN & TANDA TANGAN */}
                    <div style={{ pageBreakInside: 'avoid', marginTop: '4px', paddingTop: '2px' }}>
                        <div className="flex justify-content-between align-items-end">
                            <div style={{ fontSize: '7.5px', color: '#64748b', maxWidth: '300px', lineHeight: 1.2 }}>
                                <p style={{ margin: 0 }}>
                                    Dokumen Rekam Medis Elektronik (RME) ini diterbitkan secara sah melalui Sistem Informasi Manajemen Klinik Kecantikan.
                                </p>
                                <p style={{ margin: '1px 0 0 0', fontFamily: 'monospace' }}>
                                    Dicetak pada: {formatDateSimple(new Date().toISOString())}
                                </p>
                            </div>

                            <div className="text-center" style={{ minWidth: '180px' }}>
                                <div style={{ fontSize: '8.5px', color: '#475569' }}>
                                    {clinicConfig.msKotaPerusahaan || 'Kota Madiun'}, {formatDateSimple(new Date().toISOString())}
                                </div>
                                <div style={{ fontSize: '8.5px', fontWeight: 600, color: '#334155' }}>
                                    Dokter Penanggung Jawab Pasien
                                </div>
                                <div style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {/* Signature Stamp placeholder */}
                                    <span style={{ fontSize: '7.5px', color: '#cbd5e1', fontStyle: 'italic' }}>
                                        (Tanda Tangan &amp; Cap Digital)
                                    </span>
                                </div>
                                <div style={{ fontSize: '9.5px', fontWeight: 800, textDecoration: 'underline', color: '#0f172a' }}>
                                    {dokterFormatted}
                                </div>
                                <div style={{ fontSize: '7.5px', color: '#64748b', fontFamily: 'monospace' }}>
                                    SIP: {headerRM.no_sip || visitData.no_sip || '440/SIP-D/2026/001'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Dialog>
    );
};

export default RMEReportPrint;

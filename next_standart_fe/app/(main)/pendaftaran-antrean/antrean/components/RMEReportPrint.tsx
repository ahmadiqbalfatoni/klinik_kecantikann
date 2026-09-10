'use client';

import React, { useRef } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Printer, Download, X, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

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
                        @media print {
                            @page {
                                size: A4 portrait;
                                margin: 12mm 12mm 12mm 12mm;
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
                            }
                            .no-print {
                                display: none !important;
                            }
                        }
                        .rme-table-info td {
                            padding: 2.5px 4px;
                            vertical-align: top;
                        }
                        .rme-section-header {
                            background-color: #f1f5f9;
                            border-left: 3px solid #0d9488;
                            padding: 4px 8px;
                            font-weight: 700;
                            font-size: 11px;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                            color: #0f172a;
                            margin-top: 10px;
                            margin-bottom: 6px;
                        }
                        .rme-border-box {
                            border: 1px solid #cbd5e1;
                            border-radius: 4px;
                            padding: 6px 8px;
                        }
                        .rme-data-table {
                            width: 100%;
                            border-collapse: collapse;
                        }
                        .rme-data-table th {
                            background-color: #f8fafc;
                            border: 1px solid #cbd5e1;
                            padding: 4px 6px;
                            font-size: 10px;
                            font-weight: 700;
                            text-align: left;
                        }
                        .rme-data-table td {
                            border: 1px solid #cbd5e1;
                            padding: 4px 6px;
                            font-size: 10.5px;
                            vertical-align: top;
                        }
                    `}</style>

                    {/* 1. HEADER / KOP KLINIK */}
                    <div className="flex align-items-center justify-content-between pb-2 mb-2" style={{ borderBottom: '2px solid #0f172a' }}>
                        <div className="flex align-items-center gap-3">
                            <div
                                style={{
                                    width: '52px',
                                    height: '52px',
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #0d9488 0%, #047857 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff',
                                    fontSize: '24px',
                                    fontWeight: 'bold',
                                }}
                            >
                                ⚕
                            </div>
                            <div>
                                <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '0.5px', color: '#0f172a' }}>
                                    KLINIK KECANTIKAN ESTETIKA
                                </h1>
                                <p style={{ margin: '1px 0', fontSize: '9.5px', color: '#475569', fontWeight: 600 }}>
                                    Izin Operasional Klinik: No. 440/012/Dinkes/Klinik-Estetika/2026
                                </p>
                                <p style={{ margin: 0, fontSize: '9px', color: '#64748b' }}>
                                    Jl. Boulevard Raya Barat Blok A No. 18, Kota Madiun 63126 • Telp: (0351) 456-789 • WA: 0812-3456-7890
                                </p>
                                <p style={{ margin: 0, fontSize: '9px', color: '#64748b' }}>
                                    Email: info@klinikkecantikan.co.id • Website: www.klinikkecantikan.co.id
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div style={{ fontSize: '8.5px', color: '#94a3b8', fontStyle: 'italic' }}>Rekam Medis Elektronik (RME)</div>
                            <div style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'monospace', color: '#0d9488' }}>
                                {visitData.kode_kunjungan || '-'}
                            </div>
                            <div style={{ fontSize: '8.5px', color: '#64748b' }}>
                                Status: <strong style={{ color: '#059669', textTransform: 'uppercase' }}>{visitData.status_kunjungan || 'SELESAI'}</strong>
                            </div>
                        </div>
                    </div>

                    {/* 2. JUDUL DOKUMEN */}
                    <div className="text-center my-2">
                        <h2 style={{ margin: 0, fontSize: '13px', fontWeight: 800, textDecoration: 'underline', letterSpacing: '1px' }}>
                            LAPORAN DATA REKAM MEDIS PASIEN
                        </h2>
                    </div>

                    {/* 3. INFORMASI KUNJUNGAN & PASIEN (2 KOLOM SEJAJAR) */}
                    <div className="grid mt-2 mb-1" style={{ margin: '0 -4px' }}>
                        {/* Kolom Kiri: Informasi Kunjungan */}
                        <div className="col-6 p-1">
                            <div className="rme-border-box h-full" style={{ backgroundColor: '#fafafa' }}>
                                <div style={{ fontSize: '10px', fontWeight: 800, color: '#0d9488', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px', marginBottom: '4px' }}>
                                    INFORMASI KUNJUNGAN
                                </div>
                                <table className="rme-table-info w-full" style={{ fontSize: '10px' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ width: '115px', color: '#64748b' }}>Tanggal Kunjungan</td>
                                            <td style={{ width: '8px' }}>:</td>
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
                                <div style={{ fontSize: '10px', fontWeight: 800, color: '#0d9488', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px', marginBottom: '4px' }}>
                                    IDENTITAS PASIEN
                                </div>
                                <table className="rme-table-info w-full" style={{ fontSize: '10px' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ width: '100px', color: '#64748b' }}>No. Rekam Medis</td>
                                            <td style={{ width: '8px' }}>:</td>
                                            <td className="font-mono font-bold text-teal-800">{noRm}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b' }}>NIK</td>
                                            <td>:</td>
                                            <td className="font-mono">{visitData.nik || '-'}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b' }}>Nama Pasien</td>
                                            <td>:</td>
                                            <td className="font-bold">{patientName}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b' }}>Jenis Kelamin</td>
                                            <td>:</td>
                                            <td>{formatGender(visitData.jenis_kelamin)}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ color: '#64748b' }}>Tgl. Lahir / Umur</td>
                                            <td>:</td>
                                            <td>{formatDateSimple(visitData.tanggal_lahir)}{calculateAge(visitData.tanggal_lahir)}</td>
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
                                            <td style={{ color: '#64748b' }}>Pekerjaan</td>
                                            <td>:</td>
                                            <td>{visitData.pekerjaan || '-'}</td>
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

                    {/* 4. SECTION I: SUBJEKTIF (ANAMNESIS) */}
                    <div className="rme-section-header">
                        I. Subjektif (Anamnesis & Keluhan)
                    </div>
                    <div className="rme-border-box mb-2">
                        <table className="rme-table-info w-full" style={{ fontSize: '10.5px' }}>
                            <tbody>
                                <tr>
                                    <td style={{ width: '160px', color: '#64748b', fontWeight: 600 }}>Keluhan Utama</td>
                                    <td style={{ width: '8px' }}>:</td>
                                    <td className="font-medium">{headerRM.keluhan || headerRM.subjective || visitData.catatan_pasien || '-'}</td>
                                </tr>
                                <tr>
                                    <td style={{ color: '#64748b', fontWeight: 600 }}>Keluhan Tambahan / Durasi</td>
                                    <td>:</td>
                                    <td>{headerRM.durasi_keluhan || '-'}</td>
                                </tr>
                                <tr>
                                    <td style={{ color: '#64748b', fontWeight: 600 }}>Riwayat Treatment Sebelumnya</td>
                                    <td>:</td>
                                    <td>{headerRM.riwayat_treatment || '-'}</td>
                                </tr>
                                <tr>
                                    <td style={{ color: '#64748b', fontWeight: 600 }}>Riwayat Alergi & Kontraindikasi</td>
                                    <td>:</td>
                                    <td style={{ color: headerRM.riwayat_alergi ? '#b91c1c' : '#475569' }}>
                                        {headerRM.riwayat_alergi || visitData.alergi || 'Tidak Ada'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* 5. SECTION II: OBJEKTIF (PEMERIKSAAN FISIK & KARAKTERISTIK KULIT) */}
                    <div className="rme-section-header">
                        II. Objektif (Pemeriksaan Fisik & Kondisi Kulit)
                    </div>
                    <div className="rme-border-box mb-2">
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                            Analisis Karakteristik Kulit Pasien:
                        </div>
                        <div className="grid mb-2" style={{ margin: '0 -4px' }}>
                            <div className="col-4 p-1">
                                <div className="p-1 border-1 surface-border border-round" style={{ backgroundColor: '#f8fafc', fontSize: '10px' }}>
                                    <span style={{ color: '#64748b' }}>Tipe Kulit:</span>{' '}
                                    <strong>{headerRM.pemeriksaan_skin_type || 'Normal'}</strong>
                                </div>
                            </div>
                            <div className="col-4 p-1">
                                <div className="p-1 border-1 surface-border border-round" style={{ backgroundColor: '#f8fafc', fontSize: '10px' }}>
                                    <span style={{ color: '#64748b' }}>Inflamasi:</span>{' '}
                                    <strong>{headerRM.pemeriksaan_inflammation || 'Tidak Ada'}</strong>
                                </div>
                            </div>
                            <div className="col-4 p-1">
                                <div className="p-1 border-1 surface-border border-round" style={{ backgroundColor: '#f8fafc', fontSize: '10px' }}>
                                    <span style={{ color: '#64748b' }}>Kondisi Acne:</span>{' '}
                                    <strong>{headerRM.pemeriksaan_acne || 'Tidak Ada'}</strong>
                                </div>
                            </div>
                            <div className="col-6 p-1">
                                <div className="p-1 border-1 surface-border border-round" style={{ backgroundColor: '#f8fafc', fontSize: '10px' }}>
                                    <span style={{ color: '#64748b' }}>Pigmentasi:</span>{' '}
                                    <strong>{headerRM.pemeriksaan_pigmentation || 'Normal / Rata'}</strong>
                                </div>
                            </div>
                            <div className="col-6 p-1">
                                <div className="p-1 border-1 surface-border border-round" style={{ backgroundColor: '#f8fafc', fontSize: '10px' }}>
                                    <span style={{ color: '#64748b' }}>Sensitivitas:</span>{' '}
                                    <strong>{headerRM.pemeriksaan_sensitivity || 'Rendah / Normal'}</strong>
                                </div>
                            </div>
                        </div>

                        {/* Catatan Objektif Tambahan */}
                        {headerRM.objective && (
                            <div className="mt-1 pt-1 border-top-1 surface-border" style={{ fontSize: '10.5px' }}>
                                <span style={{ color: '#64748b', fontWeight: 600 }}>Catatan Temuan Fisik / Objektif:</span>
                                <p style={{ margin: '2px 0 0 0', color: '#1e293b' }}>{headerRM.objective}</p>
                            </div>
                        )}

                        {/* Form Pemeriksaan Ruangan Spesifik jika terisi */}
                        {formFieldsCombined.length > 0 && (
                            <div className="mt-2 pt-2 border-top-1 surface-border">
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                                    Hasil Form Penanganan Ruangan:
                                </div>
                                <div className="grid" style={{ margin: '0 -3px' }}>
                                    {formFieldsCombined.map((f, fIdx) => (
                                        <div key={fIdx} className="col-6 p-1" style={{ fontSize: '10px' }}>
                                            <span style={{ color: '#64748b' }}>{f.label}:</span>{' '}
                                            <strong style={{ color: '#0f172a' }}>{String(f.value)}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 6. SECTION III: ASSESSMENT (DIAGNOSIS) */}
                    <div className="rme-section-header">
                        III. Assessment (Diagnosis Medis / Estetika)
                    </div>
                    <div className="rme-border-box mb-2">
                        <table className="rme-table-info w-full" style={{ fontSize: '10.5px' }}>
                            <tbody>
                                <tr>
                                    <td style={{ width: '160px', color: '#64748b', fontWeight: 600 }}>Diagnosis Utama</td>
                                    <td style={{ width: '8px' }}>:</td>
                                    <td className="font-bold text-teal-900" style={{ fontSize: '11px' }}>
                                        {headerRM.diagnosis || visitData.diagnosis || '-'}
                                    </td>
                                </tr>
                                {headerRM.assessment && (
                                    <tr>
                                        <td style={{ color: '#64748b', fontWeight: 600 }}>Catatan Analisis Klinis</td>
                                        <td>:</td>
                                        <td>{headerRM.assessment}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* 7. SECTION IV: PLANNING & TINDAKAN (PENATALAKSANAAN) */}
                    <div className="rme-section-header">
                        IV. Planning & Tindakan (Penatalaksanaan Medis)
                    </div>
                    <div className="rme-border-box mb-2">
                        {headerRM.plan && (
                            <div className="mb-2 pb-2 border-bottom-1 surface-border" style={{ fontSize: '10.5px' }}>
                                <span style={{ color: '#64748b', fontWeight: 600 }}>Rencana Terapi / Anjuran Dokter:</span>
                                <p style={{ margin: '2px 0 0 0', color: '#1e293b' }}>{headerRM.plan}</p>
                            </div>
                        )}

                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                            Rincian Layanan & Tindakan yang Diberikan:
                        </div>
                        {layananList.length > 0 ? (
                            <table className="rme-data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '30px', textAlign: 'center' }}>No</th>
                                        <th>Nama Layanan / Tindakan</th>
                                        <th style={{ width: '140px' }}>Ruangan</th>
                                        <th style={{ width: '140px' }}>Petugas / Pelaksana</th>
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
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '9.5px' }}>
                                                            {allDaftarPetugas.map((p: any, pIdx: number) => (
                                                                <div key={pIdx} style={{ lineHeight: '1.25' }}>
                                                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{p.nama}</span>
                                                                    <span style={{ color: p.is_dokter_pj ? '#0f766e' : '#6b21a8', fontSize: '9px', fontWeight: 600 }}> ({p.role || p.jabatan || 'PETUGAS'})</span>
                                                                    {p.no_sip && p.no_sip !== '-' && (
                                                                        <div style={{ fontSize: '8.5px', color: '#64748b' }}>SIP: {p.no_sip}</div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (dokterObj || terapisList.length > 0) ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '9.5px' }}>
                                                            {dokterObj && (
                                                                <div style={{ lineHeight: '1.25' }}>
                                                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{dokterObj.nama}</span>
                                                                    <span style={{ color: '#0f766e', fontSize: '9px', fontWeight: 600 }}> (Dokter/PJ)</span>
                                                                    {(dokterObj.kode_karyawan || dokterObj.no_sip) && (
                                                                        <div style={{ fontSize: '8.5px', color: '#64748b' }}>SIP: {dokterObj.kode_karyawan || dokterObj.no_sip}</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {terapisList.map((t: any, tIdx: number) => (
                                                                <div key={tIdx} style={{ lineHeight: '1.25' }}>
                                                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{t.nama || t.nama_petugas}</span>
                                                                    <span style={{ color: '#6b21a8', fontSize: '9px', fontWeight: 600 }}> ({(t.role || t.jabatan || 'TERAPIS').toUpperCase()})</span>
                                                                    {t.no_sip && t.no_sip !== '-' && (
                                                                        <div style={{ fontSize: '8.5px', color: '#64748b' }}>SIP: {t.no_sip}</div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: '9.5px' }}>{dokterFormatted}</span>
                                                    )}
                                                </td>
                                                <td>{catatan}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <p style={{ margin: 0, fontStyle: 'italic', color: '#94a3b8', fontSize: '10.5px' }}>
                                Tidak ada tindakan / konsultasi tercatat.
                            </p>
                        )}
                    </div>

                    {/* 8. SECTION V: PENGESAHAN & TANDA TANGAN */}
                    <div className="mt-4 pt-2" style={{ pageBreakInside: 'avoid' }}>
                        <div className="flex justify-content-between align-items-end">
                            <div style={{ fontSize: '9px', color: '#64748b', maxWidth: '300px' }}>
                                <p style={{ margin: 0 }}>
                                    Dokumen Rekam Medis Elektronik (RME) ini diterbitkan secara sah melalui Sistem Informasi Manajemen Klinik Kecantikan.
                                </p>
                                <p style={{ margin: '2px 0 0 0', fontFamily: 'monospace' }}>
                                    Dicetak pada: {formatDateSimple(new Date().toISOString())}
                                </p>
                            </div>

                            <div className="text-center" style={{ minWidth: '220px' }}>
                                <div style={{ fontSize: '10px', color: '#475569' }}>
                                    Kota Madiun, {formatDateSimple(new Date().toISOString())}
                                </div>
                                <div style={{ fontSize: '10px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                                    Dokter Penanggung Jawab Pasien
                                </div>
                                <div style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {/* Signature Stamp placeholder */}
                                    <span style={{ fontSize: '9px', color: '#cbd5e1', fontStyle: 'italic' }}>
                                        (Tanda Tangan & Cap Digital)
                                    </span>
                                </div>
                                <div style={{ fontSize: '11px', fontWeight: 800, textDecoration: 'underline', color: '#0f172a' }}>
                                    {dokterFormatted}
                                </div>
                                <div style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace' }}>
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

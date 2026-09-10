'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Toast } from 'primereact/toast';
import { Calendar } from 'primereact/calendar';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Paginator } from 'primereact/paginator';
import { Image } from 'primereact/image';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';
import { Menu } from 'primereact/menu';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { ColumnGroup } from 'primereact/columngroup';
import { Row } from 'primereact/row';
import postData from '@/lib/axios/postData';
import { showError } from '@/lib/tools/generalTools';
import { exportToXLSX } from '@/lib/tools/printTools/exportToXLSX';
import LaporanNavCard, { LaporanModuleId } from './components/LaporanNavCard';
import ModulWipCard from './components/ModulWipCard';
import {
  LaporanPenjualanView,
  LaporanTreatmentView,
  LaporanProdukView,
  LaporanPaketView,
  LaporanPasienView,
  LaporanKunjunganView,
  LaporanDokterView,
  LaporanBeauticianView,
  LaporanInventoryView,
  LaporanVoucherView,
  LaporanKeuanganView,
} from './components/LaporanViews';

interface KaryawanInfo {
  kode_karyawan: string;
  nama: string;
  jabatan: string;
}

interface RekamMedisDetail {
  kode_rekam_medis: string | null;
  no_sip: string | null;
  keluhan: string;
  durasi_keluhan?: string | null;
  riwayat_alergi?: string | null;
  riwayat_treatment?: string | null;
  pemeriksaan_acne?: string | null;
  pemeriksaan_inflammation?: string | null;
  pemeriksaan_skin_type?: string | null;
  pemeriksaan_pigmentation?: string | null;
  pemeriksaan_sensitivity?: string | null;
  diagnosis?: string | null;
  diagnosa?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  tindakan?: string;
  catatan?: string;
  dokter_penanggung_jawab: KaryawanInfo | null;
  data_form?: any;
  formatted_data_form?: Array<{ key: string; label: string; value: any }>;
  fotos?: Array<{ id?: number; tipe: string; jenis_foto?: string; url_foto: string }>;
}

interface LayananDetail {
  kode_antrian_layanan: string;
  nama_layanan: string;
  jenis_layanan: string;
  harga: number;
  kode_ruangan: string;
  nama_ruangan: string;
  status: string;
  dipanggil_at: string | null;
  selesai_at: string | null;
  catatan_tindakan?: string | null;
  catatan_petugas?: string | null;
  catatan_hasil_treatment?: string | null;
  petugas: KaryawanInfo | null;
  rekam_medis: RekamMedisDetail | null;
}

interface KunjunganRecord {
  kode_kunjungan: string;
  no_rm: string;
  nama_pasien: string;
  tanggal_kunjungan: string;
  jam_datang: string;
  status_kunjungan: string;
  layanan: LayananDetail[];
}

interface DetailItemTransaksi {
  kode_detail_transaksi: string;
  jenis: string;
  kode: string;
  nama: string;
  satuan: string;
  qty: number;
  harga_satuan: number;
  subtotal: number;
}

interface TransaksiRecord {
  id: number;
  kode_transaksi: string;
  kode_kunjungan: string | null;
  kode_rekam_medis: string | null;
  no_rm: string;
  nama_pasien: string;
  no_hp: string | null;
  tanggal_transaksi: string;
  total_harga: number;
  total_diskon: number;
  total_bayar: number;
  metode_bayar: string;
  status: string;
  created_at: string;
  details: DetailItemTransaksi[];
}

const formatDateIndo = (dateStr: string) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  } catch (_) {
    return dateStr;
  }
};

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0);
};

const getImgSrc = (path?: string) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const beUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const baseUrl = beUrl.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
};

const getJabatanBadge = (jabatan?: string) => {
  const j = (jabatan || '').toLowerCase();
  if (j === 'dokter') return 'bg-purple-50 text-purple-700 border-purple-200 border-1 font-semibold px-2.5 py-0.5 border-round-pill text-xs';
  if (j === 'perawat') return 'bg-blue-50 text-blue-700 border-blue-200 border-1 font-semibold px-2.5 py-0.5 border-round-pill text-xs';
  if (j === 'terapis') return 'bg-teal-50 text-teal-700 border-teal-200 border-1 font-semibold px-2.5 py-0.5 border-round-pill text-xs';
  if (j === 'kasir') return 'bg-amber-50 text-amber-700 border-amber-200 border-1 font-semibold px-2.5 py-0.5 border-round-pill text-xs';
  if (j === 'apoteker') return 'bg-emerald-50 text-emerald-700 border-emerald-200 border-1 font-semibold px-2.5 py-0.5 border-round-pill text-xs';
  return 'bg-gray-50 text-gray-700 border-gray-200 border-1 font-semibold px-2.5 py-0.5 border-round-pill text-xs';
};

const getStatusKunjunganSeverity = (status?: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'selesai' || s === 'sudah_diambil') return 'success';
  if (s === 'berlangsung' || s === 'dipanggil' || s === 'pengecekan' || s === 'pengerjaan') return 'info';
  if (s === 'menunggu' || s === 'pending') return 'warning';
  if (s === 'batal') return 'danger';
  return 'secondary';
};

const getStatusLeftBorderClass = (status?: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'selesai' || s === 'sudah_diambil' || s === 'lunas' || s === 'berhasil') return 'border-left-4 border-teal-500';
  if (s === 'berlangsung' || s === 'dipanggil' || s === 'pengecekan' || s === 'pengerjaan' || s === 'proses') return 'border-left-4 border-blue-500';
  if (s === 'menunggu' || s === 'pending' || s === 'draft') return 'border-left-4 border-yellow-500';
  if (s === 'batal' || s === 'cancelled') return 'border-left-4 border-red-500';
  return 'border-left-4 border-gray-300';
};

const getStatusTransaksiSeverity = (status?: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'lunas' || s === 'selesai' || s === 'berhasil') return 'success';
  if (s === 'draft' || s === 'pending' || s === 'menunggu') return 'warning';
  if (s === 'batal' || s === 'cancelled') return 'danger';
  return 'secondary';
};

const getStatusAntrianSeverity = (status?: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'selesai' || s === 'sudah_diambil') return 'success';
  if (s === 'dipanggil' || s === 'berlangsung' || s === 'proses') return 'info';
  if (s === 'menunggu' || s === 'pending') return 'warning';
  if (s === 'batal') return 'danger';
  return 'secondary';
};

const renderFormattedContent = (text?: string | null) => {
  if (!text || text === '-' || text.trim() === '') return <span className="text-gray-400 italic text-xs">-</span>;

  const imgRegex = /(https?:\/\/[^\s"'<>]+|\/uploads\/[^\s"'<>]+)/gi;
  const matches = text.match(imgRegex);

  return (
    <div>
      <div className="white-space-pre-wrap">{text}</div>
      {matches && matches.length > 0 && (
        <div className="flex align-items-center gap-3 mt-2 flex-wrap">
          {matches.map((url, idx) => (
            <div key={idx} className="text-center">
              <span className="block text-[10px] font-bold text-emerald-700 mb-1">Foto Lampiran #{idx + 1}</span>
              <Image
                src={getImgSrc(url)}
                alt={`Foto Lampiran ${idx + 1}`}
                width="110"
                height="110"
                preview
                className="border-round-lg overflow-hidden shadow-1 border-2 border-emerald-500 cursor-pointer"
                imageClassName="w-full h-full object-cover border-round-lg"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const renderDataFormDinamis = (rm: any, item?: any) => {
  const rawForm: Array<{ key: string; label: string; value: any; type?: string }> = rm?.formatted_data_form || [];
  const fotos: Array<{ tipe: string; url_foto: string }> = rm?.fotos || [];
  const catTindakan = item?.catatan_tindakan || rm?.catatan_tindakan || null;
  const catPetugas = item?.catatan_petugas || rm?.catatan_petugas || null;
  const catHasil = item?.catatan_hasil_treatment || rm?.catatan_hasil_treatment || null;

  const ignoredKeys = [
    'catatan_tindakan',
    'catatan_tindakan_alat_digunakan',
    'catatan_petugas',
    'catatan_hasil_treatment',
    'foto_before_after',
    'foto_before',
    'foto_after',
  ];

  const seenKeys = new Set<string>();
  const formattedForm = rawForm.filter((f) => {
    if (!f.key || ignoredKeys.includes(f.key.toLowerCase())) return false;
    if (seenKeys.has(f.key.toLowerCase())) return false;
    seenKeys.add(f.key.toLowerCase());
    return true;
  });

  if (formattedForm.length === 0 && fotos.length === 0 && !catTindakan && !catPetugas && !catHasil) {
    return null;
  }

  const beforeFotos = fotos.filter((f) => f.tipe === 'before');
  const afterFotos = fotos.filter((f) => f.tipe === 'after');

  return (
    <div className="mt-3 flex flex-column gap-3">
      {/* CARD: ISIAN KHUSUS FORM RUANGAN */}
      {formattedForm.length > 0 && (
        <div className="surface-card p-3 border-round-lg border-1 surface-border shadow-2xs">
          <div className="flex align-items-center justify-content-between mb-3 pb-2 border-bottom-1 surface-border">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex align-items-center gap-2 m-0">
              <i className="pi pi-th-large text-emerald-600 text-sm" />
              ISIAN KHUSUS FORM RUANGAN ({item?.nama_ruangan || 'RUANGAN'})
            </span>
            <span className="bg-emerald-600 text-white font-bold text-[10px] px-2.5 py-0.5 border-round-pill">
              {formattedForm.length} Field
            </span>
          </div>

          <div className="grid formgrid p-fluid">
            {formattedForm.map((fItem, idx) => (
              <div key={idx} className="col-12 md:col-6 mb-2">
                <div className="bg-gray-50 p-2.5 border-round-lg border-1 surface-border h-full">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    {fItem.label}
                  </label>
                  <div className="text-gray-800 font-medium text-xs white-space-pre-wrap">
                    {typeof fItem.value === 'object' ? JSON.stringify(fItem.value) : String(fItem.value || '-')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CARD: CATATAN TINDAKAN RUANGAN */}
      {catTindakan && (
        <div className="surface-card p-3 border-round-lg border-1 surface-border shadow-2xs">
          <div className="flex align-items-center gap-2 mb-2 pb-2 border-bottom-1 surface-border">
            <i className="pi pi-briefcase text-emerald-600 text-sm" />
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              CATATAN TINDAKAN RUANGAN
            </span>
          </div>
          <div className="bg-emerald-50/50 p-3 border-round-lg border-1 border-emerald-200 text-gray-800 font-medium text-xs white-space-pre-wrap">
            {catTindakan}
          </div>
        </div>
      )}

      {/* CARD: CATATAN PETUGAS & OBSERVASI */}
      {catPetugas && (
        <div className="surface-card p-3 border-round-lg border-1 surface-border shadow-2xs">
          <div className="flex align-items-center gap-2 mb-2 pb-2 border-bottom-1 surface-border">
            <i className="pi pi-user-edit text-emerald-600 text-sm" />
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              CATATAN &amp; OBSERVASI PETUGAS RUANGAN
            </span>
          </div>
          <div className="bg-emerald-50/50 p-3 border-round-lg border-1 border-emerald-200 text-gray-800 font-medium text-xs white-space-pre-wrap">
            {catPetugas}
          </div>
        </div>
      )}

      {/* CARD: CATATAN HASIL TREATMENT */}
      {catHasil && (
        <div className="surface-card p-3 border-round-lg border-1 surface-border shadow-2xs">
          <div className="flex align-items-center gap-2 mb-2 pb-2 border-bottom-1 surface-border">
            <i className="pi pi-check-circle text-blue-600 text-sm" />
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              CATATAN HASIL TREATMENT (PASCA TINDAKAN)
            </span>
          </div>
          <div className="bg-blue-50/50 p-3 border-round-lg border-1 border-blue-200 text-gray-800 font-medium text-xs white-space-pre-wrap">
            {catHasil}
          </div>
        </div>
      )}

      {/* CARD: GALERI FOTO BEFORE / AFTER */}
      {fotos.length > 0 && (
        <div className="surface-card p-3 border-round-lg border-1 surface-border shadow-2xs">
          <div className="flex align-items-center justify-content-between mb-2 pb-2 border-bottom-1 surface-border">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex align-items-center gap-2">
              <i className="pi pi-images text-emerald-600 text-sm" />
              DOKUMENTASI FOTO BEFORE / AFTER
            </span>
            <span className="text-[10px] text-gray-400 font-medium">Klik foto untuk memperbesar</span>
          </div>
          <div className="flex align-items-center gap-3 flex-wrap bg-gray-50 p-3 border-round-lg border-1 surface-border">
            {beforeFotos.map((f, idx) => (
              <div key={`before-${idx}`} className="text-center flex flex-column align-items-center">
                <span className="block text-[10px] font-bold text-gray-600 mb-1.5 bg-gray-200 px-2 py-0.5 border-round-pill">
                  📷 Foto Before (Sebelum)
                </span>
                <Image
                  src={getImgSrc(f.url_foto)}
                  alt="Foto Before"
                  width="120"
                  height="120"
                  preview
                  className="border-round-lg overflow-hidden shadow-1 border-2 border-gray-300 hover:scale-105 transition-all cursor-pointer"
                  imageClassName="w-full h-full object-cover border-round-lg"
                />
              </div>
            ))}
            {afterFotos.map((f, idx) => (
              <div key={`after-${idx}`} className="text-center flex flex-column align-items-center">
                <span className="block text-[10px] font-bold text-emerald-800 mb-1.5 bg-emerald-100 px-2 py-0.5 border-round-pill">
                  ✨ Foto After (Sesudah)
                </span>
                <Image
                  src={getImgSrc(f.url_foto)}
                  alt="Foto After"
                  width="120"
                  height="120"
                  preview
                  className="border-round-lg overflow-hidden shadow-2 border-2 border-emerald-500 hover:scale-105 transition-all cursor-pointer"
                  imageClassName="w-full h-full object-cover border-round-lg"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const LaporanPage = () => {
  const toast = useRef<Toast>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const printMenuTrxRef = useRef<Menu>(null);
  const printMenuRMRef = useRef<Menu>(null);

  // Tab / Modul Laporan State
  const [activeModule, setActiveModule] = useState<LaporanModuleId>('penjualan');

  // ─── REKAM MEDIS STATE ───
  const [searchVal, setSearchVal] = useState('');
  const [tanggalDari, setTanggalDari] = useState<Date | null>(null);
  const [tanggalSampai, setTanggalSampai] = useState<Date | null>(null);
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  const [records, setRecords] = useState<KunjunganRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [expandedRMRows, setExpandedRMRows] = useState<any>(null);
  const [expandedVisits, setExpandedVisits] = useState<Record<string, boolean>>({});

  // ─── TRANSAKSI STATE ───
  const [trxSearchVal, setTrxSearchVal] = useState('');
  const [trxTanggalDari, setTrxTanggalDari] = useState<Date | null>(null);
  const [trxTanggalSampai, setTrxTanggalSampai] = useState<Date | null>(null);
  const [trxPage, setTrxPage] = useState(1);
  const [trxPerPage] = useState(10);
  const [trxTotalRecords, setTrxTotalRecords] = useState(0);

  const [trxRecords, setTrxRecords] = useState<TransaksiRecord[]>([]);
  const [loadingTrx, setLoadingTrx] = useState(false);
  const [expandedTrx, setExpandedTrx] = useState<Record<string, boolean>>({});
  const [expandedTrxRows, setExpandedTrxRows] = useState<any>(null);

  // Fetch Rekam Medis
  useEffect(() => {
    if (activeModule === 'rekam_medis') {
      fetchRekamMedis(1);
    }
  }, [tanggalDari, tanggalSampai, activeModule]);

  // Fetch Transaksi
  useEffect(() => {
    if (activeModule === 'penjualan') {
      fetchTransaksi(1);
    }
  }, [trxTanggalDari, trxTanggalSampai, activeModule]);

  const fetchRekamMedis = async (
    pPage = 1,
    pKeyword?: string,
    pTglDari?: Date | null,
    pTglSampai?: Date | null
  ) => {
    const targetKeyword = pKeyword !== undefined ? pKeyword : searchVal;
    const targetTglDari = pTglDari !== undefined ? pTglDari : tanggalDari;
    const targetTglSampai = pTglSampai !== undefined ? pTglSampai : tanggalSampai;

    setLoadingRecords(true);
    try {
      const formatDateParam = (d: Date | null) => {
        if (!d) return undefined;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const payload = {
        keyword: targetKeyword || undefined,
        page: pPage,
        perPage: perPage,
        tanggal_dari: formatDateParam(targetTglDari),
        tanggal_sampai: formatDateParam(targetTglSampai),
      };

      const res = await postData('/master/pasien-rekam-medis', payload);
      if (['00', '0000'].includes(res?.data?.status)) {
        const dataList: KunjunganRecord[] = res.data.data || [];
        setRecords(dataList);
        setTotalRecords(res.data.total_data || 0);
        setPage(pPage);

        if (dataList.length > 0) {
          const initialMap: Record<string, boolean> = {};
          dataList.forEach((k, idx) => {
            initialMap[k.kode_kunjungan] = idx === 0;
          });
          setExpandedVisits(initialMap);
        } else {
          setExpandedVisits({});
        }
      } else {
        showError(toast, res?.data?.message || 'Gagal memuat rekam medis');
      }
    } catch (err: any) {
      showError(toast, err?.response?.data?.message || err?.message || 'Gagal terhubung ke server');
    } finally {
      setLoadingRecords(false);
    }
  };

  const fetchTransaksi = async (
    pPage = 1,
    pKeyword?: string,
    pTglDari?: Date | null,
    pTglSampai?: Date | null
  ) => {
    const targetKeyword = pKeyword !== undefined ? pKeyword : trxSearchVal;
    const targetTglDari = pTglDari !== undefined ? pTglDari : trxTanggalDari;
    const targetTglSampai = pTglSampai !== undefined ? pTglSampai : trxTanggalSampai;

    setLoadingTrx(true);
    try {
      const formatDateParam = (d: Date | null) => {
        if (!d) return undefined;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const payload = {
        keyword: targetKeyword || undefined,
        page: pPage,
        perPage: trxPerPage,
        tanggal_dari: formatDateParam(targetTglDari),
        tanggal_sampai: formatDateParam(targetTglSampai),
      };

      const res = await postData('/master/pasien-transaksi', payload);
      if (['00', '0000'].includes(res?.data?.status)) {
        const dataList: TransaksiRecord[] = res.data.data || [];
        setTrxRecords(dataList);
        setTrxTotalRecords(res.data.total_data || 0);
        setTrxPage(pPage);

        if (dataList.length > 0) {
          const initialMap: Record<string, boolean> = {};
          dataList.forEach((t, idx) => {
            initialMap[t.kode_transaksi] = idx === 0;
          });
          setExpandedTrx(initialMap);
        } else {
          setExpandedTrx({});
        }
      } else {
        showError(toast, res?.data?.message || 'Gagal memuat laporan transaksi');
      }
    } catch (err: any) {
      showError(toast, err?.response?.data?.message || err?.message || 'Gagal terhubung ke server');
    } finally {
      setLoadingTrx(false);
    }
  };

  const handleResetFilterRM = () => {
    setTanggalDari(null);
    setTanggalSampai(null);
    setSearchVal('');
    fetchRekamMedis(1, '', null, null);
  };

  const handleResetFilterTrx = () => {
    setTrxTanggalDari(null);
    setTrxTanggalSampai(null);
    setTrxSearchVal('');
    fetchTransaksi(1, '', null, null);
  };

  const handleCetakLaporanTrx = () => {
    if (trxRecords.length === 0) {
      showError(toast, 'Tidak ada data transaksi untuk dicetak');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showError(toast, 'Gagal membuka jendela cetak. Mohon izinkan popup browser.');
      return;
    }

    const tglMulaiStr = trxTanggalDari ? formatDateIndo(trxTanggalDari.toISOString()) : 'Semua Tanggal';
    const tglSelesaiStr = trxTanggalSampai ? formatDateIndo(trxTanggalSampai.toISOString()) : 'Semua Tanggal';
    const periodeStr = `${tglMulaiStr} s.d ${tglSelesaiStr}`;
    const totalNominal = trxRecords.reduce((acc, curr) => acc + (curr.total_bayar || 0), 0);

    const tableRowsHtml = trxRecords
      .map(
        (tr, idx) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td><strong>${tr.kode_transaksi}</strong></td>
          <td>${formatDateIndo(tr.tanggal_transaksi)}</td>
          <td>${tr.nama_pasien || 'Umum'}</td>
          <td style="text-align: center;">${tr.no_rm || '-'}</td>
          <td style="text-align: center;">${tr.kode_kunjungan || '-'}</td>
          <td style="text-align: center; text-transform: uppercase;">${tr.metode_bayar || 'TUNAI'}</td>
          <td style="text-align: right;">${formatRupiah(tr.total_harga)}</td>
          <td style="text-align: right; color: red;">${tr.total_diskon > 0 ? '-' + formatRupiah(tr.total_diskon) : 'Rp 0'}</td>
          <td style="text-align: right; font-weight: bold; color: #047857;">${formatRupiah(tr.total_bayar)}</td>
          <td style="text-align: center; font-weight: bold; text-transform: uppercase;">${tr.status}</td>
        </tr>
      `
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Laporan Transaksi Pembayaran</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #1e293b; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #047857; padding-bottom: 10px; }
            .header h2 { margin: 0; color: #047857; font-size: 18px; }
            .header h3 { margin: 4px 0 0 0; font-size: 14px; color: #334155; }
            .header p { margin: 4px 0 0 0; color: #64748b; font-size: 11px; }
            .summary-box { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin-bottom: 20px; }
            .summary-item { font-size: 12px; }
            .summary-item label { color: #64748b; display: block; font-size: 10px; font-weight: bold; text-transform: uppercase; }
            .summary-item span { font-weight: bold; font-size: 14px; color: #047857; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; }
            th { background-color: #f1f5f9; color: #0f172a; text-transform: uppercase; font-size: 10px; }
            .footer { margin-top: 30px; text-align: right; font-size: 10px; color: #94a3b8; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>KLINIK KECANTIKAN</h2>
            <h3>LAPORAN TRANSAKSI PEMBAYARAN</h3>
            <p>Periode Laporan: ${periodeStr}</p>
          </div>

          <div class="summary-box">
            <div class="summary-item">
              <label>Total Transaksi</label>
              <span>${trxRecords.length} Data</span>
            </div>
            <div class="summary-item">
              <label>Total Nominal Pendapatan</label>
              <span>${formatRupiah(totalNominal)}</span>
            </div>
            <div class="summary-item">
              <label>Waktu Cetak</label>
              <span style="color: #334155; font-size: 12px;">${new Date().toLocaleString('id-ID')}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Kode Transaksi</th>
                <th>Tanggal</th>
                <th>Nama Pasien</th>
                <th>No. RM</th>
                <th>Kode Kunjungan</th>
                <th>Metode Bayar</th>
                <th>Subtotal</th>
                <th>Diskon</th>
                <th>Total Bayar</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer">
            Dicetak otomatis oleh Sistem Klinik Kecantikan pada ${new Date().toLocaleString('id-ID')}
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleExportExcelTrx = async () => {
    if (trxRecords.length === 0) {
      showError(toast, 'Tidak ada data transaksi untuk diexport');
      return;
    }

    const exportData = trxRecords.map((tr, idx) => ({
      No: idx + 1,
      'Kode Transaksi': tr.kode_transaksi,
      Tanggal: formatDateIndo(tr.tanggal_transaksi),
      'Nama Pasien': tr.nama_pasien || 'Umum',
      'No. RM': tr.no_rm || '-',
      'Kode Kunjungan': tr.kode_kunjungan || '-',
      'Metode Bayar': String(tr.metode_bayar || 'TUNAI').toUpperCase(),
      'Total Harga (Rp)': tr.total_harga,
      'Total Diskon (Rp)': tr.total_diskon,
      'Total Bayar (Rp)': tr.total_bayar,
      Status: String(tr.status || '').toUpperCase(),
    }));

    const fileName = `Laporan_Transaksi_${new Date().toISOString().slice(0, 10)}`;
    await exportToXLSX({ data: exportData, fileName });
  };

  const handleCetakLaporanRM = () => {
    if (records.length === 0) {
      showError(toast, 'Tidak ada data rekam medis untuk dicetak');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showError(toast, 'Gagal membuka jendela cetak. Mohon izinkan popup browser.');
      return;
    }

    const tglMulaiStr = tanggalDari ? formatDateIndo(tanggalDari.toISOString()) : 'Semua Tanggal';
    const tglSelesaiStr = tanggalSampai ? formatDateIndo(tanggalSampai.toISOString()) : 'Semua Tanggal';
    const periodeStr = `${tglMulaiStr} s.d ${tglSelesaiStr}`;

    const tableRowsHtml = records
      .map(
        (rec, idx) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td><strong>${rec.nama_pasien || '-'}</strong></td>
          <td style="text-align: center;">${rec.no_rm || '-'}</td>
          <td style="text-align: center;">${rec.kode_kunjungan}</td>
          <td>${formatDateIndo(rec.tanggal_kunjungan)} (${rec.jam_datang} WIB)</td>
          <td style="text-align: center;">${rec.layanan.length} Sesi</td>
          <td style="text-align: center; font-weight: bold; text-transform: uppercase;">${rec.status_kunjungan}</td>
        </tr>
      `
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Laporan Rekam Medis Pasien</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #1e293b; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #047857; padding-bottom: 10px; }
            .header h2 { margin: 0; color: #047857; font-size: 18px; }
            .header h3 { margin: 4px 0 0 0; font-size: 14px; color: #334155; }
            .header p { margin: 4px 0 0 0; color: #64748b; font-size: 11px; }
            .summary-box { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin-bottom: 20px; }
            .summary-item { font-size: 12px; }
            .summary-item label { color: #64748b; display: block; font-size: 10px; font-weight: bold; text-transform: uppercase; }
            .summary-item span { font-weight: bold; font-size: 14px; color: #047857; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; }
            th { background-color: #f1f5f9; color: #0f172a; text-transform: uppercase; font-size: 10px; }
            .footer { margin-top: 30px; text-align: right; font-size: 10px; color: #94a3b8; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>KLINIK KECANTIKAN</h2>
            <h3>LAPORAN REKAM MEDIS PASIEN</h3>
            <p>Periode Laporan: ${periodeStr}</p>
          </div>

          <div class="summary-box">
            <div class="summary-item">
              <label>Total Kunjungan</label>
              <span>${records.length} Kunjungan</span>
            </div>
            <div class="summary-item">
              <label>Waktu Cetak</label>
              <span style="color: #334155; font-size: 12px;">${new Date().toLocaleString('id-ID')}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Nama Pasien</th>
                <th>No. RM</th>
                <th>Kode Kunjungan</th>
                <th>Tanggal &amp; Jam</th>
                <th>Sesi Treatment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer">
            Dicetak otomatis oleh Sistem Klinik Kecantikan pada ${new Date().toLocaleString('id-ID')}
          </div>

          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleExportExcelRM = async () => {
    if (records.length === 0) {
      showError(toast, 'Tidak ada data rekam medis untuk diexport');
      return;
    }

    const exportData = records.map((rec, idx) => ({
      No: idx + 1,
      'Kode Kunjungan': rec.kode_kunjungan,
      'No. RM': rec.no_rm,
      'Nama Pasien': rec.nama_pasien,
      Tanggal: formatDateIndo(rec.tanggal_kunjungan),
      'Jam Datang': `${rec.jam_datang} WIB`,
      'Status Kunjungan': String(rec.status_kunjungan || '').toUpperCase(),
      'Jumlah Sesi Treatment': rec.layanan.length,
    }));

    const fileName = `Laporan_Rekam_Medis_${new Date().toISOString().slice(0, 10)}`;
    await exportToXLSX({ data: exportData, fileName });
  };

  const printMenuItemsTrx = [
    {
      label: 'Cetak / Format PDF',
      icon: 'pi pi-file-pdf text-red-600',
      command: () => handleCetakLaporanTrx(),
    },
    {
      label: 'Export Excel (.xlsx)',
      icon: 'pi pi-file-excel text-emerald-600',
      command: () => handleExportExcelTrx(),
    },
  ];

  const printMenuItemsRM = [
    {
      label: 'Cetak / Format PDF',
      icon: 'pi pi-file-pdf text-red-600',
      command: () => handleCetakLaporanRM(),
    },
    {
      label: 'Export Excel (.xlsx)',
      icon: 'pi pi-file-excel text-emerald-600',
      command: () => handleExportExcelRM(),
    },
  ];

  const toggleExpand = (kode_kunjungan: string) => {
    setExpandedVisits((prev) => ({
      ...prev,
      [kode_kunjungan]: !prev[kode_kunjungan],
    }));
  };

  const toggleExpandTrx = (kode_transaksi: string) => {
    setExpandedTrx((prev) => ({
      ...prev,
      [kode_transaksi]: !prev[kode_transaksi],
    }));
  };

  const totalHargaBruto = trxRecords.reduce((acc, curr) => acc + (curr.total_harga || 0), 0);
  const totalPotonganDiskon = trxRecords.reduce((acc, curr) => acc + (curr.total_diskon || 0), 0);
  const grandTotalBersih = trxRecords.reduce((acc, curr) => acc + (curr.total_bayar || 0), 0);

  const trxFooterGroup = (
    <ColumnGroup>
      <Row>
        <Column footer="Grand Total (Semua Halaman):" colSpan={5} footerStyle={{ textAlign: 'right', fontWeight: 'bold' }} />
        <Column footer={formatRupiah(totalHargaBruto)} footerStyle={{ fontWeight: 'bold', textAlign: 'right' }} />
        <Column footer={totalPotonganDiskon > 0 ? `- ${formatRupiah(totalPotonganDiskon)}` : 'Rp 0'} footerStyle={{ fontWeight: 'bold', textAlign: 'right', color: '#dc2626' }} />
        <Column footer={formatRupiah(grandTotalBersih)} footerStyle={{ fontWeight: 'bold', textAlign: 'right', color: '#047857' }} />
        <Column footer="" colSpan={1} />
      </Row>
    </ColumnGroup>
  );

  return (
    <>
      <Toast ref={toast} position="top-right" />

      {/* 1. KARTU SELEKTOR UTAMA: LAPORAN & ANALYTICS (SESUAI GAMBAR 4 KOLOM) */}
      <LaporanNavCard
        activeModule={activeModule}
        onSelectModule={(id) => setActiveModule(id)}
      />

      {/* ─── TAB: REKAM MEDIS KLINIS ─── */}
      {activeModule === 'rekam_medis' && (
        <>
          {/* CARD UTAMA: ACTION BUTTONS, KETERANGAN STATUS & FILTER BAR */}
          <div className="card mb-4">
            <div className="flex flex-row flex-wrap align-items-center gap-2 mb-4">
              <Button
                size="small"
                label="Refresh"
                icon="pi pi-refresh"
                outlined
                severity="success"
                className="border-round-lg"
                loading={loadingRecords}
                onClick={() => fetchRekamMedis(1, searchVal)}
              />
              <Menu model={printMenuItemsRM} popup ref={printMenuRMRef} />
              <Button
                type="button"
                size="small"
                label="Cetak Laporan"
                icon="pi pi-print"
                outlined
                severity="success"
                className="border-round-lg"
                onClick={(e) => printMenuRMRef.current?.toggle(e)}
              />
            </div>

            {/* Legend Box Status Kunjungan */}
            <div className="flex flex-wrap align-items-center gap-4 mb-4 p-3 surface-50 border-round-xl border-1 surface-border">
              <span className="flex align-items-center text-xs font-bold text-500 uppercase tracking-wider mr-2">
                <i className="pi pi-info-circle mr-2" /> KETERANGAN STATUS:
              </span>
              <div className="flex align-items-center gap-2">
                <span className="block bg-yellow-500 border-round-sm" style={{ width: '12px', height: '12px' }} />
                <span className="text-xs font-semibold text-700">Menunggu</span>
              </div>
              <div className="flex align-items-center gap-2">
                <span className="block bg-blue-500 border-round-sm" style={{ width: '12px', height: '12px' }} />
                <span className="text-xs font-semibold text-700">Berlangsung / Dipanggil</span>
              </div>
              <div className="flex align-items-center gap-2">
                <span className="block bg-teal-500 border-round-sm" style={{ width: '12px', height: '12px' }} />
                <span className="text-xs font-semibold text-700">Selesai</span>
              </div>
              <div className="flex align-items-center gap-2">
                <span className="block bg-red-500 border-round-sm" style={{ width: '12px', height: '12px' }} />
                <span className="text-xs font-semibold text-700">Batal</span>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap align-items-center justify-content-between gap-3">
              <div className="flex align-items-center flex-wrap gap-2">
                <div className="flex align-items-center gap-2">
                  <Calendar
                    value={tanggalDari}
                    onChange={(e) => setTanggalDari(e.value as Date)}
                    dateFormat="yy-mm-dd"
                    showIcon
                    placeholder="Mulai"
                    className="w-11rem text-sm"
                  />
                  <span className="text-xs text-500 font-bold">s.d</span>
                  <Calendar
                    value={tanggalSampai}
                    onChange={(e) => setTanggalSampai(e.value as Date)}
                    dateFormat="yy-mm-dd"
                    showIcon
                    placeholder="Selesai"
                    className="w-11rem text-sm"
                  />
                </div>
              </div>

              <div className="flex align-items-center gap-2 ml-auto w-full md:w-auto">
                <Button
                  type="button"
                  icon="pi pi-filter"
                  label="Filter"
                  outlined
                  severity="success"
                  onClick={() => fetchRekamMedis(1, searchVal)}
                  loading={loadingRecords}
                  className="border-round-lg"
                />

                <span className="p-input-icon-left w-full md:w-20rem">
                  <IconField iconPosition="left">
                    <InputIcon className="pi pi-search" />
                    <InputText
                      value={searchVal}
                      className="w-full text-sm"
                      placeholder="Cari Pasien, RM, Diagnosa..."
                      onChange={(e) => {
                        const value = e.target.value;
                        setSearchVal(value);

                        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                        searchTimeoutRef.current = setTimeout(() => {
                          fetchRekamMedis(1, value);
                        }, 400);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                          fetchRekamMedis(1, searchVal);
                        }
                      }}
                    />
                  </IconField>
                </span>

                <Button
                  type="button"
                  icon="pi pi-filter-slash"
                  outlined
                  severity="danger"
                  tooltip="Reset Semua Filter"
                  tooltipOptions={{ position: 'bottom' }}
                  onClick={handleResetFilterRM}
                  className="border-round-lg"
                />
              </div>
            </div>

            {/* REKAM MEDIS DATATABLE */}
          <DataTable
            value={records}
            loading={loadingRecords}
            className="p-datatable-sm text-xs"
            responsiveLayout="scroll"
            stripedRows
            showGridlines
            emptyMessage="Data riwayat rekam medis tidak ditemukan pada filter ini."
            expandedRows={expandedRMRows}
            onRowToggle={(e) => setExpandedRMRows(e.data)}
            rowExpansionTemplate={(record: KunjunganRecord) => (
              <div className="p-3 bg-gray-50/80 border-round-lg">
                <div className="flex align-items-center justify-content-between mb-3 pb-2 border-bottom-1 surface-border">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex align-items-center gap-2">
                    <i className="pi pi-folder-open text-emerald-600 text-sm" />
                    RINCIAN SOAP &amp; SESI TREATMENT (KUNJUNGAN: {record.kode_kunjungan})
                  </span>
                </div>

                {record.layanan.length === 0 ? (
                  <div className="text-xs text-gray-400 italic py-2 text-center">
                    Tidak ada catatan treatment pada kunjungan ini.
                  </div>
                ) : (
                  record.layanan.map((item, lIdx) => {
                    const rm = item.rekam_medis;
                    const dpjpOrPetugas = rm?.dokter_penanggung_jawab || item.petugas;
                    return (
                      <div key={lIdx} className="surface-card p-0 border-round-lg border-1 surface-border shadow-2xs overflow-hidden mb-3">
                        <div className="bg-emerald-50/60 p-3 border-bottom-1 surface-border flex align-items-center justify-content-between flex-wrap gap-2">
                          <div>
                            <div className="flex align-items-center gap-2 mb-1">
                              <i className="pi pi-building text-emerald-600" />
                              <span className="font-bold text-sm text-gray-800">{item.nama_ruangan}</span>
                              <Tag
                                value={item.status.toUpperCase()}
                                severity={getStatusAntrianSeverity(item.status)}
                                rounded
                                className="text-[9px] font-bold px-2 py-0.5 ml-2"
                              />
                            </div>
                            <div className="text-xs text-gray-600 font-medium">
                              <span className="font-semibold text-gray-500 uppercase text-[10px]">Layanan:</span> {item.nama_layanan}
                            </div>
                          </div>
                          <div className="text-right">
                            {(() => {
                              const terapisList: any[] = Array.isArray((item as any).terapis_pendamping) ? (item as any).terapis_pendamping : [];
                              const allDaftarPetugas: any[] = Array.isArray((item as any).daftar_petugas) ? (item as any).daftar_petugas : [];

                              if (allDaftarPetugas.length > 0) {
                                return (
                                  <div className="flex flex-column gap-1 align-items-end">
                                    <span className="text-[10px] text-gray-500 font-semibold uppercase">Petugas Pelaksana ({allDaftarPetugas.length}):</span>
                                    <div className="flex align-items-center gap-1.5 flex-wrap justify-content-end">
                                      {allDaftarPetugas.map((p, pIdx) => (
                                        <span key={pIdx} className={getJabatanBadge(p.role || p.jabatan)}>
                                          {p.nama}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }

                              if (terapisList.length > 0) {
                                return (
                                  <div className="flex flex-column gap-1 align-items-end">
                                    <span className="text-[10px] text-gray-500 font-semibold uppercase">Dokter &amp; Terapis ({terapisList.length + (dpjpOrPetugas ? 1 : 0)}):</span>
                                    <div className="flex align-items-center gap-1.5 flex-wrap justify-content-end">
                                      {dpjpOrPetugas && (
                                        <span className={getJabatanBadge(dpjpOrPetugas.jabatan)}>
                                          {dpjpOrPetugas.nama}
                                        </span>
                                      )}
                                      {terapisList.map((t, tIdx) => (
                                        <span key={tIdx} className={getJabatanBadge(t.role || t.jabatan || 'terapis')}>
                                          {t.nama || t.nama_petugas}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }

                              if (dpjpOrPetugas) {
                                return (
                                  <div className="flex align-items-center gap-1.5 justify-content-end">
                                    <span className="text-xs text-gray-500 font-medium">Dokter / Petugas:</span>
                                    <span className={getJabatanBadge(dpjpOrPetugas.jabatan)}>
                                      {dpjpOrPetugas.nama}
                                    </span>
                                  </div>
                                );
                              }

                              return <div className="text-xs text-gray-400 italic">Dokter / Petugas: -</div>;
                            })()}
                          </div>
                        </div>

                        <div className="p-3 flex flex-column gap-3">
                          {rm && (
                            rm.kode_rekam_medis ||
                            (rm.keluhan && rm.keluhan !== '-') ||
                            (rm.diagnosis && rm.diagnosis !== '-') ||
                            rm.subjective ||
                            rm.objective ||
                            rm.assessment ||
                            rm.plan
                          ) ? (
                            <div className="grid text-xs">
                              {/* S - ANAMNESIS */}
                              <div className="col-12 md:col-6 mb-3">
                                <div className="h-full bg-blue-50/30 border-1 border-blue-100 border-left-4 border-blue-500 p-3 border-round-lg">
                                  <label className="block text-xs font-bold text-blue-700 uppercase tracking-wider mb-2 flex align-items-center gap-1.5">
                                    <i className="pi pi-comments text-blue-600 text-sm" />
                                    ANAMNESIS &amp; KELUHAN
                                  </label>
                                  <div className="text-gray-800 font-medium leading-normal flex flex-column gap-1">
                                    <div><span className="font-semibold text-color-secondary">Keluhan: </span>{renderFormattedContent(rm.keluhan)}</div>
                                    {rm.durasi_keluhan && <div><span className="font-semibold text-color-secondary">Durasi: </span>{rm.durasi_keluhan}</div>}
                                    {rm.riwayat_alergi && <div><span className="font-semibold text-red-600">Riwayat Alergi: </span>{rm.riwayat_alergi}</div>}
                                    {rm.riwayat_treatment && <div><span className="font-semibold text-color-secondary">Riwayat Treatment: </span>{rm.riwayat_treatment}</div>}
                                  </div>
                                </div>
                              </div>

                              {/* O - PEMERIKSAAN KATEGORIKAL */}
                              <div className="col-12 md:col-6 mb-3">
                                <div className="h-full bg-teal-50/30 border-1 border-teal-100 border-left-4 border-teal-500 p-3 border-round-lg">
                                  <label className="block text-xs font-bold text-teal-700 uppercase tracking-wider mb-2 flex align-items-center gap-1.5">
                                    <i className="pi pi-eye text-teal-600 text-sm" />
                                    PEMERIKSAAN KULIT &amp; DIAGNOSIS
                                  </label>
                                  <div className="text-gray-800 font-medium leading-normal flex flex-column gap-1">
                                    <div><span className="font-bold text-teal-900">Diagnosis: </span>{rm.diagnosis || '-'}</div>
                                    <div className="grid text-[11px] mt-1 pt-1 border-top-1 surface-border">
                                      <div className="col-6">Acne: <strong>{rm.pemeriksaan_acne || '-'}</strong></div>
                                      <div className="col-6">Inflammation: <strong>{rm.pemeriksaan_inflammation || '-'}</strong></div>
                                      <div className="col-6">Tipe Kulit: <strong>{rm.pemeriksaan_skin_type || '-'}</strong></div>
                                      <div className="col-6">Pigmentasi: <strong>{rm.pemeriksaan_pigmentation || '-'}</strong></div>
                                      <div className="col-12">Sensitivitas: <strong>{rm.pemeriksaan_sensitivity || '-'}</strong></div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* A / P - SOAP DETAIL */}
                              <div className="col-12 mb-2">
                                <div className="bg-purple-50/30 border-1 border-purple-100 border-left-4 border-purple-500 p-3 border-round-lg text-xs">
                                  <label className="block text-xs font-bold text-purple-700 uppercase tracking-wider mb-2 flex align-items-center gap-1.5">
                                    <i className="pi pi-stethoscope text-purple-600 text-sm" />
                                    SOAP DOKTER (SUBJECTIVE, OBJECTIVE, ASSESSMENT, PLAN)
                                  </label>
                                  <div className="grid">
                                    <div className="col-12 md:col-6 mb-1">
                                      <span className="font-bold text-purple-900 block">S (Subjective):</span>
                                      <span>{rm.subjective || rm.keluhan || '-'}</span>
                                    </div>
                                    <div className="col-12 md:col-6 mb-1">
                                      <span className="font-bold text-purple-900 block">O (Objective):</span>
                                      <span>{rm.objective || '-'}</span>
                                    </div>
                                    <div className="col-12 md:col-6 mb-1">
                                      <span className="font-bold text-purple-900 block">A (Assessment):</span>
                                      <span>{rm.assessment || rm.diagnosis || '-'}</span>
                                    </div>
                                    <div className="col-12 md:col-6 mb-1">
                                      <span className="font-bold text-purple-900 block">P (Plan):</span>
                                      <span>{rm.plan || '-'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {renderDataFormDinamis(rm, item)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
            dataKey="kode_kunjungan"
          >
            <Column expander style={{ width: '3rem' }} />
            <Column
              header="#"
              body={(_, options) => (page - 1) * perPage + options.rowIndex + 1}
              style={{ width: '3rem', textAlign: 'center' }}
            />
            <Column
              field="tanggal_kunjungan"
              header="TANGGAL &amp; JAM"
              sortable
              body={(rec: KunjunganRecord) => (
                <div className="flex flex-column gap-0.5 text-xs text-gray-700 font-medium">
                  <div className="flex align-items-center gap-1.5">
                    <i className="pi pi-calendar text-emerald-600" />
                    <span>{formatDateIndo(rec.tanggal_kunjungan)}</span>
                  </div>
                  <div className="flex align-items-center gap-1 text-[11px] text-gray-400">
                    <i className="pi pi-clock" />
                    <span>{rec.jam_datang} WIB</span>
                  </div>
                </div>
              )}
            />
            <Column
              field="nama_pasien"
              header="NAMA PASIEN"
              sortable
              body={(rec: KunjunganRecord) => (
                <span className="font-bold text-xs text-gray-800">{rec.nama_pasien || '-'}</span>
              )}
            />
            <Column
              header="DOKTER PENANGGUNG JAWAB"
              body={(rec: KunjunganRecord) => {
                const dokter = rec.layanan.find((l) => l.rekam_medis?.dokter_penanggung_jawab)?.rekam_medis?.dokter_penanggung_jawab;
                if (!dokter) return <span className="text-xs text-gray-400 italic">-</span>;
                return (
                  <span className={getJabatanBadge(dokter.jabatan)}>
                    {dokter.nama}
                  </span>
                );
              }}
            />
            <Column
              header="ANAMNESA / KELUHAN"
              body={(rec: KunjunganRecord) => {
                const keluhan = rec.layanan.find((l) => l.rekam_medis?.keluhan)?.rekam_medis?.keluhan;
                if (!keluhan || keluhan === '-') return <span className="text-xs text-gray-400 italic">-</span>;
                return <span className="text-xs font-medium text-gray-700 line-clamp-2">{keluhan}</span>;
              }}
              style={{ minWidth: '150px' }}
            />
            <Column
              header="DIAGNOSA"
              body={(rec: KunjunganRecord) => {
                const diagnosa = rec.layanan.find((l) => l.rekam_medis?.diagnosa)?.rekam_medis?.diagnosa;
                if (!diagnosa || diagnosa === '-') return <span className="text-xs text-gray-400 italic">-</span>;
                return <span className="text-xs font-medium text-gray-700 line-clamp-2">{diagnosa}</span>;
              }}
              style={{ minWidth: '150px' }}
            />
            <Column
              header="FOTO (BEFORE / AFTER)"
              body={(rec: KunjunganRecord) => {
                const allFotos = rec.layanan.flatMap((l) => l.rekam_medis?.fotos || []);
                if (allFotos.length === 0) {
                  return <span className="text-xs text-gray-400 italic py-1">Tanpa Foto</span>;
                }
                return (
                  <div className="flex align-items-center gap-1.5 flex-wrap">
                    {allFotos.map((f, idx) => {
                      const jenisFoto = String(f.tipe || f.jenis_foto || 'foto').toLowerCase();
                      return (
                        <div key={idx} className="relative group">
                          <Image
                            src={getImgSrc(f.url_foto)}
                            alt={jenisFoto || 'Foto RM'}
                            width="45"
                            height="45"
                            preview
                            className="border-round-md overflow-hidden border-1 surface-border shadow-2xs hover:scale-105 transition-all"
                            imageClassName="w-full h-full object-cover border-round-md"
                          />
                          <span
                            className={
                              jenisFoto === 'before'
                                ? 'absolute -bottom-1 left-0 right-0 bg-gray-900/80 text-white text-[8px] font-bold text-center border-round-bottom-md py-0.2'
                                : 'absolute -bottom-1 left-0 right-0 bg-emerald-700/90 text-white text-[8px] font-bold text-center border-round-bottom-md py-0.2'
                            }
                          >
                            {jenisFoto.toUpperCase()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              }}
              style={{ minWidth: '150px' }}
            />
            <Column
              field="status_kunjungan"
              header="STATUS"
              sortable
              body={(rec: KunjunganRecord) => (
                <Tag
                  value={String(rec.status_kunjungan || '').toUpperCase()}
                  severity={getStatusKunjunganSeverity(rec.status_kunjungan)}
                  rounded
                  className="text-[10px] font-bold px-2.5 py-0.5"
                />
              )}
            />
          </DataTable>

          {totalRecords > perPage && (
            <div className="mt-3 pt-2 border-top-1 surface-border">
              <Paginator
                first={(page - 1) * perPage}
                rows={perPage}
                totalRecords={totalRecords}
                onPageChange={(e) => fetchRekamMedis(e.page + 1, searchVal)}
                className="p-paginator-sm"
              />
            </div>
          )}
        </div>
      </>
    )}

      {/* ─── TAMPILAN VIEW MODUL LAPORAN AKTIF DARI DATABASE ─── */}
      {activeModule === 'penjualan' && <LaporanPenjualanView />}
      {activeModule === 'treatment' && <LaporanTreatmentView />}
      {activeModule === 'produk' && <LaporanProdukView />}
      {activeModule === 'paket' && <LaporanPaketView />}
      {activeModule === 'pasien' && <LaporanPasienView />}
      {activeModule === 'kunjungan' && <LaporanKunjunganView />}
      {activeModule === 'dokter' && <LaporanDokterView />}
      {activeModule === 'beautician' && <LaporanBeauticianView />}
      {activeModule === 'inventory' && <LaporanInventoryView />}
      {activeModule === 'voucher' && <LaporanVoucherView />}
      {activeModule === 'keuangan' && <LaporanKeuanganView />}

      {/* ─── MODUL DALAM PROGRES PENGERJAAN (SESUAI REQUEST USER) ─── */}
      {activeModule === 'membership' && (
        <ModulWipCard moduleName="Laporan Membership" onBackToActive={() => setActiveModule('penjualan')} />
      )}
      {activeModule === 'appointment' && (
        <ModulWipCard moduleName="Laporan Appointment" onBackToActive={() => setActiveModule('penjualan')} />
      )}
      {activeModule === 'komisi' && (
        <ModulWipCard moduleName="Laporan Komisi" onBackToActive={() => setActiveModule('penjualan')} />
      )}
      {activeModule === 'stok_opname' && (
        <ModulWipCard moduleName="Laporan Stok Opname" onBackToActive={() => setActiveModule('penjualan')} />
      )}
      {activeModule === 'pembelian' && (
        <ModulWipCard moduleName="Laporan Pembelian" onBackToActive={() => setActiveModule('penjualan')} />
      )}
      {activeModule === 'expired' && (
        <ModulWipCard moduleName="Laporan Expired" onBackToActive={() => setActiveModule('penjualan')} />
      )}
      {activeModule === 'deposit' && (
        <ModulWipCard moduleName="Laporan Deposit" onBackToActive={() => setActiveModule('penjualan')} />
      )}
      {activeModule === 'crm' && (
        <ModulWipCard moduleName="Laporan CRM" onBackToActive={() => setActiveModule('penjualan')} />
      )}
    </>
  );
};

export default LaporanPage;

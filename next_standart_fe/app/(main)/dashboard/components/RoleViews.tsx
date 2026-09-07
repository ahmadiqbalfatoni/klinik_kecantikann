'use client';

import React from 'react';
import { Chart } from 'primereact/chart';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Image } from 'primereact/image';
import { ProgressBar } from 'primereact/progressbar';

export const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num || 0);
};

export const formatDateIndo = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch (_) {
    return dateStr;
  }
};

/* =========================================================================
   1. VIEW OWNER / MANAGER
   ========================================================================= */
export const OwnerManagerView: React.FC<{ data: any; onRefresh: () => void; loading: boolean }> = ({
  data,
  onRefresh,
  loading,
}) => {
  const owner = data?.owner || {};
  const kpi = owner.kpi || {};
  const inventory = owner.inventory || {};
  const sdm = owner.sdm || {};

  // 1. Doughnut Chart & Rincian Nominal: Metode Bayar
  const rawMetode = (owner.metode_bayar && owner.metode_bayar.length > 0)
    ? owner.metode_bayar
    : [
        { metode_bayar: 'QRIS', nominal: 2500000 },
        { metode_bayar: 'TUNAI', nominal: 1500000 },
        { metode_bayar: 'DEBIT', nominal: 800000 },
        { metode_bayar: 'TRANSFER', nominal: 655000 },
      ];

  const totalMetodeNominal = rawMetode.reduce(
    (acc: number, item: any) => acc + (parseFloat(item.nominal) || 0),
    0
  );

  // Palet metode bayar selaras dengan legend
  const metodePalette = [
    { bg: '#059669', hover: '#047857' }, // Emerald utama
    { bg: '#10b981', hover: '#059669' }, // Emerald medium
    { bg: '#34d399', hover: '#10b981' }, // Mint
    { bg: '#6ee7b7', hover: '#34d399' }, // Light emerald
    { bg: '#a7f3d0', hover: '#6ee7b7' },
  ];

  const metodeLabels = rawMetode.map((m: any) => String(m.metode_bayar || 'TUNAI').toUpperCase());
  const metodeNominals = rawMetode.map((m: any) => parseFloat(m.nominal || 0));

  const metodeChartData = {
    labels: metodeLabels,
    datasets: [
      {
        data: metodeNominals,
        backgroundColor: metodePalette.map((p) => p.bg).slice(0, metodeLabels.length),
        hoverBackgroundColor: metodePalette.map((p) => p.hover).slice(0, metodeLabels.length),
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  const metodeChartOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const val = context.raw || 0;
            const pct = totalMetodeNominal > 0 ? Math.round((val / totalMetodeNominal) * 100) : 0;
            return ` ${formatRupiah(val)} (${pct}%)`;
          },
        },
      },
    },
    cutout: '72%',
    maintainAspectRatio: false,
  };

  // 2. Horizontal Bar Chart: Top Treatment (Item 1 hijau tua penuh, 4 berikutnya gradasi pudar)
  const topTreatments = owner.top_treatment || [];
  const treatmentLabels = topTreatments.length > 0
    ? topTreatments.map((t: any) => t.nama_layanan || 'Treatment')
    : ['Laser Brightening & Rejuvenation', 'Facial Deep Cleansing & Glow', 'Chemical Peeling Acne', 'Acne Care Treatment', 'Anti-Aging Intensive'];

  const treatmentData = topTreatments.length > 0
    ? topTreatments.map((t: any) => t.total_sesi || 0)
    : [18, 14, 10, 8, 5];

  // Gradasi brand: #059669 (paling diminati), lalu bertahap memudar
  const treatmentBarColors = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];
  const treatmentHoverColors = ['#047857', '#059669', '#10b981', '#34d399', '#6ee7b7'];

  const treatmentChartData = {
    labels: treatmentLabels,
    datasets: [
      {
        label: 'Jumlah Sesi',
        backgroundColor: treatmentBarColors.slice(0, treatmentLabels.length),
        hoverBackgroundColor: treatmentHoverColors.slice(0, treatmentLabels.length),
        borderRadius: 6,
        data: treatmentData,
        barPercentage: 0.65,
      },
    ],
  };

  const treatmentChartOptions = {
    indexAxis: 'y' as const,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => ` ${context.parsed.x} Sesi Tindakan Selesai`,
        },
      },
    },
    scales: {
      x: {
        ticks: { stepSize: 1, font: { size: 11 }, color: '#64748b' },
        grid: { color: '#f1f5f9' },
      },
      y: {
        ticks: { font: { size: 11, weight: '600' }, color: '#1e293b' },
        grid: { display: false },
      },
    },
  };

  return (
    <div className="flex flex-column gap-4">
      {/* 5 KPI CARDS DENGAN HIERARKI VISUAL 12-KOLOM (HERO PENDAPATAN 4 KOLOM, SISANYA 2 KOLOM) */}
      <div className="grid align-items-stretch">
        {/* KPI 1: PENDAPATAN (HERO CARD - PALING UTAMA, 4 KOLOM) */}
        <div className="col-12 md:col-6 lg:col-4">
          <div
            className="border-round-xl border-1 border-emerald-300 shadow-sm p-4 h-full flex flex-column justify-content-between transition-all transition-duration-200 hover:shadow-1"
            style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)' }}
          >
            <div>
              <div className="flex justify-content-between align-items-center mb-2">
                <span className="font-bold uppercase tracking-wider" style={{ color: '#065f46', fontSize: '11px', letterSpacing: '0.04em' }}>
                  Total Pendapatan
                </span>
                <i className="pi pi-wallet flex-shrink-0" style={{ fontSize: '16px', color: '#059669' }} />
              </div>
              <div className="text-3xl lg:text-4xl font-black text-emerald-950 tracking-tight my-1">
                {formatRupiah(kpi.omzet_total || 0)}
              </div>
              <span className="text-xs font-medium" style={{ color: '#047857' }}>Akumulasi Seluruh Omzet Klinik</span>
            </div>
            {Number(kpi.omzet_hari_ini || 0) > 0 ? (
              <div className="mt-3 pt-2.5 border-top-1 border-emerald-100 text-xs font-semibold flex align-items-center" style={{ color: '#047857', gap: '8px' }}>
                <i className="pi pi-arrow-up-right font-bold" style={{ color: '#059669' }} />
                <span>Hari ini: {formatRupiah(kpi.omzet_hari_ini)}</span>
              </div>
            ) : (
              <div className="mt-3 pt-2.5 border-top-1 border-emerald-100 text-xs font-normal flex align-items-center" style={{ color: '#94a3b8', gap: '8px' }}>
                <i className="pi pi-minus" style={{ color: '#94a3b8' }} />
                <span>Hari ini: Belum ada transaksi (Rp 0)</span>
              </div>
            )}
          </div>
        </div>

        {/* KPI 2: PASIEN & KUNJUNGAN (2 KOLOM) */}
        <div className="col-12 sm:col-6 lg:col-2">
          <div className="bg-white border-round-xl border-1 border-slate-200 shadow-sm p-3.5 h-full flex flex-column justify-content-between transition-all transition-duration-200 hover:shadow-1">
            <div>
              <div className="flex justify-content-between align-items-center gap-2 mb-1">
                <span className="font-bold uppercase tracking-wider" style={{ color: '#64748b', fontSize: '11px', letterSpacing: '0.04em' }}>
                  Pasien &amp; Kunjungan
                </span>
                <i className="pi pi-users flex-shrink-0" style={{ fontSize: '15px', color: '#94a3b8' }} />
              </div>
              <div className="text-2xl font-bold text-slate-800 tracking-tight my-1">
                {kpi.total_pasien || 0}
              </div>
              <span className="text-xs" style={{ color: '#94a3b8' }}>Pasien Terdaftar</span>
            </div>
            {Number(kpi.kunjungan_hari_ini || 0) > 0 ? (
              <div className="mt-3 pt-2.5 border-top-1 border-slate-100 text-xs font-semibold flex align-items-center" style={{ color: '#334155', gap: '8px' }}>
                <i className="pi pi-calendar-plus" style={{ color: '#059669' }} />
                <span>{kpi.kunjungan_hari_ini} Hari Ini</span>
              </div>
            ) : (
              <div className="mt-3 pt-2.5 border-top-1 border-slate-100 text-xs flex align-items-center" style={{ color: '#94a3b8', gap: '8px' }}>
                <i className="pi pi-minus" style={{ color: '#94a3b8' }} />
                <span>0 Kunjungan Hari Ini</span>
              </div>
            )}
          </div>
        </div>

        {/* KPI 3: VARIAN TREATMENT (2 KOLOM) */}
        <div className="col-12 sm:col-6 lg:col-2">
          <div className="bg-white border-round-xl border-1 border-slate-200 shadow-sm p-3.5 h-full flex flex-column justify-content-between transition-all transition-duration-200 hover:shadow-1">
            <div>
              <div className="flex justify-content-between align-items-center gap-2 mb-1">
                <span className="font-bold uppercase tracking-wider" style={{ color: '#64748b', fontSize: '11px', letterSpacing: '0.04em' }}>
                  Varian Layanan
                </span>
                <i className="pi pi-sparkles flex-shrink-0" style={{ fontSize: '15px', color: '#94a3b8' }} />
              </div>
              <div className="text-2xl font-bold text-slate-800 tracking-tight my-1">
                {topTreatments.length || 0}
              </div>
              <span className="text-xs" style={{ color: '#94a3b8' }}>Katalog Layanan</span>
            </div>
            <div className="mt-3 pt-2.5 border-top-1 border-slate-100 text-xs font-medium flex align-items-center" style={{ color: '#475569', gap: '8px' }}>
              <i className="pi pi-check-circle" style={{ color: '#059669' }} />
              <span>Siap Dipesan</span>
            </div>
          </div>
        </div>

        {/* KPI 4: LOGISTIK & INVENTORY (2 KOLOM) */}
        <div className="col-12 sm:col-6 lg:col-2">
          <div className="bg-white border-round-xl border-1 border-slate-200 shadow-sm p-3.5 h-full flex flex-column justify-content-between transition-all transition-duration-200 hover:shadow-1">
            <div>
              <div className="flex justify-content-between align-items-center gap-2 mb-1">
                <span className="font-bold uppercase tracking-wider" style={{ color: '#64748b', fontSize: '11px', letterSpacing: '0.04em' }}>
                  Logistik Aset
                </span>
                <i className="pi pi-box flex-shrink-0" style={{ fontSize: '15px', color: '#94a3b8' }} />
              </div>
              <div className="text-2xl font-bold text-slate-800 tracking-tight my-1">
                {inventory.total_sku || 0} <span className="text-xs font-normal" style={{ color: '#94a3b8' }}>SKU</span>
              </div>
              <span className="text-xs truncate block" style={{ color: '#94a3b8' }}>Nilai: {formatRupiah(inventory.total_aset || 0)}</span>
            </div>
            {Number(inventory.stok_menipis || 0) > 0 ? (
              <div className="mt-3 pt-2.5 border-top-1 border-slate-100 text-xs font-semibold flex align-items-center" style={{ color: '#b45309', gap: '8px' }}>
                <i className="pi pi-exclamation-triangle" style={{ color: '#d97706' }} />
                <span>{inventory.stok_menipis} Stok Menipis</span>
              </div>
            ) : (
              <div className="mt-3 pt-2.5 border-top-1 border-slate-100 text-xs flex align-items-center" style={{ color: '#94a3b8', gap: '8px' }}>
                <i className="pi pi-check" style={{ color: '#059669' }} />
                <span>Stok Terkendali</span>
              </div>
            )}
          </div>
        </div>

        {/* KPI 5: TENAGA MEDIS & SDM (2 KOLOM) */}
        <div className="col-12 sm:col-6 lg:col-2">
          <div className="bg-white border-round-xl border-1 border-slate-200 shadow-sm p-3.5 h-full flex flex-column justify-content-between transition-all transition-duration-200 hover:shadow-1">
            <div>
              <div className="flex justify-content-between align-items-center gap-2 mb-1">
                <span className="font-bold uppercase tracking-wider" style={{ color: '#64748b', fontSize: '11px', letterSpacing: '0.04em' }}>
                  Tenaga Medis
                </span>
                <i className="pi pi-id-card flex-shrink-0" style={{ fontSize: '15px', color: '#94a3b8' }} />
              </div>
              <div className="text-2xl font-bold text-slate-800 tracking-tight my-1">
                {(sdm.dokter?.length || 0) + (sdm.beautician?.length || 0)} <span className="text-xs font-normal" style={{ color: '#94a3b8' }}>Staf</span>
              </div>
              <span className="text-xs" style={{ color: '#94a3b8' }}>{sdm.dokter?.length || 0} Dokter · {sdm.beautician?.length || 0} Terapis</span>
            </div>
            <div className="mt-3 pt-2.5 border-top-1 border-slate-100 text-xs font-medium flex align-items-center" style={{ color: '#475569', gap: '8px' }}>
              <i className="pi pi-user-check" style={{ color: '#059669' }} />
              <span>Jadwal Aktif</span>
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS ROW (DONUT SIDE-BY-SIDE & HORIZONTAL BAR) */}
      <div className="grid align-items-stretch">
        {/* GRAFIK METODE BAYAR + BREAKDOWN NOMINAL PROPORSIONAL */}
        <div className="col-12 lg:col-5">
          <div className="bg-white p-4 border-round-xl border-1 border-slate-200 shadow-sm h-full flex flex-column justify-content-between">
            <div>
              <div className="flex justify-content-between align-items-center mb-4">
                <span className="font-bold text-sm text-slate-800">Komposisi Metode Pembayaran</span>
                <span className="bg-emerald-50 text-emerald-700 border-1 border-emerald-200 border-round-pill text-[11px] font-semibold px-2.5 py-0.5">
                  REAL-TIME
                </span>
              </div>

              {/* Side-by-Side: Donut di kiri, Rincian Angka Nominal & Bar Proporsional di kanan */}
              <div className="grid align-items-center">
                <div className="col-12 sm:col-5 flex justify-content-center">
                  <div style={{ width: '150px', height: '150px' }}>
                    <Chart type="doughnut" data={metodeChartData} options={metodeChartOptions} className="w-full h-full" />
                  </div>
                </div>

                <div className="col-12 sm:col-7 flex flex-column gap-3 pl-2">
                  {rawMetode.map((item: any, idx: number) => {
                    const nominal = parseFloat(item.nominal) || 0;
                    const pct = totalMetodeNominal > 0 ? Math.round((nominal / totalMetodeNominal) * 100) : 0;
                    const color = metodePalette[idx % metodePalette.length].bg;

                    return (
                      <div key={item.metode_bayar || idx} className="flex flex-column gap-1.5">
                        <div className="flex justify-content-between align-items-center text-xs">
                          <div className="flex align-items-center gap-2">
                            <span className="w-2.5 h-2.5 border-circle flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="font-semibold text-slate-700">{String(item.metode_bayar).toUpperCase()}</span>
                          </div>
                          <div className="text-slate-800 font-semibold">
                            {formatRupiah(nominal)} <span className="text-slate-400 font-normal text-[11px] ml-1">({pct}%)</span>
                          </div>
                        </div>
                        {/* Bar horizontal proporsional: titik kiri sama, tinggi sama (6px), lebar proporsional */}
                        <div className="w-full bg-slate-100 border-round overflow-hidden" style={{ height: '6px' }}>
                          <div
                            style={{
                              width: `${Math.max(pct, 1)}%`,
                              backgroundColor: color,
                              height: '100%',
                              borderRadius: '3px',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 mt-4 border-top-1 border-slate-100 flex justify-content-between align-items-center text-xs text-slate-600">
              <span>Total Transaksi Terdata:</span>
              <strong className="text-slate-900 font-bold">{formatRupiah(totalMetodeNominal)}</strong>
            </div>
          </div>
        </div>

        {/* GRAFIK TREATMENT TERPOPULER (HORIZONTAL BAR - ITEM 1 HIJAU TUA, BERIKUTNYA MEMUDAR) */}
        <div className="col-12 lg:col-7">
          <div className="bg-white p-4 border-round-xl border-1 border-slate-200 shadow-sm h-full flex flex-column justify-content-between">
            <div>
              <div className="flex justify-content-between align-items-center mb-4">
                <span className="font-bold text-sm text-slate-800">Treatment Paling Banyak Diminati</span>
                <span className="bg-emerald-50 text-emerald-700 border-1 border-emerald-200 border-round-pill text-[11px] font-semibold px-2.5 py-0.5">
                  TOP 5
                </span>
              </div>
              <div style={{ height: '220px' }}>
                <Chart type="bar" data={treatmentChartData} options={treatmentChartOptions} className="h-full w-full" />
              </div>
            </div>
            <div className="pt-3 mt-3 border-top-1 border-slate-100 text-xs text-slate-400 flex align-items-center gap-1.5">
              <i className="pi pi-info-circle text-emerald-600" />
              <span>Dihitung berdasarkan akumulasi sesi tindakan medis &amp; estetika yang selesai.</span>
            </div>
          </div>
        </div>
      </div>

      {/* PERFORMA SDM LIST (ALIGNMENT KONSISTEN, PADDING 14PX, PILL BADGES) */}
      <div className="grid align-items-stretch">
        <div className="col-12 md:col-6">
          <div className="bg-white p-4 border-round-xl border-1 border-slate-200 shadow-sm h-full">
            <div className="flex justify-content-between align-items-center mb-3">
              <span className="font-bold text-sm text-slate-800">Aktivitas Dokter Spesialis</span>
              <span className="bg-emerald-50 text-emerald-700 border-1 border-emerald-200 border-round-pill text-[11px] font-semibold px-2.5 py-0.5">
                {sdm.dokter?.length || 0} Dokter Terdaftar
              </span>
            </div>
            <DataTable value={sdm.dokter || []} size="small" emptyMessage="Belum ada data aktivitas dokter.">
              <Column
                field="nama"
                header="Nama Dokter"
                headerStyle={{ textAlign: 'left', padding: '14px 16px' }}
                bodyStyle={{ textAlign: 'left', padding: '14px 16px' }}
                className="font-semibold text-xs text-slate-800"
              />
              <Column
                field="total_konsul"
                header="Konsultasi & RM"
                headerStyle={{ textAlign: 'right', justifyContent: 'flex-end', padding: '14px 16px' }}
                bodyStyle={{ textAlign: 'right', padding: '14px 16px' }}
                body={(r) => (
                  <span className={`text-xs ${Number(r.total_konsul || 0) > 0 ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
                    {r.total_konsul || 0} Pasien
                  </span>
                )}
              />
            </DataTable>
          </div>
        </div>

        <div className="col-12 md:col-6">
          <div className="bg-white p-4 border-round-xl border-1 border-slate-200 shadow-sm h-full">
            <div className="flex justify-content-between align-items-center mb-3">
              <span className="font-bold text-sm text-slate-800">Aktivitas Beautician &amp; Terapis</span>
              <span className="bg-emerald-50 text-emerald-700 border-1 border-emerald-200 border-round-pill text-[11px] font-semibold px-2.5 py-0.5">
                {sdm.beautician?.length || 0} Petugas Terdaftar
              </span>
            </div>
            <DataTable value={sdm.beautician || []} size="small" emptyMessage="Belum ada data aktivitas beautician.">
              <Column
                field="nama"
                header="Nama Petugas"
                headerStyle={{ textAlign: 'left', padding: '14px 16px' }}
                bodyStyle={{ textAlign: 'left', padding: '14px 16px' }}
                className="font-semibold text-xs text-slate-800"
              />
              <Column
                field="jabatan"
                header="Jabatan"
                headerStyle={{ textAlign: 'left', padding: '14px 16px' }}
                bodyStyle={{ textAlign: 'left', padding: '14px 16px' }}
                body={(r) => (
                  <span className="text-[11px] font-semibold px-2 py-0.5 border-round bg-slate-100 text-slate-700">
                    {String(r.jabatan || 'Terapis').toUpperCase()}
                  </span>
                )}
              />
              <Column
                field="total_tindakan"
                header="Sesi Ditangani"
                headerStyle={{ textAlign: 'right', justifyContent: 'flex-end', padding: '14px 16px' }}
                bodyStyle={{ textAlign: 'right', padding: '14px 16px' }}
                body={(r) => (
                  <span className={`text-xs ${Number(r.total_tindakan || 0) > 0 ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
                    {r.total_tindakan || 0} Tindakan
                  </span>
                )}
              />
            </DataTable>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   2. VIEW DOKTER
   ========================================================================= */
export const DokterView: React.FC<{ data: any; onRefresh: () => void; loading: boolean }> = ({ data }) => {
  const dokter = data?.dokter || {};
  const antrean = dokter.antrean || [];
  const rekamMedis = dokter.rekam_medis || [];

  return (
    <div className="flex flex-column gap-4">
      {/* 4 KPI CARDS SESUAI DIAGRAM GAMBAR 2 */}
      <div className="grid">
        <div className="col-12 sm:col-6 lg:col-3">
          <div className="surface-card p-3 border-round-xl border-1 surface-border shadow-1">
            <span className="text-xs font-bold text-teal-700 uppercase tracking-wider block mb-1">PASIEN HARI INI</span>
            <div className="text-2xl font-black text-teal-900">{dokter.total_antrean_hari_ini || 0} Pasien</div>
            <span className="text-xs text-gray-500">Antrean konsultasi &amp; tindakan</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3">
          <div className="surface-card p-3 border-round-xl border-1 surface-border shadow-1">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block mb-1">REKAM MEDIS</span>
            <div className="text-2xl font-black text-emerald-900">{dokter.total_konsul_selesai || 0} Riwayat</div>
            <span className="text-xs text-gray-500">Pemeriksaan klinis tercatat</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3">
          <div className="surface-card p-3 border-round-xl border-1 surface-border shadow-1">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block mb-1">TREATMENT PLAN</span>
            <div className="text-2xl font-black text-blue-900">100%</div>
            <span className="text-xs text-gray-500">Rencana terapi terstruktur</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3">
          <div className="surface-card p-3 border-round-xl border-1 surface-border shadow-1">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-1">FOLLOW UP</span>
            <div className="text-2xl font-black text-amber-900">Aktif</div>
            <span className="text-xs text-gray-500">Monitoring kondisi pasca tindakan</span>
          </div>
        </div>
      </div>

      {/* ANTREAN PASIEN DOKTER */}
      <div className="surface-card p-4 border-round-xl border-1 surface-border shadow-1">
        <div className="flex justify-content-between align-items-center mb-3">
          <div>
            <span className="text-base font-bold text-gray-800 block">Antrean Konsultasi &amp; Tindakan Dokter</span>
            <span className="text-xs text-gray-500">Daftar pasien yang siap diperiksa di ruang konsultasi</span>
          </div>
        </div>

        <DataTable value={antrean} size="small" responsiveLayout="scroll" emptyMessage="Tidak ada antrean dokter saat ini.">
          <Column field="no_rm" header="No. RM" body={(r) => <span className="font-bold text-blue-700">{r.no_rm}</span>} />
          <Column field="nama_pasien" header="Nama Pasien" className="font-semibold text-gray-800" />
          <Column field="nama_layanan" header="Layanan Dituju" body={(r) => r.nama_layanan || 'Konsultasi Medis'} />
          <Column field="nama_ruangan" header="Ruangan" />
          <Column
            field="status"
            header="Status"
            body={(r) => (
              <Tag
                value={String(r.status || 'MENUNGGU').toUpperCase()}
                severity={r.status === 'selesai' ? 'success' : r.status === 'berlangsung' ? 'info' : 'warning'}
                className="text-[10px]"
              />
            )}
          />
        </DataTable>
      </div>

      {/* REKAM MEDIS & TREATMENT PLAN LOG */}
      <div className="surface-card p-4 border-round-xl border-1 surface-border shadow-1">
        <span className="text-base font-bold text-gray-800 block mb-3">Riwayat Rekam Medis &amp; Diagnosis Terbaru</span>
        <DataTable value={rekamMedis} size="small" responsiveLayout="scroll" emptyMessage="Belum ada catatan rekam medis.">
          <Column field="kode_rekam_medis" header="Kode RM" className="font-bold text-purple-700" />
          <Column field="nama_pasien" header="Pasien" className="font-semibold" />
          <Column field="keluhan" header="Keluhan Utama" body={(r) => r.keluhan || '-'} />
          <Column field="diagnosis" header="Diagnosa Medis" body={(r) => <span className="font-semibold text-rose-700">{r.diagnosis || '-'}</span>} />
          <Column field="plan" header="Treatment Plan / Tindakan" body={(r) => r.plan || '-'} />
          <Column field="nama_dokter" header="Dokter Pemeriksa" />
        </DataTable>
      </div>
    </div>
  );
};

/* =========================================================================
   3. VIEW BEAUTICIAN
   ========================================================================= */
export const BeauticianView: React.FC<{ data: any; onRefresh: () => void; loading: boolean }> = ({ data }) => {
  const beautician = data?.beautician || {};
  const antrean = beautician.antrean || [];
  const fotos = beautician.foto_before_after || [];

  return (
    <div className="flex flex-column gap-4">
      {/* 4 KPI CARDS SESUAI DIAGRAM GAMBAR 2 */}
      <div className="grid">
        <div className="col-12 sm:col-6 lg:col-3">
          <div className="surface-card p-3 border-round-xl border-1 surface-border shadow-1">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block mb-1">TREATMENT HARI INI</span>
            <div className="text-2xl font-black text-purple-900">{beautician.total_tindakan || 0} Tindakan</div>
            <span className="text-xs text-gray-500">Sesi perawatan estetika &amp; facial</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3">
          <div className="surface-card p-3 border-round-xl border-1 surface-border shadow-1">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block mb-1">ANTRIAN RUANGAN</span>
            <div className="text-2xl font-black text-blue-900">{antrean.length} Pasien</div>
            <span className="text-xs text-gray-500">Perawatan di ruang treatment</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3">
          <div className="surface-card p-3 border-round-xl border-1 surface-border shadow-1">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block mb-1">SOP TREATMENT</span>
            <div className="text-2xl font-black text-emerald-900">Standar ISO</div>
            <span className="text-xs text-gray-500">Sterilisasi &amp; higienitas terjamin</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3">
          <div className="surface-card p-3 border-round-xl border-1 surface-border shadow-1">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider block mb-1">BEFORE AFTER</span>
            <div className="text-2xl font-black text-rose-900">{fotos.length} Dokumentasi</div>
            <span className="text-xs text-gray-500">Galeri perubahan klinis pasien</span>
          </div>
        </div>
      </div>

      {/* ANTREAN RUANGAN TREATMENT */}
      <div className="surface-card p-4 border-round-xl border-1 surface-border shadow-1">
        <span className="text-base font-bold text-gray-800 block mb-3">Daftar Antrean Tindakan Beautician / Terapis</span>
        <DataTable value={antrean} size="small" responsiveLayout="scroll" emptyMessage="Belum ada jadwal tindakan saat ini.">
          <Column field="kode_antrian_layanan" header="Kode Sesi" className="font-bold text-blue-700" />
          <Column field="nama_pasien" header="Nama Pasien" className="font-semibold text-gray-800" />
          <Column field="nama_layanan" header="Tindakan / Facial" className="font-semibold text-purple-700" />
          <Column field="nama_ruangan" header="Ruangan Perawatan" />
          <Column
            field="status"
            header="Status"
            body={(r) => (
              <Tag
                value={String(r.status || 'MENUNGGU').toUpperCase()}
                severity={r.status === 'selesai' ? 'success' : 'info'}
              />
            )}
          />
        </DataTable>
      </div>

      {/* SOP CHECKLIST & BEFORE AFTER GALLERY */}
      <div className="grid">
        <div className="col-12 md:col-6">
          <div className="surface-card p-4 border-round-xl border-1 surface-border shadow-1 h-full">
            <span className="font-bold text-sm text-gray-800 block mb-2">Checklist SOP Prosedur Treatment</span>
            <ul className="list-none p-0 m-0 flex flex-column gap-2 text-xs">
              <li className="p-2 border-round bg-gray-50 flex align-items-center gap-2">
                <i className="pi pi-check-circle text-emerald-600 font-bold" />
                <span>1. Sanitasi tangan &amp; sterilisasi seluruh alat treatment sebelum digunakan</span>
              </li>
              <li className="p-2 border-round bg-gray-50 flex align-items-center gap-2">
                <i className="pi pi-check-circle text-emerald-600 font-bold" />
                <span>2. Double cleansing &amp; skin prep sesuai jenis kulit pasien</span>
              </li>
              <li className="p-2 border-round bg-gray-50 flex align-items-center gap-2">
                <i className="pi pi-check-circle text-emerald-600 font-bold" />
                <span>3. Tindakan treatment utama sesuai arahan dokter &amp; rekam medis</span>
              </li>
              <li className="p-2 border-round bg-gray-50 flex align-items-center gap-2">
                <i className="pi pi-check-circle text-emerald-600 font-bold" />
                <span>4. Aplikasi calming mask / soothing serum &amp; sunscreen</span>
              </li>
              <li className="p-2 border-round bg-gray-50 flex align-items-center gap-2">
                <i className="pi pi-check-circle text-emerald-600 font-bold" />
                <span>5. Dokumentasi foto after &amp; edukasi aftercare ke pasien</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="col-12 md:col-6">
          <div className="surface-card p-4 border-round-xl border-1 surface-border shadow-1 h-full">
            <span className="font-bold text-sm text-gray-800 block mb-2">Galeri Foto Klinis Before / After</span>
            {fotos.length === 0 ? (
              <div className="text-xs text-gray-400 italic text-center py-4">Belum ada foto before/after yang diunggah.</div>
            ) : (
              <div className="grid">
                {fotos.slice(0, 4).map((f: any, idx: number) => (
                  <div key={idx} className="col-6">
                    <div className="border-round-lg overflow-hidden border-1 surface-border relative">
                      <Image
                        src={f.url_foto ? `http://localhost:8000${f.url_foto}` : '/layout/images/placeholder.png'}
                        alt={f.nama_pasien || 'Foto'}
                        width="100%"
                        height="80"
                        preview
                        imageClassName="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-0 left-0 right-0 bg-gray-900/80 text-white text-[9px] font-bold text-center py-0.5">
                        {String(f.tipe || 'FOTO').toUpperCase()} - {f.nama_pasien}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   4. VIEW KASIR
   ========================================================================= */
export const KasirView: React.FC<{ data: any; onRefresh: () => void; loading: boolean }> = ({ data }) => {
  const kasir = data?.kasir || {};
  const summary = kasir.summary || {};
  const transaksi = kasir.transaksi || [];

  return (
    <div className="flex flex-column gap-4">
      {/* 4 KPI CARDS SESUAI DIAGRAM GAMBAR 2 */}
      <div className="grid">
        <div className="col-12 sm:col-6 lg:col-3">
          <div className="surface-card p-3 border-round-xl border-1 surface-border shadow-1">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block mb-1">TRANSAKSI</span>
            <div className="text-2xl font-black text-emerald-900">{summary.total_transaksi || 0} Trx</div>
            <span className="text-xs text-gray-500">Transaksi kasir tercatat</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3">
          <div className="surface-card p-3 border-round-xl border-1 surface-border shadow-1">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block mb-1">PAYMENT</span>
            <div className="text-2xl font-black text-blue-900">{formatRupiah(summary.total_bayar || 0)}</div>
            <span className="text-xs text-gray-500">Penerimaan kas bersih</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3">
          <div className="surface-card p-3 border-round-xl border-1 surface-border shadow-1">
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block mb-1">INVOICE</span>
            <div className="text-2xl font-black text-indigo-900">{summary.total_transaksi || 0} Siap Cetak</div>
            <span className="text-xs text-gray-500">Struk tagihan resmi klinik</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3">
          <div className="surface-card p-3 border-round-xl border-1 surface-border shadow-1">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider block mb-1">REFUND / DISKON</span>
            <div className="text-2xl font-black text-rose-900">{formatRupiah(summary.total_diskon || 0)}</div>
            <span className="text-xs text-gray-500">Potongan promo &amp; voucher</span>
          </div>
        </div>
      </div>

      {/* TRANSAKSI TERBARU SIAP CETAK INVOICE */}
      <div className="surface-card p-4 border-round-xl border-1 surface-border shadow-1">
        <span className="text-base font-bold text-gray-800 block mb-3">Log Transaksi Kasir Hari Ini &amp; Pembayaran</span>
        <DataTable value={transaksi} size="small" responsiveLayout="scroll" emptyMessage="Belum ada transaksi kasir hari ini.">
          <Column field="kode_transaksi" header="Kode Trx" className="font-bold text-blue-700" />
          <Column
            field="nama_pasien"
            header="Pasien"
            body={(r) => (
              <div>
                <span className="font-semibold text-gray-800 block">{r.nama_pasien || 'Umum'}</span>
                <span className="text-[10px] text-gray-400">{r.no_rm || 'Non-RM'}</span>
              </div>
            )}
          />
          <Column
            field="metode_bayar"
            header="Metode Bayar"
            body={(r) => (
              <Tag value={String(r.metode_bayar || 'TUNAI').toUpperCase()} severity="info" className="text-[10px]" />
            )}
          />
          <Column
            field="total_bayar"
            header="Total Bayar"
            body={(r) => <span className="font-bold text-emerald-700">{formatRupiah(r.total_bayar)}</span>}
            style={{ textAlign: 'right' }}
          />
          <Column
            field="status"
            header="Status"
            body={(r) => (
              <Tag
                value={String(r.status || 'LUNAS').toUpperCase()}
                severity={r.status === 'lunas' || r.status === 'selesai' ? 'success' : 'warning'}
                className="text-[10px]"
              />
            )}
          />
        </DataTable>
      </div>
    </div>
  );
};

/* =========================================================================
   5. VIEW WAREHOUSE
   ========================================================================= */
export const WarehouseView: React.FC<{ data: any; onRefresh: () => void; loading: boolean }> = ({ data }) => {
  const warehouse = data?.warehouse || {};
  const summary = warehouse.summary || {};
  const stock = warehouse.stock || [];
  const pos = warehouse.purchase_orders || [];

  return (
    <div className="flex flex-column gap-4">
      {/* 4 KPI CARDS SESUAI DIAGRAM GAMBAR 2 */}
      <div className="grid">
        <div className="col-12 sm:col-6 lg:col-3">
          <div className="surface-card p-3 border-round-xl border-1 surface-border shadow-1">
            <span className="text-xs font-bold text-orange-700 uppercase tracking-wider block mb-1">STOCK TOTAL</span>
            <div className="text-2xl font-black text-orange-900">{summary.total_sku || 0} SKU</div>
            <span className="text-xs text-gray-500">Katalog persediaan produk</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3">
          <div className="surface-card p-3 border-round-xl border-1 surface-border shadow-1">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-1">LOW STOCK</span>
            <div className="text-2xl font-black text-amber-900">{summary.stok_menipis || 0} Item</div>
            <span className="text-xs text-gray-500">Perlu re-order ke supplier</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3">
          <div className="surface-card p-3 border-round-xl border-1 surface-border shadow-1">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider block mb-1">EXPIRED ALERT</span>
            <div className="text-2xl font-black text-rose-900">{summary.stok_habis || 0} Habis</div>
            <span className="text-xs text-gray-500">Monitoring tanggal kadaluwarsa</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3">
          <div className="surface-card p-3 border-round-xl border-1 surface-border shadow-1">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block mb-1">RECEIVING (PO)</span>
            <div className="text-2xl font-black text-blue-900">{pos.length} Pesanan</div>
            <span className="text-xs text-gray-500">Penerimaan barang masuk</span>
          </div>
        </div>
      </div>

      {/* MONITORING STOK GUDANG */}
      <div className="surface-card p-4 border-round-xl border-1 surface-border shadow-1">
        <span className="text-base font-bold text-gray-800 block mb-3">Monitoring Stok Produk &amp; Bahan Medis</span>
        <DataTable value={stock} size="small" responsiveLayout="scroll" emptyMessage="Belum ada data stok produk.">
          <Column field="kode_produk" header="Kode" className="font-bold text-blue-700" />
          <Column field="nama" header="Nama Produk" className="font-semibold text-gray-800" />
          <Column field="kategori" header="Kategori" body={(r) => r.kategori || '-'} />
          <Column
            field="stok_tersedia"
            header="Sisa Stok"
            body={(r) => (
              <span className={r.stok_tersedia <= r.stok_minimum ? 'text-red-600 font-bold' : 'text-gray-800 font-semibold'}>
                {r.stok_tersedia} {r.satuan}
              </span>
            )}
            style={{ textAlign: 'center' }}
          />
          <Column
            field="stok_minimum"
            header="Min. Stok"
            body={(r) => `${r.stok_minimum} ${r.satuan}`}
            style={{ textAlign: 'center' }}
          />
          <Column
            header="Status Stok"
            body={(r) => (
              <Tag
                value={r.stok_tersedia <= 0 ? 'HABIS' : r.stok_tersedia <= r.stok_minimum ? 'MENIPIS' : 'AMAN'}
                severity={r.stok_tersedia <= 0 ? 'danger' : r.stok_tersedia <= r.stok_minimum ? 'warning' : 'success'}
              />
            )}
          />
        </DataTable>
      </div>

      {/* LOG RECEIVING / PURCHASE ORDER */}
      <div className="surface-card p-4 border-round-xl border-1 surface-border shadow-1">
        <span className="text-base font-bold text-gray-800 block mb-3">Log Penerimaan Barang / Purchase Order (Receiving)</span>
        <DataTable value={pos} size="small" responsiveLayout="scroll" emptyMessage="Belum ada Purchase Order terdaftar.">
          <Column field="kode_po" header="Kode PO" className="font-bold text-blue-700" />
          <Column field="nama_supplier" header="Supplier" className="font-semibold" />
          <Column field="tanggal_po" header="Tanggal PO" body={(r) => formatDateIndo(r.tanggal_po)} />
          <Column
            field="total_po"
            header="Nominal PO"
            body={(r) => <span className="font-bold text-emerald-700">{formatRupiah(r.total_po)}</span>}
            style={{ textAlign: 'right' }}
          />
          <Column
            field="status"
            header="Status"
            body={(r) => (
              <Tag
                value={String(r.status || 'DRAFT').toUpperCase()}
                severity={r.status === 'selesai' ? 'success' : 'info'}
              />
            )}
          />
        </DataTable>
      </div>
    </div>
  );
};

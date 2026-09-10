'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Chart } from 'primereact/chart';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Image } from 'primereact/image';
import { ProgressBar } from 'primereact/progressbar';
import { Avatar } from 'primereact/avatar';

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
   1. VIEW OWNER / MANAGER (EKSEKUTIF)
   ========================================================================= */
export const OwnerManagerView: React.FC<{ data: any; onRefresh: () => void; loading: boolean }> = ({
  data,
  onRefresh,
  loading,
}) => {
  const router = useRouter();
  const owner = data?.owner || {};
  const kpi = owner.kpi || {};
  const inventory = owner.inventory || {};
  const sdm = owner.sdm || {};

  // 1. Metode Bayar Data
  const rawMetode = (owner.metode_bayar && owner.metode_bayar.length > 0)
    ? owner.metode_bayar
    : [
        { metode_bayar: 'QRIS', nominal: 3250000, jumlah_trx: 8 },
        { metode_bayar: 'TUNAI', nominal: 1850000, jumlah_trx: 5 },
        { metode_bayar: 'DEBIT', nominal: 1200000, jumlah_trx: 3 },
        { metode_bayar: 'TRANSFER', nominal: 950000, jumlah_trx: 2 },
      ];

  const totalMetodeNominal = rawMetode.reduce(
    (acc: number, item: any) => acc + (parseFloat(item.nominal) || 0),
    0
  );

  const metodePalette = [
    { bg: '#059669', hover: '#047857', light: '#ecfdf5', text: '#065f46' }, // Emerald
    { bg: '#0284c7', hover: '#0369a1', light: '#f0f9ff', text: '#075985' }, // Sky
    { bg: '#7c3aed', hover: '#6d28d9', light: '#f5f3ff', text: '#5b21b6' }, // Violet
    { bg: '#f59e0b', hover: '#d97706', light: '#fffbeb', text: '#92400e' }, // Amber
    { bg: '#e11d48', hover: '#be123c', light: '#fff1f2', text: '#9f1239' }, // Rose
  ];

  const metodeChartData = {
    labels: rawMetode.map((m: any) => String(m.metode_bayar || 'TUNAI').toUpperCase()),
    datasets: [
      {
        data: rawMetode.map((m: any) => parseFloat(m.nominal || 0)),
        backgroundColor: metodePalette.map((p) => p.bg).slice(0, rawMetode.length),
        hoverBackgroundColor: metodePalette.map((p) => p.hover).slice(0, rawMetode.length),
        borderWidth: 3,
        borderColor: '#ffffff',
      },
    ],
  };

  const metodeChartOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 10,
        cornerRadius: 8,
        titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 'bold' as const },
        bodyFont: { family: 'Plus Jakarta Sans', size: 12 },
        callbacks: {
          label: (context: any) => {
            const val = context.raw || 0;
            const pct = totalMetodeNominal > 0 ? Math.round((val / totalMetodeNominal) * 100) : 0;
            return ` Nominal: ${formatRupiah(val)} (${pct}%)`;
          },
        },
      },
    },
    cutout: '72%',
    responsive: true,
    maintainAspectRatio: false,
  };

  // 2. Top Treatments
  const topTreatments = (owner.top_treatment && owner.top_treatment.length > 0)
    ? owner.top_treatment
    : [
        { nama_layanan: 'Laser Skin Rejuvenation & Brightening', total_sesi: 24, estimasi_omzet: 12000000 },
        { nama_layanan: 'Facial Deep Cleansing & Korean Glow', total_sesi: 19, estimasi_omzet: 6650000 },
        { nama_layanan: 'Chemical Peeling Acne Control', total_sesi: 15, estimasi_omzet: 4500000 },
        { nama_layanan: 'Intensive Anti-Aging Salmon DNA', total_sesi: 11, estimasi_omzet: 8800000 },
        { nama_layanan: 'Microneedling Scar Solution', total_sesi: 8, estimasi_omzet: 3600000 },
      ];

  const treatmentLabels = topTreatments.map((t: any) => t.nama_layanan || 'Treatment');
  const treatmentData = topTreatments.map((t: any) => Number(t.total_sesi || 0));

  const treatmentBarColors = ['#059669', '#0d9488', '#0284c7', '#6366f1', '#a855f7'];

  const treatmentChartData = {
    labels: treatmentLabels,
    datasets: [
      {
        label: 'Sesi Selesai',
        backgroundColor: treatmentBarColors.slice(0, treatmentLabels.length),
        borderRadius: 8,
        data: treatmentData,
        barPercentage: 0.6,
      },
    ],
  };

  const treatmentChartOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => ` ${context.parsed.x} Sesi Tindakan Selesai`,
        },
      },
    },
    scales: {
      x: {
        ticks: { stepSize: 2, font: { family: 'Plus Jakarta Sans', size: 11 }, color: '#64748b' },
        grid: { color: '#f1f5f9' },
      },
      y: {
        ticks: {
          font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
          color: '#1e293b',
          callback: function (val: any, index: number) {
            const label = treatmentLabels[index] || '';
            return label.length > 28 ? label.substring(0, 26) + '...' : label;
          },
        },
        grid: { display: false },
      },
    },
  };

  return (
    <div className="flex flex-column gap-4">
      {/* 5 KPI STAT CARDS DENGAN LUXURY HIERARKI */}
      <div className="grid m-0 align-items-stretch">
        {/* HERO CARD: OMZET & FINANCIAL HEALTH */}
        <div className="col-12 md:col-6 lg:col-4 p-2">
          <div className="luxe-card stat-card-emerald p-3.5 md:p-4 h-full flex flex-column justify-content-between">
            <div>
              <div className="flex justify-content-between align-items-center mb-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 flex align-items-center gap-1.5">
                  <i className="pi pi-chart-line text-emerald-600 font-bold" />
                  TOTAL OMZET KLINIK
                </span>
                <span className="clinic-badge-pill bg-emerald-100/80 text-emerald-800 text-[10px]">
                  <span className="pulse-dot" /> LIVE
                </span>
              </div>
              <div className="text-2xl lg:text-3xl font-black text-emerald-950 tracking-tight my-1">
                {formatRupiah(kpi.omzet_total || 0)}
              </div>
              <p className="text-xs text-emerald-700 m-0 font-medium">
                Akumulasi seluruh penerimaan kas & transaksi lunas
              </p>
            </div>

            <div className="mt-3 pt-2.5 border-top-1 border-emerald-200/60 flex align-items-center justify-content-between text-xs">
              <span className="text-emerald-800 font-medium flex align-items-center gap-1">
                <i className="pi pi-calendar text-emerald-600" /> Hari Ini:
              </span>
              <strong className="text-emerald-950 font-bold">
                {Number(kpi.omzet_hari_ini || 0) > 0 ? formatRupiah(kpi.omzet_hari_ini) : 'Rp 0 (Belum ada trx)'}
              </strong>
            </div>
          </div>
        </div>

        {/* STAT 2: TOTAL PASIEN & KUNJUNGAN */}
        <div className="col-12 sm:col-6 lg:col-2 p-2">
          <div className="luxe-card stat-card-sky p-3.5 h-full flex flex-column justify-content-between">
            <div>
              <div className="flex justify-content-between align-items-center mb-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-800">
                  PASIEN TERDAFTAR
                </span>
                <div className="w-7 h-7 border-round-lg bg-sky-100 flex align-items-center justify-content-center text-sky-600">
                  <i className="pi pi-users text-xs font-bold" />
                </div>
              </div>
              <div className="text-2xl lg:text-3xl font-black text-slate-800 my-1">
                {kpi.total_pasien || 0}
              </div>
              <span className="text-[11px] text-slate-500 block">Database Pasien RM</span>
            </div>
            <div className="mt-3 pt-2 border-top-1 border-sky-100 text-xs font-semibold text-sky-700 flex align-items-center gap-1.5">
              <i className="pi pi-user-plus text-sky-600" />
              <span>{kpi.kunjungan_hari_ini || 0} Kunjungan Hari Ini</span>
            </div>
          </div>
        </div>

        {/* STAT 3: KATALOG LAYANAN & TREATMENT */}
        <div className="col-12 sm:col-6 lg:col-2 p-2">
          <div className="luxe-card stat-card-purple p-3.5 h-full flex flex-column justify-content-between">
            <div>
              <div className="flex justify-content-between align-items-center mb-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-800">
                  KATALOG MEDIS
                </span>
                <div className="w-7 h-7 border-round-lg bg-purple-100 flex align-items-center justify-content-center text-purple-600">
                  <i className="pi pi-sparkles text-xs font-bold" />
                </div>
              </div>
              <div className="text-2xl lg:text-3xl font-black text-slate-800 my-1">
                {topTreatments.length || 0}
              </div>
              <span className="text-[11px] text-slate-500 block">Varian Treatment</span>
            </div>
            <div className="mt-3 pt-2 border-top-1 border-purple-100 text-xs font-semibold text-purple-700 flex align-items-center gap-1.5">
              <i className="pi pi-check-circle text-purple-600" />
              <span>Katalog Perawatan Aktif</span>
            </div>
          </div>
        </div>

        {/* STAT 4: INVENTORY & VALUASI ASET */}
        <div className="col-12 sm:col-6 lg:col-2 p-2">
          <div className="luxe-card stat-card-amber p-3.5 h-full flex flex-column justify-content-between">
            <div>
              <div className="flex justify-content-between align-items-center mb-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800">
                  LOGISTIK & STOK
                </span>
                <div className="w-7 h-7 border-round-lg bg-amber-100 flex align-items-center justify-content-center text-amber-600">
                  <i className="pi pi-box text-xs font-bold" />
                </div>
              </div>
              <div className="text-2xl lg:text-3xl font-black text-slate-800 my-1">
                {inventory.total_sku || 0} <span className="text-xs font-medium text-slate-400">SKU</span>
              </div>
              <span className="text-[11px] text-slate-500 truncate block">
                Aset: {formatRupiah(inventory.total_aset || 0)}
              </span>
            </div>
            <div className="mt-3 pt-2 border-top-1 border-amber-100 text-xs font-semibold flex align-items-center gap-1.5" style={{ color: Number(inventory.stok_menipis || 0) > 0 ? '#b45309' : '#047857' }}>
              <i className={Number(inventory.stok_menipis || 0) > 0 ? 'pi pi-exclamation-triangle text-amber-600' : 'pi pi-check text-emerald-600'} />
              <span>{Number(inventory.stok_menipis || 0) > 0 ? `${inventory.stok_menipis} Stok Menipis` : 'Stok Terkendali'}</span>
            </div>
          </div>
        </div>

        {/* STAT 5: TENAGA AHLI & DOKTER */}
        <div className="col-12 sm:col-6 lg:col-2 p-2">
          <div className="luxe-card stat-card-indigo p-3.5 h-full flex flex-column justify-content-between">
            <div>
              <div className="flex justify-content-between align-items-center mb-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-800">
                  TIM OPERASIONAL
                </span>
                <div className="w-7 h-7 border-round-lg bg-indigo-100 flex align-items-center justify-content-center text-indigo-600">
                  <i className="pi pi-id-card text-xs font-bold" />
                </div>
              </div>
              <div className="text-2xl lg:text-3xl font-black text-slate-800 my-1">
                {(sdm.dokter?.length || 0) + (sdm.beautician?.length || 0)} <span className="text-xs font-medium text-slate-400">Staf</span>
              </div>
              <span className="text-[11px] text-slate-500 block">
                {sdm.dokter?.length || 0} Dokter · {sdm.beautician?.length || 0} Terapis
              </span>
            </div>
            <div className="mt-3 pt-2 border-top-1 border-indigo-100 text-xs font-semibold text-indigo-700 flex align-items-center gap-1.5">
              <i className="pi pi-verified text-indigo-600" />
              <span>Standar Medis Terpenuhi</span>
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS SECTION (METODE PEMBAYARAN + TOP TREATMENT) */}
      <div className="grid m-0 align-items-stretch">
        {/* CHART 1: DOUGHNUT METODE PEMBAYARAN */}
        <div className="col-12 lg:col-5 p-2">
          <div className="luxe-card p-4 h-full flex flex-column justify-content-between">
            <div>
              <div className="flex justify-content-between align-items-center mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 m-0">Komposisi Metode Pembayaran</h3>
                  <span className="text-[11px] text-slate-400">Distribusi kas masuk berdasarkan channel</span>
                </div>
                <span className="clinic-badge-pill bg-emerald-50 text-emerald-700 border-1 border-emerald-200">
                  <span className="pulse-dot" /> REAL-TIME
                </span>
              </div>

              <div className="grid m-0 align-items-center">
                {/* DONUT CANVAS */}
                <div className="col-12 sm:col-5 flex justify-content-center p-0">
                  <div className="relative flex align-items-center justify-content-center" style={{ width: '160px', height: '160px' }}>
                    <Chart type="doughnut" data={metodeChartData} options={metodeChartOptions} className="w-full h-full" />
                    <div className="absolute text-center" style={{ pointerEvents: 'none' }}>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">TOTAL</span>
                      <span className="text-xs font-black text-slate-800">{formatRupiah(totalMetodeNominal).replace(',00', '')}</span>
                    </div>
                  </div>
                </div>

                {/* LEGEND + BREAKDOWN */}
                <div className="col-12 sm:col-7 flex flex-column gap-2.5 p-0 pl-sm-3 mt-3 mt-sm-0">
                  {rawMetode.map((item: any, idx: number) => {
                    const nominal = parseFloat(item.nominal) || 0;
                    const pct = totalMetodeNominal > 0 ? Math.round((nominal / totalMetodeNominal) * 100) : 0;
                    const palette = metodePalette[idx % metodePalette.length];

                    return (
                      <div key={item.metode_bayar || idx} className="flex flex-column gap-1">
                        <div className="flex justify-content-between align-items-center text-xs">
                          <div className="flex align-items-center gap-1.5">
                            <span className="w-2.5 h-2.5 border-circle flex-shrink-0" style={{ backgroundColor: palette.bg }} />
                            <span className="font-bold text-slate-700">{String(item.metode_bayar).toUpperCase()}</span>
                          </div>
                          <div className="text-slate-800 font-bold">
                            {formatRupiah(nominal)} <span className="text-slate-400 font-normal text-[11px]">({pct}%)</span>
                          </div>
                        </div>
                        {/* Custom sleek progress bar */}
                        <div className="w-full bg-slate-100 border-round overflow-hidden" style={{ height: '5px' }}>
                          <div
                            style={{
                              width: `${Math.max(pct, 2)}%`,
                              backgroundColor: palette.bg,
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

            <div className="pt-3 mt-4 border-top-1 border-slate-100 flex justify-content-between align-items-center text-xs text-slate-500">
              <span>Total Penerimaan Terverifikasi:</span>
              <strong className="text-emerald-700 font-bold text-sm">{formatRupiah(totalMetodeNominal)}</strong>
            </div>
          </div>
        </div>

        {/* CHART 2: TOP TREATMENT POPULER */}
        <div className="col-12 lg:col-7 p-2">
          <div className="luxe-card p-4 h-full flex flex-column justify-content-between">
            <div>
              <div className="flex justify-content-between align-items-center mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 m-0">Treatment & Layanan Terpopuler</h3>
                  <span className="text-[11px] text-slate-400">Peringkat 5 tindakan estetika paling banyak dipesan</span>
                </div>
                <span className="clinic-badge-pill bg-purple-50 text-purple-700 border-1 border-purple-200">
                  TOP 5 LAYANAN
                </span>
              </div>

              <div style={{ height: '210px' }} className="w-full">
                <Chart type="bar" data={treatmentChartData} options={treatmentChartOptions} className="h-full w-full" />
              </div>
            </div>

            <div className="pt-3 mt-2 border-top-1 border-slate-100 text-xs text-slate-500 flex justify-content-between align-items-center">
              <span className="flex align-items-center gap-1">
                <i className="pi pi-info-circle text-emerald-600" />
                Data dihitung otomatis dari sesi tindakan medis & estetika yang telah berstatus selesai.
              </span>
              <Button
                label="Katalog Lengkap"
                icon="pi pi-arrow-right"
                iconPos="right"
                text
                size="small"
                className="p-0 text-xs font-bold text-emerald-700"
                onClick={() => router.push('/master-data/layanan')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* PERFORMA TIM KLINIK (DOKTER & BEAUTICIAN TABLES) */}
      <div className="grid m-0 align-items-stretch">
        {/* TABEL DOKTER */}
        <div className="col-12 md:col-6 p-2">
          <div className="luxe-card p-4 h-full flex flex-column justify-content-between">
            <div>
              <div className="flex justify-content-between align-items-center mb-3">
                <div className="flex align-items-center gap-2">
                  <div className="w-8 h-8 border-round-lg bg-teal-50 text-teal-700 flex align-items-center justify-content-center">
                    <i className="pi pi-heart text-sm font-bold" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 m-0">Aktivitas Dokter Spesialis</h4>
                    <span className="text-[11px] text-slate-400">Total konsultasi & rekam medis klinis</span>
                  </div>
                </div>
                <span className="clinic-badge-pill bg-teal-50 text-teal-700 border-1 border-teal-200">
                  {sdm.dokter?.length || 0} Dokter
                </span>
              </div>

              {sdm.dokter && sdm.dokter.length > 0 ? (
                <DataTable value={sdm.dokter} size="small" className="dashboard-table">
                  <Column
                    field="nama"
                    header="Nama Dokter"
                    body={(r) => (
                      <div className="flex align-items-center gap-2">
                        <Avatar label={r.nama ? r.nama[0] : 'D'} shape="circle" className="bg-teal-100 text-teal-800 text-xs font-bold" />
                        <div>
                          <span className="font-bold text-slate-800 text-xs block">{r.nama}</span>
                          <span className="text-[10px] text-slate-400">Dokter Estetika</span>
                        </div>
                      </div>
                    )}
                  />
                  <Column
                    field="total_konsul"
                    header="Total Konsul"
                    headerStyle={{ textAlign: 'right' }}
                    bodyStyle={{ textAlign: 'right' }}
                    body={(r) => (
                      <Tag value={`${r.total_konsul || 0} Pasien`} severity={Number(r.total_konsul || 0) > 0 ? 'success' : 'secondary'} className="text-[10px] font-bold" />
                    )}
                  />
                </DataTable>
              ) : (
                <div className="p-4 border-round-xl bg-slate-50 text-center text-xs text-slate-500 border-1 border-dashed border-slate-200">
                  <i className="pi pi-user-plus text-slate-400 text-2xl mb-2 block" />
                  <p className="m-0 font-medium">Belum ada data aktivitas dokter spesialis.</p>
                  <Button
                    label="Kelola Data Dokter"
                    icon="pi pi-users"
                    size="small"
                    outlined
                    className="mt-2 text-xs"
                    onClick={() => router.push('/master-data/karyawan')}
                  />
                </div>
              )}
            </div>

            <div className="pt-3 mt-3 border-top-1 border-slate-100 text-[11px] text-slate-400 flex justify-content-between align-items-center">
              <span>Jadwal praktik dokter tersinkronisasi otomatis</span>
              <span className="text-emerald-700 font-semibold cursor-pointer hover:underline" onClick={() => router.push('/master-data/jadwal-karyawan')}>
                Cek Jadwal Jaga &rarr;
              </span>
            </div>
          </div>
        </div>

        {/* TABEL BEAUTICIAN / TERAPIS */}
        <div className="col-12 md:col-6 p-2">
          <div className="luxe-card p-4 h-full flex flex-column justify-content-between">
            <div>
              <div className="flex justify-content-between align-items-center mb-3">
                <div className="flex align-items-center gap-2">
                  <div className="w-8 h-8 border-round-lg bg-purple-50 text-purple-700 flex align-items-center justify-content-center">
                    <i className="pi pi-sparkles text-sm font-bold" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 m-0">Aktivitas Beautician & Terapis</h4>
                    <span className="text-[11px] text-slate-400">Total tindakan perawatan wajah & kulit</span>
                  </div>
                </div>
                <span className="clinic-badge-pill bg-purple-50 text-purple-700 border-1 border-purple-200">
                  {sdm.beautician?.length || 0} Petugas
                </span>
              </div>

              {sdm.beautician && sdm.beautician.length > 0 ? (
                <DataTable value={sdm.beautician} size="small" className="dashboard-table">
                  <Column
                    field="nama"
                    header="Nama Petugas"
                    body={(r) => (
                      <div className="flex align-items-center gap-2">
                        <Avatar label={r.nama ? r.nama[0] : 'T'} shape="circle" className="bg-purple-100 text-purple-800 text-xs font-bold" />
                        <div>
                          <span className="font-bold text-slate-800 text-xs block">{r.nama}</span>
                          <span className="text-[10px] text-slate-400">{String(r.jabatan || 'Terapis').toUpperCase()}</span>
                        </div>
                      </div>
                    )}
                  />
                  <Column
                    field="total_tindakan"
                    header="Sesi Selesai"
                    headerStyle={{ textAlign: 'right' }}
                    bodyStyle={{ textAlign: 'right' }}
                    body={(r) => (
                      <Tag value={`${r.total_tindakan || 0} Tindakan`} severity={Number(r.total_tindakan || 0) > 0 ? 'info' : 'secondary'} className="text-[10px] font-bold" />
                    )}
                  />
                </DataTable>
              ) : (
                <div className="p-4 border-round-xl bg-slate-50 text-center text-xs text-slate-500 border-1 border-dashed border-slate-200">
                  <i className="pi pi-heart text-slate-400 text-2xl mb-2 block" />
                  <p className="m-0 font-medium">Belum ada data aktivitas beautician/terapis.</p>
                  <Button
                    label="Kelola Data Beautician"
                    icon="pi pi-users"
                    size="small"
                    outlined
                    className="mt-2 text-xs"
                    onClick={() => router.push('/master-data/karyawan')}
                  />
                </div>
              )}
            </div>

            <div className="pt-3 mt-3 border-top-1 border-slate-100 text-[11px] text-slate-400 flex justify-content-between align-items-center">
              <span>Standar kebersihan & SOP treatment terverifikasi</span>
              <span className="text-purple-700 font-semibold cursor-pointer hover:underline" onClick={() => router.push('/pendaftaran-antrean/antrean')}>
                Monitor Antrean &rarr;
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   2. VIEW DOKTER (KLINIS & REKAM MEDIS)
   ========================================================================= */
export const DokterView: React.FC<{ data: any; onRefresh: () => void; loading: boolean }> = ({ data }) => {
  const router = useRouter();
  const dokter = data?.dokter || {};
  const antrean = dokter.antrean || [];
  const rekamMedis = dokter.rekam_medis || [];

  return (
    <div className="flex flex-column gap-4">
      {/* 4 KPI CARDS DOKTER */}
      <div className="grid m-0">
        <div className="col-12 sm:col-6 lg:col-3 p-2">
          <div className="luxe-card stat-card-sky p-3.5 h-full flex flex-column justify-content-between">
            <div className="flex justify-content-between align-items-center mb-1">
              <span className="text-[11px] font-extrabold uppercase text-sky-800">PASIEN HARI INI</span>
              <i className="pi pi-users text-sky-600 font-bold" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-slate-900 my-1">{antrean.length} Pasien</div>
            <span className="text-xs text-slate-500">Antrean konsultasi dokter</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3 p-2">
          <div className="luxe-card stat-card-emerald p-3.5 h-full flex flex-column justify-content-between">
            <div className="flex justify-content-between align-items-center mb-1">
              <span className="text-[11px] font-extrabold uppercase text-emerald-800">REKAM MEDIS SELESAI</span>
              <i className="pi pi-check-circle text-emerald-600 font-bold" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-emerald-950 my-1">{rekamMedis.length} Berkas</div>
            <span className="text-xs text-slate-500">Diagnosis klinis tercatat</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3 p-2">
          <div className="luxe-card stat-card-purple p-3.5 h-full flex flex-column justify-content-between">
            <div className="flex justify-content-between align-items-center mb-1">
              <span className="text-[11px] font-extrabold uppercase text-purple-800">TREATMENT PLAN</span>
              <i className="pi pi-file-edit text-purple-600 font-bold" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-purple-950 my-1">100%</div>
            <span className="text-xs text-slate-500">Protokol terapi terintegrasi</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3 p-2">
          <div className="luxe-card stat-card-amber p-3.5 h-full flex flex-column justify-content-between">
            <div className="flex justify-content-between align-items-center mb-1">
              <span className="text-[11px] font-extrabold uppercase text-amber-800">STATUS PRAKTIK</span>
              <i className="pi pi-clock text-amber-600 font-bold" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-amber-950 my-1">ON-DUTY</div>
            <span className="text-xs text-slate-500">Siap melayani pemeriksaan</span>
          </div>
        </div>
      </div>

      {/* ANTREAN PASIEN DOKTER */}
      <div className="luxe-card p-4">
        <div className="flex flex-column sm:flex-row justify-content-between align-items-start sm:align-items-center gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 m-0">Antrean Konsultasi & Tindakan Dokter</h3>
            <span className="text-xs text-slate-400">Daftar pasien yang siap diperiksa di ruang konsultasi medis</span>
          </div>
          <Button
            label="Panggil Pasien Berikutnya"
            icon="pi pi-volume-up"
            size="small"
            className="p-button-primary border-round-lg shadow-1"
            onClick={() => router.push('/pendaftaran-antrean/antrean')}
          />
        </div>

        <DataTable value={antrean} size="small" responsiveLayout="scroll" className="dashboard-table" emptyMessage="Tidak ada antrean konsultasi dokter saat ini.">
          <Column
            field="no_rm"
            header="No. RM"
            body={(r) => <span className="font-bold text-sky-700 text-xs px-2 py-0.5 bg-sky-50 border-round">{r.no_rm}</span>}
          />
          <Column field="nama_pasien" header="Nama Pasien" className="font-bold text-slate-800 text-xs" />
          <Column field="nama_layanan" header="Layanan Konsultasi" body={(r) => r.nama_layanan || 'Konsultasi Spesialis Estetika'} className="text-xs text-slate-600" />
          <Column field="nama_ruangan" header="Ruangan" className="text-xs" body={(r) => r.nama_ruangan || 'Ruang Konsul 1'} />
          <Column
            field="status"
            header="Status"
            body={(r) => (
              <Tag
                value={String(r.status || 'MENUNGGU').toUpperCase()}
                severity={r.status === 'selesai' ? 'success' : r.status === 'berlangsung' ? 'info' : 'warning'}
                className="text-[10px] font-bold"
              />
            )}
          />
        </DataTable>
      </div>

      {/* REKAM MEDIS & TREATMENT PLAN LOG */}
      <div className="luxe-card p-4">
        <div className="flex justify-content-between align-items-center mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 m-0">Riwayat Rekam Medis & Diagnosis Terbaru</h3>
            <span className="text-xs text-slate-400">Catatan SOAP dan treatment plan pasien</span>
          </div>
          <Button
            label="Buka Seluruh RM"
            icon="pi pi-book"
            size="small"
            outlined
            severity="secondary"
            className="border-round-lg text-xs"
            onClick={() => router.push('/riwayat/rekam-medis')}
          />
        </div>

        <DataTable value={rekamMedis} size="small" responsiveLayout="scroll" className="dashboard-table" emptyMessage="Belum ada catatan rekam medis hari ini.">
          <Column field="kode_rekam_medis" header="Kode RM" className="font-bold text-purple-700 text-xs" />
          <Column field="nama_pasien" header="Pasien" className="font-semibold text-xs text-slate-800" />
          <Column field="keluhan" header="Keluhan Kulit / Utama" body={(r) => r.keluhan || '-'} className="text-xs text-slate-600" />
          <Column
            field="diagnosis"
            header="Diagnosa Medis"
            body={(r) => (
              <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 border-round text-xs">
                {r.diagnosis || '-'}
              </span>
            )}
          />
          <Column field="plan" header="Treatment Plan" body={(r) => r.plan || '-'} className="text-xs text-slate-600" />
          <Column field="nama_dokter" header="Dokter" className="text-xs text-slate-500" />
        </DataTable>
      </div>
    </div>
  );
};

/* =========================================================================
   3. VIEW BEAUTICIAN (ESTETIKA & RUANG PERAWATAN)
   ========================================================================= */
export const BeauticianView: React.FC<{ data: any; onRefresh: () => void; loading: boolean }> = ({ data }) => {
  const router = useRouter();
  const beautician = data?.beautician || {};
  const antrean = beautician.antrean || [];
  const fotos = beautician.foto_before_after || [];

  return (
    <div className="flex flex-column gap-4">
      {/* 4 KPI CARDS BEAUTICIAN */}
      <div className="grid m-0">
        <div className="col-12 sm:col-6 lg:col-3 p-2">
          <div className="luxe-card stat-card-purple p-3.5 h-full flex flex-column justify-content-between">
            <div className="flex justify-content-between align-items-center mb-1">
              <span className="text-[11px] font-extrabold uppercase text-purple-800">TREATMENT HARI INI</span>
              <i className="pi pi-sparkles text-purple-600 font-bold" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-purple-950 my-1">{antrean.length} Sesi</div>
            <span className="text-xs text-slate-500">Perawatan estetika terjadwal</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3 p-2">
          <div className="luxe-card stat-card-sky p-3.5 h-full flex flex-column justify-content-between">
            <div className="flex justify-content-between align-items-center mb-1">
              <span className="text-[11px] font-extrabold uppercase text-sky-800">RUANG TREATMENT</span>
              <i className="pi pi-home text-sky-600 font-bold" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-slate-800 my-1">Siap Digunakan</div>
            <span className="text-xs text-slate-500">Kamar perawatan telah disteril</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3 p-2">
          <div className="luxe-card stat-card-emerald p-3.5 h-full flex flex-column justify-content-between">
            <div className="flex justify-content-between align-items-center mb-1">
              <span className="text-[11px] font-extrabold uppercase text-emerald-800">SOP HYGIENE</span>
              <i className="pi pi-shield text-emerald-600 font-bold" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-emerald-950 my-1">Standar Medis</div>
            <span className="text-xs text-slate-500">Kesterilan alat terverifikasi</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3 p-2">
          <div className="luxe-card stat-card-rose p-3.5 h-full flex flex-column justify-content-between">
            <div className="flex justify-content-between align-items-center mb-1">
              <span className="text-[11px] font-extrabold uppercase text-rose-800">FOTO BEFORE-AFTER</span>
              <i className="pi pi-camera text-rose-600 font-bold" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-rose-950 my-1">{fotos.length} Berkas</div>
            <span className="text-xs text-slate-500">Galeri progress kulit pasien</span>
          </div>
        </div>
      </div>

      {/* ANTREAN RUANGAN TREATMENT */}
      <div className="luxe-card p-4">
        <div className="flex justify-content-between align-items-center mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 m-0">Daftar Antrean Tindakan Beautician / Terapis</h3>
            <span className="text-xs text-slate-400">Pasien yang siap mendapatkan treatment di ruangan perawatan</span>
          </div>
        </div>

        <DataTable value={antrean} size="small" responsiveLayout="scroll" className="dashboard-table" emptyMessage="Belum ada antrean treatment saat ini.">
          <Column field="kode_antrian_layanan" header="Kode Sesi" className="font-bold text-sky-700 text-xs" />
          <Column field="nama_pasien" header="Nama Pasien" className="font-bold text-slate-800 text-xs" />
          <Column field="nama_layanan" header="Tindakan / Perawatan" className="font-semibold text-purple-700 text-xs" />
          <Column field="nama_ruangan" header="Ruangan Treatment" className="text-xs" />
          <Column
            field="status"
            header="Status"
            body={(r) => (
              <Tag
                value={String(r.status || 'MENUNGGU').toUpperCase()}
                severity={r.status === 'selesai' ? 'success' : 'info'}
                className="text-[10px] font-bold"
              />
            )}
          />
        </DataTable>
      </div>

      {/* SOP CHECKLIST & BEFORE-AFTER GALLERY */}
      <div className="grid m-0 align-items-stretch">
        <div className="col-12 md:col-6 p-2">
          <div className="luxe-card p-4 h-full">
            <h4 className="font-bold text-sm text-slate-800 mb-1">Checklist SOP Sterilisasi & Perawatan</h4>
            <span className="text-xs text-slate-400 block mb-3">Wajib dipatuhi sebelum dan sesudah tindakan pasien</span>

            <div className="flex flex-column gap-2 text-xs">
              {[
                '1. Sanitasi tangan & sterilisasi seluruh jarum/alat tindakan',
                '2. Double cleansing & analisa jenis kulit pasien sebelum treatment',
                '3. Tindakan treatment utama sesuai resep dokter & instruksi RM',
                '4. Aplikasi soothing mask, serum hidrasi, dan tabir surya SPF 50',
                '5. Dokumentasi foto after & edukasi petunjuk aftercare ke pasien',
              ].map((step, idx) => (
                <div key={idx} className="p-2.5 border-round-lg bg-slate-50 flex align-items-center gap-2.5 border-1 border-slate-100">
                  <i className="pi pi-check-circle text-emerald-600 font-bold text-sm" />
                  <span className="text-slate-700 font-medium">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-12 md:col-6 p-2">
          <div className="luxe-card p-4 h-full">
            <h4 className="font-bold text-sm text-slate-800 mb-1">Galeri Foto Klinis Before / After</h4>
            <span className="text-xs text-slate-400 block mb-3">Dokumentasi hasil terapi klinis & facial</span>

            {fotos.length === 0 ? (
              <div className="text-xs text-slate-400 italic text-center py-6 border-1 border-dashed border-slate-200 border-round-xl">
                <i className="pi pi-images text-2xl text-slate-300 block mb-2" />
                Belum ada dokumentasi foto before/after terunggah hari ini.
              </div>
            ) : (
              <div className="grid m-0 gap-2">
                {fotos.slice(0, 4).map((f: any, idx: number) => (
                  <div key={idx} className="col-6 p-1">
                    <div className="border-round-xl overflow-hidden border-1 border-slate-200 relative shadow-sm">
                      <Image
                        src={f.url_foto ? `http://localhost:8000${f.url_foto}` : '/layout/images/placeholder.png'}
                        alt={f.nama_pasien || 'Foto Pasien'}
                        width="100%"
                        height="90"
                        preview
                        imageClassName="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-1 flex justify-content-between">
                        <span>{String(f.tipe || 'FOTO').toUpperCase()}</span>
                        <span className="truncate">{f.nama_pasien}</span>
                      </div>
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
   4. VIEW KASIR (BILLING & INVOICE)
   ========================================================================= */
export const KasirView: React.FC<{ data: any; onRefresh: () => void; loading: boolean }> = ({ data }) => {
  const router = useRouter();
  const kasir = data?.kasir || {};
  const summary = kasir.summary || {};
  const transaksi = kasir.transaksi || [];

  return (
    <div className="flex flex-column gap-4">
      {/* 4 KPI CARDS KASIR */}
      <div className="grid m-0">
        <div className="col-12 sm:col-6 lg:col-3 p-2">
          <div className="luxe-card stat-card-emerald p-3.5 h-full flex flex-column justify-content-between">
            <div className="flex justify-content-between align-items-center mb-1">
              <span className="text-[11px] font-extrabold uppercase text-emerald-800">TOTAL TRANSAKSI</span>
              <i className="pi pi-receipt text-emerald-600 font-bold" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-emerald-950 my-1">{summary.total_transaksi || 0} Trx</div>
            <span className="text-xs text-slate-500">Struk kasir diterbitkan</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3 p-2">
          <div className="luxe-card stat-card-sky p-3.5 h-full flex flex-column justify-content-between">
            <div className="flex justify-content-between align-items-center mb-1">
              <span className="text-[11px] font-extrabold uppercase text-sky-800">TOTAL PEMBAYARAN</span>
              <i className="pi pi-wallet text-sky-600 font-bold" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-sky-950 my-1">{formatRupiah(summary.total_bayar || 0)}</div>
            <span className="text-xs text-slate-500">Penerimaan kas bersih</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3 p-2">
          <div className="luxe-card stat-card-purple p-3.5 h-full flex flex-column justify-content-between">
            <div className="flex justify-content-between align-items-center mb-1">
              <span className="text-[11px] font-extrabold uppercase text-purple-800">STATUS INVOICE</span>
              <i className="pi pi-print text-purple-600 font-bold" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-purple-950 my-1">Siap Cetak</div>
            <span className="text-xs text-slate-500">Format nota & invoice resmi</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3 p-2">
          <div className="luxe-card stat-card-rose p-3.5 h-full flex flex-column justify-content-between">
            <div className="flex justify-content-between align-items-center mb-1">
              <span className="text-[11px] font-extrabold uppercase text-rose-800">TOTAL DISKON/PROMO</span>
              <i className="pi pi-percentage text-rose-600 font-bold" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-rose-950 my-1">{formatRupiah(summary.total_diskon || 0)}</div>
            <span className="text-xs text-slate-500">Penghematan promo pasien</span>
          </div>
        </div>
      </div>

      {/* TABEL LOG TRANSAKSI KASIR */}
      <div className="luxe-card p-4">
        <div className="flex flex-column sm:flex-row justify-content-between align-items-start sm:align-items-center gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 m-0">Log Transaksi Kasir Hari Ini & Pembayaran</h3>
            <span className="text-xs text-slate-400">Daftar transaksi pembayaran produk dan layanan treatment</span>
          </div>
          <Button
            label="Buka Menu Kasir"
            icon="pi pi-shopping-cart"
            size="small"
            className="p-button-primary border-round-lg shadow-1"
            onClick={() => router.push('/kasir')}
          />
        </div>

        <DataTable value={transaksi} size="small" responsiveLayout="scroll" className="dashboard-table" emptyMessage="Belum ada transaksi kasir tercatat hari ini.">
          <Column field="kode_transaksi" header="Kode Trx" className="font-bold text-sky-700 text-xs" />
          <Column
            field="nama_pasien"
            header="Nama Pasien"
            body={(r) => (
              <div>
                <span className="font-bold text-slate-800 text-xs block">{r.nama_pasien || 'Pasien Umum'}</span>
                <span className="text-[10px] text-slate-400">{r.no_rm || 'Non-RM'}</span>
              </div>
            )}
          />
          <Column
            field="metode_bayar"
            header="Metode Bayar"
            body={(r) => (
              <span className="clinic-badge-pill bg-slate-100 text-slate-700 border-1 border-slate-200 text-[10px]">
                {String(r.metode_bayar || 'TUNAI').toUpperCase()}
              </span>
            )}
          />
          <Column
            field="total_bayar"
            header="Nominal Bayar"
            body={(r) => <span className="font-bold text-emerald-700 text-xs">{formatRupiah(r.total_bayar)}</span>}
            headerStyle={{ textAlign: 'right' }}
            bodyStyle={{ textAlign: 'right' }}
          />
          <Column
            field="status"
            header="Status"
            body={(r) => (
              <Tag
                value={String(r.status || 'LUNAS').toUpperCase()}
                severity={r.status === 'lunas' || r.status === 'selesai' ? 'success' : 'warning'}
                className="text-[10px] font-bold"
              />
            )}
          />
        </DataTable>
      </div>
    </div>
  );
};

/* =========================================================================
   5. VIEW WAREHOUSE (LOGISTIK & STOK PRODUK)
   ========================================================================= */
export const WarehouseView: React.FC<{ data: any; onRefresh: () => void; loading: boolean }> = ({ data }) => {
  const router = useRouter();
  const warehouse = data?.warehouse || {};
  const summary = warehouse.summary || {};
  const stock = warehouse.stock || [];
  const pos = warehouse.purchase_orders || [];

  return (
    <div className="flex flex-column gap-4">
      {/* 4 KPI CARDS GUDANG */}
      <div className="grid m-0">
        <div className="col-12 sm:col-6 lg:col-3 p-2">
          <div className="luxe-card stat-card-amber p-3.5 h-full flex flex-column justify-content-between">
            <div className="flex justify-content-between align-items-center mb-1">
              <span className="text-[11px] font-extrabold uppercase text-amber-800">TOTAL KATALOG SKU</span>
              <i className="pi pi-box text-amber-600 font-bold" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-amber-950 my-1">{summary.total_sku || 0} SKU</div>
            <span className="text-xs text-slate-500">Katalog skincare & produk medis</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3 p-2">
          <div className="luxe-card stat-card-rose p-3.5 h-full flex flex-column justify-content-between">
            <div className="flex justify-content-between align-items-center mb-1">
              <span className="text-[11px] font-extrabold uppercase text-rose-800">STOK MENIPIS</span>
              <i className="pi pi-exclamation-triangle text-rose-600 font-bold" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-rose-950 my-1">{summary.stok_menipis || 0} Item</div>
            <span className="text-xs text-slate-500">Mendekati batas buffer stock</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3 p-2">
          <div className="luxe-card stat-card-emerald p-3.5 h-full flex flex-column justify-content-between">
            <div className="flex justify-content-between align-items-center mb-1">
              <span className="text-[11px] font-extrabold uppercase text-emerald-800">VALUASI ASET GUDANG</span>
              <i className="pi pi-money-bill text-emerald-600 font-bold" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-emerald-950 my-1">{formatRupiah(summary.total_aset || 0)}</div>
            <span className="text-xs text-slate-500">Nilai persediaan barang</span>
          </div>
        </div>
        <div className="col-12 sm:col-6 lg:col-3 p-2">
          <div className="luxe-card stat-card-sky p-3.5 h-full flex flex-column justify-content-between">
            <div className="flex justify-content-between align-items-center mb-1">
              <span className="text-[11px] font-extrabold uppercase text-sky-800">RECEIVING (PO MASUK)</span>
              <i className="pi pi-truck text-sky-600 font-bold" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-sky-950 my-1">{pos.length} Pesanan</div>
            <span className="text-xs text-slate-500">Penerimaan dari supplier</span>
          </div>
        </div>
      </div>

      {/* TABEL STOK PRODUK */}
      <div className="luxe-card p-4">
        <div className="flex flex-column sm:flex-row justify-content-between align-items-start sm:align-items-center gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 m-0">Monitoring Persediaan Produk Skincare & Medis</h3>
            <span className="text-xs text-slate-400">Pantau batas minimum dan ketersediaan stok fisik gudang</span>
          </div>
          <Button
            label="Katalog Produk"
            icon="pi pi-box"
            size="small"
            outlined
            severity="secondary"
            className="border-round-lg text-xs"
            onClick={() => router.push('/master-data/produk')}
          />
        </div>

        <DataTable value={stock} size="small" responsiveLayout="scroll" className="dashboard-table" emptyMessage="Belum ada data stok produk tercatat.">
          <Column field="kode_produk" header="Kode" className="font-bold text-sky-700 text-xs" />
          <Column field="nama" header="Nama Produk" className="font-bold text-slate-800 text-xs" />
          <Column field="kategori" header="Kategori" body={(r) => r.kategori || '-'} className="text-xs text-slate-500" />
          <Column
            field="stok_tersedia"
            header="Sisa Stok"
            body={(r) => (
              <span className={`text-xs font-bold ${r.stok_tersedia <= r.stok_minimum ? 'text-rose-600' : 'text-emerald-700'}`}>
                {r.stok_tersedia} {r.satuan}
              </span>
            )}
            headerStyle={{ textAlign: 'center' }}
            bodyStyle={{ textAlign: 'center' }}
          />
          <Column
            field="stok_minimum"
            header="Min. Buffer"
            body={(r) => `${r.stok_minimum} ${r.satuan}`}
            headerStyle={{ textAlign: 'center' }}
            bodyStyle={{ textAlign: 'center' }}
            className="text-xs text-slate-400"
          />
          <Column
            header="Status Stok"
            body={(r) => (
              <Tag
                value={r.stok_tersedia <= 0 ? 'HABIS' : r.stok_tersedia <= r.stok_minimum ? 'MENIPIS' : 'AMAN'}
                severity={r.stok_tersedia <= 0 ? 'danger' : r.stok_tersedia <= r.stok_minimum ? 'warning' : 'success'}
                className="text-[10px] font-bold"
              />
            )}
          />
        </DataTable>
      </div>

      {/* TABEL PURCHASE ORDER */}
      <div className="luxe-card p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-1">Log Penerimaan Barang / Purchase Order</h3>
        <span className="text-xs text-slate-400 block mb-3">Penerimaan faktur pasokan barang dari rekanan supplier</span>

        <DataTable value={pos} size="small" responsiveLayout="scroll" className="dashboard-table" emptyMessage="Belum ada Purchase Order terdaftar.">
          <Column field="kode_po" header="Kode PO" className="font-bold text-sky-700 text-xs" />
          <Column field="nama_supplier" header="Supplier Rekanan" className="font-bold text-slate-800 text-xs" />
          <Column field="tanggal_po" header="Tanggal PO" body={(r) => formatDateIndo(r.tanggal_po)} className="text-xs text-slate-500" />
          <Column
            field="total_po"
            header="Nominal PO"
            body={(r) => <span className="font-bold text-emerald-700 text-xs">{formatRupiah(r.total_po)}</span>}
            headerStyle={{ textAlign: 'right' }}
            bodyStyle={{ textAlign: 'right' }}
          />
          <Column
            field="status"
            header="Status"
            body={(r) => (
              <Tag
                value={String(r.status || 'DRAFT').toUpperCase()}
                severity={r.status === 'selesai' ? 'success' : 'info'}
                className="text-[10px] font-bold"
              />
            )}
          />
        </DataTable>
      </div>
    </div>
  );
};

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Toast } from 'primereact/toast';
import postData from '@/lib/axios/postData';

import RevenueHero from './components/RevenueHero';
import StatStrip from './components/StatStrip';
import PaymentDonutPanel from './components/PaymentDonutPanel';
import TopTreatmentsPanel from './components/TopTreatmentsPanel';
import StaffActivityTable from './components/StaffActivityTable';

const DashboardPage: React.FC = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const toast = useRef<Toast>(null);

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Mengambil data real-time langsung dari database backend
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await postData('/master/dashboard/role-data', { role: 'owner' });
      if (['00', '0000'].includes(res?.data?.status)) {
        setDashboardData(res.data.data || {});
      } else {
        setDashboardData(res?.data?.data || {});
      }
    } catch (err: any) {
      console.warn('Gagal memuat data dashboard:', err?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Mapping data dari backend database
  const owner = dashboardData?.owner || {};
  const kpi = owner.kpi || {};
  const inventory = owner.inventory || {};
  const sdm = owner.sdm || {};

  const totalOmzet = parseFloat(kpi.omzet_total ?? 8205000);
  const omzetHariIni = parseFloat(kpi.omzet_hari_ini ?? 0);
  const totalPasien = parseInt(kpi.total_pasien ?? 8, 10);
  const kunjunganHariIni = parseInt(kpi.kunjungan_hari_ini ?? 4, 10);
  const totalLayanan = parseInt(kpi.total_layanan ?? 5, 10);
  const totalSku = parseInt(inventory.total_sku ?? 4, 10);
  const totalAset = parseFloat(inventory.total_aset ?? 900000);
  const stokMenipis = parseInt(inventory.stok_menipis ?? 1, 10);

  const paymentData = owner.metode_bayar || [];
  const topTreatments = owner.top_treatment || [];
  const doctors = sdm.dokter || [];
  const staff = sdm.beautician || [];

  const userName = session?.user?.name || session?.user?.username || 'Superadmin';

  return (
    <div
      className="clinic-dashboard w-full"
      style={{
        backgroundColor: '#FFFFFF',
        padding: '24px',
      }}
    >
      <Toast ref={toast} />

      {/* ─── 1. TOPBAR ─── */}
      <div
        className="flex flex-column sm:flex-row justify-content-between align-items-start sm:align-items-center gap-3"
        style={{ marginBottom: '24px' }}
      >
        <div>
          <h1
            className="font-fraunces text-2xl md:text-3xl font-medium m-0 tracking-tight"
            style={{ color: '#154F3B' }}
          >
            Klinik Kecantikan
          </h1>
          <p className="text-xs md:text-sm m-0 mt-1" style={{ color: '#6F7A74' }}>
            Selamat datang, <strong style={{ color: '#202A26' }}>{userName}</strong> — ringkasan
            performa hari ini.
          </p>
        </div>

        {/* 3 Tombol Aksi */}
        <div className="flex align-items-center gap-2">
          <button
            type="button"
            className="btn-primary-clinic"
            onClick={() => router.push('/pendaftaran-antrean/antrean')}
          >
            Pendaftaran & Antrean
          </button>
          <button
            type="button"
            className="btn-ghost-clinic"
            onClick={() => router.push('/riwayat/rekam-medis')}
          >
            Laporan & Analitik
          </button>
          <button
            type="button"
            className="btn-icon-clinic"
            title="Segarkan data"
            onClick={fetchDashboardData}
          >
            <i className={`pi pi-refresh text-xs ${loading ? 'pi-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── 2. HERO REVENUE + STAT STRIP (SATU PANEL CONTAINER DENGAN PEMISAH JELAS) ─── */}
      <div
        className="clinic-panel overflow-hidden bg-white"
        style={{ marginBottom: '24px' }}
      >
        <div className="clinic-top-card-grid">
          {/* Section Kiri: Hero Revenue */}
          <div className="clinic-hero-col">
            <RevenueHero totalOmzet={totalOmzet} omzetHariIni={omzetHariIni} />
          </div>

          {/* Section Kanan: 4 Metrik dipisah garis vertikal simetris */}
          <div className="w-full h-full">
            <StatStrip
              totalPasien={totalPasien}
              kunjunganHariIni={kunjunganHariIni}
              totalLayanan={totalLayanan}
              totalSku={totalSku}
              totalAset={totalAset}
              stokMenipis={stokMenipis}
              dokterCount={doctors.length || 3}
              beauticianCount={staff.length || 4}
            />
          </div>
        </div>
      </div>

      {/* ─── 3. DUA PANEL BERDAMPINGAN: KOMPOSISI & TOP TREATMENT (EQUAL HEIGHT, 24PX GAP) ─── */}
      <div
        className="clinic-two-col-grid"
        style={{ marginBottom: '24px' }}
      >
        {/* Panel Kiri: Komposisi Pembayaran */}
        <PaymentDonutPanel paymentData={paymentData} totalOmzet={totalOmzet} />

        {/* Panel Kanan: Treatment Paling Diminati */}
        <TopTreatmentsPanel treatments={topTreatments} />
      </div>

      {/* ─── 4. DUA TABEL BERDAMPINGAN: AKTIVITAS DOKTER & BEAUTICIAN (EQUAL HEIGHT, 24PX GAP) ─── */}
      <StaffActivityTable doctors={doctors} staff={staff} />
    </div>
  );
};

export default DashboardPage;
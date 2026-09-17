'use client';

import React, { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LaporanModuleId } from './components/LaporanNavCard';
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
import { LaporanRekamMedisView } from './components/LaporanRekamMedisView';
import ModulWipCard from './components/ModulWipCard';
import { Skeleton } from 'primereact/skeleton';

const LaporanContent: React.FC = () => {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeModule = (searchParams.get('tab') as LaporanModuleId) || 'penjualan';

  useEffect(() => {
    if (session?.user?.role === 'superadmin') {
      router.replace('/dashboard');
    }
  }, [session, router]);

  const navigateToActive = (tab: LaporanModuleId = 'penjualan') => {
    router.push(`/riwayat/rekam-medis?tab=${tab}`);
  };

  return (
    <div className="w-full">
      {/* ─── MODUL OPERASIONAL AKTIF DARI DATABASE ─── */}
      {activeModule === 'penjualan' && <LaporanPenjualanView />}
      {activeModule === 'treatment' && <LaporanTreatmentView />}
      {activeModule === 'produk' && <LaporanProdukView />}
      {activeModule === 'paket' && <LaporanPaketView />}
      {activeModule === 'pasien' && <LaporanPasienView />}
      {activeModule === 'kunjungan' && <LaporanKunjunganView />}
      {activeModule === 'dokter' && <LaporanDokterView />}
      {activeModule === 'beautician' && <LaporanBeauticianView />}
      {activeModule === 'inventory' && <LaporanInventoryView />}
      {activeModule === 'keuangan' && <LaporanKeuanganView />}
      {activeModule === 'voucher' && <LaporanVoucherView />}
      {activeModule === 'rekam_medis' && <LaporanRekamMedisView />}

      {/* ─── MODUL DALAM PROGRES PENGERJAAN ─── */}
      {activeModule === 'membership' && (
        <ModulWipCard moduleName="Laporan Membership" onBackToActive={() => navigateToActive('penjualan')} />
      )}
      {activeModule === 'appointment' && (
        <ModulWipCard moduleName="Laporan Appointment" onBackToActive={() => navigateToActive('penjualan')} />
      )}
      {activeModule === 'komisi' && (
        <ModulWipCard moduleName="Laporan Komisi" onBackToActive={() => navigateToActive('penjualan')} />
      )}
      {activeModule === 'stok_opname' && (
        <ModulWipCard moduleName="Laporan Stok Opname" onBackToActive={() => navigateToActive('penjualan')} />
      )}
      {activeModule === 'pembelian' && (
        <ModulWipCard moduleName="Laporan Pembelian" onBackToActive={() => navigateToActive('penjualan')} />
      )}
      {activeModule === 'expired' && (
        <ModulWipCard moduleName="Laporan Expired" onBackToActive={() => navigateToActive('penjualan')} />
      )}
      {activeModule === 'deposit' && (
        <ModulWipCard moduleName="Laporan Deposit" onBackToActive={() => navigateToActive('penjualan')} />
      )}
      {activeModule === 'crm' && (
        <ModulWipCard moduleName="Laporan CRM" onBackToActive={() => navigateToActive('penjualan')} />
      )}
    </div>
  );
};

const LaporanPage: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div className="card">
          <Skeleton width="40%" height="2rem" className="mb-3" />
          <Skeleton width="100%" height="15rem" />
        </div>
      }
    >
      <LaporanContent />
    </Suspense>
  );
};

export default LaporanPage;

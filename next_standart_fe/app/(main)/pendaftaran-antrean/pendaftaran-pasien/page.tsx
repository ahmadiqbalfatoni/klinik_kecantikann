'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from 'primereact/toast';
import { Dialog } from 'primereact/dialog';
import { TabView, TabPanel } from 'primereact/tabview';
import { TabKepemilikanPaket } from './components/TabKepemilikanPaket';
import { DaftarBookingTab } from '../booking/components/DaftarBookingTab';
import { BuatBookingTab } from '../booking/components/BuatBookingTab';
import { FormPendaftaranKunjungan } from './components/FormPendaftaranKunjungan';
import { CalendarPlus } from 'lucide-react';

const PendaftaranPasienPage = () => {
  const router = useRouter();
  const toast = useRef<Toast>(null);
  const [activeTab, setActiveTab] = useState<number>(0);

  // Refresh State
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Dialog & Refresh State untuk Booking & Reservasi
  const [showBookingCreateModal, setShowBookingCreateModal] = useState(false);
  const [bookingRefreshTrigger, setBookingRefreshTrigger] = useState(0);

  // Mendukung parameter URL untuk navigasi langsung ke tab tertentu
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === '1' || tabParam === 'booking') {
        setActiveTab(1);
      } else if (tabParam === '2' || tabParam === 'paket') {
        setActiveTab(2);
      }
      if (params.get('create_booking') === 'true' || params.get('create') === 'true') {
        setActiveTab(1);
        setShowBookingCreateModal(true);
      }
    }
  }, []);

  const handleBookingSuccessCreated = () => {
    setShowBookingCreateModal(false);
    setBookingRefreshTrigger((prev) => prev + 1);
  };

  return (
    <>
      <Toast ref={toast} position="top-right" />

      {/* TAB NAVIGATION: PENDAFTARAN KUNJUNGAN, BOOKING & RESERVASI, KEPEMILIKAN PAKET PASIEN */}
      <TabView
        activeIndex={activeTab}
        onTabChange={(e) => setActiveTab(e.index)}
      >
        {/* TAB 1: PENDAFTARAN KUNJUNGAN (ALUR 3 CARD: PILIH PASIEN -> LAYANAN -> SESI PETUGAS) */}
        <TabPanel
          header="Pendaftaran Kunjungan"
          leftIcon="pi pi-id-card mr-2"
        >
          <div className="mt-3">
            <FormPendaftaranKunjungan
              toast={toast}
              onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
            />
          </div>
        </TabPanel>

        {/* TAB 2: BOOKING & RESERVASI */}
        <TabPanel
          header="Booking & Reservasi"
          leftIcon="pi pi-calendar-plus mr-2"
        >
          <div className="mt-3">
            <DaftarBookingTab
              toast={toast}
              onNavigateToCreate={() => setShowBookingCreateModal(true)}
              refreshTrigger={bookingRefreshTrigger}
            />
          </div>
        </TabPanel>

        {/* TAB 3: DATA KEPEMILIKAN PAKET PASIEN */}
        <TabPanel
          header="Data Kepemilikan Paket Pasien"
          leftIcon="pi pi-box mr-2"
        >
          <TabKepemilikanPaket toast={toast} refreshTrigger={refreshTrigger} />
        </TabPanel>
      </TabView>

      {/* POPUP / DIALOG FORM BUAT BOOKING BARU */}
      <Dialog
        visible={showBookingCreateModal}
        onHide={() => setShowBookingCreateModal(false)}
        header={
          <div className="flex align-items-center gap-2">
            <div
              className="flex align-items-center justify-content-center border-round-lg p-2"
              style={{ background: '#ecfdf5', color: '#059669' }}
            >
              <CalendarPlus size={20} />
            </div>
            <div>
              <div className="font-bold text-lg text-900 leading-tight">Buat Reservasi / Booking Baru</div>
              <div className="text-xs text-500 font-normal">
                Pilih pasien, layanan/treatment, jadwal janji temu, dan konfirmasi uang muka (DP).
              </div>
            </div>
          </div>
        }
        modal
        style={{ width: '100%', maxWidth: '1280px' }}
        breakpoints={{ '1280px': '95vw', '960px': '98vw', '641px': '100vw' }}
        contentClassName="p-2 sm:p-3"
        className="p-dialog-custom"
      >
        <BuatBookingTab
          toast={toast}
          onSuccessCreated={handleBookingSuccessCreated}
        />
      </Dialog>
    </>
  );
};

export default PendaftaranPasienPage;

'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Divider } from 'primereact/divider';
import { TabView, TabPanel } from 'primereact/tabview';
import { TabPendaftaranLama } from './components/tab_pendaftaran_lama';
import { TabKepemilikanPaket } from './components/TabKepemilikanPaket';
import { PasienFormCard } from './components/PasienFormCard';
import { DaftarBookingTab } from '../booking/components/DaftarBookingTab';
import { BuatBookingTab } from '../booking/components/BuatBookingTab';
import { CalendarPlus } from 'lucide-react';

const PendaftaranPasienPage = () => {
  const router = useRouter();
  const toast = useRef<Toast>(null);
  const [activeTab, setActiveTab] = useState<number>(0);

  // Dialog & Refresh State untuk Edit Pasien Lama
  const [dialogEditPasienVisible, setDialogEditPasienVisible] = useState(false);
  const [editingPasien, setEditingPasien] = useState<any>(null);
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

  const handleEditPasien = (pasien: any) => {
    setEditingPasien(pasien);
    setDialogEditPasienVisible(true);
  };

  const handleCloseDialog = () => {
    setDialogEditPasienVisible(false);
    setEditingPasien(null);
  };

  const handleBookingSuccessCreated = () => {
    setShowBookingCreateModal(false);
    setBookingRefreshTrigger((prev) => prev + 1);
  };

  return (
    <>
      <Toast ref={toast} position="top-right" />

      {/* TAB NAVIGATION: PENDAFTARAN LAYANAN, BOOKING & RESERVASI, KEPEMILIKAN PAKET PASIEN */}
      <TabView
        activeIndex={activeTab}
        onTabChange={(e) => setActiveTab(e.index)}
      >
        {/* TAB 1: PENDAFTARAN LAYANAN & KUNJUNGAN */}
        <TabPanel
          header="Pendaftaran Layanan & Kunjungan"
          leftIcon="pi pi-id-card mr-2"
        >
          {/* CARD TABEL PASIEN LAMA & PILIH LAYANAN */}
          <div className="card border-round-xl p-4 shadow-1 surface-card mb-4 mt-3">
            {/* Page Header */}
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-900 flex align-items-center gap-2 mb-1">
                <i className="pi pi-id-card text-blue-600 text-2xl" />
                Pendaftaran Kunjungan & Layanan Pasien
              </h3>
              <p className="text-500 text-sm m-0">
                Cari pasien terdaftar, pilih layanan/treatment yang diinginkan, dan ambil nomor antrean klinik.
              </p>
            </div>

            {/* Baris Tombol Aksi di bagian paling atas sebelum tabel - Sama persis dengan pola Master Data (Gambar 2) */}
            <div className="flex flex-row flex-wrap align-items-center gap-2 mb-4">
              <Button
                type="button"
                size="small"
                label="Pasien Baru"
                icon="pi pi-plus"
                outlined
                severity="success"
                className="border-round-md font-medium px-3"
                tooltip="Buka Registrasi Pasien Baru"
                tooltipOptions={{ position: 'bottom' }}
                onClick={() => router.push('/pendaftaran-antrean/registrasi-pasien')}
              />
              <Divider layout="vertical" className="m-0 h-2rem" />
              <Button
                type="button"
                size="small"
                label="Cetak"
                icon="pi pi-print"
                outlined
                className="border-round-md font-medium px-3 border-purple-600 text-purple-600"
                tooltip="Cetak Data Pasien"
                tooltipOptions={{ position: 'bottom' }}
                onClick={() => window.print()}
              />
              <Divider layout="vertical" className="m-0 h-2rem" />
              <Button
                type="button"
                size="small"
                label="Refresh"
                icon="pi pi-refresh"
                outlined
                severity="success"
                className="border-round-md font-medium px-3"
                tooltip="Refresh Data Pasien"
                tooltipOptions={{ position: 'bottom' }}
                onClick={() => setRefreshTrigger((prev) => prev + 1)}
              />
            </div>

            {/* DATATABLE PASIEN LAMA DENGAN AKSI PILIH LAYANAN */}
            <TabPendaftaranLama
              toast={toast}
              onEditPasien={handleEditPasien}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </TabPanel>

        {/* TAB 2: BOOKING & RESERVASI (DI SEBELAH KANAN PENDAFTARAN LAYANAN & KUNJUNGAN) */}
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

      {/* DIALOG POPUP EDIT DATA PASIEN */}
      <Dialog
        visible={dialogEditPasienVisible}
        onHide={handleCloseDialog}
        header={
          <div className="flex align-items-center gap-2">
            <i className="pi pi-user-edit text-blue-600 text-xl" />
            <span className="font-bold text-xl">
              {editingPasien ? `Edit Data Pasien (${editingPasien.no_rm})` : 'Edit Data Pasien'}
            </span>
          </div>
        }
        modal
        style={{ width: '100%', maxWidth: '950px' }}
        breakpoints={{ '960px': '95vw', '641px': '100vw' }}
        contentClassName="p-3"
      >
        <PasienFormCard
          initialData={editingPasien}
          onSuccess={() => {
            setRefreshTrigger((prev) => prev + 1);
            handleCloseDialog();
          }}
          onCancel={handleCloseDialog}
          toast={toast}
          submitLabel="Simpan Perubahan"
        />
      </Dialog>

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

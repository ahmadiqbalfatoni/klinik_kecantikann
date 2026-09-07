'use client';

import React, { useRef, useState } from 'react';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Divider } from 'primereact/divider';
import { TabView, TabPanel } from 'primereact/tabview';
import { TabPendaftaran } from './components/tab_pendaftaran';
import { TabPendaftaranLama } from './components/tab_pendaftaran_lama';
import { TabKepemilikanPaket } from './components/TabKepemilikanPaket';
import { StepPilihLayanan } from './components/StepPilihLayanan';
import { KarcisAntrianModal } from './components/dialogs/KarcisAntrianModal';
import { KarcisAntrianLayananModal } from './components/dialogs/KarcisAntrianLayananModal';

const PendaftaranPasienPage = () => {
  const toast = useRef<Toast>(null);
  const [activeTab, setActiveTab] = useState<number>(0);

  // Dialog & Refresh State
  const [dialogPasienBaruVisible, setDialogPasienBaruVisible] = useState(false);
  const [editingPasien, setEditingPasien] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Step Pilih Layanan inline (untuk pasien baru setelah registrasi)
  const [pageStep, setPageStep] = useState<1 | 2>(1);
  const [newPasienData, setNewPasienData] = useState<any>(null);

  // Ticket modals (untuk pasien baru inline)
  const [karcisVisible, setKarcisVisible] = useState(false);
  const [ticketData, setTicketData] = useState<any>(null);
  const [antrianLayananModalVisible, setAntrianLayananModalVisible] = useState(false);
  const [antrianLayananData, setAntrianLayananData] = useState<any>(null);

  const handleOpenPasienBaru = () => {
    setEditingPasien(null);
    setDialogPasienBaruVisible(true);
  };

  const handleEditPasien = (pasien: any) => {
    setEditingPasien(pasien);
    setDialogPasienBaruVisible(true);
  };

  const handleCloseDialog = () => {
    setDialogPasienBaruVisible(false);
    setEditingPasien(null);
  };

  // Dipanggil dari TabPendaftaran ketika form pasien baru sukses
  const handleNewPasienRegistered = (pasienData: any) => {
    handleCloseDialog();
    setNewPasienData(pasienData);
    setPageStep(2);
  };

  // Dipanggil dari StepPilihLayanan inline (pasien baru)
  const handleLayananSuccess = (resultData: any) => {
    if (resultData.antrian_layanan && resultData.antrian_layanan.length > 0) {
      setAntrianLayananData(resultData);
      setAntrianLayananModalVisible(true);
    } else {
      setTicketData({
        no_rm: resultData.no_rm,
        nama: resultData.nama_pasien,
        kode_kunjungan: resultData.kode_kunjungan,
        nomor_antrian: resultData.nomor_antrian_awal,
        kode_antrian: resultData.kode_antrian_awal,
        tanggal_kunjungan: resultData.tanggal_kunjungan,
        jam_datang: resultData.jam_datang,
      });
      setKarcisVisible(true);
    }
    setRefreshTrigger((prev) => prev + 1);
    setPageStep(1);
    setNewPasienData(null);
  };

  // ─── STEP 2: Pilih Layanan inline untuk Pasien Baru ───────────────────────
  if (pageStep === 2 && newPasienData) {
    return (
      <>
        <Toast ref={toast} position="top-right" />

        {/* Header */}
        <div className="card p-4 mb-4 border-round-xl surface-card shadow-1">
          <div className="mb-0 flex align-items-center gap-2">
            <i className="pi pi-id-card text-blue-600 text-3xl" />
            <div>
              <h2 className="text-2xl font-bold text-900 m-0">Pilih Layanan & Treatment</h2>
              <p className="text-color-secondary m-0 text-sm">
                Pasien <strong>{newPasienData.nama}</strong> ({newPasienData.no_rm}) — pilih layanan atau paket untuk kunjungan ini.
              </p>
            </div>
          </div>
        </div>

        {/* Inline StepPilihLayanan — sama dengan pasien lama */}
        <div className="card border-round-xl p-4 shadow-1 surface-card mb-4">
          <StepPilihLayanan
            pasienData={newPasienData}
            toast={toast}
            onSuccess={handleLayananSuccess}
            onBack={() => {
              setPageStep(1);
              setNewPasienData(null);
            }}
          />
        </div>

        <KarcisAntrianModal
          visible={karcisVisible}
          onHide={() => setKarcisVisible(false)}
          data={ticketData}
        />
        <KarcisAntrianLayananModal
          visible={antrianLayananModalVisible}
          onHide={() => setAntrianLayananModalVisible(false)}
          data={antrianLayananData}
        />
      </>
    );
  }

  // ─── STEP 1: Halaman Utama Pendaftaran ─────────────────────────────────────
  return (
    <>
      <Toast ref={toast} position="top-right" />

      {/* TAB NAVIGATION: PENDAFTARAN PASIEN & KEPEMILIKAN PAKET PASIEN */}
      <TabView activeIndex={activeTab} onTabChange={(e) => setActiveTab(e.index)} className="custom-pendaftaran-tabview">
        <TabPanel
          header={
            <span className="flex align-items-center gap-2 font-bold px-1">
              <i className="pi pi-id-card text-lg" />
              Pendaftaran Kunjungan Pasien
            </span>
          }
        >
          {/* CARD TABEL PASIEN LAMA DENGAN POLA KONSISTEN MASTER DATA */}
          <div className="card border-round-xl p-4 shadow-1 surface-card mb-4 mt-3">
            {/* Page Header */}
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-900 flex align-items-center gap-2 mb-1">
                <i className="pi pi-id-card text-blue-600 text-2xl" />
                Pendaftaran Kunjungan Pasien
              </h3>
              <p className="text-500 text-sm m-0">
                Cari data pasien terdaftar (Pasien Lama) atau buka registrasi rekam medis untuk Pasien Baru.
              </p>
            </div>

            {/* Baris Tombol Aksi di bagian paling atas sebelum tabel */}
            <div className="flex flex-row flex-wrap align-items-center gap-2 mb-4">
              <Button
                size="small"
                label="Pasien Baru"
                icon="pi pi-plus"
                outlined
                severity="success"
                className="border-round-md font-medium px-3"
                onClick={handleOpenPasienBaru}
              />
              <Divider layout="vertical" className="m-0 h-2rem" />
              <Button
                size="small"
                label="Refresh"
                icon="pi pi-refresh"
                outlined
                severity="success"
                className="border-round-md font-medium px-3"
                onClick={() => setRefreshTrigger((prev) => prev + 1)}
              />
            </div>

            {/* DATATABLE PASIEN LAMA */}
            <TabPendaftaranLama
              toast={toast}
              onEditPasien={handleEditPasien}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </TabPanel>

        <TabPanel
          header={
            <span className="flex align-items-center gap-2 font-bold px-1">
              <i className="pi pi-box text-lg text-amber-600" />
              Data Kepemilikan Paket Pasien
            </span>
          }
        >
          <TabKepemilikanPaket toast={toast} refreshTrigger={refreshTrigger} />
        </TabPanel>
      </TabView>

      {/* 3. DIALOG POPUP FORM PASIEN BARU — setelah sukses, step pilih layanan inline */}
      <Dialog
        visible={dialogPasienBaruVisible}
        onHide={handleCloseDialog}
        header={
          <div className="flex align-items-center gap-2">
            <i className="pi pi-user-plus text-blue-600 text-xl" />
            <span className="font-bold text-xl">
              {editingPasien ? `Edit Data Pasien (${editingPasien.no_rm})` : 'Form Pendaftaran Pasien Baru'}
            </span>
          </div>
        }
        modal
        style={{ width: '100%', maxWidth: '950px' }}
        breakpoints={{ '960px': '95vw', '641px': '100vw' }}
        contentClassName="p-3"
      >
        <TabPendaftaran
          toast={toast}
          editingPasien={editingPasien}
          onCancelEdit={handleCloseDialog}
          onRegistrationSuccess={handleNewPasienRegistered}
          onRefreshVisits={() => {
            setRefreshTrigger((prev) => prev + 1);
            handleCloseDialog();
          }}
        />
      </Dialog>
    </>
  );
};

export default PendaftaranPasienPage;

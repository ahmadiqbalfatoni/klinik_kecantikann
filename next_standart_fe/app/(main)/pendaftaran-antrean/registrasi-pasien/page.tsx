'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Tag } from 'primereact/tag';
import Link from 'next/link';
import { PasienFormCard, PasienFormData } from '../pendaftaran-pasien/components/PasienFormCard';

const RegistrasiPasienPage = () => {
  const router = useRouter();
  const toast = useRef<Toast>(null);

  // Key untuk mereset PasienFormCard setelah registrasi sukses
  const [formKey, setFormKey] = useState<number>(1);
  const [successDialogVisible, setSuccessDialogVisible] = useState<boolean>(false);
  const [newPatientData, setNewPatientData] = useState<any>(null);

  const handleRegistrationSuccess = (resultData: any) => {
    setNewPatientData(resultData);
    setSuccessDialogVisible(true);
  };

  const handleRegisterAnother = () => {
    setSuccessDialogVisible(false);
    setNewPatientData(null);
    setFormKey((prev) => prev + 1);
  };

  const handleProceedToLayanan = () => {
    setSuccessDialogVisible(false);
    // Arahkan ke halaman pendaftaran pasien (pilih layanan)
    router.push('/pendaftaran-antrean/pendaftaran-pasien');
  };

  return (
    <div className="layout-registrasi-pasien">
      <Toast ref={toast} position="top-right" />

      {/* HEADER SECTION */}
      <div className="card p-4 mb-4 border-round-xl surface-card shadow-1 border-1 surface-border">
        <div className="flex flex-column md:flex-row md:align-items-center md:justify-content-between gap-3">
          <div className="flex align-items-center gap-3">
            <div
              className="flex align-items-center justify-content-center border-round-xl"
              style={{
                width: '3.5rem',
                height: '3.5rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              }}
            >
              <i className="pi pi-user-plus text-white text-2xl" />
            </div>
            <div>
              <div className="flex align-items-center gap-2 mb-1">
                <h2 className="text-2xl font-bold text-900 m-0">Registrasi Pasien Baru</h2>
                <Tag severity="success" value="Formulir Pasien Baru" className="text-xs px-2" />
              </div>
              <p className="text-color-secondary m-0 text-sm">
                Pendaftaran rekam medis dan data profil identitas pasien baru klinik kecantikan.
              </p>
            </div>
          </div>

          <div className="flex align-items-center gap-2">
            <Link href="/pendaftaran-antrean/pendaftaran-pasien">
              <Button
                type="button"
                size="small"
                label="Pendaftaran Layanan"
                icon="pi pi-arrow-right"
                iconPos="right"
                outlined
                severity="secondary"
                className="border-round-lg text-sm"
              />
            </Link>
          </div>
        </div>
      </div>


      {/* CARD UTAMA FORMULIR PASIEN BARU */}
      <div className="card border-round-xl p-4 shadow-1 surface-card border-1 surface-border mb-4">
        <PasienFormCard
          key={formKey}
          onSuccess={handleRegistrationSuccess}
          toast={toast}
          submitLabel="Daftarkan Pasien Baru"
        />
      </div>

      {/* MODAL SUKSES REGISTRASI PASIEN BARU */}
      <Dialog
        visible={successDialogVisible}
        onHide={() => setSuccessDialogVisible(false)}
        modal
        closable={false}
        style={{ width: '100%', maxWidth: '520px' }}
        breakpoints={{ '960px': '90vw', '641px': '95vw' }}
        className="p-dialog-custom"
      >
        <div className="p-4 text-center">
          <div
            className="flex align-items-center justify-content-center border-round-circle mx-auto mb-3"
            style={{
              width: '4.5rem',
              height: '4.5rem',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
            }}
          >
            <i className="pi pi-check text-white text-3xl font-bold" />
          </div>

          <h3 className="text-xl font-bold text-900 m-0 mb-1">Registrasi Pasien Berhasil!</h3>
          <p className="text-500 text-sm m-0 mb-4">
            Data pasien baru telah resmi tersimpan di rekam medis klinik.
          </p>

          {/* KARTU IDENTITAS NO RM */}
          {newPatientData && (
            <div className="p-3 border-round-xl bg-gray-50 border-1 surface-border text-left mb-4">
              <div className="flex align-items-center justify-content-between mb-2 pb-2 border-bottom-1 surface-border">
                <span className="text-xs text-500 uppercase font-semibold">Nomor Rekam Medis (No. RM)</span>
                <span className="font-mono font-bold text-lg text-emerald-700">
                  {newPatientData.no_rm || '-'}
                </span>
              </div>
              <div className="grid text-sm m-0">
                <div className="col-12 py-1 flex justify-content-between">
                  <span className="text-500">Nama Pasien:</span>
                  <span className="font-semibold text-900">{newPatientData.nama || '-'}</span>
                </div>
                {newPatientData.nik && (
                  <div className="col-12 py-1 flex justify-content-between">
                    <span className="text-500">NIK:</span>
                    <span className="font-mono text-700">{newPatientData.nik}</span>
                  </div>
                )}
                {newPatientData.no_hp && (
                  <div className="col-12 py-1 flex justify-content-between">
                    <span className="text-500">WhatsApp / HP:</span>
                    <span className="font-medium text-700">{newPatientData.no_hp}</span>
                  </div>
                )}
                {newPatientData.jenis_kelamin && (
                  <div className="col-12 py-1 flex justify-content-between">
                    <span className="text-500">Jenis Kelamin:</span>
                    <span className="text-700">
                      {newPatientData.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TOMBOL AKSI */}
          <div className="flex flex-column sm:flex-row gap-2">
            <Button
              type="button"
              label="Daftarkan Pasien Baru Lagi"
              icon="pi pi-user-plus"
              outlined
              severity="secondary"
              className="flex-1 border-round-lg font-medium"
              onClick={handleRegisterAnother}
            />
            <Button
              type="button"
              label="Lanjut Pilih Layanan"
              icon="pi pi-arrow-right"
              iconPos="right"
              severity="success"
              className="flex-1 border-round-lg font-bold"
              onClick={handleProceedToLayanan}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default RegistrasiPasienPage;

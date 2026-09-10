'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Tag } from 'primereact/tag';
import { DataTable, DataTableStateEvent } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputText } from 'primereact/inputtext';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { Divider } from 'primereact/divider';
import postData from '@/lib/axios/postData';
import { showError, showSuccess } from '@/lib/tools/generalTools';
import { PasienFormCard } from '../pendaftaran-pasien/components/PasienFormCard';

export interface Pasien {
  id: number;
  no_rm: string;
  nama: string;
  nik?: string;
  no_hp?: string;
  tanggal_lahir?: string;
  jenis_kelamin?: string;
  golongan_darah?: string;
  agama?: string;
  status_perkawinan?: string;
  kewarganegaraan?: string;
  pekerjaan?: string;
  provinsi?: string;
  kota_kabupaten?: string;
  kecamatan?: string;
  kelurahan_desa?: string;
  patokan?: string;
  alergi?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

const RegistrasiPasienPage = () => {
  const toast = useRef<Toast>(null);

  // Table & Pagination State
  const [data, setData] = useState<Pasien[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(10);
  const [first, setFirst] = useState(0);
  const [searchVal, setSearchVal] = useState('');
  const [keyword, setKeyword] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Modal / Dialog States
  const [dialogTambahPasienVisible, setDialogTambahPasienVisible] = useState<boolean>(false);
  const [dialogEditPasienVisible, setDialogEditPasienVisible] = useState<boolean>(false);
  const [editingPasien, setEditingPasien] = useState<Pasien | null>(null);
  const [detailPasien, setDetailPasien] = useState<Pasien | null>(null);
  const [successDialogVisible, setSuccessDialogVisible] = useState<boolean>(false);
  const [newPatientData, setNewPatientData] = useState<any>(null);

  // Key untuk mereset form tambah saat dibuka ulang
  const [formKey, setFormKey] = useState<number>(1);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const fetchPasienData = async () => {
    setLoading(true);
    try {
      const payload = {
        page,
        perPage: rows,
        keyword: keyword.trim(),
      };

      const res = await postData('/master/pendaftaran-pasien-cari', payload);
      if (['00', '0000', 200].includes(res.data.status) || res.status === 200) {
        setData(res.data.data || []);
        setTotalRecords(res.data.total_data || 0);
      } else {
        showError(toast, res.data.message || 'Gagal memuat data pasien');
      }
    } catch (error: any) {
      showError(toast, 'Terjadi kesalahan saat memuat master data pasien');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPasienData();
  }, [page, rows, keyword, refreshTrigger]);

  const onPageChange = (event: DataTableStateEvent) => {
    setFirst(event.first);
    setRows(event.rows);
    setPage((event.page || 0) + 1);
  };

  const handleSearchChange = (val: string) => {
    setSearchVal(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setKeyword(val);
      setPage(1);
      setFirst(0);
    }, 300);
  };

  const handleClearSearch = () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setSearchVal('');
    setKeyword('');
    setPage(1);
    setFirst(0);
  };

  // Tambah Pasien Baru Handlers
  const handleOpenTambahModal = () => {
    setFormKey((prev) => prev + 1);
    setDialogTambahPasienVisible(true);
  };

  const handleRegistrationSuccess = (resultData: any) => {
    setDialogTambahPasienVisible(false);
    setNewPatientData(resultData);
    setSuccessDialogVisible(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleRegisterAnother = () => {
    setSuccessDialogVisible(false);
    setNewPatientData(null);
    setFormKey((prev) => prev + 1);
    setDialogTambahPasienVisible(true);
  };

  // Edit Pasien Handlers
  const handleEditPasien = (pasien: Pasien) => {
    setEditingPasien(pasien);
    setDialogEditPasienVisible(true);
  };

  const handleEditSuccess = () => {
    setDialogEditPasienVisible(false);
    setEditingPasien(null);
    setRefreshTrigger((prev) => prev + 1);
    showSuccess(toast, 'Data pasien berhasil diperbarui');
  };

  // DataTable Template
  const noRmBodyTemplate = (rowData: Pasien) => {
    return <span className="font-bold text-900 font-mono">{rowData.no_rm}</span>;
  };

  const jenisKelaminBodyTemplate = (rowData: Pasien) => {
    if (!rowData.jenis_kelamin) return <span className="text-400 font-italic">-</span>;
    const isMale = rowData.jenis_kelamin === 'L';
    return (
      <Tag
        value={isMale ? 'Laki-Laki' : 'Perempuan'}
        severity={isMale ? 'warning' : 'success'}
        className="text-xs px-2 py-1"
      />
    );
  };

  const actionBodyTemplate = (rowData: Pasien) => {
    return (
      <div className="flex align-items-center justify-content-center gap-1">
        <Button
          icon="pi pi-eye"
          size="small"
          outlined
          severity="info"
          className="p-button-sm border-round-md"
          onClick={(e) => {
            e.stopPropagation();
            setDetailPasien(rowData);
          }}
          tooltip="Lihat Detail Profil Pasien"
          tooltipOptions={{ position: 'top' }}
        />
        <Button
          icon="pi pi-pencil"
          size="small"
          outlined
          severity="warning"
          className="p-button-sm border-round-md"
          onClick={(e) => {
            e.stopPropagation();
            handleEditPasien(rowData);
          }}
          tooltip="Edit Data Pasien"
          tooltipOptions={{ position: 'top' }}
        />
      </div>
    );
  };

  const headerTableTemplate = (
    <div className="flex flex-wrap align-items-center justify-content-between gap-3">
      <span className="text-xl font-bold text-900">Daftar Pasien Terdaftar</span>
      <div className="flex align-items-center gap-2 ml-auto w-full md:w-auto">
        <IconField iconPosition="left" className="w-full md:w-22rem">
          <InputIcon className="pi pi-search" />
          <InputText
            value={searchVal}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                setKeyword(searchVal);
                setPage(1);
                setFirst(0);
              }
            }}
            placeholder="Cari Nama, No. RM, No. HP, atau NIK..."
            className="w-full text-sm"
          />
        </IconField>
        <Button
          type="button"
          icon="pi pi-filter-slash"
          outlined
          severity="danger"
          tooltip="Reset Filter"
          tooltipOptions={{ position: 'bottom' }}
          onClick={handleClearSearch}
        />
      </div>
    </div>
  );

  return (
    <div className="layout-registrasi-pasien">
      <Toast ref={toast} position="top-right" />

      {/* HEADER SECTION */}
      <div className="card p-4 mb-4 border-round-xl surface-card shadow-1 border-1 surface-border">
        <div className="flex flex-column md:flex-row md:align-items-center md:justify-content-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-900 m-0 flex align-items-center gap-2 mb-1">
              <i className="pi pi-user-plus text-teal-600 text-2xl" />
              Pasien Baru
            </h2>
            <p className="text-color-secondary m-0 text-sm">
              Pusat data pasien terdaftar dan formulir pendaftaran identitas pasien baru klinik kecantikan.
            </p>
          </div>
        </div>
      </div>

      {/* CARD UTAMA: ACTION BAR & DATATABLE PASIEN */}
      <div className="card border-round-xl p-4 shadow-1 surface-card border-1 surface-border mb-4">
        {/* BARIS TOMBOL AKSI: TAMBAH PASIEN BARU, CETAK, REFRESH */}
        <div className="flex flex-row flex-wrap align-items-center gap-2 mb-4">
          <Button
            type="button"
            size="small"
            label="Baru"
            icon="pi pi-plus"
            outlined
            severity="success"
            className="border-round-md font-medium px-3"
            tooltip="Tambah Pasien Baru"
            tooltipOptions={{ position: 'bottom' }}
            onClick={handleOpenTambahModal}
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

        {/* TABEL DATA PASIEN */}
        <DataTable
          value={data}
          scrollable
          lazy
          paginator
          first={first}
          rows={rows}
          totalRecords={totalRecords}
          onPage={onPageChange}
          header={headerTableTemplate}
          loading={loading}
          dataKey="no_rm"
          emptyMessage="Data Pasien Tidak Ditemukan"
          rowsPerPageOptions={[10, 25, 50]}
          rowHover
          onRowClick={(e) => setDetailPasien(e.data as Pasien)}
          style={{ cursor: 'pointer' }}
          paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
          currentPageReportTemplate="Menampilkan {first} - {last} dari {totalRecords} data pasien"
        >
          <Column field="no_rm" header="No. RM" body={noRmBodyTemplate} align="center" sortable style={{ minWidth: '8rem' }} />
          <Column field="nama" header="Nama Pasien" className="font-bold text-900" sortable style={{ minWidth: '13rem' }} />
          <Column field="nik" header="NIK" align="center" style={{ minWidth: '10rem' }} body={(r: Pasien) => r.nik || '-'} />
          <Column field="no_hp" header="No. HP" align="center" style={{ minWidth: '10rem' }} body={(r: Pasien) => r.no_hp || '-'} />
          <Column field="tanggal_lahir" header="Tgl Lahir" align="center" style={{ minWidth: '8rem' }} body={(r: Pasien) => r.tanggal_lahir || '-'} />
          <Column header="L/P" body={jenisKelaminBodyTemplate} align="center" style={{ minWidth: '7rem' }} />
          <Column field="kota_kabupaten" header="Kota / Alamat" style={{ minWidth: '12rem' }} body={(r: Pasien) => r.kota_kabupaten || r.provinsi || '-'} />
          <Column header="Aksi" body={actionBodyTemplate} align="center" style={{ minWidth: '7rem' }} />
        </DataTable>
      </div>

      {/* POPUP MODAL DIALOG: TAMBAH PASIEN BARU */}
      <Dialog
        visible={dialogTambahPasienVisible}
        onHide={() => setDialogTambahPasienVisible(false)}
        header={
          <div className="flex align-items-center gap-2">
            <i className="pi pi-user-plus text-teal-600 text-xl" />
            <div>
              <div className="font-bold text-lg text-900 leading-tight">Formulir Pasien Baru</div>
              <div className="text-xs text-500 font-normal">
                Pendaftaran identitas, data profil, dan rekam medis pasien baru.
              </div>
            </div>
          </div>
        }
        modal
        style={{ width: '100%', maxWidth: '980px' }}
        breakpoints={{ '960px': '95vw', '641px': '100vw' }}
        contentClassName="p-3"
      >
        <PasienFormCard
          key={formKey}
          onSuccess={handleRegistrationSuccess}
          onCancel={() => setDialogTambahPasienVisible(false)}
          toast={toast}
          submitLabel="Daftarkan Pasien Baru"
          hidePilihLayanan={true}
          hideHeader={true}
        />
      </Dialog>

      {/* POPUP MODAL DIALOG: EDIT DATA PASIEN */}
      <Dialog
        visible={dialogEditPasienVisible}
        onHide={() => {
          setDialogEditPasienVisible(false);
          setEditingPasien(null);
        }}
        header={
          <div className="flex align-items-center gap-2">
            <i className="pi pi-user-edit text-blue-600 text-xl" />
            <div>
              <div className="font-bold text-lg text-900 leading-tight">
                {editingPasien ? `Edit Data Pasien (${editingPasien.no_rm})` : 'Edit Data Pasien'}
              </div>
              <div className="text-xs text-500 font-normal">
                Perbarui data profil dan identitas rekam medis pasien.
              </div>
            </div>
          </div>
        }
        modal
        style={{ width: '100%', maxWidth: '980px' }}
        breakpoints={{ '960px': '95vw', '641px': '100vw' }}
        contentClassName="p-3"
      >
        <PasienFormCard
          initialData={editingPasien}
          onSuccess={handleEditSuccess}
          onCancel={() => {
            setDialogEditPasienVisible(false);
            setEditingPasien(null);
          }}
          toast={toast}
          submitLabel="Simpan Perubahan"
          hidePilihLayanan={true}
          hideHeader={true}
        />
      </Dialog>

      {/* DIALOG DETAIL PASIEN (HANYA BISA MELIHAT SAJA / VIEW ONLY) */}
      <Dialog
        visible={Boolean(detailPasien)}
        onHide={() => setDetailPasien(null)}
        header={`Detail Profil Pasien — ${detailPasien?.nama || ''}`}
        modal
        style={{ width: '100%', maxWidth: '600px' }}
        breakpoints={{ '641px': '90vw' }}
        footer={
          <div className="flex flex-wrap justify-content-end gap-2 pt-2">
            <Button
              label="Tutup"
              icon="pi pi-times"
              severity="secondary"
              outlined
              onClick={() => setDetailPasien(null)}
            />
          </div>
        }
      >
        {detailPasien && (
          <div className="grid text-sm p-2 gap-y-3">
            <div className="col-12 md:col-6">
              <span className="text-color-secondary block text-xs">No. Rekam Medis (RM)</span>
              <strong className="text-base text-emerald-700 font-mono">{detailPasien.no_rm}</strong>
            </div>
            <div className="col-12 md:col-6">
              <span className="text-color-secondary block text-xs">Nama Lengkap</span>
              <strong className="text-base">{detailPasien.nama}</strong>
            </div>

            <div className="col-12 md:col-6">
              <span className="text-color-secondary block text-xs">NIK</span>
              <span className="font-mono">{detailPasien.nik || '-'}</span>
            </div>
            <div className="col-12 md:col-6">
              <span className="text-color-secondary block text-xs">No. Handphone (WhatsApp)</span>
              <span>{detailPasien.no_hp || '-'}</span>
            </div>

            <div className="col-12 md:col-6">
              <span className="text-color-secondary block text-xs">Tanggal Lahir</span>
              <span>{detailPasien.tanggal_lahir || '-'}</span>
            </div>
            <div className="col-12 md:col-6">
              <span className="text-color-secondary block text-xs">Jenis Kelamin</span>
              <span>{detailPasien.jenis_kelamin === 'L' ? 'Laki-Laki' : detailPasien.jenis_kelamin === 'P' ? 'Perempuan' : '-'}</span>
            </div>

            <div className="col-12 md:col-6">
              <span className="text-color-secondary block text-xs">Golongan Darah</span>
              <span>{detailPasien.golongan_darah || '-'}</span>
            </div>
            <div className="col-12 md:col-6">
              <span className="text-color-secondary block text-xs">Agama</span>
              <span>{detailPasien.agama || '-'}</span>
            </div>

            <div className="col-12 md:col-6">
              <span className="text-color-secondary block text-xs">Status Perkawinan</span>
              <span>{detailPasien.status_perkawinan || '-'}</span>
            </div>
            <div className="col-12 md:col-6">
              <span className="text-color-secondary block text-xs">Kewarganegaraan</span>
              <span>{detailPasien.kewarganegaraan || '-'}</span>
            </div>

            <div className="col-12 md:col-6">
              <span className="text-color-secondary block text-xs">Pekerjaan</span>
              <span>{detailPasien.pekerjaan || '-'}</span>
            </div>
            <div className="col-12 md:col-6">
              <span className="text-color-secondary block text-xs">Kota / Alamat</span>
              <span>{detailPasien.kota_kabupaten || detailPasien.provinsi || '-'}</span>
            </div>

            <div className="col-12">
              <span className="text-color-secondary block text-xs">Alamat Lengkap & Patokan</span>
              <span>
                {[detailPasien.kelurahan_desa, detailPasien.kecamatan, detailPasien.kota_kabupaten, detailPasien.provinsi]
                  .filter(Boolean)
                  .join(', ') || '-'}
                {detailPasien.patokan ? ` (${detailPasien.patokan})` : ''}
              </span>
            </div>

            {detailPasien.alergi && (
              <div className="col-12 p-3 surface-100 border-round border-left-4 border-red-500 text-red-700">
                <strong>Riwayat Alergi:</strong> {detailPasien.alergi}
              </div>
            )}
          </div>
        )}
      </Dialog>

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
            className="flex align-items-center justify-content-center border-round-circle mx-auto mb-3 bg-green-50 text-green-600"
            style={{ width: '4rem', height: '4rem' }}
          >
            <i className="pi pi-check text-2xl font-bold" />
          </div>

          <h3 className="text-xl font-bold text-900 m-0 mb-1">Pasien Baru Berhasil Didaftarkan!</h3>
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
              label="Selesai"
              icon="pi pi-check"
              severity="success"
              className="flex-1 border-round-lg font-bold"
              onClick={() => setSuccessDialogVisible(false)}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default RegistrasiPasienPage;

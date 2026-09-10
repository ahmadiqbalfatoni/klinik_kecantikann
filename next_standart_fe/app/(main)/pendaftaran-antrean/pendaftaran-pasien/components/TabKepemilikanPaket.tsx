'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { Tag } from 'primereact/tag';
import { ProgressBar } from 'primereact/progressbar';
import { Dialog } from 'primereact/dialog';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import postData from '@/lib/axios/postData';
import { showError, showSuccess } from '@/lib/tools/generalTools';
import { apiPasienKepemilikanPaket, apiPasienAmbilAntrianLayanan } from './endpoints';
import { KarcisAntrianLayananModal } from './dialogs/KarcisAntrianLayananModal';
import { Package } from 'lucide-react';

interface DetailKepemilikan {
  kode_detail_kepemilikan_paket_layanan: string;
  kode_layanan: string;
  nama_layanan: string;
  sesi_total: number;
  sesi_terpakai: number;
  sisa_sesi: number;
  tipe?: string;
  wajib_konsultasi?: string;
  kode_ruangan?: string;
  nama_ruangan?: string;
  durasi_menit?: number;
}

interface KepemilikanPaket {
  id: number;
  kode_kepemilikan_paket_layanan: string;
  no_rm: string;
  nama_pasien: string;
  no_hp_pasien?: string;
  kode_paket_layanan: string;
  nama_paket: string;
  tipe_paket?: string;
  kode_ruangan_paket?: string;
  nama_ruangan_paket?: string;
  tanggal_beli: string;
  tanggal_expired: string;
  status: 'aktif' | 'habis' | 'expired' | string;
  total_sesi: number;
  total_terpakai: number;
  sisa_sesi: number;
  details: DetailKepemilikan[];
}

interface TabKepemilikanPaketProps {
  toast?: any;
  refreshTrigger?: number;
}

export const TabKepemilikanPaket: React.FC<TabKepemilikanPaketProps> = ({ toast, refreshTrigger = 0 }) => {
  const [dataList, setDataList] = useState<KepemilikanPaket[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  const [page, setPage] = useState<number>(1);
  const [rows, setRows] = useState<number>(10);
  const [first, setFirst] = useState<number>(0);

  const [searchVal, setSearchVal] = useState<string>('');
  const [appliedKeyword, setAppliedKeyword] = useState<string>('');

  const [selectedItem, setSelectedItem] = useState<KepemilikanPaket | null>(null);
  const [dialogDetailVisible, setDialogDetailVisible] = useState<boolean>(false);

  // State Modal Klaim Sesi Paket (dengan opsi konsultasi)
  const [claimDialogVisible, setClaimDialogVisible] = useState<boolean>(false);
  const [claimTargetItem, setClaimTargetItem] = useState<KepemilikanPaket | null>(null);
  const [claimTargetDetail, setClaimTargetDetail] = useState<DetailKepemilikan | null>(null);
  const [claimConsultChoice, setClaimConsultChoice] = useState<boolean>(true);
  const [submittingClaim, setSubmittingClaim] = useState<boolean>(false);

  const [antrianLayananModalVisible, setAntrianLayananModalVisible] = useState(false);
  const [antrianLayananData, setAntrianLayananData] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await postData(apiPasienKepemilikanPaket, {
        page,
        perPage: rows,
        keyword: appliedKeyword.trim(),
      });

      if (['00', '0000'].includes(res.data.status)) {
        setDataList(res.data.data || []);
        setTotalRecords(res.data.total_data || 0);
      } else {
        showError(toast, res.data.message || 'Gagal memuat data kepemilikan paket');
      }
    } catch (err: any) {
      showError(toast, err?.response?.data?.message || 'Terjadi kesalahan sistem saat memuat data paket pasien');
    } finally {
      setLoading(false);
    }
  }, [page, rows, appliedKeyword, toast]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = (val: string) => {
    setSearchVal(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      setFirst(0);
      setAppliedKeyword(val);
    }, 300);
  };

  const handleClearSearch = () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setSearchVal('');
    setAppliedKeyword('');
    setPage(1);
    setFirst(0);
  };

  const handleOpenDetail = (item: KepemilikanPaket) => {
    setSelectedItem(item);
    setDialogDetailVisible(true);
  };

  const handleOpenClaimDialog = (item: KepemilikanPaket, detailItem?: DetailKepemilikan) => {
    const targetDetail = detailItem || (item.details || []).find((d) => d.sisa_sesi > 0) || item.details?.[0];
    if (!targetDetail || targetDetail.sisa_sesi <= 0) {
      showError(toast, 'Sesi layanan paket ini sudah habis');
      return;
    }
    setClaimTargetItem(item);
    setClaimTargetDetail(targetDetail);
    setClaimConsultChoice(true); // default Ya
    setClaimDialogVisible(true);
  };

  const handleExecuteClaim = async () => {
    if (!claimTargetItem || !claimTargetDetail) return;

    // Tipe PAKET adalah sumber kebenaran tunggal untuk aturan konsultasi
    // wajib_konsultasi dari detail layanan komponen DIABAIKAN untuk klaim paket
    const tipePaket = (claimTargetItem.tipe_paket || '').toString().trim().toUpperCase();
    // Tentukan wajibKon hanya dari tipePaket
    const wajibKon: string = tipePaket === 'MEDICAL TREATMENT' ? 'wajib'
      : tipePaket === 'SERVICE TREATMENT' ? 'tidak'
      : 'opsional';

    // Tentukan pilihan konsultasi:
    // - BEAUTY TREATMENT (opsional): IKUTI PILIHAN USER (claimConsultChoice)
    // - MEDICAL TREATMENT: selalu konsultasi
    // - SERVICE TREATMENT: tidak pernah konsultasi
    let chooseConsult: boolean;
    if (wajibKon === 'wajib') {
      chooseConsult = true;
    } else if (wajibKon === 'tidak') {
      chooseConsult = false;
    } else {
      // OPSIONAL (BEAUTY TREATMENT): ikuti pilihan user di dialog
      chooseConsult = claimConsultChoice === true;
    }

    setSubmittingClaim(true);
    try {
      const res = await postData(apiPasienAmbilAntrianLayanan, {
        no_rm: claimTargetItem.no_rm,
        items: [
          {
            jenis_layanan: 'klaim_paket',
            kode_layanan: claimTargetDetail.kode_layanan,
            kode_ruangan: claimTargetDetail.kode_ruangan || claimTargetItem.kode_ruangan_paket,
            nama_ruangan: claimTargetDetail.nama_ruangan || claimTargetItem.nama_ruangan_paket,
            butuh_konsul: chooseConsult,
            wajib_konsultasi: wajibKon,
            lewat_konsultasi: chooseConsult,
            kode_kepemilikan_paket_layanan: claimTargetItem.kode_kepemilikan_paket_layanan,
          },
        ],
      });

      if (['00', '0000'].includes(res.data.status)) {
        showSuccess(toast, res.data.message || 'Klaim sesi berhasil diterbitkan');
        setAntrianLayananData(res.data.data);
        setAntrianLayananModalVisible(true);
        setClaimDialogVisible(false);
        setDialogDetailVisible(false);
        loadData();
      } else {
        showError(toast, res.data.message || 'Gagal mengklaim sesi paket');
      }
    } catch (error: any) {
      showError(toast, error?.response?.data?.message || 'Terjadi kesalahan saat klaim sesi paket');
    } finally {
      setSubmittingClaim(false);
    }
  };

  const getStatusColor = (status: string) => {
    const st = (status || '').toLowerCase();
    if (st === 'aktif') return '#22c55e';
    if (st === 'habis') return '#f59e0b';
    if (st === 'expired') return '#ef4444';
    return '#94a3b8';
  };

  // Column templates matching Pendaftaran Pasien table
  const noRmBodyTemplate = (rowData: KepemilikanPaket) => (
    <span className="font-bold text-900">{rowData.no_rm}</span>
  );

  const pasienBodyTemplate = (rowData: KepemilikanPaket) => (
    <div>
      <span className="font-bold text-900 block text-sm">{rowData.nama_pasien || '-'}</span>
      {rowData.no_hp_pasien && <span className="text-xs text-500 block">HP: {rowData.no_hp_pasien}</span>}
    </div>
  );

  const paketBodyTemplate = (rowData: KepemilikanPaket) => (
    <div>
      <span className="font-bold text-900 block text-sm">{rowData.nama_paket || rowData.kode_paket_layanan}</span>
      <span className="text-xs text-500 font-mono block">Kode: {rowData.kode_kepemilikan_paket_layanan}</span>
    </div>
  );

  const progresSesiTemplate = (rowData: KepemilikanPaket) => {
    const total = rowData.total_sesi || 1;
    const terpakai = rowData.total_terpakai || 0;
    const percent = Math.min(100, Math.round((terpakai / total) * 100));

    return (
      <div className="w-full max-w-12rem">
        <div className="flex justify-content-between text-xs font-semibold mb-1">
          <span>{terpakai} / {total} Sesi Terpakai</span>
          <span>{percent}%</span>
        </div>
        <ProgressBar value={percent} showValue={false} style={{ height: '7px' }} color={percent === 100 ? '#ef4444' : '#3b82f6'} />
      </div>
    );
  };

  const sisaSesiTemplate = (rowData: KepemilikanPaket) => {
    const sisa = rowData.sisa_sesi;
    let severity: 'success' | 'warning' | 'danger' = 'success';
    if (sisa === 0) severity = 'danger';
    else if (sisa === 1) severity = 'warning';

    return <Tag value={`${sisa} Sesi Tersisa`} severity={severity} className="font-bold text-xs px-2 py-1 border-round-md" />;
  };

  const tanggalBodyTemplate = (rowData: KepemilikanPaket) => (
    <div className="text-xs">
      <span className="text-500 block">Beli: {rowData.tanggal_beli || '-'}</span>
      <span className="font-bold text-900 block">Expired: {rowData.tanggal_expired || '-'}</span>
    </div>
  );



  const actionBodyTemplate = (rowData: KepemilikanPaket) => (
    <div className="flex align-items-center justify-content-center gap-1">
      {rowData.status === 'aktif' && rowData.sisa_sesi > 0 && (
        <Button
          icon="pi pi-ticket"
          label="Klaim Sesi"
          size="small"
          severity="success"
          className="text-xs font-bold border-round-md"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenClaimDialog(rowData);
          }}
        />
      )}
      <Button
        icon="pi pi-eye"
        label="Detail Sesi"
        size="small"
        outlined
        severity="info"
        className="text-xs font-semibold border-round-md"
        onClick={(e) => {
          e.stopPropagation();
          handleOpenDetail(rowData);
        }}
      />
    </div>
  );

  return (
    <>
      <ConfirmDialog />

      <KarcisAntrianLayananModal
        visible={antrianLayananModalVisible}
        onHide={() => setAntrianLayananModalVisible(false)}
        data={antrianLayananData}
      />

      {/* HEADER SECTION */}
      <div className="card surface-card border-1 surface-border border-round-xl p-4 shadow-1 mb-3">
        <div className="flex align-items-center gap-2 mb-1">
          <Package className="text-primary" size={24} />
          <h2 className="text-xl font-bold text-900 m-0">Data Kepemilikan Paket Pasien</h2>
        </div>
        <p className="text-xs text-500 mt-1 mb-0">
          Cari data pasien terdaftar yang memiliki paket layanan aktif atau multi-sesi beserta rincian sisa sesinya.
        </p>
      </div>

      {/* CARD KEPEMILIKAN PAKET DENGAN POLA KONSISTEN MASTER DATA */}
      <div className="card border-round-xl p-4 shadow-1 surface-card mb-4">

        {/* Baris Tombol Aksi di bagian paling atas sebelum tabel */}
        <div className="flex flex-row flex-wrap align-items-center gap-2 mb-4">
          <Button
            size="small"
            label="Refresh"
            icon="pi pi-refresh"
            outlined
            severity="success"
            className="border-round-md font-medium px-3"
            loading={loading}
            onClick={loadData}
          />
        </div>

        {/* DATATABLE */}
        <DataTable
          value={dataList}
          loading={loading}
          lazy
          paginator
          first={first}
          rows={rows}
          totalRecords={totalRecords}
          onPage={(e) => {
            setFirst(e.first);
            setRows(e.rows);
            setPage((e.page || 0) + 1);
          }}
          dataKey="kode_kepemilikan_paket_layanan"
          emptyMessage="Data Kepemilikan Paket Pasien Tidak Ditemukan"
          rowsPerPageOptions={[10, 25, 50]}
          rowHover
          onRowClick={(e) => handleOpenDetail(e.data as KepemilikanPaket)}
          style={{ cursor: 'pointer' }}
          paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
          currentPageReportTemplate="Menampilkan {first} - {last} dari {totalRecords} data kepemilikan paket"
          header={
            <div className="flex flex-column gap-3">
              <div className="flex flex-wrap align-items-center justify-content-between gap-2">
                <span className="text-xl font-bold text-900">Data Kepemilikan Paket</span>
                <div className="flex align-items-center gap-2 ml-auto w-full md:w-auto">
                  <IconField iconPosition="left" className="w-full md:w-20rem">
                    <InputIcon className="pi pi-search" />
                    <InputText
                      value={searchVal}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                          setPage(1);
                          setFirst(0);
                          setAppliedKeyword(searchVal);
                        }
                      }}
                      placeholder="Cari Data..."
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
              <div className="flex flex-wrap align-items-center gap-3 px-2 py-2 border-round-md surface-100 text-xs font-medium text-color-secondary">
                <span className="flex align-items-center gap-1">
                  <i className="pi pi-info-circle" />
                  <span className="font-semibold">KETERANGAN STATUS:</span>
                </span>
                <span className="flex align-items-center gap-1">
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#22c55e', boxShadow: '0 1px 3px #22c55e55' }} />
                  Aktif
                </span>
                <span className="flex align-items-center gap-1">
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#f59e0b', boxShadow: '0 1px 3px #f59e0b55' }} />
                  Habis
                </span>
                <span className="flex align-items-center gap-1">
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#ef4444', boxShadow: '0 1px 3px #ef444455' }} />
                  Expired
                </span>
              </div>
            </div>
          }
        >
          <Column
            header=""
            headerStyle={{ width: '3rem' }}
            align="center"
            body={(r: KepemilikanPaket) => (
              <span
                style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  borderRadius: '3px',
                  backgroundColor: getStatusColor(r.status),
                  boxShadow: `0 1px 3px ${getStatusColor(r.status)}55`,
                }}
                title={`Status: ${(r.status || '').toUpperCase()}`}
              />
            )}
          />
          <Column field="no_rm" header="No. RM" body={noRmBodyTemplate} sortable headerStyle={{ fontWeight: 'bold' }} style={{ minWidth: '8rem' }} />
          <Column field="nama_pasien" header="Nama Pasien" body={pasienBodyTemplate} sortable style={{ minWidth: '12rem' }} />
          <Column field="nama_paket" header="Paket Layanan" body={paketBodyTemplate} sortable style={{ minWidth: '14rem' }} />
          <Column header="Progres Sesi" body={progresSesiTemplate} style={{ minWidth: '12rem' }} />
          <Column header="Sisa Sesi" body={sisaSesiTemplate} align="center" style={{ minWidth: '10rem' }} />
          <Column header="Masa Berlaku" body={tanggalBodyTemplate} align="center" style={{ minWidth: '11rem' }} />
          <Column header="Aksi" body={actionBodyTemplate} align="center" style={{ minWidth: '14rem' }} />
        </DataTable>
      </div>

      {/* DIALOG DETAIL SESI */}
      <Dialog
        visible={dialogDetailVisible}
        onHide={() => setDialogDetailVisible(false)}
        header={
          <div className="flex align-items-center gap-2">
            <i className="pi pi-list text-blue-600 text-xl" />
            <span className="font-bold text-lg">Rincian Sesi Layanan Paket</span>
          </div>
        }
        modal
        style={{ width: '100%', maxWidth: '650px' }}
      >
        {selectedItem && (
          <div className="flex flex-column gap-3 py-1">
            <div className="surface-100 p-3 border-round-xl border-1 surface-border flex justify-content-between align-items-center">
              <div>
                <span className="text-xs text-500 block">Pasien</span>
                <span className="font-bold text-900 text-base">{selectedItem.nama_pasien}</span>
                <span className="text-xs text-blue-600 block font-medium">No. RM: {selectedItem.no_rm}</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-500 block">Paket</span>
                <span className="font-bold text-amber-700 block">{selectedItem.nama_paket}</span>
                <Tag value={selectedItem.status.toUpperCase()} severity={selectedItem.status === 'aktif' ? 'success' : 'danger'} className="text-[10px] mt-1 font-bold" />
              </div>
            </div>

            <h5 className="font-bold text-sm text-900 m-0 mb-1">Rincian Sesi Per Layanan:</h5>
            <DataTable value={selectedItem.details} className="p-datatable-sm" responsiveLayout="scroll">
              <Column field="kode_layanan" header="Kode" className="font-mono text-xs" style={{ width: '100px' }} />
              <Column field="nama_layanan" header="Nama Layanan" className="font-bold text-xs" />
              <Column field="sesi_total" header="Total" className="text-center text-xs" style={{ width: '80px' }} />
              <Column field="sesi_terpakai" header="Terpakai" className="text-center text-xs" style={{ width: '90px' }} />
              <Column
                header="Sisa Sesi"
                body={(det: DetailKepemilikan) => (
                  <Tag value={`${det.sisa_sesi} Sesi`} severity={det.sisa_sesi > 0 ? 'info' : 'danger'} className="text-xs font-bold" />
                )}
                style={{ width: '100px', textAlign: 'center' }}
              />
              <Column
                header="Aksi Klaim"
                body={(det: DetailKepemilikan) => (
                  det.sisa_sesi > 0 && selectedItem.status === 'aktif' ? (
                    <Button
                      icon="pi pi-ticket"
                      label="Klaim"
                      size="small"
                      severity="success"
                      className="text-xs font-bold py-1 px-2 border-round-md"
                      onClick={() => handleOpenClaimDialog(selectedItem, det)}
                    />
                  ) : (
                    <span className="text-xs text-400 font-semibold">Habis</span>
                  )
                )}
                style={{ width: '100px', textAlign: 'center' }}
              />
            </DataTable>
          </div>
        )}
      </Dialog>

      {/* DIALOG KONFIRMASI KLAIM SESI PAKET */}
      <Dialog
        visible={claimDialogVisible}
        onHide={() => !submittingClaim && setClaimDialogVisible(false)}
        header={
          <div className="flex align-items-center gap-3 py-1">
            <div
              className="flex align-items-center justify-content-center border-round-xl text-white shadow-1"
              style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
            >
              <i className="pi pi-send text-xl" />
            </div>
            <div>
              <h4 className="font-bold text-lg text-900 m-0">Konfirmasi Klaim Sesi Paket</h4>
              <p className="text-xs text-500 m-0 mt-1">Verifikasi rincian sesi dan alur kunjungan pasien</p>
            </div>
          </div>
        }
        footer={
          <div className="flex align-items-center justify-content-between pt-2">
            <Button
              label="Batal"
              icon="pi pi-times"
              severity="secondary"
              outlined
              disabled={submittingClaim}
              className="border-round-lg font-bold px-3"
              onClick={() => setClaimDialogVisible(false)}
            />
            <Button
              label={submittingClaim ? 'Menerbitkan Antrean...' : 'Ya, Terbitkan Antrean'}
              icon="pi pi-check"
              severity="success"
              loading={submittingClaim}
              className="border-round-lg font-bold px-4"
              onClick={handleExecuteClaim}
            />
          </div>
        }
        modal
        style={{ width: '100%', maxWidth: '560px' }}
        className="p-fluid"
      >
        {claimTargetItem && claimTargetDetail && (() => {
          const tipePaket = (claimTargetItem.tipe_paket || '').toString().trim().toUpperCase();
          const isWajib = tipePaket === 'MEDICAL TREATMENT';
          const isService = tipePaket === 'SERVICE TREATMENT';
          const isOpsional = !isWajib && !isService;
          const roomName = claimTargetDetail.nama_ruangan || claimTargetItem.nama_ruangan_paket || 'Ruangan Tindakan';

          return (
            <div className="flex flex-column gap-3 pt-2">
              <div className="p-3 border-round-xl border-1 surface-border surface-50 flex flex-column gap-2 text-sm">
                <div className="flex align-items-center justify-content-between">
                  <span className="text-500 font-medium text-xs">Pasien</span>
                  <div className="flex align-items-center gap-2">
                    <span className="font-bold text-900">{claimTargetItem.nama_pasien}</span>
                    <span className="text-xs font-bold px-2 py-1 border-round-lg text-white" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>{claimTargetItem.no_rm}</span>
                  </div>
                </div>
                <div className="flex align-items-center justify-content-between">
                  <span className="text-500 font-medium text-xs">Tujuan Ruangan</span>
                  <span className="font-semibold text-primary text-xs flex align-items-center"><i className="pi pi-map-marker text-xs mr-1.5" />{roomName}</span>
                </div>
              </div>
              <div className="flex flex-column gap-2">
                <span className="text-sm font-bold text-700">Rincian Sesi yang Diklaim:</span>
                <div className="surface-50 border-1 surface-border border-round-xl p-3 flex flex-column gap-2">
                  <div className="flex align-items-center justify-content-between">
                    <span className="font-bold text-900 text-sm">{claimTargetDetail.nama_layanan || claimTargetDetail.kode_layanan}</span>
                    <span className="font-bold text-amber-600 text-sm">Rp 0 (Klaim Sesi)</span>
                  </div>
                  <div className="flex align-items-center gap-2 flex-wrap">
                    <span className="text-xs text-500">{claimTargetItem.nama_paket}</span>
                    <Tag value={`Tersisa ${claimTargetDetail.sisa_sesi} Sesi`} severity="success" className="text-xs font-bold" />
                  </div>
                  {isWajib && (<span className="text-xs font-semibold text-red-700 flex align-items-center gap-1 pt-1 border-top-1 surface-border"><i className="pi pi-user-edit text-xs" /> Wajib Konsultasi Dokter Dulu</span>)}
                  {isService && (<span className="text-xs font-semibold text-green-700 flex align-items-center gap-1 pt-1 border-top-1 surface-border"><i className="pi pi-bolt text-xs" /> Langsung ke {roomName}</span>)}
                  {isOpsional && (
                    <div className="flex flex-column gap-2 pt-1 border-top-1 surface-border">
                      <div className="flex align-items-center justify-content-between">
                        <span className="text-xs font-bold text-700 flex align-items-center gap-1"><i className="pi pi-question-circle text-indigo-500" />Pilihan Alur Kunjungan</span>
                        <Tag value="Opsional Konsul" severity="info" className="text-xs" />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 p-2 border-round-xl border-2 cursor-pointer transition-all transition-duration-200 flex align-items-center gap-2" style={{ borderColor: claimConsultChoice !== false ? '#6366f1' : '#e2e8f0', background: claimConsultChoice !== false ? 'linear-gradient(135deg, #eef2ff, #e0e7ff)' : 'var(--surface-50)' }} onClick={() => setClaimConsultChoice(true)}>
                          <div className="flex align-items-center justify-content-center border-round-lg text-white flex-shrink-0" style={{ width: '32px', height: '32px', background: claimConsultChoice !== false ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#cbd5e1' }}><i className="pi pi-user-edit text-sm" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs" style={{ color: claimConsultChoice !== false ? '#4338ca' : '#64748b' }}>Konsultasi Dokter Dulu</div>
                            <div className="text-xs" style={{ color: claimConsultChoice !== false ? '#6366f1' : '#94a3b8' }}>Ke Ruang Konsultasi</div>
                          </div>
                          {claimConsultChoice !== false && <i className="pi pi-check-circle text-indigo-500 flex-shrink-0" />}
                        </div>
                        <div className="flex-1 p-2 border-round-xl border-2 cursor-pointer transition-all transition-duration-200 flex align-items-center gap-2" style={{ borderColor: claimConsultChoice === false ? '#10b981' : '#e2e8f0', background: claimConsultChoice === false ? 'linear-gradient(135deg, #ecfdf5, #d1fae5)' : 'var(--surface-50)' }} onClick={() => setClaimConsultChoice(false)}>
                          <div className="flex align-items-center justify-content-center border-round-lg text-white flex-shrink-0" style={{ width: '32px', height: '32px', background: claimConsultChoice === false ? 'linear-gradient(135deg, #10b981, #059669)' : '#cbd5e1' }}><i className="pi pi-bolt text-sm" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs" style={{ color: claimConsultChoice === false ? '#065f46' : '#64748b' }}>Langsung Tindakan</div>
                            <div className="text-xs" style={{ color: claimConsultChoice === false ? '#10b981' : '#94a3b8' }}>{roomName}</div>
                          </div>
                          {claimConsultChoice === false && <i className="pi pi-check-circle text-green-500 flex-shrink-0" />}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex align-items-center justify-content-between font-extrabold text-base pt-2 border-top-2 surface-border text-900">
                <span>Total Estimasi Biaya:</span>
                <span className="text-blue-600">Rp 0 (Klaim Sesi Paket)</span>
              </div>
              <p className="text-xs text-500 m-0">Nomor antrean dan nomor kunjungan baru akan otomatis diterbitkan ke sistem.</p>
            </div>
          );
        })()}
      </Dialog>
    </>
  );
};

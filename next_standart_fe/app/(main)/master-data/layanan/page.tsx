'use client';

import { useEffect, useRef, useState } from 'react';
import postData from '@/lib/axios/postData';
import { Toast } from 'primereact/toast';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dialog } from 'primereact/dialog';
import { Tag } from 'primereact/tag';
import { Dropdown } from 'primereact/dropdown';
import { Divider } from 'primereact/divider';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { showError, showSuccess } from '@/lib/tools/generalTools';

const Page = () => {
    const toast = useRef<Toast>(null);

    const [data, setData] = useState<any[]>([]);
    const [kategoriList, setKategoriList] = useState<any[]>([]);
    const [ruanganList, setRuanganList] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [totalRecords, setTotalRecords] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const [rows, setRows] = useState<number>(10);
    const [keyword, setKeyword] = useState<string>('');
    const [selectedRows, setSelectedRows] = useState<any[]>([]);

    const tipeOptions = [
        { label: 'MEDICAL TREATMENT (Wajib Konsul)', value: 'MEDICAL TREATMENT' },
        { label: 'BEAUTY TREATMENT (Opsional)', value: 'BEAUTY TREATMENT' },
        { label: 'SERVICE TREATMENT (Tidak Perlu Konsul)', value: 'SERVICE TREATMENT' }
    ];

    const [dialogVisible, setDialogVisible] = useState<boolean>(false);
    const [isEdit, setIsEdit] = useState<boolean>(false);
    const [formData, setFormData] = useState<any>({
        kode_layanan: '',
        kode_kategori_layanan: '',
        kode_ruangan: '',
        wajib_konsultasi: 'tidak',
        kode_ruangan_konsultasi: '',
        nama: '',
        tipe: 'BEAUTY TREATMENT',
        harga: 0,
        durasi_menit: 30,
        status: 'aktif',
    });
    const [saving, setSaving] = useState<boolean>(false);
    const [submitted, setSubmitted] = useState<boolean>(false);

    const wajibKonsultasiOptions = [
        { label: 'Tidak (Langsung Tindakan)', value: 'tidak' },
        { label: 'Opsional (Bisa Konsultasi / Langsung Tindakan)', value: 'opsional' },
        { label: 'Wajib (Masuk Ruang Konsultasi Dulu)', value: 'wajib' }
    ];

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await postData('/master/layanan-data', { page, perPage: rows, keyword });
            setData(res.data.data || []);
            setTotalRecords(res.data.total_data || 0);
        } catch (error: any) {
            showError(toast, error?.response?.data?.message || 'Gagal memuat data layanan');
        } finally {
            setLoading(false);
        }
    };

    const loadKategori = async () => {
        try {
            const res = await postData('/master/kategori-layanan-data', { status: 'aktif' });
            const list = (res.data.data || []).map((k: any) => ({ label: k.nama, value: k.kode_kategori_layanan }));
            setKategoriList(list);
        } catch (error) {
            console.error('Failed to fetch kategori list');
        }
    };

    const loadRuangan = async () => {
        try {
            const res = await postData('/master/ruangan-dropdown', {});
            const list = (res.data.data || []).map((r: any) => ({ label: `${r.kode_ruangan} - ${r.nama_ruangan}`, value: r.kode_ruangan }));
            setRuanganList(list);
        } catch (error) {
            console.error('Failed to fetch ruangan list');
        }
    };

    useEffect(() => {
        loadData();
    }, [page, rows, keyword]);

    useEffect(() => {
        loadKategori();
        loadRuangan();
    }, []);

    const handleOpenCreate = () => {
        setIsEdit(false);
        setSubmitted(false);
        setFormData({
            kode_layanan: '',
            kode_kategori_layanan: kategoriList[0]?.value || '',
            kode_ruangan: ruanganList[0]?.value || '',
            wajib_konsultasi: 'tidak',
            kode_ruangan_konsultasi: '',
            nama: '',
            tipe: 'BEAUTY TREATMENT',
            harga: 0,
            durasi_menit: 30,
            status: 'aktif'
        });
        setDialogVisible(true);
    };

    const handleOpenEdit = (rowData: any) => {
        setIsEdit(true);
        setSubmitted(false);
        setFormData({
            ...rowData,
            kode_ruangan: rowData.kode_ruangan || '',
            wajib_konsultasi: rowData.wajib_konsultasi || 'tidak',
            kode_ruangan_konsultasi: rowData.kode_ruangan_konsultasi || '',
            tipe: rowData.tipe || 'BEAUTY TREATMENT',
        });
        setDialogVisible(true);
    };

    const handleSave = async () => {
        if (!formData.nama || !formData.kode_kategori_layanan) {
            showError(toast, 'Nama dan Kategori Layanan wajib diisi!');
            return;
        }
        setSaving(true);
        try {
            const endpoint = isEdit ? '/master/layanan-update' : '/master/layanan-create';
            const res = await postData(endpoint, formData);
            showSuccess(toast, res.data.message || 'Berhasil disimpan');
            setDialogVisible(false);
            loadData();
        } catch (error: any) {
            showError(toast, error?.response?.data?.message || 'Gagal menyimpan data');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (codes: string[]) => {
        confirmDialog({
            message: `Apakah Anda yakin ingin menghapus ${codes.length} data layanan ini?`,
            header: 'Konfirmasi Hapus',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Ya, Hapus',
            rejectLabel: 'Batal',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    const res = await postData('/master/layanan-delete', { kode_layanan: codes });
                    showSuccess(toast, res.data.message || 'Berhasil dihapus');
                    setSelectedRows([]);
                    loadData();
                } catch (error: any) {
                    showError(toast, error?.response?.data?.message || 'Gagal menghapus data');
                }
            }
        });
    };

    const formatRupiah = (val: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
    };

    return (
        <div className="w-full">
            <Toast ref={toast} />
            <ConfirmDialog />

            <div className="card border-round-xl p-4 shadow-1 surface-card mb-4">
                {/* Page Header */}
                <div className="mb-4">
                    <h3 className="text-2xl font-bold text-900 flex align-items-center gap-2 mb-1">
                        <i className="pi pi-sparkles text-purple-600 text-2xl" />
                        Kelola Data Layanan
                    </h3>
                    <p className="text-500 text-sm m-0">
                        Tambah, edit, atau nonaktifkan layanan treatment dan perawatan klinik.
                    </p>
                </div>

                <div className="flex flex-row flex-wrap align-items-center gap-2 mb-4">
                    <Button
                        size="small"
                        label="Baru"
                        icon="pi pi-plus"
                        outlined
                        severity="success"
                        className="border-round-md font-medium px-3"
                        onClick={handleOpenCreate}
                    />
                    <Divider layout="vertical" className="m-0 h-2rem" />
                    <Button
                        size="small"
                        label="Cetak"
                        icon="pi pi-print"
                        outlined
                        className="border-round-md font-medium px-3 border-purple-600 text-purple-600"
                        onClick={() => window.print()}
                    />
                    <Divider layout="vertical" className="m-0 h-2rem" />
                    <Button
                        size="small"
                        label={`Hapus${selectedRows.length > 0 ? ` (${selectedRows.length})` : ''}`}
                        icon="pi pi-trash"
                        severity="danger"
                        outlined
                        disabled={selectedRows.length === 0}
                        className="border-round-md font-medium px-3"
                        onClick={() => { if (selectedRows.length < 1) return; handleDelete(selectedRows.map((r) => r.kode_layanan)); }}
                    />
                    <Divider layout="vertical" className="m-0 h-2rem" />
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

                <DataTable
                    value={data}
                    loading={loading}
                    paginator
                    rows={rows}
                    totalRecords={totalRecords}
                    lazy
                    first={(page - 1) * rows}
                    onPage={(e) => { setPage((e.page || 0) + 1); setRows(e.rows); }}
                    selection={selectedRows}
                    onSelectionChange={(e) => setSelectedRows(e.value as any[])}
                    dataKey="kode_layanan"
                    className="p-datatable-sm"
                    emptyMessage="Data layanan tidak ditemukan."
                    responsiveLayout="scroll"
                    rowsPerPageOptions={[10, 25, 50]}
                    paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                    currentPageReportTemplate="Menampilkan {first} - {last} dari {totalRecords} data"
                    header={
                        <div className="flex flex-column gap-3">
                            <div className="flex flex-wrap align-items-center justify-content-between gap-2">
                                <span className="text-xl font-bold">Data Layanan</span>
                                <div className="flex align-items-center gap-2 ml-auto w-full md:w-auto">
                                    <IconField iconPosition="left" className="w-full md:w-20rem">
                                        <InputIcon className="pi pi-search" />
                                        <InputText value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Cari Data..." className="w-full text-sm" />
                                    </IconField>
                                    <Button
                                        type="button"
                                        icon="pi pi-filter-slash"
                                        outlined
                                        severity="danger"
                                        tooltip="Reset Filter"
                                        tooltipOptions={{ position: 'bottom' }}
                                        onClick={() => setKeyword('')}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-wrap align-items-center gap-3 px-1 py-2 border-round-md surface-100 text-xs font-medium text-color-secondary">
                                <span className="flex align-items-center gap-1">
                                    <i className="pi pi-info-circle" />
                                    <span className="font-semibold">KETERANGAN STATUS:</span>
                                </span>
                                <span className="flex align-items-center gap-1">
                                    <span style={{ display:'inline-block', width:'12px', height:'12px', borderRadius:'3px', backgroundColor:'#22c55e', boxShadow:'0 1px 3px #22c55e55' }} />
                                    Aktif
                                </span>
                                <span className="flex align-items-center gap-1">
                                    <span style={{ display:'inline-block', width:'12px', height:'12px', borderRadius:'3px', backgroundColor:'#ef4444', boxShadow:'0 1px 3px #ef444455' }} />
                                    Tidak Aktif
                                </span>
                            </div>
                        </div>
                    }
                >
                    <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
                    <Column
                        header=""
                        headerStyle={{ width: '3rem' }}
                        align="center"
                        body={(r) => (
                            <span
                                style={{
                                    display: 'inline-block',
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '3px',
                                    backgroundColor: r.status === 'aktif' ? '#22c55e' : '#ef4444',
                                    boxShadow: r.status === 'aktif' ? '0 1px 3px #22c55e55' : '0 1px 3px #ef444455'
                                }}
                                title={r.status === 'aktif' ? 'Status: Aktif' : 'Status: Tidak Aktif'}
                            />
                        )}
                    ></Column>
                    <Column field="kode_layanan" header="Kode" sortable headerStyle={{ fontWeight: 'bold' }}></Column>
                    <Column field="nama" header="Nama Layanan" sortable headerStyle={{ fontWeight: 'bold' }}></Column>
                    <Column
                        field="tipe"
                        header="Tipe Layanan"
                        sortable
                        headerStyle={{ fontWeight: 'bold' }}
                        body={(r) => {
                            const val = r.tipe || 'BEAUTY TREATMENT';
                            let severity: 'danger' | 'info' | 'success' | 'warning' = 'info';
                            let text = 'BEAUTY TREATMENT (Opsional)';
                            if (val === 'MEDICAL TREATMENT') {
                                severity = 'danger';
                                text = 'MEDICAL TREATMENT (Wajib Konsul)';
                            } else if (val === 'SERVICE TREATMENT') {
                                severity = 'success';
                                text = 'SERVICE TREATMENT (Tidak Perlu Konsul)';
                            }
                            return <Tag value={text} severity={severity} className="text-xs px-2 py-1" />;
                        }}
                    ></Column>
                    <Column field="nama_kategori" header="Kategori" body={(r) => r.nama_kategori || r.kode_kategori_layanan || '-'}></Column>
                    <Column field="nama_ruangan" header="Ruangan" body={(r) => r.nama_ruangan ? `${r.kode_ruangan ? r.kode_ruangan + ' - ' : ''}${r.nama_ruangan}` : (r.kode_ruangan || '-')}></Column>
                    <Column
                        field="wajib_konsultasi"
                        header="Status Konsultasi"
                        body={(r) => {
                            const val = r.wajib_konsultasi || 'tidak';
                            let severity: 'danger' | 'info' | 'warning' = 'info';
                            let text = 'Tidak';
                            if (val === 'wajib') {
                                severity = 'danger';
                                text = `Wajib${r.nama_ruangan_konsultasi ? ` (${r.nama_ruangan_konsultasi})` : ''}`;
                            } else if (val === 'opsional') {
                                severity = 'warning';
                                text = `Opsional${r.nama_ruangan_konsultasi ? ` (${r.nama_ruangan_konsultasi})` : ''}`;
                            }
                            return <Tag value={text} severity={severity} className="text-xs px-2 py-1" />;
                        }}
                    ></Column>
                    <Column field="harga" header="Harga" body={(r) => <span className="font-semibold text-green-600">{formatRupiah(r.harga)}</span>}></Column>
                    <Column field="durasi_menit" header="Durasi" body={(r) => `${r.durasi_menit} Menit`}></Column>
                    <Column
                        header="Aksi"
                        align="center"
                        headerStyle={{ width: '8rem', textAlign: 'center' }}
                        body={(r) => (
                            <div className="flex align-items-center justify-content-center gap-2">
                                <Button icon="pi pi-pencil" outlined severity="success" className="p-button-sm border-round-md" onClick={() => handleOpenEdit(r)} tooltip="Edit" />
                                <Button icon="pi pi-trash" outlined severity="danger" className="p-button-sm border-round-md" onClick={() => handleDelete([r.kode_layanan])} tooltip="Hapus" />
                            </div>
                        )}
                    ></Column>
                </DataTable>
            </div>

            <Dialog header={isEdit ? 'Edit Data Layanan' : 'Tambah Data Layanan'} visible={dialogVisible} style={{ width: '550px' }} modal onHide={() => setDialogVisible(false)}>
                <div className="flex flex-column gap-3 pt-2">
                    {isEdit && (
                        <div>
                            <label className="block text-sm font-semibold mb-1">Kode Layanan</label>
                            <InputText value={formData.kode_layanan} disabled className="w-full text-sm" />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-semibold mb-1">Nama Layanan *</label>
                        <InputText value={formData.nama} onChange={(e) => setFormData({ ...formData, nama: e.target.value })} placeholder="Masukkan nama layanan" className="w-full text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Tipe Layanan *</label>
                        <Dropdown
                            value={formData.tipe}
                            options={tipeOptions}
                            onChange={(e) => setFormData({ ...formData, tipe: e.value })}
                            placeholder="Pilih Tipe Layanan"
                            className="w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Kategori Layanan *</label>
                        <Dropdown
                            value={formData.kode_kategori_layanan}
                            options={kategoriList}
                            onChange={(e) => setFormData({ ...formData, kode_kategori_layanan: e.value })}
                            placeholder="Pilih Kategori"
                            className="w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Ruangan Tindakan Utama</label>
                        <Dropdown
                            value={formData.kode_ruangan}
                            options={ruanganList}
                            onChange={(e) => setFormData({ ...formData, kode_ruangan: e.value })}
                            placeholder="Pilih Ruangan Tindakan"
                            showClear
                            className="w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Status Wajib Konsultasi *</label>
                        <Dropdown
                            value={formData.wajib_konsultasi}
                            options={wajibKonsultasiOptions}
                            onChange={(e) => setFormData({ ...formData, wajib_konsultasi: e.value, kode_ruangan_konsultasi: e.value === 'tidak' ? '' : formData.kode_ruangan_konsultasi })}
                            placeholder="Pilih Status Konsultasi"
                            className="w-full text-sm"
                        />
                    </div>
                    {formData.wajib_konsultasi && formData.wajib_konsultasi !== 'tidak' && (
                        <div>
                            <label className="block text-sm font-semibold mb-1">Ruangan Konsultasi *</label>
                            <Dropdown
                                value={formData.kode_ruangan_konsultasi}
                                options={ruanganList}
                                onChange={(e) => setFormData({ ...formData, kode_ruangan_konsultasi: e.value })}
                                placeholder="Pilih Ruangan Konsultasi"
                                showClear
                                className="w-full text-sm"
                            />
                        </div>
                    )}
                    <div className="grid">
                        <div className="col-6">
                            <label className="block text-sm font-semibold mb-1">Harga (Rp) *</label>
                            <InputNumber value={formData.harga} onValueChange={(e) => setFormData({ ...formData, harga: e.value })} mode="currency" currency="IDR" locale="id-ID" className="w-full text-sm" />
                        </div>
                        <div className="col-6">
                            <label className="block text-sm font-semibold mb-1">Durasi (Menit) *</label>
                            <InputNumber value={formData.durasi_menit} onValueChange={(e) => setFormData({ ...formData, durasi_menit: e.value })} suffix=" menit" className="w-full text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Status *</label>
                        <Dropdown
                            value={formData.status}
                            options={[{ label: 'Aktif', value: 'aktif' }, { label: 'Nonaktif', value: 'nonaktif' }]}
                            onChange={(e) => setFormData({ ...formData, status: e.value })}
                            className="w-full text-sm"
                        />
                    </div>
                </div>
                <div className="flex justify-content-end gap-2 mt-4">
                    <Button label="Batal" icon="pi pi-times" text onClick={() => setDialogVisible(false)} />
                    <Button label="Simpan" icon="pi pi-check" loading={saving} onClick={handleSave} className="bg-primary border-none" />
                </div>
            </Dialog>
        </div>
    );
};

export default Page;

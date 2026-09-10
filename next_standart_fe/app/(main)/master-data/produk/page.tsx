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
import { InputSwitch } from 'primereact/inputswitch';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { showError, showSuccess } from '@/lib/tools/generalTools';

const Page = () => {
    const toast = useRef<Toast>(null);

    const [data, setData] = useState<any[]>([]);
    const [kategoriList, setKategoriList] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [totalRecords, setTotalRecords] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const [rows, setRows] = useState<number>(10);
    const [keyword, setKeyword] = useState<string>('');
    const [selectedRows, setSelectedRows] = useState<any[]>([]);

    const [dialogVisible, setDialogVisible] = useState<boolean>(false);
    const [isEdit, setIsEdit] = useState<boolean>(false);
    const [formData, setFormData] = useState<any>({
        kode_produk: '',
        kode_kategori_produk: '',
        nama: '',
        satuan: 'Pcs',
        harga_beli: 0,
        harga_jual: 0,
        status: 'aktif',
    });
    const [saving, setSaving] = useState<boolean>(false);
    const [submitted, setSubmitted] = useState<boolean>(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await postData('/master/produk-data', { page, perPage: rows, keyword });
            setData(res.data.data || []);
            setTotalRecords(res.data.total_data || 0);
        } catch (error: any) {
            showError(toast, error?.response?.data?.message || 'Gagal memuat data produk');
        } finally {
            setLoading(false);
        }
    };

    const loadDropdowns = async () => {
        try {
            const resKat = await postData('/master/kategori-produk-data', { status: 'aktif' });
            setKategoriList((resKat.data.data || []).map((k: any) => ({ label: k.nama, value: k.kode_kategori_produk })));
        } catch (error) {
            console.error('Failed to load dropdowns');
        }
    };

    useEffect(() => {
        loadData();
    }, [page, rows, keyword]);

    useEffect(() => {
        loadDropdowns();
    }, []);

    const handleOpenCreate = () => {
        setIsEdit(false);
        setSubmitted(false);
        setFormData({
            kode_produk: '',
            kode_kategori_produk: kategoriList[0]?.value || '',
            nama: '',
            satuan: 'Pcs',
            harga_beli: 0,
            harga_jual: 0,
            status: 'aktif',
        });
        setDialogVisible(true);
    };

    const handleOpenEdit = (rowData: any) => {
        setIsEdit(true);
        setSubmitted(false);
        setFormData({ ...rowData });
        setDialogVisible(true);
    };

    const handleSave = async () => {
        if (!formData.nama || !formData.kode_kategori_produk || !formData.satuan) {
            showError(toast, 'Nama, Kategori, dan Satuan Produk wajib diisi!');
            return;
        }
        setSaving(true);
        try {
            const endpoint = isEdit ? '/master/produk-update' : '/master/produk-create';
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
            message: `Apakah Anda yakin ingin menghapus ${codes.length} data produk ini?`,
            header: 'Konfirmasi Hapus',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Ya, Hapus',
            rejectLabel: 'Batal',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    const res = await postData('/master/produk-delete', { kode_produk: codes });
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
        <div className="p-4">
            <Toast ref={toast} />
            <ConfirmDialog />

            <div className="card border-round-xl p-4 shadow-1 surface-card mb-4">
                {/* Page Header */}
                <div className="mb-4">
                    <h3 className="text-2xl font-bold text-900 flex align-items-center gap-2 mb-1">
                        <i className="pi pi-box text-purple-600 text-2xl" />
                        Kelola Data Produk & Skincare
                    </h3>
                    <p className="text-500 text-sm m-0">
                        Tambah, edit, atau nonaktifkan produk dan skincare yang dijual di klinik.
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
                        onClick={() => { if (selectedRows.length < 1) return; handleDelete(selectedRows.map((r) => r.kode_produk)); }}
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
                    dataKey="kode_produk"
                    className="p-datatable-sm"
                    emptyMessage="Data produk tidak ditemukan."
                    responsiveLayout="scroll"
                    rowsPerPageOptions={[10, 25, 50]}
                    paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                    currentPageReportTemplate="Menampilkan {first} - {last} dari {totalRecords} data"
                    header={
                        <div className="flex flex-column gap-3">
                            <div className="flex flex-wrap align-items-center justify-content-between gap-2">
                                <span className="text-xl font-bold">Data Produk & Skincare</span>
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
                                    <span className="font-semibold">KETERANGAN:</span>
                                </span>
                                <span className="flex align-items-center gap-1">
                                    <span style={{ display:'inline-block', width:'12px', height:'12px', borderRadius:'3px', backgroundColor:'#22c55e', boxShadow:'0 1px 3px #22c55e55' }} />
                                    Status Aktif
                                </span>
                                <span className="flex align-items-center gap-1">
                                    <span style={{ display:'inline-block', width:'12px', height:'12px', borderRadius:'3px', backgroundColor:'#ef4444', boxShadow:'0 1px 3px #ef444455' }} />
                                    Status Tidak Aktif
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
                    <Column field="kode_produk" header="Kode" sortable headerStyle={{ fontWeight: 'bold' }}></Column>
                    <Column field="nama" header="Nama Produk" sortable headerStyle={{ fontWeight: 'bold' }}></Column>
                    <Column field="nama_kategori" header="Kategori" body={(r) => r.nama_kategori || r.kode_kategori_produk || '-'}></Column>
                    <Column field="satuan" header="Satuan"></Column>
                    <Column field="harga_beli" header="Harga Beli" body={(r) => formatRupiah(r.harga_beli)}></Column>
                    <Column field="harga_jual" header="Harga Jual" body={(r) => <span className="font-semibold text-green-600">{formatRupiah(r.harga_jual)}</span>}></Column>
                    <Column
                        header="Aksi"
                        align="center"
                        headerStyle={{ width: '8rem', textAlign: 'center' }}
                        body={(r) => (
                            <div className="flex align-items-center justify-content-center gap-2">
                                <Button icon="pi pi-pencil" outlined severity="success" className="p-button-sm border-round-md" onClick={() => handleOpenEdit(r)} tooltip="Edit" />
                                <Button icon="pi pi-trash" outlined severity="danger" className="p-button-sm border-round-md" onClick={() => handleDelete([r.kode_produk])} tooltip="Hapus" />
                            </div>
                        )}
                    ></Column>
                </DataTable>
            </div>

            <Dialog header={isEdit ? 'Edit Data Produk' : 'Tambah Data Produk'} visible={dialogVisible} style={{ width: '550px' }} modal onHide={() => setDialogVisible(false)}>
                <div className="flex flex-column gap-3 pt-2">
                    {isEdit && (
                        <div>
                            <label className="block text-sm font-semibold mb-1">Kode Produk</label>
                            <InputText value={formData.kode_produk} disabled className="w-full text-sm" />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-semibold mb-1">Nama Produk *</label>
                        <InputText value={formData.nama} onChange={(e) => setFormData({ ...formData, nama: e.target.value })} placeholder="Masukkan nama produk" className="w-full text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Kategori Produk *</label>
                        <Dropdown
                            value={formData.kode_kategori_produk}
                            options={kategoriList}
                            onChange={(e) => setFormData({ ...formData, kode_kategori_produk: e.value })}
                            placeholder="Pilih Kategori"
                            className="w-full text-sm"
                        />
                    </div>
                    <div className="grid">
                        <div className="col-6">
                            <label className="block text-sm font-semibold mb-1">Satuan *</label>
                            <InputText value={formData.satuan} onChange={(e) => setFormData({ ...formData, satuan: e.target.value })} placeholder="misal: Pcs, Botol" className="w-full text-sm" />
                        </div>
                        <div className="col-6">
                            <label className="block text-sm font-semibold mb-1">Status *</label>
                            <Dropdown
                                value={formData.status}
                                options={[{ label: 'Aktif', value: 'aktif' }, { label: 'Nonaktif', value: 'nonaktif' }]}
                                onChange={(e) => setFormData({ ...formData, status: e.value })}
                                className="w-full text-sm"
                            />
                        </div>
                    </div>
                    <div className="grid">
                        <div className="col-6">
                            <label className="block text-sm font-semibold mb-1">Harga Beli *</label>
                            <InputNumber value={formData.harga_beli} onValueChange={(e) => setFormData({ ...formData, harga_beli: e.value })} mode="currency" currency="IDR" locale="id-ID" className="w-full text-sm" />
                        </div>
                        <div className="col-6">
                            <label className="block text-sm font-semibold mb-1">Harga Jual *</label>
                            <InputNumber value={formData.harga_jual} onValueChange={(e) => setFormData({ ...formData, harga_jual: e.value })} mode="currency" currency="IDR" locale="id-ID" className="w-full text-sm" />
                        </div>
                    </div>
                    <div className="p-2 border-round surface-100 text-xs text-color-secondary flex align-items-center gap-2 mt-1">
                        <i className="pi pi-info-circle text-primary text-sm" />
                        <span>Kuantitas stok fisik, batas minimum, dan restock produk dikelola melalui menu <strong>Inventori</strong>.</span>
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

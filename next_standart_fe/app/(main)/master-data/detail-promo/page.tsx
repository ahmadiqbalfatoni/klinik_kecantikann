'use client';

import { useEffect, useRef, useState } from 'react';
import postData from '@/lib/axios/postData';
import { Toast } from 'primereact/toast';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
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
    const [promoOptions, setPromoOptions] = useState<any[]>([]);
    const [produkOptions, setProdukOptions] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [totalRecords, setTotalRecords] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const [rows, setRows] = useState<number>(10);
    const [keyword, setKeyword] = useState<string>('');
    const [selectedRows, setSelectedRows] = useState<any[]>([]);
    const [expandedRows, setExpandedRows] = useState<any>(null);

    const [dialogVisible, setDialogVisible] = useState<boolean>(false);
    const [isEdit, setIsEdit] = useState<boolean>(false);
    const [submitted, setSubmitted] = useState<boolean>(false);
    const [formData, setFormData] = useState<any>({
        kode_promo: '',
        status: 'aktif',
        details: []
    });
    const [saving, setSaving] = useState<boolean>(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await postData('/master/detail-promo-data', { page, perPage: rows, keyword });
            setData(res.data.data || []);
            setTotalRecords(res.data.total_data || 0);
        } catch (error: any) {
            showError(toast, error?.response?.data?.message || 'Gagal memuat data detail promo');
        } finally {
            setLoading(false);
        }
    };

    const loadPromos = async () => {
        try {
            const res = await postData('/master/promo-data', { status: 'aktif' });
            const list = (res.data.data || []).map((p: any) => ({
                label: `${p.nama} (${p.kode_promo}) - Diskon ${p.jenis_diskon === 'persen' ? `${Number(p.nilai_diskon)}%` : `Rp ${Number(p.nilai_diskon).toLocaleString('id-ID')}`}`,
                value: p.kode_promo,
                nama: p.nama,
                jenis_diskon: p.jenis_diskon,
                nilai_diskon: p.nilai_diskon,
                tanggal_mulai: p.tanggal_mulai,
                tanggal_selesai: p.tanggal_selesai
            }));
            setPromoOptions(list);
        } catch (_) {}
    };

    const loadProduk = async () => {
        try {
            const res = await postData('/master/produk-data', { status: 'aktif' });
            const list = (res.data.data || []).map((p: any) => ({
                label: `${p.nama} (${p.kode_produk}) - Rp ${Number(p.harga_jual || 0).toLocaleString('id-ID')}`,
                value: p.kode_produk,
                nama: p.nama,
                harga_jual: Number(p.harga_jual || 0),
                satuan: p.satuan || 'Pcs',
                stok_tersedia: p.stok_tersedia || 0,
                nama_kategori: p.nama_kategori || '-'
            }));
            setProdukOptions(list);
        } catch (_) {}
    };

    useEffect(() => {
        loadData();
    }, [page, rows, keyword]);

    useEffect(() => {
        loadPromos();
        loadProduk();
    }, []);

    const formatYmd = (val: any) => {
        if (!val) return '';
        if (typeof val === 'string') {
            if (val.includes('T')) return val.split('T')[0];
            if (val.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
        }
        try {
            const d = new Date(val);
            if (isNaN(d.getTime())) return '';
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (_) {
            return '';
        }
    };

    const formatRupiah = (val: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
    };

    const toggleRowExpansion = (rowData: any) => {
        let _expandedRows = { ...expandedRows };
        if (_expandedRows[rowData.kode_promo]) {
            delete _expandedRows[rowData.kode_promo];
        } else {
            _expandedRows[rowData.kode_promo] = true;
        }
        setExpandedRows(_expandedRows);
    };

    const handleOpenCreate = () => {
        setIsEdit(false);
        setSubmitted(false);
        const firstPromo = promoOptions.length > 0 ? promoOptions[0].value : '';
        setFormData({
            kode_promo: firstPromo,
            status: 'aktif',
            details: produkOptions.length > 0 ? [{ kode_produk: produkOptions[0].value, jumlah: 1 }] : []
        });
        setDialogVisible(true);
    };

    const handleOpenEdit = (rowData: any) => {
        setIsEdit(true);
        setSubmitted(false);
        setFormData({
            kode_promo: rowData.kode_promo,
            status: rowData.status || 'aktif',
            details: (rowData.details || []).map((d: any) => ({
                kode_produk: d.kode_produk,
                jumlah: 1
            }))
        });
        setDialogVisible(true);
    };

    const handleAddDetail = () => {
        if (produkOptions.length === 0) return;
        setFormData((prev: any) => ({
            ...prev,
            details: [...prev.details, { kode_produk: produkOptions[0].value, jumlah: 1 }]
        }));
    };

    const handleRemoveDetail = (index: number) => {
        setFormData((prev: any) => ({
            ...prev,
            details: prev.details.filter((_: any, i: number) => i !== index)
        }));
    };

    const handleDetailChange = (index: number, val: any) => {
        setFormData((prev: any) => {
            const updated = [...prev.details];
            updated[index] = { ...updated[index], kode_produk: val };
            return { ...prev, details: updated };
        });
    };

    const selectedPromoObj = promoOptions.find((p) => p.value === formData.kode_promo);

    const calculatePromoPrice = (hargaNormal: number) => {
        if (!selectedPromoObj) return { hargaPromo: hargaNormal, hemat: 0 };
        const nilai = parseFloat(selectedPromoObj.nilai_diskon) || 0;
        let hargaPromo = hargaNormal;
        let hemat = 0;
        if (selectedPromoObj.jenis_diskon === 'persen') {
            hargaPromo = Math.round(hargaNormal * (1 - nilai / 100));
            hemat = Math.max(0, hargaNormal - hargaPromo);
        } else {
            hargaPromo = Math.max(0, Math.round(hargaNormal - nilai));
            hemat = Math.min(hargaNormal, nilai);
        }
        return { hargaPromo, hemat };
    };

    const handleSave = async () => {
        setSubmitted(true);
        if (!formData.kode_promo) {
            showError(toast, 'Promo wajib dipilih!');
            return;
        }
        if (!formData.details || formData.details.length === 0) {
            showError(toast, 'Minimal tambahkan 1 produk dalam promo!');
            return;
        }
        setSaving(true);
        try {
            const endpoint = isEdit ? '/master/detail-promo-update' : '/master/detail-promo-create';
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
            message: `Apakah Anda yakin ingin menghapus ${codes.length} data detail promo ini?`,
            header: 'Konfirmasi Hapus',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Ya, Hapus',
            rejectLabel: 'Batal',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    const res = await postData('/master/detail-promo-delete', { kode_promo: codes });
                    showSuccess(toast, res.data.message || 'Berhasil dihapus');
                    setSelectedRows([]);
                    loadData();
                } catch (error: any) {
                    showError(toast, error?.response?.data?.message || 'Gagal menghapus data');
                }
            }
        });
    };

    const rowExpansionTemplate = (data: any) => {
        return (
            <div className="p-3 surface-50 border-round border-1 surface-border my-2">
                <div className="flex align-items-center justify-content-between mb-2">
                    <h5 className="m-0 font-bold text-sm text-900 flex align-items-center gap-2">
                        <i className="pi pi-list text-purple-600"></i>
                        Detail Produk Promo: {data.nama} ({data.kode_promo})
                    </h5>
                    <span className="text-xs text-500 font-medium">Total: {data.details?.length || 0} Produk</span>
                </div>
                <div className="border-1 surface-border border-round overflow-hidden surface-card">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="surface-200 text-800 text-xs">
                                <th className="p-2 border-bottom-1 surface-border" style={{ width: '3rem' }}>No</th>
                                <th className="p-2 border-bottom-1 surface-border">Kode Produk</th>
                                <th className="p-2 border-bottom-1 surface-border">Nama Produk</th>
                                <th className="p-2 border-bottom-1 surface-border text-right">Harga Normal</th>
                                <th className="p-2 border-bottom-1 surface-border text-right">Harga Promo</th>
                                <th className="p-2 border-bottom-1 surface-border text-right" style={{ width: '120px' }}>Jumlah Pcs</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data.details || []).map((item: any, idx: number) => (
                                <tr key={idx} className="border-bottom-1 surface-border text-sm hover:surface-100">
                                    <td className="p-2 text-500">{idx + 1}</td>
                                    <td className="p-2 text-primary font-medium">{item.kode_produk}</td>
                                    <td className="p-2 font-medium">{item.nama_produk || item.kode_produk}</td>
                                    <td className="p-2 text-right text-500 line-through">{formatRupiah(item.harga_normal)}</td>
                                    <td className="p-2 text-right font-bold text-green-600">{formatRupiah(item.harga_promo)}</td>
                                    <td className="p-2 text-right">
                                        <Tag value={`${item.stok_tersedia !== undefined ? item.stok_tersedia : 1} ${item.satuan || 'Pcs'}`} severity="info" />
                                    </td>
                                </tr>
                            ))}
                            {(!data.details || data.details.length === 0) && (
                                <tr>
                                    <td colSpan={6} className="p-3 text-center text-500 text-sm">Tidak ada produk dalam promo ini.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4">
            <Toast ref={toast} />
            <ConfirmDialog />

            {/* Header Action Bar */}
            <div className="card border-round-xl p-4 shadow-1 surface-card mb-4">
                {/* Page Header */}
                <div className="mb-4">
                    <h3 className="text-2xl font-bold text-900 flex align-items-center gap-2 mb-1">
                        <i className="pi pi-tags text-purple-600 text-2xl" />
                        Kelola Detail Promo Produk &amp; Skincare
                    </h3>
                    <p className="text-500 text-sm m-0">
                        Tambah, edit, atau nonaktifkan detail produk yang termasuk dalam promo klinik.
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
                        onClick={() => {
                            if (selectedRows.length < 1) return;
                            handleDelete(selectedRows.map((r) => r.kode_promo));
                        }}
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
                    onPage={(e) => {
                        setPage((e.page || 0) + 1);
                        setRows(e.rows);
                    }}
                    selection={selectedRows}
                    onSelectionChange={(e) => setSelectedRows(e.value as any[])}
                    expandedRows={expandedRows}
                    onRowToggle={(e) => setExpandedRows(e.data)}
                    rowExpansionTemplate={rowExpansionTemplate}
                    dataKey="kode_promo"
                    className="p-datatable-sm"
                    emptyMessage="Data detail promo produk tidak ditemukan."
                    responsiveLayout="scroll"
                    rowsPerPageOptions={[10, 25, 50]}
                    paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                    currentPageReportTemplate="Menampilkan {first} - {last} dari {totalRecords} data"
                    header={
                        <div className="flex flex-column gap-3">
                            <div className="flex flex-wrap align-items-center justify-content-between gap-2">
                                <span className="text-xl font-bold">Data Detail Promo Produk</span>
                                <div className="flex align-items-center gap-2 ml-auto w-full md:w-auto">
                                    <IconField iconPosition="left" className="w-full md:w-20rem">
                                        <InputIcon className="pi pi-search" />
                                        <InputText
                                            value={keyword}
                                            onChange={(e) => setKeyword(e.target.value)}
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
                                    <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#22c55e', boxShadow: '0 1px 3px #22c55e55' }} />
                                    Aktif
                                </span>
                                <span className="flex align-items-center gap-1">
                                    <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#ef4444', boxShadow: '0 1px 3px #ef444455' }} />
                                    Tidak Aktif
                                </span>
                            </div>
                        </div>
                    }
                >
                    <Column expander style={{ width: '3rem' }} />
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
                    <Column field="kode_promo" header="Kode" sortable headerStyle={{ fontWeight: 'bold' }}></Column>
                    <Column field="nama" header="Nama Promo" sortable headerStyle={{ fontWeight: 'bold' }}></Column>
                    <Column
                        header="Detail Produk"
                        body={(r) => (
                            <Button
                                label={`Lihat Detail (${r.details?.length || 0})`}
                                icon="pi pi-eye"
                                text
                                size="small"
                                className="p-button-sm text-primary font-semibold p-1"
                                onClick={() => toggleRowExpansion(r)}
                            />
                        )}
                    ></Column>
                    <Column
                        field="nilai_diskon"
                        header="Diskon"
                        body={(r) => (
                            <span className="font-semibold text-purple-600">
                                {r.jenis_diskon === 'persen' ? `${Number(r.nilai_diskon)}%` : formatRupiah(r.nilai_diskon)}
                            </span>
                        )}
                    ></Column>
                    <Column
                        field="sisa_hari"
                        header="Masa Berlaku"
                        body={(r) => {
                            const sisa = r.sisa_hari !== undefined ? parseInt(r.sisa_hari, 10) : 0;
                            return `${sisa} Hari`;
                        }}
                    ></Column>
                    <Column
                        header="Periode Aktif Promo"
                        body={(r) => {
                            const start = formatYmd(r.tanggal_mulai);
                            const end = formatYmd(r.tanggal_selesai);
                            const sisa = r.sisa_hari !== undefined ? parseInt(r.sisa_hari, 10) : 0;
                            const isInactive = r.status === 'nonaktif' || sisa <= 0;

                            if (isInactive) {
                                return (
                                    <div className="flex flex-column gap-1 text-xs">
                                        <Tag severity="danger" value="0 Hari (Nonaktif)" className="text-[10px] py-0 px-2 font-bold" style={{ width: 'fit-content' }} />
                                        {start && end && (
                                            <span className="text-400 text-[11px]">
                                                {start} s/d {end}
                                            </span>
                                        )}
                                    </div>
                                );
                            }

                            return (
                                <div className="flex flex-column gap-1 text-xs">
                                    <span className="font-bold text-green-600 flex align-items-center gap-1">
                                        <i className="pi pi-clock text-green-600 text-xs" />
                                        Sisa {sisa} Hari
                                    </span>
                                    {start && end && (
                                        <span className="text-500 text-[11px]">
                                            {start} s/d {end}
                                        </span>
                                    )}
                                </div>
                            );
                        }}
                    ></Column>
                    <Column
                        header="Aksi"
                        align="center"
                        headerStyle={{ width: '8rem', textAlign: 'center' }}
                        body={(r) => (
                            <div className="flex align-items-center justify-content-center gap-2">
                                <Button
                                    icon="pi pi-pencil"
                                    outlined
                                    severity="success"
                                    className="p-button-sm border-round-md"
                                    onClick={() => handleOpenEdit(r)}
                                    tooltip="Edit"
                                />
                                <Button
                                    icon="pi pi-trash"
                                    outlined
                                    severity="danger"
                                    className="p-button-sm border-round-md"
                                    onClick={() => handleDelete([r.kode_promo])}
                                    tooltip="Hapus"
                                />
                            </div>
                        )}
                    ></Column>
                </DataTable>
            </div>

            {/* Modal Create/Edit */}
            <Dialog
                header={isEdit ? 'Edit Detail Promo Produk' : 'Tambah Detail Promo Produk'}
                visible={dialogVisible}
                style={{ width: '650px' }}
                modal
                onHide={() => setDialogVisible(false)}
            >
                <div className="flex flex-column gap-3 pt-2">
                    <div>
                        <label className="block text-sm font-semibold mb-1">Pilih Promo *</label>
                        <Dropdown
                            value={formData.kode_promo}
                            options={promoOptions}
                            onChange={(e) => setFormData({ ...formData, kode_promo: e.value })}
                            placeholder="Pilih Promo Klinik..."
                            filter
                            disabled={isEdit}
                            className={`w-full text-sm border-round-md ${submitted && !formData.kode_promo ? 'p-invalid' : ''}`}
                        />
                        {submitted && !formData.kode_promo && (
                            <small className="p-error text-red-500 text-xs block mt-1">Promo wajib dipilih.</small>
                        )}
                    </div>

                    {selectedPromoObj && (
                        <div className="surface-100 p-3 border-round-md border-1 surface-border flex align-items-center justify-content-between text-xs">
                            <div>
                                <span className="font-semibold text-900 block">{selectedPromoObj.nama}</span>
                                <span className="text-500">
                                    Periode: {formatYmd(selectedPromoObj.tanggal_mulai)} s/d {formatYmd(selectedPromoObj.tanggal_selesai)}
                                </span>
                            </div>
                            <Tag
                                value={`Diskon: ${selectedPromoObj.jenis_diskon === 'persen' ? `${Number(selectedPromoObj.nilai_diskon)}%` : formatRupiah(selectedPromoObj.nilai_diskon)}`}
                                severity="warning"
                                className="font-bold text-xs"
                            />
                        </div>
                    )}

                    <div className="surface-50 p-3 border-round-md border-1 surface-border">
                        <div className="flex align-items-center justify-content-between mb-2">
                            <span className="font-bold text-sm text-900">Status Promo</span>
                            <InputSwitch
                                checked={formData.status === 'aktif'}
                                onChange={(e) => setFormData({ ...formData, status: e.value ? 'aktif' : 'nonaktif' })}
                            />
                        </div>
                        <span className="text-xs text-600 block">
                            <strong>Status: {formData.status === 'aktif' ? 'Aktif' : 'Non-aktif'}</strong>. {formData.status === 'aktif' ? 'Promo produk aktif dan dapat digunakan dalam kasir.' : 'Promo produk dinonaktifkan.'}
                        </span>
                    </div>

                    <div className="mt-2 border-top-1 surface-border pt-3">
                        <div className="flex align-items-center justify-content-between mb-2">
                            <label className="font-bold text-sm text-900">Detail Produk Dalam Promo *</label>
                            <Button label="Tambah Produk" icon="pi pi-plus" text size="small" onClick={handleAddDetail} />
                        </div>
                        {submitted && (!formData.details || formData.details.length === 0) && (
                            <small className="p-error text-red-500 text-xs block mb-2">Minimal tambahkan 1 produk dalam promo.</small>
                        )}

                        {(formData.details || []).map((det: any, idx: number) => {
                            const prod = produkOptions.find((p) => p.value === det.kode_produk);
                            const hargaNormal = prod ? prod.harga_jual : 0;
                            const { hargaPromo } = calculatePromoPrice(hargaNormal);

                            return (
                                <div key={idx} className="flex align-items-center gap-2 mb-2 p-2 surface-100 border-round">
                                    <div className="flex-grow-1">
                                        <Dropdown
                                            value={det.kode_produk}
                                            options={produkOptions}
                                            onChange={(e) => handleDetailChange(idx, e.value)}
                                            placeholder="Pilih Produk..."
                                            filter
                                            className="w-full text-sm"
                                        />
                                    </div>
                                    <div className="text-right px-2" style={{ minWidth: '150px' }}>
                                        <div className="text-xs text-500 line-through">{formatRupiah(hargaNormal)}</div>
                                        <div className="text-sm font-bold text-green-600">{formatRupiah(hargaPromo)}</div>
                                    </div>
                                    <Button
                                        icon="pi pi-trash"
                                        rounded
                                        text
                                        severity="danger"
                                        onClick={() => handleRemoveDetail(idx)}
                                        tooltip="Hapus Produk"
                                    />
                                </div>
                            );
                        })}
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

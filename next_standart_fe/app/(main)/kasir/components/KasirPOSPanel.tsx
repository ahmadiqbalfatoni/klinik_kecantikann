'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Toast } from 'primereact/toast';
import { Dropdown } from 'primereact/dropdown';
import { Checkbox } from 'primereact/checkbox';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Tag } from 'primereact/tag';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import postData from '@/lib/axios/postData';
import { showError, showSuccess } from '@/lib/tools/generalTools';
import type { CartItem } from '../page';

interface KunjunganOption {
  kode_kunjungan: string;
  kode_booking?: string | null;
  no_rm: string;
  nama_pasien: string;
  no_hp: string;
  jam_datang: string;
  dp_nominal?: number;
  dp_status?: string | null;
  metode_pembayaran_dp?: string | null;
  layanan_pendaftaran?: CartItem[];
}

interface ItemOption {
  jenis: 'layanan' | 'produk';
  kode: string;
  nama: string;
  nama_kategori?: string;
  satuan?: string;
  harga: number;
}

interface PromoOption {
  kode_detail_promo: string;
  kode_promo: string;
  nama_promo: string;
  jenis_diskon: 'persen' | 'nominal';
  nilai_diskon: number;
  jenis_item: 'layanan' | 'paket' | 'produk';
  kode_item: string;
  nama_item: string;
}

interface KasirPOSPanelProps {
  toast: React.RefObject<Toast>;
  kode_transaksi: string | null;
  onDraftSaved: (kode: string) => void;
  onOpenBayar: (payload: {
    kode_transaksi: string;
    total_bayar: number;
    total_harga?: number;
    dp_nominal?: number;
    metode_pembayaran_dp?: string | null;
    sisa_bayar?: number;
    nama_pasien: string;
    no_rm: string;
    items: CartItem[];
    kode_promo?: string | null;
    nama_promo?: string | null;
    total_diskon?: number;
  }) => void;
}

const formatRupiah = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);

export const KasirPOSPanel: React.FC<KasirPOSPanelProps> = ({
  toast,
  kode_transaksi,
  onDraftSaved,
  onOpenBayar,
}) => {
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const [kunjunganList, setKunjunganList] = useState<KunjunganOption[]>([]);
  const [layananList, setLayananList] = useState<ItemOption[]>([]);
  const [produkList, setProdukList] = useState<ItemOption[]>([]);
  const [promoList, setPromoList] = useState<PromoOption[]>([]);

  const [selectedKunjungan, setSelectedKunjungan] = useState<KunjunganOption | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchItem, setSearchItem] = useState('');
  const [activeItemTab, setActiveItemTab] = useState<'layanan' | 'produk'>('layanan');
  const [editingKodeTrx, setEditingKodeTrx] = useState<string | null>(null);
  const [trxStatus, setTrxStatus] = useState<'draft' | 'lunas' | 'batal' | null>(null);
  const [selectedPromos, setSelectedPromos] = useState<PromoOption[]>([]);
  const [dpNominal, setDpNominal] = useState<number>(0);
  const [metodeDp, setMetodeDp] = useState<string | null>(null);

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    if (kode_transaksi) {
      fetchDetail(kode_transaksi);
    } else {
      resetForm();
    }
  }, [kode_transaksi]);

  const resetForm = () => {
    setSelectedKunjungan(null);
    setCart([]);
    setEditingKodeTrx(null);
    setTrxStatus(null);
    setSelectedPromos([]);
    setSearchItem('');
    setDpNominal(0);
    setMetodeDp(null);
  };

  const fetchOptions = async () => {
    setLoadingOptions(true);
    try {
      const res = await postData('/master/kasir-options', {});
      if (['00', '0000'].includes(res?.data?.status)) {
        setKunjunganList(res.data.data.kunjungan || []);
        setLayananList(res.data.data.layanan || []);
        setProdukList(res.data.data.produk || []);
        setPromoList(res.data.data.promo || []);
      }
    } catch (err: any) {
      showError(toast, err?.response?.data?.message || err?.message || 'Gagal memuat opsi kasir');
    } finally {
      setLoadingOptions(false);
    }
  };

  const fetchDetail = async (kode: string) => {
    setLoadingDetail(true);
    try {
      const res = await postData('/master/kasir-detail', { kode_transaksi: kode });
      if (['00', '0000'].includes(res?.data?.status)) {
        const trx = res.data.data;
        setEditingKodeTrx(trx.kode_transaksi);
        setTrxStatus(trx.status);
        setDpNominal(parseFloat(String(trx.dp_nominal || 0)));
        setMetodeDp(trx.metode_pembayaran_dp || null);

        const kunjungan = kunjunganList.find((k) => k.kode_kunjungan === trx.kode_kunjungan) ||
          (trx.kode_kunjungan ? {
            kode_kunjungan: trx.kode_kunjungan,
            kode_booking: trx.kode_booking || null,
            no_rm: trx.no_rm,
            nama_pasien: trx.nama_pasien || trx.no_rm,
            no_hp: trx.no_hp || '',
            jam_datang: '',
            dp_nominal: parseFloat(String(trx.dp_nominal || 0)),
            dp_status: trx.dp_status || null,
            metode_pembayaran_dp: trx.metode_pembayaran_dp || null,
          } : null);
        setSelectedKunjungan(kunjungan);

        const cartItems: CartItem[] = (trx.details || []).map((d: any) => ({
          jenis: d.jenis,
          kode: d.kode,
          nama: d.nama,
          satuan: d.satuan || (d.jenis === 'layanan' ? 'tindakan' : 'pcs'),
          qty: d.qty,
          harga_satuan: parseFloat(d.harga_satuan),
          subtotal: parseFloat(d.subtotal),
          is_from_pendaftaran: Boolean(d.is_from_pendaftaran),
          kode_promo: d.kode_promo || null,
          nama_promo: d.nama_promo || null,
          jenis_diskon: d.jenis_diskon || null,
          nilai_diskon: d.nilai_diskon != null ? parseFloat(d.nilai_diskon) : null,
        }));
        setCart(cartItems);

        if (trx.kode_promo) {
          const codes = String(trx.kode_promo).split(',').map((s: string) => s.trim()).filter(Boolean);
          const cartCodes = new Set(cartItems.map((c: any) => c.kode));
          // Pilih detail promo yang kode_promo-nya ada di kode_promo tersimpan DAN kode_item-nya ada di cart
          const foundDetails = promoList.filter((p) =>
            codes.includes(p.kode_promo) && cartCodes.has(p.kode_item)
          );
          setSelectedPromos(foundDetails);
        } else {
          setSelectedPromos([]);
        }
      }
    } catch (err: any) {
      showError(toast, err?.response?.data?.message || err?.message || 'Gagal memuat detail transaksi');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleKunjunganChange = (kunjungan: KunjunganOption | null) => {
    setSelectedKunjungan(kunjungan);
    if (!kunjungan) {
      setCart([]);
      setEditingKodeTrx(null);
      setTrxStatus(null);
      setSelectedPromos([]);
      setDpNominal(0);
      setMetodeDp(null);
      return;
    }

    setDpNominal(parseFloat(String(kunjungan.dp_nominal || 0)));
    setMetodeDp(kunjungan.metode_pembayaran_dp || null);

    if (!editingKodeTrx) {
      const itemsFromPendaftaran = kunjungan.layanan_pendaftaran || [];
      setCart(itemsFromPendaftaran);
      setSelectedPromos([]);
    }
  };

  const addToCart = (item: ItemOption) => {
    const existing = cart.find((c) => c.jenis === item.jenis && c.kode === item.kode);
    if (existing) {
      setCart(cart.map((c) =>
        c.jenis === item.jenis && c.kode === item.kode
          ? { ...c, qty: c.qty + 1, subtotal: (c.qty + 1) * c.harga_satuan }
          : c
      ));
    } else {
      setCart([...cart, {
        jenis: item.jenis,
        kode: item.kode,
        nama: item.nama,
        nama_kategori: item.nama_kategori,
        satuan: item.satuan || (item.jenis === 'layanan' ? 'tindakan' : 'pcs'),
        qty: 1,
        harga_satuan: item.harga,
        subtotal: item.harga,
        is_from_pendaftaran: false,
      }]);
    }
  };

  const updateQty = (idx: number, newQty: number) => {
    if (newQty <= 0) {
      setCart(cart.filter((_, i) => i !== idx));
    } else {
      setCart(cart.map((c, i) => i === idx ? { ...c, qty: newQty, subtotal: newQty * c.harga_satuan } : c));
    }
  };

  const removeItem = (idx: number) => {
    setCart(cart.filter((_, i) => i !== idx));
  };

  // Real-time Total Calculations
  const totalHarga = useMemo(() => cart.reduce((s, c) => s + c.subtotal, 0), [cart]);

  /**
   * Hitung total diskon per detail promo yang dicentang.
   * Setiap detail promo diterapkan ke item spesifik (kode_item) di cart.
   */
  const { totalDiskon, promoBreakdown } = useMemo(() => {
    let totalDisc = 0;
    const breakdownMap: Record<string, { nama_promo: string; diskon: number }> = {};

    if (selectedPromos.length > 0 && totalHarga > 0) {
      for (const dp of selectedPromos) {
        const cartItem = cart.find((c) => c.kode === dp.kode_item);
        if (!cartItem) continue;

        const diskon = dp.jenis_diskon === 'persen'
          ? (cartItem.subtotal * dp.nilai_diskon) / 100
          : Math.min(dp.nilai_diskon * cartItem.qty, cartItem.subtotal);

        totalDisc += diskon;

        if (!breakdownMap[dp.kode_detail_promo]) {
          breakdownMap[dp.kode_detail_promo] = { nama_promo: dp.nama_item, diskon: 0 };
        }
        breakdownMap[dp.kode_detail_promo].diskon += diskon;
      }
      totalDisc = Math.min(totalDisc, totalHarga);
    }

    return { totalDiskon: totalDisc, promoBreakdown: Object.values(breakdownMap) };
  }, [cart, totalHarga, selectedPromos]);

  const totalBayar = Math.max(0, totalHarga - totalDiskon);
  const sisaBayar = Math.max(0, totalBayar - dpNominal);

  const filteredItems = useMemo(() => {
    const list = activeItemTab === 'layanan' ? layananList : produkList;
    if (!searchItem.trim()) return list;
    const q = searchItem.toLowerCase();
    return list.filter((i) => i.nama.toLowerCase().includes(q) || i.nama_kategori?.toLowerCase().includes(q));
  }, [activeItemTab, layananList, produkList, searchItem]);

  const handleSaveDraft = async () => {
    if (!selectedKunjungan) {
      showError(toast, 'Pilih pasien terlebih dahulu');
      return;
    }
    if (cart.length === 0) {
      showError(toast, 'Tambahkan minimal 1 item ke cart');
      return;
    }

    setSavingDraft(true);
    try {
      const payload = {
        kode_transaksi: editingKodeTrx || undefined,
        kode_kunjungan: selectedKunjungan.kode_kunjungan,
        no_rm: selectedKunjungan.no_rm,
        items: cart.map((c) => ({
          jenis: c.jenis,
          kode: c.kode,
          nama: c.nama,
          qty: c.qty,
          harga_satuan: c.harga_satuan,
          is_from_pendaftaran: c.is_from_pendaftaran ? 1 : 0,
        })),
        kode_promo: [...new Set(selectedPromos.map((p) => p.kode_promo))].join(','),
        metode_bayar: 'tunai',
      };

      const res = await postData('/master/kasir-save', payload);
      if (['00', '0000'].includes(res?.data?.status)) {
        showSuccess(toast, 'Draft transaksi berhasil disimpan');
        onDraftSaved(res.data.data.kode_transaksi);
      } else {
        showError(toast, res?.data?.message || 'Gagal menyimpan draft');
      }
    } catch (err: any) {
      showError(toast, err?.response?.data?.message || err?.message || 'Gagal terhubung ke server');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleBayar = async () => {
    if (!selectedKunjungan) { showError(toast, 'Pilih pasien terlebih dahulu'); return; }
    if (cart.length === 0) { showError(toast, 'Cart masih kosong'); return; }

    setSavingDraft(true);
    try {
      const payload = {
        kode_transaksi: editingKodeTrx || undefined,
        kode_kunjungan: selectedKunjungan.kode_kunjungan,
        no_rm: selectedKunjungan.no_rm,
        items: cart.map((c) => ({
          jenis: c.jenis,
          kode: c.kode,
          nama: c.nama,
          qty: c.qty,
          harga_satuan: c.harga_satuan,
          is_from_pendaftaran: c.is_from_pendaftaran ? 1 : 0,
        })),
        kode_promo: selectedPromos.map((p) => p.kode_promo).join(','),
        metode_bayar: 'tunai',
      };
      const res = await postData('/master/kasir-save', payload);
      if (['00', '0000'].includes(res?.data?.status)) {
        const kodeTrx = res.data.data.kode_transaksi;
        setEditingKodeTrx(kodeTrx);
        onOpenBayar({
          kode_transaksi: kodeTrx,
          total_bayar: totalBayar,
          total_harga: totalHarga,
          dp_nominal: dpNominal,
          metode_pembayaran_dp: metodeDp,
          sisa_bayar: sisaBayar,
          nama_pasien: selectedKunjungan.nama_pasien,
          no_rm: selectedKunjungan.no_rm,
          items: cart,
          kode_promo: [...new Set(selectedPromos.map((p) => p.kode_promo))].join(','),
          nama_promo: [...new Set(selectedPromos.map((p) => p.nama_promo))].join(', '),
          total_diskon: totalDiskon,
        });
      } else {
        showError(toast, res?.data?.message || 'Gagal menyimpan sebelum bayar');
      }
    } catch (err: any) {
      showError(toast, err?.response?.data?.message || err?.message || 'Gagal terhubung ke server');
    } finally {
      setSavingDraft(false);
    }
  };

  const isReadOnly = trxStatus === 'lunas' || trxStatus === 'batal';

  if (loadingDetail) {
    return (
      <div className="flex align-items-center justify-content-center h-full surface-ground">
        <ProgressSpinner style={{ width: '32px', height: '32px' }} />
        <span className="ml-2 text-sm text-500 font-medium">Memuat rincian transaksi...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-2 overflow-hidden">
      {/* KIRI: Katalog Item (50%) */}
      <div style={{ flex: '1 1 50%', minWidth: 0 }} className="flex flex-column h-full surface-card border-round-xl border-1 surface-border shadow-1 overflow-hidden">
        {/* Header Catalog */}
        <div className="p-3 border-bottom-1 surface-border bg-white flex-shrink-0">
          <label className="block text-xs font-extrabold text-teal-800 uppercase tracking-wider mb-2 flex align-items-center gap-2 m-0">
            <i className="pi pi-shopping-bag text-teal-600 text-sm" />
            KATALOG ITEM (LAYANAN &amp; PRODUK)
          </label>

          {/* Tabs layanan/produk - bebas dipilih kapan saja */}
          <div className="flex gap-1 mb-2 p-1 bg-slate-100 border-round-lg">
            {(['layanan', 'produk'] as const).map((tab) => {
              const isActive = activeItemTab === tab;
              const count = tab === 'layanan' ? layananList.length : produkList.length;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveItemTab(tab)}
                  className={`flex-1 py-2 px-3 border-round-md font-bold text-xs border-none cursor-pointer flex align-items-center justify-content-center gap-2 transition-all ${
                    isActive ? 'bg-teal-600 text-white shadow-1' : 'bg-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className={`pi ${tab === 'layanan' ? 'pi-briefcase' : 'pi-box'}`} style={{ fontSize: '12px' }} />
                  <span>{tab === 'layanan' ? 'Layanan & Paket' : 'Produk'} ({count})</span>
                </button>
              );
            })}
          </div>


          <IconField iconPosition="left" className="w-full">
            <InputIcon className="pi pi-search text-xs text-400" />
            <InputText
              value={searchItem}
              onChange={(e) => setSearchItem(e.target.value)}
              placeholder={`Cari ${activeItemTab === 'layanan' ? 'layanan / paket' : 'produk'}...`}
              className="p-inputtext-sm w-full border-round-lg text-xs"
            />
          </IconField>
        </div>

        {/* Item Grid */}
        <div className="flex-1 overflow-y-auto p-3 surface-ground">
          {loadingOptions ? (
            <div className="flex align-items-center justify-content-center py-5">
              <ProgressSpinner style={{ width: '28px', height: '28px' }} />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-column align-items-center justify-content-center py-5 text-center">
              <i className="pi pi-inbox text-3xl text-300 mb-2" />
              <span className="text-xs text-500 font-medium">Tidak ada item ditemukan</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px' }}>
              {filteredItems.map((item) => {
                const inCartItem = cart.find((c) => c.jenis === item.jenis && c.kode === item.kode);
                const inCart = Boolean(inCartItem);

                // Cari detail promo yang dicentang dan berlaku untuk item katalog ini
                const matchingDetails = selectedPromos.filter((dp) => dp.kode_item === item.kode);
                let diskonCatalog = 0;
                matchingDetails.forEach((dp) => {
                  diskonCatalog += dp.jenis_diskon === 'persen'
                    ? (item.harga * dp.nilai_diskon) / 100
                    : Math.min(dp.nilai_diskon, item.harga);
                });
                const hargaSetelahDiskon = Math.max(0, item.harga - diskonCatalog);

                  // Item layanan dikunci saat transaksi sudah dipilih; produk tetap bebas
                  const isLayananLocked = item.jenis === 'layanan' && Boolean(editingKodeTrx);
                  const isItemDisabled = isReadOnly || isLayananLocked;

                  return (
                  <div
                    key={item.kode}
                    onClick={() => !isItemDisabled && addToCart(item)}
                    title={isLayananLocked ? 'Layanan tidak bisa diubah saat transaksi sedang aktif' : undefined}
                    className={`surface-card p-3 border-round-xl border-1 transition-all user-select-none relative flex flex-column justify-content-between shadow-1 ${
                      isItemDisabled
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer hover:shadow-2'
                    } ${inCart && !isItemDisabled ? 'border-2 border-teal-500 bg-teal-50/50' : 'surface-border'}`}
                  >
                    <div className="mb-2">
                      {matchingDetails.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {matchingDetails.map((dp) => (
                            <span
                              key={dp.kode_detail_promo}
                              className="text-xs font-extrabold px-2 py-0.5 border-round-md text-rose-700 bg-rose-100 border-1 border-rose-200 inline-block"
                            >
                              {dp.jenis_diskon === 'persen' ? `-${dp.nilai_diskon}%` : `-${formatRupiah(dp.nilai_diskon)}`}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex align-items-start justify-content-between gap-1 mb-1">
                        <div className="font-bold text-xs text-slate-900 line-height-2 flex-1">
                          {item.nama}
                        </div>
                        {inCart && (
                          <span
                            className="bg-teal-600 text-white font-bold px-2 py-1 border-round-md flex align-items-center gap-1 flex-shrink-0 shadow-1"
                          >
                            <i className="pi pi-check" style={{ fontSize: '6px' }} />
                            <span style={{ fontSize: '7px', lineHeight: 1 }}>Terpilih</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {item.nama_kategori || (item.jenis === 'layanan' ? 'Layanan' : 'Produk')}
                      </div>
                    </div>

                    <div className="flex align-items-center justify-content-between pt-2 border-top-1 surface-border">
                      {matchingDetails.length > 0 && diskonCatalog > 0 ? (
                        <div className="flex align-items-baseline gap-1.5">
                          <span className="text-xs text-slate-400 line-through font-semibold">{formatRupiah(item.harga)}</span>
                          <span className="font-black text-sm text-rose-600">{formatRupiah(hargaSetelahDiskon)}</span>
                        </div>
                      ) : (
                        <span className="font-black text-sm text-teal-700">{formatRupiah(item.harga)}</span>
                      )}
                      {inCart && inCartItem && (
                        <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 border-round-md">
                          x{inCartItem.qty}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* KANAN: Pasien & Rincian Kasir (50%) */}
      <div style={{ flex: '1 1 50%', minWidth: 0 }} className="flex flex-column h-full surface-card border-round-xl border-1 surface-border shadow-1 overflow-hidden">
        {/* Pasien selector header */}
        <div className="p-3 border-bottom-1 surface-border bg-white flex-shrink-0">
          <div className="flex align-items-center justify-content-between mb-2">
            <label className="text-xs font-extrabold text-teal-800 uppercase tracking-wider flex align-items-center gap-2 m-0">
              <i className="pi pi-user text-teal-600 text-sm" />
              RINCIAN TRANSAKSI KASIR
            </label>
            {trxStatus && (
              <div className="flex align-items-center gap-2">
                <Tag
                  value={trxStatus.toUpperCase()}
                  severity={trxStatus === 'lunas' ? 'success' : trxStatus === 'batal' ? 'danger' : 'info'}
                  className="text-[10px] font-extrabold px-2 py-0.5"
                />
                {editingKodeTrx && <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-0.5 border-round-md">{editingKodeTrx}</span>}
              </div>
            )}
          </div>

          {/* Pasien Selector / Display */}
          {isReadOnly ? (
            <div className="bg-slate-50 border-round-xl p-3 border-1 surface-border flex align-items-center justify-content-between">
              <div>
                <div className="font-extrabold text-xs text-slate-900">{selectedKunjungan?.nama_pasien || '-'}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">No. RM: {selectedKunjungan?.no_rm}</div>
              </div>
              {selectedKunjungan?.kode_kunjungan && (
                <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 border-round-md">
                  {selectedKunjungan.kode_kunjungan}
                </span>
              )}
            </div>
          ) : (
            <Dropdown
              value={selectedKunjungan}
              options={kunjunganList}
              onChange={(e) => handleKunjunganChange(e.value)}
              optionLabel="nama_pasien"
              placeholder="Pilih Pasien..."
              filter
              filterBy="nama_pasien,no_rm"
              filterPlaceholder="Cari nama / no RM..."
              className="w-full p-inputtext-sm border-round-lg text-xs"
              valueTemplate={(opt: KunjunganOption) => (
                opt ? (
                  <div className="flex align-items-center justify-content-between w-full py-0.5">
                    <span className="font-bold text-xs text-slate-900">{opt.nama_pasien}</span>
                    <span className="text-[11px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 border-round-md">
                      RM: {opt.no_rm}
                    </span>
                  </div>
                ) : null
              )}
              itemTemplate={(opt: KunjunganOption) => (
                <div className="flex align-items-center justify-content-between w-full py-1">
                  <div>
                    <div className="font-bold text-xs text-slate-900 mb-0.5">{opt.nama_pasien}</div>
                    <div className="text-[11px] text-slate-500">RM: {opt.no_rm}</div>
                  </div>
                  {opt.jam_datang && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      {opt.jam_datang.slice(0, 5)}
                    </span>
                  )}
                </div>
              )}
            />
          )}
        </div>

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto p-3 surface-ground flex flex-column gap-2">
          {cart.length === 0 ? (
            <div className="flex flex-column align-items-center justify-content-center h-full text-center py-5">
              <i className="pi pi-shopping-cart text-4xl text-300 mb-2" />
              <span className="text-xs text-400 font-medium">Pilih item dari katalog di sebelah kiri</span>
            </div>
          ) : (
            cart.map((item, idx) => {
              // Detail promo yang dicentang dan berlaku untuk item cart ini
              const matchingDetails = selectedPromos.filter((dp) => dp.kode_item === item.kode);

              let diskonSubtotal = 0;
              matchingDetails.forEach((dp) => {
                diskonSubtotal += dp.jenis_diskon === 'persen'
                  ? (item.subtotal * dp.nilai_diskon) / 100
                  : Math.min(dp.nilai_diskon * item.qty, item.subtotal);
              });

              const subtotalSetelahDiskon = Math.max(0, item.subtotal - diskonSubtotal);

              return (
                <div
                  key={`${item.jenis}_${item.kode}_${idx}`}
                  className="surface-card p-3 border-round-xl border-1 surface-border shadow-1 hover:shadow-2 transition-all flex align-items-center justify-content-between gap-3"
                >
                  {/* Item Info (Nama & Harga Satuan) */}
                  <div className="flex-1 min-w-0 flex flex-column gap-1.5 justify-content-center">
                    <div className="flex align-items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 line-height-2">
                        {item.nama}
                      </span>
                      {matchingDetails.map((dp) => (
                        <span
                          key={dp.kode_detail_promo}
                          className="text-xs font-extrabold px-2 py-0.5 border-round-md text-rose-700 bg-rose-100 border-1 border-rose-200 inline-block"
                        >
                          {dp.jenis_diskon === 'persen' ? `-${dp.nilai_diskon}%` : `-${formatRupiah(dp.nilai_diskon)}`}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                      {formatRupiah(item.harga_satuan)} / {item.satuan || 'pcs'}
                    </div>
                  </div>

                  {/* Controls (Qty & Subtotal & Hapus) */}
                  <div className="flex align-items-center gap-2.5 flex-shrink-0">
                    {!isReadOnly && item.jenis !== 'layanan' ? (
                      <div className="flex align-items-center gap-1 bg-slate-100 p-1 border-round-lg border-1 surface-border">
                        <button
                          onClick={() => updateQty(idx, item.qty - 1)}
                          className="border-none bg-white hover:bg-slate-200 border-round-md font-bold cursor-pointer text-slate-700 shadow-1 flex align-items-center justify-content-center"
                          style={{ width: '24px', height: '24px', fontSize: '12px' }}
                        >−</button>
                        <span className="font-extrabold text-xs px-1 text-slate-900">{item.qty}</span>
                        <button
                          onClick={() => updateQty(idx, item.qty + 1)}
                          className="border-none bg-teal-600 hover:bg-teal-700 text-white border-round-md font-bold cursor-pointer shadow-1 flex align-items-center justify-content-center"
                          style={{ width: '24px', height: '24px', fontSize: '12px' }}
                        >+</button>
                      </div>
                    ) : (
                      <span className="font-extrabold text-xs text-slate-700">x{item.qty}</span>
                    )}

                    {/* Subtotal */}
                    <div className="text-right flex-shrink-0" style={{ minWidth: '90px' }}>
                      {diskonSubtotal > 0 ? (
                        <div className="flex flex-column align-items-end">
                          <span className="text-xs text-slate-400 line-through font-medium">
                            {formatRupiah(item.subtotal)}
                          </span>
                          <span className="font-bold text-xs text-rose-600">
                            {formatRupiah(subtotalSetelahDiskon)}
                          </span>
                        </div>
                      ) : (
                        <div className="font-bold text-xs text-teal-700">{formatRupiah(item.subtotal)}</div>
                      )}
                    </div>

                    {/* Hapus button (hanya untuk produk) */}
                    {!isReadOnly && item.jenis !== 'layanan' && (
                      <button
                        onClick={() => removeItem(idx)}
                        className="border-none bg-transparent cursor-pointer text-slate-400 hover:text-red-600 p-1 flex-shrink-0"
                        title="Hapus Item"
                      >
                        <i className="pi pi-trash text-xs" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Summary & Actions */}
        <div className="p-3 border-top-1 surface-border bg-white flex-shrink-0 flex flex-column gap-2.5">
          {/* Promo Selector Checkbox Multi-Select */}
          <div>
            <label className="block text-xs font-extrabold text-teal-800 uppercase tracking-wider mb-2 flex align-items-center gap-2 m-0">
              <i className="pi pi-ticket text-teal-600 text-xs" />
              VOUCHER / PROMO DISKON
            </label>

            {isReadOnly ? (
              selectedPromos.length > 0 ? (
                <div className="flex flex-column gap-2">
                  {selectedPromos.map((p) => (
                    <div key={p.kode_detail_promo || p.kode_promo} className="surface-card p-2.5 border-round-xl border-2 border-teal-500 bg-teal-50/50 shadow-1 flex align-items-center justify-content-between text-xs font-bold text-teal-900">
                      <span className="overflow-hidden text-ellipsis white-space-nowrap">
                        {p.nama_item || p.nama_promo}
                      </span>
                      <span className="font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 border-round-md flex-shrink-0 border-1 border-rose-200">
                        {p.jenis_diskon === 'persen' ? `-${p.nilai_diskon}%` : `-${formatRupiah(p.nilai_diskon)}`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">Tanpa Promo</div>
              )
            ) : (
              <div className="flex flex-column gap-2 max-h-12rem overflow-y-auto p-1">
                {promoList.length === 0 ? (
                  <div className="text-xs text-slate-400 p-2 italic text-center">Tidak ada promo aktif hari ini</div>
                ) : (
                  promoList.map((p) => {
                    const isChecked = selectedPromos.some((sp) => sp.kode_detail_promo === p.kode_detail_promo);

                    // Disable jika kode_item promo tidak ada di cart
                    const hasEligibleItem = cart.some((c) => c.kode === p.kode_item);
                    const isPromoDisabled = !hasEligibleItem;

                    return (
                      <div
                        key={p.kode_detail_promo}
                        onClick={() => {
                          if (isPromoDisabled) return;
                          if (isChecked) {
                            setSelectedPromos(selectedPromos.filter((sp) => sp.kode_detail_promo !== p.kode_detail_promo));
                          } else {
                            setSelectedPromos([...selectedPromos, p]);
                          }
                        }}
                        title={isPromoDisabled ? `Item "${p.nama_item}" belum ada di cart` : undefined}
                        className={`surface-card p-2.5 border-round-xl border-1 transition-all user-select-none flex align-items-center justify-content-between gap-2 shadow-1 ${
                          isPromoDisabled
                            ? 'opacity-40 cursor-not-allowed surface-border'
                            : isChecked
                            ? 'border-2 border-teal-500 bg-teal-50/50 shadow-2 cursor-pointer'
                            : 'surface-border hover:shadow-2 cursor-pointer'
                        }`}
                      >
                        <div className="flex align-items-center gap-2 min-w-0 flex-1">
                          <Checkbox checked={isChecked} disabled={isPromoDisabled} onChange={() => {}} className="flex-shrink-0" />
                          <span className={`text-xs font-bold line-height-2 overflow-hidden text-ellipsis white-space-nowrap ${
                            isPromoDisabled ? 'text-slate-400' : 'text-slate-800'
                          }`}>
                            {p.nama_item || p.nama_promo || p.kode_item}
                          </span>
                        </div>
                        <span className={`text-xs font-extrabold px-2 py-0.5 border-round-md flex-shrink-0 ${
                          isPromoDisabled
                            ? 'text-slate-400 bg-slate-100'
                            : 'text-rose-700 bg-rose-100 border-1 border-rose-200'
                        }`}>
                          {p.jenis_diskon === 'persen' ? `-${p.nilai_diskon}%` : `-${formatRupiah(p.nilai_diskon)}`}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Totals Summary */}
          <div className="surface-card border-round-xl border-1 surface-border shadow-1 p-3 flex flex-column gap-1.5">
            <div className="flex justify-content-between align-items-center text-xs text-slate-600">
              <span>Subtotal Layanan & Produk</span>
              <span className="font-bold text-slate-800">{formatRupiah(totalHarga)}</span>
            </div>

            {/* Baris rincian diskon promo */}
            {promoBreakdown.map((pb) => (
              <div key={pb.nama_promo} className="flex justify-content-between align-items-center text-xs">
                <span className="text-slate-500">Diskon ({pb.nama_promo})</span>
                <span className="font-bold text-rose-600">- {formatRupiah(pb.diskon)}</span>
              </div>
            ))}

            {dpNominal > 0 && (
              <div className="flex justify-content-between align-items-center text-xs bg-teal-50/70 p-2 border-round-md border-1 border-teal-200">
                <span className="text-teal-900 font-bold flex align-items-center gap-1.5">
                  <i className="pi pi-check-circle text-xs text-teal-600" />
                  Uang Muka (DP {metodeDp ? metodeDp.toUpperCase() : 'Terbayar'})
                </span>
                <span className="font-extrabold text-teal-800">- {formatRupiah(dpNominal)}</span>
              </div>
            )}

            <div className="flex justify-content-between align-items-center pt-2 border-top-1 surface-border">
              <div>
                <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wide block">
                  {dpNominal > 0 ? 'Sisa Pelunasan' : 'Total Bayar'}
                </span>
                {dpNominal > 0 && (
                  <span className="text-[10px] text-slate-400">Total Tindakan: {formatRupiah(totalBayar)}</span>
                )}
              </div>
              <span className="font-black text-base text-teal-700">
                {formatRupiah(dpNominal > 0 ? sisaBayar : totalBayar)}
              </span>
            </div>
          </div>

          {/* Actions */}
          {!isReadOnly && (
            <div className="flex gap-2">
              <Button
                label="Draft"
                icon="pi pi-save"
                outlined
                severity="secondary"
                onClick={handleSaveDraft}
                loading={savingDraft}
                disabled={cart.length === 0 || !selectedKunjungan}
                className="font-bold text-xs border-round-lg flex-1 py-2"
              />
              <Button
                label={dpNominal > 0 ? 'Pelunasan' : 'Bayar'}
                icon="pi pi-credit-card"
                severity="success"
                onClick={handleBayar}
                loading={savingDraft}
                disabled={cart.length === 0 || !selectedKunjungan}
                className="font-bold text-xs bg-teal-600 border-none border-round-lg text-white shadow-2 flex-1 py-2"
              />
            </div>
          )}

          {isReadOnly && trxStatus === 'lunas' && (
            <div className="bg-teal-600 border-round-lg py-2 px-3 flex align-items-center justify-content-center gap-2 shadow-1">
              <i className="pi pi-check-circle text-white text-xs" />
              <span className="text-white font-bold text-xs">Transaksi Lunas</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

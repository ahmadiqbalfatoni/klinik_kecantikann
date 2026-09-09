'use client';

import React from 'react';
import { Tag } from 'primereact/tag';
import { Checkbox } from 'primereact/checkbox';

export interface ServiceItem {
  jenis: 'layanan' | 'paket' | 'klaim_paket';
  kode_layanan: string;
  kode_kategori: string;
  nama_kategori: string;
  nama: string;
  harga: number;
  harga_asal?: number;
  is_promo?: boolean;
  kode_promo?: string;
  nama_promo?: string;
  jenis_diskon?: 'persen' | 'nominal';
  nilai_diskon?: number;
  durasi_menit: number;
  masa_berlaku_hari?: number;
  total_sesi?: number;
  kode_ruangan?: string;
  nama_ruangan?: string;
  wajib_konsultasi?: 'tidak' | 'opsional' | 'wajib';
  kode_ruangan_konsultasi?: string;
  is_konsultasi?: number;
  tipe?: 'MEDICAL TREATMENT' | 'BEAUTY TREATMENT' | 'SERVICE TREATMENT' | string;
  tipe_paket?: string;
  kode_kepemilikan_paket_layanan?: string;
  kode_detail_kepemilikan_paket_layanan?: string;
  nama_paket_asal?: string;
  sisa_sesi?: number;
  sesi_terbooking?: number;
  sesi_tersedia?: number;
  tanggal_expired?: string;
}

export interface RuanganGroup {
  kode_ruangan: string;
  nama_ruangan: string;
  deskripsi: string;
  items: ServiceItem[];
  is_konsultasi?: number;
}

export const getItemConsultType = (item: ServiceItem) => {
  // 1. Prioritas Utama: Jika properti wajib_konsultasi terdefinisi secara eksplisit (dari master data/database)
  const wk = (item.wajib_konsultasi || '').toString().trim().toLowerCase();
  if (wk === 'wajib') {
    return { isWajib: true, isService: false, isOpsional: false };
  }
  if (wk === 'tidak') {
    return { isWajib: false, isService: true, isOpsional: false };
  }
  if (wk === 'opsional') {
    return { isWajib: false, isService: false, isOpsional: true };
  }

  // 2. Fallback: Untuk paket (mst_paket_layanan) atau klaim paket yang tidak memiliki kolom wajib_konsultasi eksplisit
  const effectiveTipe = (
    item.jenis === 'klaim_paket' && item.tipe_paket
      ? item.tipe_paket
      : item.tipe || ''
  ).toString().trim().toUpperCase();

  const isWajib = effectiveTipe === 'MEDICAL TREATMENT';
  const isService = effectiveTipe === 'SERVICE TREATMENT';
  const isOpsional = !isWajib && !isService; // BEAUTY TREATMENT -> selalu opsional
  return { isWajib, isService, isOpsional };
};

export const formatRupiah = (val: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(val || 0);
};

export interface LayananCardProps {
  item: ServiceItem;
  isSelected: boolean;
  isDisabled?: boolean;
  onToggle: (item: ServiceItem) => void;
  formatPrice?: (val: number) => string;
}

export const LayananCard: React.FC<LayananCardProps> = ({
  item,
  isSelected,
  isDisabled = false,
  onToggle,
  formatPrice = formatRupiah,
}) => {
  const isPaket = item.jenis === 'paket';
  const isKlaim = item.jenis === 'klaim_paket';
  const { isWajib, isService, isOpsional } = getItemConsultType(item);

  const isFullBooked = isKlaim && item.sesi_tersedia !== undefined && item.sesi_tersedia <= 0;
  const effectiveDisabled = isDisabled || isFullBooked;

  const key = isKlaim
    ? `klaim_${item.kode_detail_kepemilikan_paket_layanan || item.kode_layanan}`
    : `${item.jenis}_${item.kode_layanan}`;

  return (
    <div key={key} className="col-12 sm:col-6 lg:col-4 p-2">
      <div
        className={`h-full p-4 border-round-xl border-1 transition-all transition-duration-200 flex flex-column justify-content-between cursor-pointer ${
          isSelected
            ? isKlaim
              ? 'surface-card border-amber-500 shadow-3 bg-amber-50'
              : isPaket
              ? 'surface-card border-amber-500 shadow-3 bg-amber-50'
              : 'surface-card border-blue-600 shadow-3 bg-blue-50'
            : effectiveDisabled
            ? 'surface-200 border-200 opacity-60 cursor-not-allowed'
            : 'surface-card surface-border hover:border-blue-400 hover:shadow-2'
        }`}
        onClick={() => {
          if (!effectiveDisabled) onToggle(item);
        }}
      >
        <div>
          <div className="flex align-items-center justify-content-between mb-2">
            <div className="flex align-items-center gap-1 flex-wrap">
              {isKlaim ? (
                <Tag value="🎁 KLAIM SESI PAKET" severity="warning" className="text-xs font-bold" />
              ) : isPaket ? (
                <Tag value="PAKET TREATMENT" severity="warning" className="text-xs font-bold" />
              ) : (
                <Tag value={item.nama_kategori || 'LAYANAN'} severity="info" className="text-xs font-medium" />
              )}

              {item.total_sesi && item.total_sesi > 0 && !isKlaim && (
                <Tag value={`${item.total_sesi} SESI`} severity="success" className="text-xs font-bold" />
              )}

              {isFullBooked && (
                <Tag value="Terjadwal Penuh" severity="danger" className="text-xs font-bold" />
              )}

              {isKlaim && item.tanggal_expired && (
                <Tag value={`Exp: ${item.tanggal_expired}`} severity="secondary" className="text-[10px]" />
              )}

              {isWajib && <Tag value="Wajib Konsul" severity="danger" className="text-[10px] font-bold" />}
              {isService && <Tag value="Tidak Perlu Konsul" severity="success" className="text-[10px] font-bold" />}
              {isOpsional && <Tag value="Opsional Konsul" severity="info" className="text-[10px] font-bold" />}
            </div>

            <Checkbox
              checked={isSelected}
              disabled={effectiveDisabled}
              onChange={() => {
                if (!effectiveDisabled) onToggle(item);
              }}
            />
          </div>

          <h4 className="text-base font-bold text-900 m-0 mb-1 line-height-2">{item.nama}</h4>
          {isKlaim && item.nama_paket_asal && (
            <span className="text-xs text-amber-700 block font-semibold mb-1">Paket Asal: {item.nama_paket_asal}</span>
          )}
          <div className="flex align-items-center gap-3 text-xs text-500 mb-2">
            <span className="flex align-items-center gap-1">
              <i className="pi pi-clock text-xs" /> {item.durasi_menit} Menit
            </span>
            {isKlaim && item.sisa_sesi !== undefined && (
              <span className="font-bold text-amber-800">
                Sisa: {item.sisa_sesi}
                {item.sesi_terbooking !== undefined && item.sesi_terbooking > 0 && (
                  <span className="text-orange-600 font-normal ml-1">({item.sesi_terbooking} booked)</span>
                )}
                {item.sesi_tersedia !== undefined && (
                  <span className="text-green-700 font-bold ml-1">| Tersedia: {item.sesi_tersedia}</span>
                )}
              </span>
            )}
          </div>

          <div>
            <span className={`text-base font-extrabold ${isKlaim ? 'text-amber-700' : isPaket ? 'text-amber-700' : 'text-blue-600'}`}>
              {isKlaim ? 'Rp 0 (Klaim Sesi)' : formatPrice(item.harga_asal ?? item.harga)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

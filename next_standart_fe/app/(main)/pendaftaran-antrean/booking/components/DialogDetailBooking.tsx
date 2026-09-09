'use client';

import React, { useRef } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Divider } from 'primereact/divider';
import { CalendarCheck, Printer, User, Calendar, Clock, MapPin, Stethoscope, CreditCard, FileText } from 'lucide-react';

interface Props {
  visible: boolean;
  booking: any;
  onHide: () => void;
}

export const DialogDetailBooking: React.FC<Props> = ({
  visible,
  booking,
  onHide,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!booking) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const win = window.open('', '', 'height=700,width=800');
    if (!win) return;

    win.document.write('<html><head><title>Bukti Reservasi - ' + booking.kode_booking + '</title>');
    win.document.write('<style>');
    win.document.write(`
      body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
      .header { text-align: center; border-bottom: 2px dashed #999; padding-bottom: 15px; margin-bottom: 15px; }
      .title { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
      .subtitle { font-size: 13px; color: #666; }
      .code { font-size: 24px; font-weight: bold; color: #0284c7; margin: 15px 0; }
      .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 14px; }
      .label { color: #666; }
      .value { font-weight: bold; }
      .footer { margin-top: 25px; text-align: center; font-size: 12px; color: #888; border-top: 1px dashed #ccc; padding-top: 10px; }
    `);
    win.document.write('</style></head><body>');
    win.document.write(printContent.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 300);
  };

  return (
    <Dialog
      header={
        <div className="flex align-items-center gap-2">
          <CalendarCheck className="text-primary" size={22} />
          <span className="font-bold text-lg">Bukti Reservasi Booking</span>
        </div>
      }
      visible={visible}
      style={{ width: '520px', maxWidth: '95vw' }}
      onHide={onHide}
      footer={
        <div className="flex justify-content-between align-items-center pt-2">
          <Button
            label="Cetak Bukti"
            icon={<Printer size={16} className="mr-1" />}
            className="p-button-outlined p-button-secondary"
            onClick={handlePrint}
          />
          <Button
            label="Tutup"
            icon="pi pi-times"
            className="p-button-primary"
            onClick={onHide}
          />
        </div>
      }
    >
      <div ref={printRef} className="py-2">
        <div className="text-center p-3 surface-50 border-1 border-200 border-round-lg mb-3">
          <div className="text-xs text-500 font-semibold uppercase tracking-wider">KLINIK KECANTIKAN ESTETIKA</div>
          <div className="text-2xl font-bold text-primary my-1">{booking.kode_booking}</div>
          <div className="text-xs text-500">Tunjukkan kode ini kepada staf saat kedatangan</div>
        </div>

        <div className="grid text-sm">
          <div className="col-12 py-1 flex justify-content-between align-items-center border-bottom-1 surface-border">
            <span className="text-500 flex align-items-center gap-1"><User size={15} /> Pasien:</span>
            <span className="font-bold text-900">{booking.nama_pasien} ({booking.no_rm})</span>
          </div>

          <div className="col-12 py-1 border-bottom-1 surface-border">
            <div className="flex justify-content-between align-items-center mb-1">
              <span className="text-500 flex align-items-center gap-1"><Stethoscope size={15} /> Layanan / Paket:</span>
              <span className="font-semibold text-900">{booking.nama_layanan || booking.kode_layanan}</span>
            </div>
            {Array.isArray(booking.items) && booking.items.length > 1 && (
              <div className="pl-4 py-1 flex flex-column gap-1">
                {booking.items.map((it: any, idx: number) => {
                  const isKlaim = it.jenis_layanan === 'klaim_paket' || it.jenis === 'klaim_paket' || it.jenis_item === 'klaim_paket';
                  return (
                    <div key={idx} className="flex justify-content-between text-xs text-600">
                      <span>• {it.nama || it.nama_layanan} ({it.durasi_menit}m)</span>
                      <span className="font-semibold">
                        {isKlaim ? (
                          <span className="text-amber-700 font-bold">Rp 0 (Klaim)</span>
                        ) : (
                          formatCurrency(it.harga_asal ?? it.harga)
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="col-12 py-1 flex justify-content-between align-items-center border-bottom-1 surface-border">
            <span className="text-500 flex align-items-center gap-1"><Calendar size={15} /> Tanggal:</span>
            <span className="font-bold text-900">{booking.tanggal_booking}</span>
          </div>

          <div className="col-12 py-1 flex justify-content-between align-items-center border-bottom-1 surface-border">
            <span className="text-500 flex align-items-center gap-1"><Clock size={15} /> Jam Rencana:</span>
            <span className="font-bold text-900">{booking.jam_booking} WIB</span>
          </div>

          <div className="col-12 py-1 flex justify-content-between align-items-center border-bottom-1 surface-border">
            <span className="text-500 flex align-items-center gap-1"><MapPin size={15} /> Ruangan:</span>
            <span className="font-semibold text-900">{booking.nama_ruangan || booking.kode_ruangan || '-'}</span>
          </div>

          <div className="col-12 py-1 flex justify-content-between align-items-center border-bottom-1 surface-border">
            <span className="text-500">Petugas / Dokter:</span>
            <span className="font-semibold text-900">{booking.nama_petugas || '-'}</span>
          </div>

          <div className="col-12 py-1 flex justify-content-between align-items-center border-bottom-1 surface-border">
            <span className="text-500 flex align-items-center gap-1"><Stethoscope size={15} /> Alur Kunjungan:</span>
            {Number(booking.butuh_konsul) === 1 ? (
              <span className="inline-flex align-items-center gap-1 font-semibold text-xs px-2 py-1 border-round bg-purple-50 text-purple-700 border-1 border-purple-200">
                Konsultasi Dokter Dulu
              </span>
            ) : (
              <span className="inline-flex align-items-center gap-1 font-semibold text-xs px-2 py-1 border-round bg-green-50 text-green-700 border-1 border-green-200">
                Langsung Tindakan
              </span>
            )}
          </div>

          <div className="col-12 py-1 flex justify-content-between align-items-center border-bottom-1 surface-border">
            <span className="text-500 flex align-items-center gap-1"><CreditCard size={15} /> Uang Muka (DP):</span>
            <span className="font-bold text-primary">{formatCurrency(booking.dp_nominal || 0)}</span>
          </div>

          {booking.dp_nominal > 0 ? (
            <div className="col-12 py-1 flex justify-content-between align-items-center border-bottom-1 surface-border">
              <span className="text-500">Metode Bayar DP:</span>
              <span className="font-semibold text-900 uppercase">
                {booking.metode_pembayaran_dp === 'cash'
                  ? 'Tunai (Cash)'
                  : booking.metode_pembayaran_dp === 'transfer'
                  ? 'Transfer Bank'
                  : booking.metode_pembayaran_dp === 'qris'
                  ? 'QRIS'
                  : booking.metode_pembayaran_dp || '-'}
              </span>
            </div>
          ) : (
            <div className="col-12 py-1 flex justify-content-between align-items-center border-bottom-1 surface-border">
              <span className="text-500">Alasan Bebas DP:</span>
              <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 border-round text-xs">
                {booking.alasan_bebas_dp || 'Klaim Paket / Bebas DP'}
              </span>
            </div>
          )}

          <div className="col-12 py-1 flex justify-content-between align-items-center border-bottom-1 surface-border">
            <span className="text-500">Status DP:</span>
            <Tag
              value={(booking.dp_status || 'belum_bayar').replace(/_/g, ' ').toUpperCase()}
              severity={
                booking.dp_status === 'sudah_bayar'
                  ? 'success'
                  : booking.dp_status === 'belum_bayar'
                  ? 'warning'
                  : 'danger'
              }
            />
          </div>

          <div className="col-12 py-1 flex justify-content-between align-items-center border-bottom-1 surface-border">
            <span className="text-500">Status Booking:</span>
            <Tag
              value={(booking.status || 'dikonfirmasi').toUpperCase()}
              severity={
                booking.status === 'selesai'
                  ? 'success'
                  : booking.status === 'dikonfirmasi'
                  ? 'info'
                  : booking.status === 'dibatalkan'
                  ? 'danger'
                  : 'secondary'
              }
            />
          </div>

          {booking.catatan_pasien && (
            <div className="col-12 py-2 border-bottom-1 surface-border">
              <span className="text-500 block mb-1 flex align-items-center gap-1"><FileText size={15} /> Catatan:</span>
              <span className="text-800 italic bg-surface-50 p-2 border-round block">{booking.catatan_pasien}</span>
            </div>
          )}
        </div>

        {Number(booking.butuh_konsul) === 1 ? (
          <div className="mt-3 p-2 bg-purple-50 border-1 border-purple-200 border-round text-center text-xs text-purple-900 leading-normal">
            <strong>Catatan Alur:</strong> Pasien dijadwalkan untuk <strong>Konsultasi Dokter</strong> terlebih dahulu saat check-in di klinik sebelum tindakan treatment. Harap datang 15–20 menit lebih awal.
          </div>
        ) : (
          <div className="mt-3 text-center text-xs text-500">
            Harap datang 15 menit sebelum waktu janji temu. Keterlambatan lebih dari 30 menit dapat menyebabkan reservasi dibatalkan otomatis dan uang muka hangus.
          </div>
        )}
      </div>
    </Dialog>
  );
};

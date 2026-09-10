'use client';

import React, { useRef } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import type { BayarResult, CartItem } from '../page';
import { getStoredPrinterSettings } from './KasirPrinterModal';

const formatRupiah = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);

const METODE_LABEL: Record<string, string> = {
  tunai: '💵 Tunai',
  debit: '💳 Debit',
  kredit: '💳 Kredit',
  qris: '📱 QRIS',
  transfer: '🏦 Transfer',
};

interface KasirStrukModalProps {
  visible: boolean;
  result: BayarResult | null;
  onHide: () => void;
}

export const KasirStrukModal: React.FC<KasirStrukModalProps> = ({ visible, result, onHide }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const printerSettings = getStoredPrinterSettings();

  const paperWidthPx =
    printerSettings.paperSize === '58mm' ? '280px' : printerSettings.paperSize === '80mm' ? '340px' : '100%';

  React.useEffect(() => {
    if (visible && result && printerSettings.autoPrint) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [visible, result]);

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;

    // Ambil semua tag style & link stylesheet agar CSS PrimeFlex/Tailwind terbawa ke popup cetak
    const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((s) => s.outerHTML)
      .join('\n');

    const printWindow = window.open('', '_blank', 'width=450,height=750');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Struk Transaksi ${result?.kode_transaksi}</title>
          ${styleTags}
          <style>
            @page { size: auto; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              color: #1e293b;
              background: #ffffff !important;
              padding: 12px;
            }
            .receipt-print-wrapper {
              max-width: ${paperWidthPx};
              margin: 0 auto;
            }
            /* Hilangkan border & shadow kartu saat dicetak */
            .receipt-print-wrapper > div {
              box-shadow: none !important;
              border: none !important;
              padding: 0 !important;
            }
            .flex { display: flex !important; }
            .flex-column { flex-direction: column !important; }
            .justify-content-between { justify-content: space-between !important; }
            .align-items-center { align-items: center !important; }
            .font-bold { font-weight: 700 !important; }
            .font-black { font-weight: 900 !important; }
            .font-semibold { font-weight: 600 !important; }
            .text-center { text-align: center !important; }
            .text-rose-600 { color: #e11d48 !important; }
            .text-teal-700 { color: #0f766e !important; }
            .text-slate-500 { color: #64748b !important; }
            .text-slate-600 { color: #475569 !important; }
            .text-slate-800 { color: #1e293b !important; }
            .text-slate-900 { color: #0f172a !important; }
            .border-top-1 { border-top: 1px solid #cbd5e1 !important; }
            .border-dashed { border-top: 1px dashed #94a3b8 !important; }
            .my-2 { margin-top: 8px !important; margin-bottom: 8px !important; }
            .mb-1 { margin-bottom: 4px !important; }
            .mb-2 { margin-bottom: 8px !important; }
            .mb-3 { margin-bottom: 12px !important; }
          </style>
        </head>
        <body>
          <div class="receipt-print-wrapper">
            ${el.innerHTML}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  if (!result) return null;

  const now = new Date();
  const tanggalStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const jamStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const totalOriginal = result.total_bayar + (result.total_diskon || 0);

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      showHeader={false}
      style={{ width: '460px', borderRadius: '20px', overflow: 'hidden' }}
      contentStyle={{ padding: 0, borderRadius: '20px' }}
    >
      {/* Top Banner Header */}
      <div style={{ background: '#0d9488', padding: '24px 16px', textAlign: 'center', color: '#ffffff', position: 'relative' }}>
        <button
          onClick={onHide}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'transparent',
            border: 'none',
            color: '#ffffff',
            opacity: 0.8,
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: '18px',
            lineHeight: 1,
          }}
          title="Tutup Modal"
        >
          <i className="pi pi-times" />
        </button>

        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.2)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 10px'
        }}>
          <i className="pi pi-check-circle text-white" style={{ fontSize: '28px' }} />
        </div>
        <h3 style={{ fontSize: '20px', fontWeight: 900, margin: '0 0 4px 0', color: '#ffffff' }}>Pembayaran Berhasil!</h3>
        <p style={{ fontSize: '13px', margin: 0, opacity: 0.85, fontFamily: 'monospace' }}>{result.kode_transaksi}</p>
      </div>

      {/* Paper Receipt Preview Body */}
      <div className="p-4 surface-ground max-h-[55vh] overflow-y-auto">
        <div
          ref={printRef}
          style={{ maxWidth: paperWidthPx, margin: '0 auto' }}
          className="bg-white p-4 border-round-xl border-1 surface-border shadow-2 text-slate-800 text-xs font-mono"
        >
          {/* Receipt Brand Header */}
          <div className="text-center mb-3">
            <div className="text-base font-black text-slate-900 tracking-tight">🌸 Klinik Kecantikan</div>
            {printerSettings.headerAddress && (
              <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{printerSettings.headerAddress}</div>
            )}
            <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mt-1">Struk Transaksi</div>
          </div>

          <div className="border-top-1 border-dashed surface-border my-2" />

          {/* Meta Info */}
          <div className="flex justify-content-between mb-1">
            <span className="text-slate-500">No. Transaksi</span>
            <span className="font-bold text-slate-900">{result.kode_transaksi}</span>
          </div>
          <div className="flex justify-content-between mb-1">
            <span className="text-slate-500">Pasien</span>
            <span className="font-bold text-slate-900">{result.nama_pasien || '-'}</span>
          </div>
          <div className="flex justify-content-between mb-1">
            <span className="text-slate-500">No. RM</span>
            <span className="font-bold text-slate-900">{result.no_rm || '-'}</span>
          </div>
          <div className="flex justify-content-between mb-1">
            <span className="text-slate-500">Tanggal</span>
            <span className="font-semibold text-slate-800">{tanggalStr}</span>
          </div>
          <div className="flex justify-content-between mb-1">
            <span className="text-slate-500">Jam</span>
            <span className="font-semibold text-slate-800">{jamStr}</span>
          </div>

          <div className="border-top-1 border-dashed surface-border my-2" />

          {/* Cart Item Details */}
          <div className="flex flex-column gap-2.5 my-2">
            {(result.items || []).map((item: CartItem, i: number) => (
              <div key={i} className="flex flex-column gap-0.5">
                <div className="font-bold text-slate-900 flex justify-content-between">
                  <span>{item.nama}</span>
                  {item.is_promo && <span className="text-rose-600 text-[10px]">🔥 PROMO</span>}
                </div>
                <div className="flex justify-content-between text-slate-600 text-[11px]">
                  <span>{item.qty} × {formatRupiah(item.harga_satuan)}</span>
                  <span className="font-bold text-slate-900">{formatRupiah(item.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-top-1 border-dashed surface-border my-2" />

          {/* Financial Totals */}
          <div className="flex justify-content-between mb-1">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-bold text-slate-800">{formatRupiah(totalOriginal)}</span>
          </div>

          {result.total_diskon != null && result.total_diskon > 0 && (
            <div className="flex justify-content-between mb-1 text-rose-600">
              <span>Diskon {result.nama_promo ? `(${result.nama_promo})` : ''}</span>
              <span className="font-bold">- {formatRupiah(result.total_diskon)}</span>
            </div>
          )}

          {result.dp_nominal != null && result.dp_nominal > 0 ? (
            <>
              <div className="flex justify-content-between mb-1 text-slate-700">
                <span>Total Biaya</span>
                <span className="font-semibold text-slate-900">{formatRupiah(result.total_bayar)}</span>
              </div>
              <div className="flex justify-content-between mb-1 text-teal-700 font-semibold">
                <span>Uang Muka (DP {result.metode_pembayaran_dp ? result.metode_pembayaran_dp.toUpperCase() : 'Terbayar'})</span>
                <span>- {formatRupiah(result.dp_nominal)}</span>
              </div>
              <div className="border-top-1 border-dashed surface-border my-1" />
              <div className="flex justify-content-between pt-1 font-bold text-sm text-slate-900 mb-2">
                <span>Sisa Pelunasan</span>
                <span className="text-teal-700">{formatRupiah(result.sisa_bayar !== undefined ? result.sisa_bayar : Math.max(0, result.total_bayar - result.dp_nominal))}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-content-between pt-1 border-top-1 border-slate-200 mt-1 mb-2 font-bold text-sm text-slate-900">
              <span>Total Bayar</span>
              <span className="text-teal-700">{formatRupiah(result.total_bayar)}</span>
            </div>
          )}

          <div className="border-top-1 border-dashed surface-border my-2" />

          {/* Payment Method details */}
          <div className="flex justify-content-between mb-1">
            <span className="text-slate-600">Metode</span>
            <span className="font-bold text-slate-900">{METODE_LABEL[result.metode_bayar] || result.metode_bayar}</span>
          </div>

          {result.metode_bayar === 'tunai' && (
            <>
              <div className="flex justify-content-between mb-1">
                <span className="text-slate-600">Dibayar</span>
                <span className="font-bold text-slate-900">{formatRupiah(result.nominal_bayar)}</span>
              </div>
              <div className="flex justify-content-between mb-1">
                <span className="text-slate-600">Kembalian</span>
                <span className="font-bold text-slate-900">{formatRupiah(result.kembalian)}</span>
              </div>
            </>
          )}

          {/* Lunas Status Badge */}
          <div className="my-3 text-center py-1.5 px-3 border-round border-2 border-emerald-500 text-emerald-700 font-black text-sm tracking-wider uppercase bg-emerald-50">
            ✓ LUNAS
          </div>

          {/* Footer message */}
          <div className="text-center text-[11px] text-slate-500 line-height-2 mt-2 whitespace-pre-line">
            {printerSettings.footerMessage || 'Terima kasih atas kunjungan Anda!\nSemoga lekas sembuh & cantik selalu 🌸'}
          </div>
        </div>
      </div>

      {/* Modal Actions Footer */}
      <div className="p-3 bg-white border-top-1 surface-border flex gap-2">
        <Button
          label="Cetak Struk"
          icon="pi pi-print"
          onClick={handlePrint}
          className="flex-1 font-bold text-xs bg-teal-600 hover:bg-teal-700 border-none border-round-lg text-white shadow-2 py-2.5"
        />
        <Button
          label="Tutup"
          icon="pi pi-times"
          outlined
          severity="secondary"
          onClick={onHide}
          className="flex-1 font-bold text-xs border-round-lg py-2.5"
        />
      </div>
    </Dialog>
  );
};

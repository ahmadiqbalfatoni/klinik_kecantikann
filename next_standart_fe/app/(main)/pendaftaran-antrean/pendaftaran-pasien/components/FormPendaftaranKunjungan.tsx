'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { TabView, TabPanel } from 'primereact/tabview';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Toast } from 'primereact/toast';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { OverlayPanel } from 'primereact/overlaypanel';
import { Dialog } from 'primereact/dialog';
import postData from '@/lib/axios/postData';
import { showError, showSuccess } from '@/lib/tools/generalTools';
import { DialogJadwalMingguanRuangan, RoomTabOption } from '../../booking/components/DialogJadwalMingguanRuangan';
import {
  LayananCard,
  ServiceItem,
  RuanganGroup,
  getItemConsultType,
} from '@/app/(main)/pendaftaran-antrean/components/shared/LayananCard';
import { KarcisAntrianModal } from './dialogs/KarcisAntrianModal';
import { KarcisAntrianLayananModal } from './dialogs/KarcisAntrianLayananModal';
import {
  User,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Info,
  Users,
  Ticket,
} from 'lucide-react';

interface Pasien {
  id?: number;
  no_rm: string;
  nama: string;
  nik?: string;
  no_hp?: string;
  jenis_kelamin?: string;
  tanggal_lahir?: string;
  alamat?: string;
  provinsi?: string;
  kota_kabupaten?: string;
  kecamatan?: string;
  kelurahan_desa?: string;
}

interface SlotItem {
  kode_jadwal: string;
  no_sip: string;
  nama_petugas: string;
  jabatan_petugas: string;
  is_penanggung_jawab?: boolean;
  has_pj?: boolean;
  petugas_pendamping?: Array<{
    kode_jadwal?: string;
    no_sip: string;
    nama_petugas: string;
    jabatan_petugas: string;
  }>;
  jumlah_pendamping?: number;
  kode_ruangan: string;
  nama_ruangan: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  kuota_total: number;
  kuota_terisi: number;
  sisa_kuota: number;
  is_available: boolean;
}

interface Props {
  toast: React.RefObject<Toast>;
  onSuccess?: () => void;
}

export const FormPendaftaranKunjungan: React.FC<Props> = ({ toast, onSuccess }) => {
  // 1. Pasien State
  const [pasienSearch, setPasienSearch] = useState('');
  const [pasienList, setPasienList] = useState<Pasien[]>([]);
  const [loadingPasien, setLoadingPasien] = useState(false);
  const [selectedPasien, setSelectedPasien] = useState<Pasien | null>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);


  // 2. Tanggal & Ruangan State
  const [tanggalKunjungan, setTanggalKunjungan] = useState<Date>(new Date());
  const [ruangans, setRuangans] = useState<RuanganGroup[]>([]);
  const [loadingRuangan, setLoadingRuangan] = useState(true);
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
  const [selectedMap, setSelectedMap] = useState<{ [key: string]: ServiceItem }>({});
  const [activeRuangan, setActiveRuangan] = useState<string | null>(null);
  const [ownedPackages, setOwnedPackages] = useState<any[]>([]);
  const [globalConsultChoice, setGlobalConsultChoice] = useState<boolean>(true);

  // 3. Slot Jadwal State
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [dokterKonsulList, setDokterKonsulList] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);

  // 4. Modal Karcis Antrean State
  const [karcisVisible, setKarcisVisible] = useState(false);
  const [ticketData, setTicketData] = useState<any>(null);
  const [antrianLayananModalVisible, setAntrianLayananModalVisible] = useState(false);
  const [antrianLayananData, setAntrianLayananData] = useState<any>(null);

  // 5. Submit State
  const [submitting, setSubmitting] = useState(false);

  // 6. Dialog Jadwal Mingguan Ruangan
  const [showJadwalRuanganDialog, setShowJadwalRuanganDialog] = useState(false);
  const [jadwalDialogRooms, setJadwalDialogRooms] = useState<RoomTabOption[]>([]);

  // 7. Popover Pendamping
  const companionOpRef = useRef<OverlayPanel>(null);
  const [activeCompanionData, setActiveCompanionData] = useState<{
    pj: string;
    jam: string;
    ruangan: string;
    companions: Array<{
      nama_petugas: string;
      jabatan_petugas?: string;
      no_sip?: string;
    }>;
  } | null>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatDateToYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Helper ringkasan pendamping
  const getCompanionSummary = (companions: Array<{ nama_petugas: string }>, total: number) => {
    const count = total || (companions ? companions.length : 0);
    if (count <= 0) return '';
    if (count === 1) return companions[0]?.nama_petugas || '1 petugas';
    if (count === 2) return `${companions[0]?.nama_petugas || ''}, ${companions[1]?.nama_petugas || ''}`;
    return `${companions[0]?.nama_petugas || ''}, ${companions[1]?.nama_petugas || ''}, +${count - 2} lainnya`;
  };

  // Load Ruangan & Layanan saat mount
  useEffect(() => {
    fetchRuanganOptions();
  }, []);

  const fetchRuanganOptions = async () => {
    setLoadingRuangan(true);
    try {
      const res = await postData('/master/pendaftaran-pasien-layanan-options');
      if (['00', '0000', 200].includes(res?.data?.status) || res?.status === 200) {
        const rawRuangan = res.data?.data?.ruangan_layanan || res.data?.data?.kategori_layanan || [];
        setRuangans(rawRuangan);
      } else {
        showError(toast, res?.data?.message || 'Gagal memuat pilihan layanan');
      }
    } catch (error) {
      showError(toast, 'Terjadi kesalahan saat memuat daftar layanan & ruangan');
    } finally {
      setLoadingRuangan(false);
    }
  };

  // Search Pasien dengan debounce
  const handleSearchPasien = (query: string) => {
    setPasienSearch(query);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!query.trim()) {
      setPasienList([]);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setLoadingPasien(true);
      try {
        const res = await postData('/master/pendaftaran-pasien-cari', {
          keyword: query.trim(),
          page: 1,
          perPage: 6,
        });
        if (['00', '0000', 200].includes(res?.data?.status) || res?.status === 200) {
          setPasienList(res.data?.data || []);
        } else {
          setPasienList([]);
        }
      } catch (err) {
        setPasienList([]);
      } finally {
        setLoadingPasien(false);
      }
    }, 300);
  };

  // Fetch Paket yang Dimiliki Pasien
  useEffect(() => {
    if (selectedPasien?.no_rm) {
      fetchOwnedPackages(selectedPasien.no_rm);
    } else {
      setOwnedPackages([]);
    }
  }, [selectedPasien?.no_rm]);

  const fetchOwnedPackages = async (noRm: string) => {
    try {
      const res = await postData('/master/pendaftaran-pasien-kepemilikan-paket', {
        no_rm: noRm,
        status: 'aktif',
      });
      if (['00', '0000', 200].includes(res?.data?.status) || res?.status === 200) {
        setOwnedPackages(res?.data?.data || []);
      } else {
        setOwnedPackages([]);
      }
    } catch (err) {
      setOwnedPackages([]);
    }
  };

  const claimablePackages = useMemo(() => {
    return (ownedPackages || []).filter((pkg: any) => {
      if (pkg.status && pkg.status.toLowerCase() !== 'aktif') return false;
      return (pkg.details || []).some((det: any) => (det.sisa_sesi || 0) > 0);
    });
  }, [ownedPackages]);

  useEffect(() => {
    setActiveTabIndex(0);
  }, [claimablePackages.length]);

  // Toggle Layanan / Paket
  const handleToggleItem = (item: ServiceItem) => {
    const key = item.jenis === 'klaim_paket'
      ? `klaim_${item.kode_detail_kepemilikan_paket_layanan || item.kode_layanan}`
      : `${item.jenis}_${item.kode_layanan}`;

    const isCurrentlySelected = !!selectedMap[key];

    if (isCurrentlySelected) {
      const newMap = { ...selectedMap };
      delete newMap[key];
      setSelectedMap(newMap);
      const remainingItems = Object.values(newMap);
      if (remainingItems.length === 0) {
        setActiveRuangan(null);
      }
    } else {
      if (item.jenis === 'klaim_paket' && item.tanggal_expired) {
        const curDateStr = formatDateToYMD(tanggalKunjungan);
        if (curDateStr > item.tanggal_expired) {
          showError(toast, `Paket "${item.nama}" sudah kedaluwarsa pada ${item.tanggal_expired}`);
          return;
        }
      }

      if (activeRuangan !== null && activeRuangan !== item.kode_ruangan) {
        const currentSelectedRoom = Object.values(selectedMap)[0]?.nama_ruangan || activeRuangan;
        showError(
          toast,
          `Anda hanya dapat memilih layanan/paket dalam 1 ruangan yang sama per kunjungan. Saat ini ruangan: ${currentSelectedRoom}. Batalkan pilihan sebelumnya jika ingin berganti ruangan.`
        );
        return;
      }

      setSelectedMap((prev) => ({ ...prev, [key]: item }));
      setActiveRuangan(item.kode_ruangan || null);
    }
  };

  const selectedList = Object.values(selectedMap);
  const totalHarga = selectedList.reduce((acc, curr) => acc + (curr.jenis === 'klaim_paket' ? 0 : (curr.harga_asal ?? curr.harga)), 0);
  const totalDurasi = selectedList.reduce((acc, curr) => acc + (curr.durasi_menit || 0), 0);

  const activeRoomName = useMemo(() => {
    if (!activeRuangan) return '';
    const r = ruangans.find((x) => x.kode_ruangan === activeRuangan);
    return r?.nama_ruangan || selectedList[0]?.nama_ruangan || `Ruangan ${activeRuangan}`;
  }, [activeRuangan, ruangans, selectedList]);

  // Cek Kebutuhan Konsultasi Dokter
  const hasWajibKonsul = useMemo(() => {
    return selectedList.some((item) => {
      const { isWajib } = getItemConsultType(item);
      return isWajib;
    });
  }, [selectedList]);

  const hasOpsionalKonsul = useMemo(() => {
    return selectedList.some((item) => {
      const { isOpsional } = getItemConsultType(item);
      return isOpsional;
    });
  }, [selectedList]);

  const effectiveButuhKonsul = useMemo(() => {
    if (hasWajibKonsul) return true;
    if (hasOpsionalKonsul) return globalConsultChoice;
    return false;
  }, [hasWajibKonsul, hasOpsionalKonsul, globalConsultChoice]);

  // Dialog Jadwal Mingguan Ruangan
  const handleOpenJadwalDialog = () => {
    if (effectiveButuhKonsul) {
      const consultRoom = ruangans.find((r) => r.is_konsultasi || (r.nama_ruangan || '').toLowerCase().includes('konsultasi'));
      const roomList: RoomTabOption[] = [
        {
          kodeRuangan: consultRoom?.kode_ruangan || 'RNG-001',
          namaRuangan: consultRoom?.nama_ruangan || 'Ruang Konsultasi Dokter',
          iconType: 'doctor',
        },
      ];
      if (activeRuangan) {
        roomList.push({
          kodeRuangan: activeRuangan,
          namaRuangan: activeRoomName || 'Ruangan Treatment',
          iconType: 'treatment',
        });
      }
      setJadwalDialogRooms(roomList);
    } else {
      if (!activeRuangan) return;
      setJadwalDialogRooms([
        {
          kodeRuangan: activeRuangan,
          namaRuangan: activeRoomName || 'Ruangan Treatment',
          iconType: 'treatment',
        },
      ]);
    }
    setShowJadwalRuanganDialog(true);
  };

  // Group slots per sesi
  const groupSlotsBySession = (rawSlots: SlotItem[]): SlotItem[] => {
    const sessionMap = new Map<string, SlotItem[]>();

    for (const slot of rawSlots) {
      const jamMulaiClean = (slot.jam_mulai || '').slice(0, 5);
      const jamSelesaiClean = (slot.jam_selesai || '').slice(0, 5);
      const key = `${slot.kode_ruangan || ''}_${(slot.hari || '').toLowerCase()}_${jamMulaiClean}_${jamSelesaiClean}`;

      if (!sessionMap.has(key)) {
        sessionMap.set(key, []);
      }
      sessionMap.get(key)!.push({
        ...slot,
        jam_mulai: jamMulaiClean,
        jam_selesai: jamSelesaiClean,
      });
    }

    const result: SlotItem[] = [];

    for (const items of sessionMap.values()) {
      const pjSlot = items.find((s) => s.is_penanggung_jawab) || items[0];
      const hasPJ = items.some((s) => s.is_penanggung_jawab);
      const pjNoSip = String(pjSlot.no_sip || '').trim().toLowerCase();
      const pjNama = String(pjSlot.nama_petugas || '').trim().toLowerCase();

      const seenCompanion = new Set<string>();
      if (pjNoSip) seenCompanion.add(pjNoSip);
      if (pjNama) seenCompanion.add(pjNama);

      const cleanCompanions: Array<{
        kode_jadwal?: string;
        no_sip: string;
        nama_petugas: string;
        jabatan_petugas: string;
      }> = [];

      const addCompanion = (c: {
        kode_jadwal?: string;
        no_sip: string;
        nama_petugas: string;
        jabatan_petugas?: string;
      }) => {
        const cNoSip = String(c.no_sip || '').trim().toLowerCase();
        const cNama = String(c.nama_petugas || '').trim().toLowerCase();
        if (c.kode_jadwal && c.kode_jadwal === pjSlot.kode_jadwal) return;
        if (pjNoSip && cNoSip === pjNoSip) return;
        if (pjNama && cNama === pjNama) return;

        const dedupeKey = cNoSip || cNama;
        if (dedupeKey && seenCompanion.has(dedupeKey)) return;
        if (dedupeKey) seenCompanion.add(dedupeKey);

        cleanCompanions.push({
          kode_jadwal: c.kode_jadwal,
          no_sip: c.no_sip,
          nama_petugas: c.nama_petugas,
          jabatan_petugas: c.jabatan_petugas || 'Terapis / Petugas',
        });
      };

      for (const item of items) {
        if (item.kode_jadwal !== pjSlot.kode_jadwal) {
          addCompanion({
            kode_jadwal: item.kode_jadwal,
            no_sip: item.no_sip,
            nama_petugas: item.nama_petugas,
            jabatan_petugas: item.jabatan_petugas,
          });
        }
        if (Array.isArray(item.petugas_pendamping)) {
          for (const c of item.petugas_pendamping) {
            addCompanion(c);
          }
        }
      }

      result.push({
        ...pjSlot,
        has_pj: hasPJ,
        petugas_pendamping: cleanCompanions,
        jumlah_pendamping: cleanCompanions.length,
      });
    }

    return result;
  };

  // Fetch Slot Jadwal saat ruangan & tanggal aktif
  useEffect(() => {
    if (!tanggalKunjungan || !activeRuangan) {
      setSlots([]);
      setDokterKonsulList([]);
      setSelectedSlot(null);
      return;
    }
    fetchSlots();
  }, [tanggalKunjungan, activeRuangan]);

  const fetchSlots = async () => {
    if (!activeRuangan) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const tglYmd = formatDateToYMD(tanggalKunjungan);
      const res = await postData('/transaksi/booking/slots', {
        tanggal_booking: tglYmd,
        kode_ruangan: activeRuangan,
        kode_layanan: selectedList[0]?.kode_layanan,
        jenis_layanan: selectedList[0]?.jenis,
      });

      if (res.data?.status === 200 || res.status === 200) {
        const d = res.data?.data;
        const rawSlots: SlotItem[] = d?.slots || [];
        const grouped = groupSlotsBySession(rawSlots);
        setSlots(grouped);
        setDokterKonsulList(d?.dokter_konsul || []);
        // Jika hanya ada 1 slot, otomatis pilih
        if (grouped.length === 1 && grouped[0].is_available) {
          setSelectedSlot(grouped[0]);
        }
      } else {
        setSlots([]);
        setDokterKonsulList([]);
      }
    } catch (err) {
      setSlots([]);
      setDokterKonsulList([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  // SUBMIT PENDAFTARAN KUNJUNGAN (LANGSUNG TERBITKAN ANTREAN TANPA PILIH JAM / DP)
  const handleSubmitPendaftaran = async () => {
    if (!selectedPasien) {
      showError(toast, 'Harap pilih pasien terlebih dahulu di Langkah 1');
      return;
    }
    if (selectedList.length === 0) {
      showError(toast, 'Harap pilih minimal satu layanan atau paket di Langkah 2');
      return;
    }
    if (!selectedSlot) {
      showError(toast, 'Harap pilih slot jadwal sesi petugas di Langkah 3');
      return;
    }

    setSubmitting(true);
    try {
      const itemsPayload = selectedList.map((item) => {
        const { isWajib, isService } = getItemConsultType(item);

        let chooseConsult = false;
        if (isWajib) {
          chooseConsult = true;
        } else if (isService) {
          chooseConsult = false;
        } else {
          chooseConsult = globalConsultChoice;
        }

        return {
          jenis_layanan: item.jenis,
          kode_layanan: item.kode_layanan,
          kode_ruangan: item.kode_ruangan,
          nama_ruangan: item.nama_ruangan,
          butuh_konsul: chooseConsult,
          wajib_konsultasi: item.wajib_konsultasi || (isWajib ? 'wajib' : isService ? 'tidak' : 'opsional'),
          lewat_konsultasi: chooseConsult,
          kode_kepemilikan_paket_layanan: item.kode_kepemilikan_paket_layanan,
          kode_jadwal: selectedSlot.kode_jadwal,
        };
      });

      const payload = {
        no_rm: selectedPasien.no_rm,
        items: itemsPayload,
        kode_jadwal: selectedSlot.kode_jadwal,
      };

      const res = await postData('/master/pendaftaran-pasien-ambil-antrian-layanan', payload);

      if (['00', '0000', 200].includes(res.data?.status) || res.status === 200) {
        showSuccess(toast, res.data?.message || 'Pendaftaran kunjungan & antrean berhasil diterbitkan');
        const resultData = res.data?.data;

        if (resultData?.antrian_layanan && resultData.antrian_layanan.length > 0) {
          setAntrianLayananData(resultData);
          setAntrianLayananModalVisible(true);
        } else if (resultData) {
          setTicketData({
            no_rm: resultData.no_rm || selectedPasien.no_rm,
            nama: resultData.nama_pasien || selectedPasien.nama,
            kode_kunjungan: resultData.kode_kunjungan,
            nomor_antrian: resultData.nomor_antrian_awal,
            kode_antrian: resultData.kode_antrian_awal,
            tanggal_kunjungan: resultData.tanggal_kunjungan,
            jam_datang: resultData.jam_datang,
          });
          setKarcisVisible(true);
        }

        // Reset state pendaftaran untuk pasien berikutnya
        setSelectedPasien(null);
        setPasienSearch('');
        setSelectedMap({});
        setActiveRuangan(null);
        setSelectedSlot(null);

        if (onSuccess) onSuccess();
      } else {
        showError(toast, res.data?.message || 'Gagal memproses pendaftaran kunjungan');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Terjadi kesalahan sistem saat mendaftarkan kunjungan';
      showError(toast, msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="layout-pendaftaran-kunjungan">
      {/* ============================================================ */}
      {/* 1. CARD PILIH PASIEN (PERSIS SEPERTI GAMBAR) */}
      {/* ============================================================ */}
      <div className="card surface-card border-1 surface-border border-round-xl p-4 shadow-1 mb-3">
        <div className="flex align-items-center justify-content-between mb-3">
          <div className="flex align-items-center gap-2">
            <span
              className="flex align-items-center justify-content-center bg-primary text-white border-round-circle font-bold"
              style={{ width: 28, height: 28, fontSize: '13px' }}
            >
              1
            </span>
            <span className="font-bold text-lg text-900">Pilih Pasien</span>
          </div>
        </div>

        {selectedPasien ? (
          /* TAMPILAN PASIEN TERPILIH PERSIS SEPERTI SCREENSHOT */
          <div className="border-1 surface-border border-round-xl p-3 bg-white flex flex-column sm:flex-row align-items-start sm:align-items-center justify-content-between gap-3">
            <div className="flex align-items-center gap-3">
              <div
                className="border-round-circle flex align-items-center justify-content-center flex-shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                }}
              >
                <User size={24} />
              </div>
              <div>
                <div className="flex align-items-center gap-2 mb-2">
                  <span className="font-bold text-lg text-900">{selectedPasien.nama}</span>
                  <Tag
                    value={selectedPasien.no_rm}
                    severity="info"
                    className="text-xs font-mono font-bold px-2 py-0.5 border-round-md"
                    style={{ backgroundColor: '#0ea5e9', color: '#ffffff' }}
                  />
                </div>

                {/* BARIS 1: NIK · NO. HP · GENDER */}
                <div className="text-xs text-500 flex flex-wrap align-items-center mb-1">
                  <span>
                    NIK: <span className="font-medium text-800 font-mono">{selectedPasien.nik || '-'}</span>
                  </span>
                  <span className="text-400 mx-2">·</span>
                  <span>
                    No. HP: <span className="font-medium text-800">{selectedPasien.no_hp || '-'}</span>
                  </span>
                  <span className="text-400 mx-2">·</span>
                  <span>
                    Gender:{' '}
                    <span className="font-medium text-800">
                      {selectedPasien.jenis_kelamin === 'L'
                        ? 'Laki-laki'
                        : selectedPasien.jenis_kelamin === 'P'
                        ? 'Perempuan'
                        : '-'}
                    </span>
                  </span>
                </div>

                {/* BARIS 2: ALAMAT LENGKAP */}
                {(selectedPasien.kota_kabupaten || selectedPasien.kecamatan || selectedPasien.alamat || selectedPasien.kelurahan_desa) && (
                  <div className="text-xs text-500 flex align-items-center flex-wrap">
                    <span>
                      Alamat:{' '}
                      <span className="font-medium text-800">
                        {[selectedPasien.kelurahan_desa, selectedPasien.kecamatan, selectedPasien.kota_kabupaten]
                          .filter(Boolean)
                          .join(', ') || selectedPasien.alamat || selectedPasien.provinsi || '-'}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Button
              type="button"
              label="Ganti Pasien"
              icon="pi pi-refresh"
              className="p-button-text p-button-secondary p-button-sm text-xs font-semibold"
              onClick={() => {
                setSelectedPasien(null);
                setPasienSearch('');
                setSelectedMap({});
                setActiveRuangan(null);
                setSelectedSlot(null);
              }}
            />
          </div>
        ) : (
          /* FORM CARI PASIEN (JIKA BELUM MEMILIH) */
          <div>
            <IconField iconPosition="left" className="w-full">
              <InputIcon className="pi pi-search" />
              <InputText
                value={pasienSearch}
                onChange={(e) => handleSearchPasien(e.target.value)}
                placeholder="Cari Pasien (Ketik Nama, No. RM, No. HP, atau NIK)..."
                className="w-full text-sm border-round-lg"
              />
            </IconField>

            {loadingPasien && (
              <div className="text-xs text-500 mt-2 flex align-items-center gap-2">
                <ProgressSpinner style={{ width: '16px', height: '16px' }} strokeWidth="4" />
                <span>Mencari data pasien...</span>
              </div>
            )}

            {pasienList.length > 0 && !selectedPasien && (
              <div className="border-1 surface-border border-round-lg mt-2 overflow-hidden shadow-1">
                <DataTable
                  value={pasienList}
                  size="small"
                  className="text-sm"
                  rowClassName={() => 'cursor-pointer hover:surface-100 transition-colors'}
                  onRowClick={(e) => {
                    setSelectedPasien(e.data as Pasien);
                    setPasienList([]);
                  }}
                >
                  <Column
                    field="no_rm"
                    header="No. RM"
                    body={(r: Pasien) => <span className="font-mono font-bold text-primary">{r.no_rm}</span>}
                    style={{ width: '110px' }}
                  />
                  <Column
                    field="nama"
                    header="Nama Pasien"
                    body={(r: Pasien) => <span className="font-semibold text-900">{r.nama}</span>}
                    style={{ minWidth: '150px' }}
                  />
                  <Column
                    field="nik"
                    header="NIK"
                    body={(r: Pasien) => <span className="font-mono text-700 text-xs">{r.nik || '-'}</span>}
                    style={{ width: '140px' }}
                  />
                  <Column
                    header="L/P"
                    align="center"
                    style={{ width: '100px' }}
                    body={(r: Pasien) => {
                      if (!r.jenis_kelamin) return <span className="text-400 text-xs">-</span>;
                      const isMale = r.jenis_kelamin === 'L';
                      return (
                        <Tag
                          value={isMale ? 'Laki-Laki' : 'Perempuan'}
                          severity={isMale ? 'info' : 'success'}
                          className="text-xs px-2 py-0.5"
                        />
                      );
                    }}
                  />
                  <Column
                    field="no_hp"
                    header="No. HP"
                    body={(r: Pasien) => <span className="text-700 font-mono text-xs">{r.no_hp || '-'}</span>}
                    style={{ width: '130px' }}
                  />
                  <Column
                    header="Alamat / Wilayah"
                    style={{ minWidth: '180px' }}
                    body={(r: Pasien) => {
                      const wilayah = [r.kelurahan_desa, r.kecamatan, r.kota_kabupaten].filter(Boolean).join(', ');
                      return <span className="text-600 text-xs">{wilayah || r.alamat || r.provinsi || '-'}</span>;
                    }}
                  />
                  <Column
                    header="Aksi"
                    align="center"
                    style={{ width: '85px' }}
                    body={(r: Pasien) => (
                      <Button
                        label="Pilih"
                        icon="pi pi-check"
                        size="small"
                        severity="success"
                        className="py-1 px-2.5 text-xs font-bold"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPasien(r);
                          setPasienList([]);
                        }}
                      />
                    )}
                  />
                </DataTable>
              </div>
            )}

            {pasienSearch && !loadingPasien && pasienList.length === 0 && (
              <div className="text-xs text-500 mt-2 p-3 surface-100 border-round-lg flex align-items-center justify-content-between">
                <span>
                  Pasien tidak ditemukan dengan kata kunci &ldquo;{pasienSearch}&rdquo;. Pastikan data pasien telah didaftarkan melalui menu <strong className="text-primary">Pasien Baru</strong>.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. CARD PILIH LAYANAN & PAKET TREATMENT (PERSIS SEPERTI GAMBAR) */}
      {/* ============================================================ */}
      <div className="card surface-card border-1 surface-border border-round-xl p-4 shadow-1 mb-3">
        <div className="flex flex-column sm:flex-row sm:align-items-center justify-content-between gap-2 mb-3">
          <div>
            <div className="flex align-items-center gap-2">
              <span
                className="flex align-items-center justify-content-center bg-primary text-white border-round-circle font-bold"
                style={{ width: 28, height: 28, fontSize: '13px' }}
              >
                2
              </span>
              <span className="font-bold text-lg text-900">Pilih Layanan & Paket Treatment</span>
            </div>
            <p className="text-xs text-500 m-0 mt-1 pl-5">
              Pilih satu atau beberapa layanan/paket dalam ruangan yang sama untuk menentukan slot jadwal petugas.
            </p>
          </div>
        </div>

        {loadingRuangan ? (
          <div className="flex flex-column align-items-center justify-content-center p-5">
            <ProgressSpinner style={{ width: '40px', height: '40px' }} strokeWidth="4" />
            <span className="text-500 text-sm mt-2">Memuat opsi ruangan &amp; layanan...</span>
          </div>
        ) : (
          <TabView
            className="p-tabview-custom"
            activeIndex={activeTabIndex}
            onTabChange={(e) => setActiveTabIndex(e.index)}
          >
            {(() => {
              const panels: React.ReactNode[] = [];

              {/* TAB KHUSUS: PAKET YANG SUDAH DIMILIKI PASIEN */}
              if (claimablePackages.length > 0) {
                panels.push(
                  <TabPanel
                    key="owned_packages_tab"
                    header={`🎁 Paket Dimiliki Pasien (${claimablePackages.length})`}
                    leftIcon="pi pi-gift mr-2 text-amber-600 font-bold"
                  >
                    <div className="p-3 bg-amber-50 border-round-lg border-1 border-amber-200 mb-3 flex align-items-center gap-2">
                      <i className="pi pi-info-circle text-amber-600 text-lg" />
                      <span className="text-sm text-amber-900 font-semibold">
                        Pasien memiliki paket aktif! Pilih sesi treatment di bawah ini untuk mengklaim sesi lanjutan (Rp 0).
                      </span>
                    </div>

                    <div className="grid">
                      {claimablePackages.map((pkg: any) => {
                        return (pkg.details || [])
                          .filter((det: any) => (det.sisa_sesi || 0) > 0)
                          .map((det: any) => {
                            const claimItem: ServiceItem = {
                              jenis: 'klaim_paket',
                              kode_layanan: det.kode_layanan,
                              kode_kategori: 'KLAIM PAKET',
                              nama_kategori: `Klaim Paket`,
                              nama: `${det.nama_layanan || det.kode_layanan}`,
                              harga: 0,
                              harga_asal: 0,
                              durasi_menit: det.durasi_menit || 45,
                              total_sesi: det.sesi_total,
                              sisa_sesi: det.sisa_sesi,
                              sesi_terbooking: det.sesi_terbooking || 0,
                              sesi_tersedia: det.sesi_tersedia ?? det.sisa_sesi,
                              tanggal_expired: pkg.tanggal_expired,
                              kode_ruangan: det.kode_ruangan || pkg.kode_ruangan_paket || 'RNG-002',
                              nama_ruangan: det.nama_ruangan || pkg.nama_ruangan_paket || 'Ruangan Treatment',
                              tipe: pkg.tipe_paket || 'BEAUTY TREATMENT',
                              tipe_paket: pkg.tipe_paket || 'BEAUTY TREATMENT',
                              wajib_konsultasi: pkg.tipe_paket === 'MEDICAL TREATMENT' ? 'wajib' : pkg.tipe_paket === 'SERVICE TREATMENT' ? 'tidak' : 'opsional',
                              kode_kepemilikan_paket_layanan: pkg.kode_kepemilikan_paket_layanan,
                              kode_detail_kepemilikan_paket_layanan: det.kode_detail_kepemilikan_paket_layanan,
                              nama_paket_asal: pkg.nama_paket,
                            };

                            const itemKey = `klaim_${det.kode_detail_kepemilikan_paket_layanan || det.kode_layanan}`;
                            const isRuangDisabled = activeRuangan !== null && activeRuangan !== claimItem.kode_ruangan;

                            return (
                              <LayananCard
                                key={itemKey}
                                item={claimItem}
                                isSelected={!!selectedMap[itemKey]}
                                isDisabled={isRuangDisabled}
                                onToggle={handleToggleItem}
                                formatPrice={formatCurrency}
                              />
                            );
                          });
                      })}
                    </div>
                  </TabPanel>
                );
              }

              {/* TAB RUANGAN MASTER DATA */}
              ruangans.forEach((ruang) => {
                const isRuangActive = activeRuangan === ruang.kode_ruangan;
                const isRuangDisabled = activeRuangan !== null && activeRuangan !== ruang.kode_ruangan;
                const ruangSelectedCount = (ruang.items || []).filter(
                  (item) => !!selectedMap[`${item.jenis}_${item.kode_layanan}`]
                ).length;
                const roomTitle = ruang.nama_ruangan || `Ruangan ${ruang.kode_ruangan}`;
                const countSuffix = ruangSelectedCount > 0 ? ` (${ruangSelectedCount})` : '';

                panels.push(
                  <TabPanel
                    key={ruang.kode_ruangan}
                    header={`${roomTitle}${countSuffix}`}
                    leftIcon={`pi ${isRuangActive ? 'pi-check-circle' : 'pi-building'} mr-2`}
                  >
                    {isRuangDisabled && (
                      <div className="flex align-items-center gap-2 p-3 mb-3 bg-orange-50 border-round-lg border-1 border-orange-200">
                        <i className="pi pi-info-circle text-orange-500" />
                        <span className="text-sm text-orange-700">
                          Ruangan ini tidak bisa dipilih karena Anda sudah memilih layanan dari ruangan <strong>{activeRoomName}</strong>.
                          Batalkan pilihan sebelumnya terlebih dahulu jika ingin berpindah ruangan.
                        </span>
                      </div>
                    )}

                    {!ruang.items || ruang.items.length === 0 ? (
                      <div className="flex flex-column align-items-center justify-content-center p-5 surface-card border-round-xl border-1 surface-border my-3 text-center">
                        <i className="pi pi-inbox text-400 text-4xl mb-2" />
                        <span className="text-700 font-bold block text-base">{roomTitle}</span>
                        <span className="text-500 text-sm mt-1">Belum ada layanan atau paket yang tersedia di ruangan ini.</span>
                      </div>
                    ) : (
                      <div className="grid">
                        {ruang.items.map((item) => {
                          const itemKey = `${item.jenis}_${item.kode_layanan}`;
                          return (
                            <LayananCard
                              key={itemKey}
                              item={item}
                              isSelected={!!selectedMap[itemKey]}
                              isDisabled={isRuangDisabled}
                              onToggle={handleToggleItem}
                              formatPrice={formatCurrency}
                            />
                          );
                        })}
                      </div>
                    )}
                  </TabPanel>
                );
              });

              return panels;
            })()}
          </TabView>
        )}

        {/* PILIHAN ALUR KUNJUNGAN PASIEN (PERSIS SEPERTI GAMBAR) */}
        {hasOpsionalKonsul && !hasWajibKonsul && (
          <div className="mt-4 p-3 border-round-xl bg-gray-50 border-1 surface-border">
            <div className="flex align-items-center gap-2 mb-2">
              <i className="pi pi-question-circle text-primary text-base" />
              <span className="font-bold text-sm text-900">Pilihan Alur Kunjungan Pasien</span>
              <Tag value="Opsional Konsul" severity="info" className="text-xs font-semibold" />
            </div>
            <p className="text-xs text-600 m-0 mb-3">
              Tindakan yang dipilih menyertakan opsi konsultasi dokter pra-tindakan. Tentukan alur kunjungan saat pasien tiba / check-in di klinik:
            </p>
            <div className="grid">
              {/* Opsi 1: Konsultasi Dokter Dulu */}
              <div className="col-12 sm:col-6">
                <div
                  className="p-3 border-round-xl border-2 cursor-pointer transition-all transition-duration-200 flex align-items-center gap-3 h-full"
                  style={{
                    borderColor: globalConsultChoice ? '#6366f1' : '#e2e8f0',
                    background: globalConsultChoice ? 'linear-gradient(135deg, #eef2ff, #e0e7ff)' : 'var(--surface-card)',
                  }}
                  onClick={() => setGlobalConsultChoice(true)}
                >
                  <div
                    className="flex align-items-center justify-content-center border-round-lg text-white flex-shrink-0"
                    style={{
                      width: '36px',
                      height: '36px',
                      background: globalConsultChoice ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#cbd5e1',
                    }}
                  >
                    <i className="pi pi-user-edit text-base" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs" style={{ color: globalConsultChoice ? '#4338ca' : '#475569' }}>
                      Konsultasi Dokter Dulu
                    </div>
                    <div className="text-[11px] text-500 mt-0.5">
                      Pasien antre di Ruang Konsultasi Dokter saat check-in sebelum menuju ruang treatment.
                    </div>
                  </div>
                  {globalConsultChoice && <i className="pi pi-check-circle text-indigo-600 text-lg flex-shrink-0" />}
                </div>
              </div>

              {/* Opsi 2: Langsung Tindakan */}
              <div className="col-12 sm:col-6">
                <div
                  className="p-3 border-round-xl border-2 cursor-pointer transition-all transition-duration-200 flex align-items-center gap-3 h-full"
                  style={{
                    borderColor: !globalConsultChoice ? '#10b981' : '#e2e8f0',
                    background: !globalConsultChoice ? 'linear-gradient(135deg, #ecfdf5, #d1fae5)' : 'var(--surface-card)',
                  }}
                  onClick={() => setGlobalConsultChoice(false)}
                >
                  <div
                    className="flex align-items-center justify-content-center border-round-lg text-white flex-shrink-0"
                    style={{
                      width: '36px',
                      height: '36px',
                      background: !globalConsultChoice ? 'linear-gradient(135deg, #10b981, #059669)' : '#cbd5e1',
                    }}
                  >
                    <i className="pi pi-bolt text-base" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs" style={{ color: !globalConsultChoice ? '#065f46' : '#475569' }}>
                      Langsung Tindakan
                    </div>
                    <div className="text-[11px] text-500 mt-0.5">
                      Pasien langsung dilayani di ruang tindakan tanpa antre konsultasi dokter.
                    </div>
                  </div>
                  {!globalConsultChoice && <i className="pi pi-check-circle text-green-600 text-lg flex-shrink-0" />}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 3. CARD PILIH SLOT JADWAL PETUGAS (PERSIS SEPERTI GAMBAR, TANPA PILIH JAM) */}
      {/* ============================================================ */}
      <div className="card surface-card border-1 surface-border border-round-xl p-4 shadow-1 mb-3">
        <div className="flex align-items-center justify-content-between mb-3">
          <div className="flex align-items-center gap-2">
            <span
              className="flex align-items-center justify-content-center bg-primary text-white border-round-circle font-bold"
              style={{ width: 28, height: 28, fontSize: '13px' }}
            >
              3
            </span>
            <span className="font-bold text-lg text-900">Pilih Slot Jadwal Petugas</span>
          </div>

          {activeRuangan && (
            <div className="flex align-items-center gap-2">
              <Button
                type="button"
                label={effectiveButuhKonsul ? 'Jadwal Dokter Konsultasi' : `Jadwal ${activeRoomName || 'Ruangan'}`}
                icon="pi pi-calendar"
                className="p-button-outlined p-button-secondary p-button-sm text-xs py-1 px-2.5 font-semibold"
                onClick={handleOpenJadwalDialog}
                tooltip={
                  effectiveButuhKonsul
                    ? `Lihat jadwal dokter Ruang Konsultasi & ${activeRoomName}`
                    : `Lihat seluruh jadwal mingguan ${activeRoomName}`
                }
                tooltipOptions={{ position: 'bottom' }}
              />
              <Button
                icon="pi pi-refresh"
                className="p-button-text p-button-rounded p-button-sm"
                onClick={fetchSlots}
                tooltip="Refresh Ketersediaan Slot"
              />
            </div>
          )}
        </div>

        {/* Info Alur Konsultasi Dokter jika aktif */}
        {activeRuangan && effectiveButuhKonsul && (
          <div className="flex align-items-center gap-3 p-3 mb-4 bg-indigo-50 border-round-xl border-1 border-indigo-200 text-xs text-indigo-950">
            <div className="flex align-items-center justify-content-center bg-indigo-100 text-indigo-700 border-round-lg p-2 flex-shrink-0">
              <Info size={18} />
            </div>
            <div className="flex-1" style={{ lineHeight: 1.55 }}>
              Konsultasi Dokter Dulu dipilih. Slot di bawah adalah jadwal terapis — jadwal dokter dicek otomatis saat check-in di klinik. Lihat jadwal dokter di hari lain lewat tombol di kanan atas.
            </div>
          </div>
        )}

        {!activeRuangan ? (
          <div className="text-center py-4 text-500 border-1 border-dashed surface-border border-round">
            <AlertCircle size={32} className="mx-auto mb-2 text-400" />
            <div>Pilih minimal satu layanan/paket di Langkah 2 terlebih dahulu untuk memuat slot jadwal yang tersedia.</div>
          </div>
        ) : loadingSlots ? (
          <div className="text-center py-4">
            <i className="pi pi-spin pi-spinner text-primary text-3xl mb-2"></i>
            <div className="text-sm text-500">Mengecek ketersediaan jadwal petugas dan kuota ruangan...</div>
          </div>
        ) : slots.length === 0 ? (
          <div className="text-center py-4 text-500 border-1 border-dashed surface-border border-round">
            <AlertCircle size={32} className="mx-auto mb-2 text-amber-500" />
            <div className="font-semibold text-900 mb-1">Tidak Ada Jadwal Petugas Tersedia</div>
            <div className="text-sm text-600">
              Tidak ditemukan jadwal aktif untuk ruangan <strong>{activeRoomName}</strong> pada hari{' '}
              <span className="font-bold">
                {['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][tanggalKunjungan.getDay()]}
              </span>
              . Silakan pilih tanggal lain atau hubungi administrator.
            </div>
          </div>
        ) : (
          <div>
            <div className="text-xs text-500 mb-3 pt-1 flex align-items-center gap-1.5">
              <Clock size={13} className="text-400" />
              <span>Pilih salah satu sesi jadwal petugas di bawah ini. Setiap sesi diwakili oleh Petugas Penanggung Jawab (PJ).</span>
            </div>

            {/* GRID SLOT PETUGAS PERSIS SEPERTI GAMBAR */}
            <div className="grid">
              {slots.map((slot) => {
                const isSelected = selectedSlot?.kode_jadwal === slot.kode_jadwal;
                const isFull = !slot.is_available;
                const companions = slot.petugas_pendamping || [];
                const totalCompanions = slot.jumlah_pendamping || companions.length;
                const hasCompanions = totalCompanions > 0;
                const companionSummary = getCompanionSummary(companions, totalCompanions);
                const fullCompanionNames = companions.map((c) => c.nama_petugas).join(', ');

                return (
                  <div key={slot.kode_jadwal} className="col-12 sm:col-6 flex">
                    <div
                      onClick={() => {
                        if (!isFull) setSelectedSlot(slot);
                      }}
                      className={`w-full flex flex-column justify-content-between border-round-xl p-3 border-2 transition-all transition-duration-200 ${
                        isFull
                          ? 'surface-100 border-300 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'border-primary surface-50 shadow-2 cursor-pointer'
                          : 'surface-card border-200 hover:border-primary-300 hover:shadow-1 cursor-pointer'
                      }`}
                    >
                      <div>
                        {/* Jam Sesi & Status Badge */}
                        <div className="flex align-items-center justify-content-between mb-2">
                          <div className="flex align-items-center gap-2">
                            <Clock size={16} className={isSelected ? 'text-primary' : 'text-500'} />
                            <span className="font-bold text-sm text-900">
                              {slot.jam_mulai} - {slot.jam_selesai} WIB
                            </span>
                          </div>
                          <Tag
                            value={isFull ? 'PENUH' : 'TERSEDIA'}
                            severity={isFull ? 'danger' : 'success'}
                            className="text-xs px-2 font-bold"
                          />
                        </div>

                        {/* Petugas PJ */}
                        <div className="flex align-items-center gap-2 mb-1 flex-wrap">
                          <User size={15} className="text-primary flex-shrink-0" />
                          <span className="font-bold text-sm text-900">{slot.nama_petugas}</span>
                          <Tag
                            value="PJ"
                            className="text-[10px] font-bold px-1.5 py-0 border-round bg-orange-500 text-white"
                          />
                        </div>

                        {/* Petugas Pendamping */}
                        {hasCompanions && (
                          <div className="flex align-items-center gap-1.5 pl-4 mb-2 text-xs text-green-700 font-semibold">
                            <span
                              className="cursor-pointer hover:underline flex align-items-center gap-1"
                              title={fullCompanionNames}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveCompanionData({
                                  pj: slot.nama_petugas,
                                  jam: `${slot.jam_mulai} - ${slot.jam_selesai} WIB`,
                                  ruangan: slot.nama_ruangan || activeRoomName,
                                  companions,
                                });
                                companionOpRef.current?.toggle(e);
                              }}
                            >
                              + {totalCompanions} petugas pendamping ({companionSummary})
                              <i className="pi pi-info-circle text-[11px] text-green-600 opacity-80" />
                            </span>
                          </div>
                        )}

                        {/* Ruangan */}
                        <div className="flex align-items-center gap-2 pl-4 text-xs text-500 mb-2">
                          <MapPin size={13} className="text-400" />
                          <span>{slot.nama_ruangan || activeRoomName}</span>
                        </div>
                      </div>

                      {/* Sisa Kuota */}
                      <div className="border-top-1 surface-border pt-2 mt-2">
                        <div className="flex align-items-center justify-content-between text-xs text-500">
                          <span>Sisa Kuota:</span>
                          <span className={`font-bold ${isFull ? 'text-red-500' : 'text-green-700'}`}>
                            {slot.sisa_kuota} dari {slot.kuota_total}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 4. CARD RINGKASAN & AKSI DAFTARKAN KUNJUNGAN */}
      {/* ============================================================ */}
      <div className="card surface-card border-1 surface-border border-round-xl p-4 shadow-1 mb-4">
        <div className="flex flex-column md:flex-row md:align-items-center justify-content-between gap-3">
          <div>
            <div className="font-bold text-base text-900 mb-1">Ringkasan Pendaftaran Kunjungan</div>
            <div className="text-xs text-500 flex flex-wrap gap-x-3 gap-y-1">
              <span>
                Pasien: <strong className="text-900">{selectedPasien?.nama || '(Belum dipilih)'}</strong>
              </span>
              <span>
                Ruangan: <strong className="text-900">{activeRoomName || '-'}</strong>
              </span>
              <span>
                Layanan: <strong className="text-900">{selectedList.length} item</strong> ({totalDurasi} Menit)
              </span>
              <span>
                Petugas: <strong className="text-900">{selectedSlot?.nama_petugas || '-'}</strong>
              </span>
              <span>
                Total: <strong className="text-emerald-700">{formatCurrency(totalHarga)}</strong>
              </span>
            </div>
          </div>

          <Button
            label="Daftarkan Kunjungan & Ambil Antrean"
            icon="pi pi-ticket"
            severity="success"
            className="border-round-lg font-bold px-4 py-2.5 shadow-2"
            disabled={!selectedPasien || selectedList.length === 0 || !selectedSlot || submitting}
            loading={submitting}
            onClick={handleSubmitPendaftaran}
          />
        </div>
      </div>

      {/* MODAL KARCIS ANTREAN AWAL */}
      <KarcisAntrianModal
        visible={karcisVisible}
        onHide={() => setKarcisVisible(false)}
        data={ticketData}
      />

      {/* MODAL KARCIS ANTREAN LAYANAN */}
      <KarcisAntrianLayananModal
        visible={antrianLayananModalVisible}
        onHide={() => setAntrianLayananModalVisible(false)}
        data={antrianLayananData}
      />

      {/* DIALOG JADWAL MINGGUAN RUANGAN */}
      <DialogJadwalMingguanRuangan
        visible={showJadwalRuanganDialog}
        onHide={() => setShowJadwalRuanganDialog(false)}
        rooms={jadwalDialogRooms}
      />

      {/* OVERLAY PANEL PENDAMPING */}
      <OverlayPanel ref={companionOpRef} className="shadow-4 border-round-xl">
        {activeCompanionData && (
          <div style={{ maxWidth: '320px' }}>
            <div className="font-bold text-xs text-900 mb-1 flex align-items-center gap-1">
              <Users size={14} className="text-primary" />
              <span>Tim Petugas Sesi ({activeCompanionData.ruangan})</span>
            </div>
            <div className="text-[11px] text-500 mb-2">Shift: {activeCompanionData.jam}</div>
            <div className="text-xs p-2 bg-primary-50 border-round mb-2">
              <div className="font-semibold text-primary-900 text-[11px]">Penanggung Jawab (PJ):</div>
              <div className="font-bold text-primary-700">{activeCompanionData.pj}</div>
            </div>
            <div className="text-[11px] font-semibold text-700 mb-1">
              Petugas Pendamping ({activeCompanionData.companions.length}):
            </div>
            <ul className="m-0 pl-3 text-xs text-600">
              {activeCompanionData.companions.map((c, i) => (
                <li key={i} className="mb-0.5">
                  <span className="font-medium text-900">{c.nama_petugas}</span>
                  {c.jabatan_petugas && <span className="text-500 text-[11px]"> — {c.jabatan_petugas}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </OverlayPanel>

    </div>
  );
};

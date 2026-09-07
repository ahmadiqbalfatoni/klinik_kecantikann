'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { TabView, TabPanel } from 'primereact/tabview';
import { SelectButton } from 'primereact/selectbutton';
import { InputNumber } from 'primereact/inputnumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { ProgressBar } from 'primereact/progressbar';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Toast } from 'primereact/toast';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { Divider } from 'primereact/divider';
import postData from '@/lib/axios/postData';
import { showError, showSuccess } from '@/lib/tools/generalTools';
import { DialogQuickAddPasien } from './DialogQuickAddPasien';
import { DialogDetailBooking } from './DialogDetailBooking';
import { DialogJadwalMingguanRuangan, RoomTabOption } from './DialogJadwalMingguanRuangan';
import {
  LayananCard,
  ServiceItem,
  RuanganGroup,
} from '@/app/(main)/pendaftaran-antrean/components/shared/LayananCard';
import {
  User,
  UserPlus,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  RotateCcw,
  Trash2,
  Info,
} from 'lucide-react';

interface Pasien {
  no_rm: string;
  nama: string;
  nik?: string;
  no_hp?: string;
  jenis_kelamin?: string;
  alamat?: string;
}

interface SlotItem {
  kode_jadwal: string;
  no_sip: string;
  nama_petugas: string;
  jabatan_petugas: string;
  kode_ruangan: string;
  nama_ruangan: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  jam_booking_default: string;
  kuota_total: number;
  kuota_terisi: number;
  sisa_kuota: number;
  is_available: boolean;
  booked_times?: string[];
}

interface Props {
  toast: React.RefObject<Toast>;
  onSuccessCreated?: () => void;
}

export const BuatBookingTab: React.FC<Props> = ({ toast, onSuccessCreated }) => {
  // 1. Pasien State
  const [pasienSearch, setPasienSearch] = useState('');
  const [pasienList, setPasienList] = useState<Pasien[]>([]);
  const [loadingPasien, setLoadingPasien] = useState(false);
  const [selectedPasien, setSelectedPasien] = useState<Pasien | null>(null);
  const [showQuickAddPasien, setShowQuickAddPasien] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // 2. Tanggal & Layanan State (Pola Tab Ruangan & Multi-Select Card)
  const [tanggalBooking, setTanggalBooking] = useState<Date>(new Date());
  const [ruangans, setRuangans] = useState<RuanganGroup[]>([]);
  const [loadingRuangan, setLoadingRuangan] = useState(true);
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
  const [selectedMap, setSelectedMap] = useState<{ [key: string]: ServiceItem }>({});
  const [activeRuangan, setActiveRuangan] = useState<string | null>(null);
  const [ownedPackages, setOwnedPackages] = useState<any[]>([]);
  const [loadingPackages, setLoadingPackages] = useState<boolean>(false);

  // 3. Slot Jadwal State
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [dokterKonsulList, setDokterKonsulList] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const [jamBooking, setJamBooking] = useState<string>('');
  const [isManualTime, setIsManualTime] = useState(false);
  const [manualTimeInput, setManualTimeInput] = useState('');
  const [manualTimeError, setManualTimeError] = useState('');

  // 4. DP & Catatan State
  const [dpPercentage, setDpPercentage] = useState<number>(20);
  const [dpNominal, setDpNominal] = useState<number>(0);
  const [sumber, setSumber] = useState<'staff' | 'whatsapp'>('staff');
  const [catatanPasien, setCatatanPasien] = useState('');
  const [globalConsultChoice, setGlobalConsultChoice] = useState<boolean>(true);

  // 5. Submit & Modal State
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [createdBookingData, setCreatedBookingData] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // 6. Dialog Jadwal Mingguan Ruangan State
  const [showJadwalRuanganDialog, setShowJadwalRuanganDialog] = useState(false);
  const [jadwalDialogRooms, setJadwalDialogRooms] = useState<RoomTabOption[]>([]);

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

  // 1. Fetch Ruangan & Pilihan Layanan/Paket saat component mount
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
      console.error('Error fetching ruangan & layanan options:', error);
      showError(toast, 'Terjadi kesalahan saat memuat daftar layanan & ruangan');
    } finally {
      setLoadingRuangan(false);
    }
  };

  // 2. Search Pasien saat user mengetik
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
          perPage: 5,
        });
        setPasienList(res.data?.data || []);
      } catch (err) {
        console.error('Error search pasien:', err);
      } finally {
        setLoadingPasien(false);
      }
    }, 400);
  };

  // 2b. Fetch Kepemilikan Paket Pasien saat Pasien Dipilih
  useEffect(() => {
    if (selectedPasien?.no_rm) {
      fetchOwnedPackages(selectedPasien.no_rm);
    } else {
      setOwnedPackages([]);
    }
  }, [selectedPasien?.no_rm]);

  const fetchOwnedPackages = async (noRm: string) => {
    setLoadingPackages(true);
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
      console.error('Error fetching patient owned packages:', err);
      setOwnedPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  const claimablePackages = useMemo(() => {
    return (ownedPackages || []).filter((pkg: any) => {
      if (pkg.status && pkg.status.toLowerCase() !== 'aktif') return false;
      return (pkg.details || []).some((det: any) => (det.sisa_sesi || 0) > 0);
    });
  }, [ownedPackages]);

  // Handler Perubahan Tanggal Booking dengan Validasi Expired Paket
  const handleDateChange = (newDate: Date | null) => {
    if (!newDate) return;
    const newDateStr = formatDateToYMD(newDate);

    // Cek apakah ada klaim paket terpilih yang expired sebelum tanggal ini
    const expiredClaimItem = selectedList.find(
      (it) => it.jenis === 'klaim_paket' && it.tanggal_expired && newDateStr > it.tanggal_expired
    );

    if (expiredClaimItem) {
      showError(
        toast,
        `Sesi paket "${expiredClaimItem.nama}" kedaluwarsa pada ${expiredClaimItem.tanggal_expired}. Anda tidak dapat memilih tanggal booking (${newDateStr}) setelah tanggal kedaluwarsa paket.`
      );
      return;
    }

    setTanggalBooking(newDate);
  };

  // 3. Multi-Select Toggle Layanan/Paket
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
      // Validasi tanggal expired jika klaim_paket
      if (item.jenis === 'klaim_paket' && item.tanggal_expired) {
        const curDateStr = formatDateToYMD(tanggalBooking);
        if (curDateStr > item.tanggal_expired) {
          showError(
            toast,
            `Paket ini kedaluwarsa pada ${item.tanggal_expired}. Tanggal booking saat ini (${curDateStr}) melewati batas kedaluwarsa paket. Silakan ubah tanggal booking terlebih dahulu.`
          );
          return;
        }
      }

      if (activeRuangan !== null && activeRuangan !== item.kode_ruangan) {
        const currentRoomName =
          ruangans.find((r) => r.kode_ruangan === activeRuangan)?.nama_ruangan ||
          Object.values(selectedMap)[0]?.nama_ruangan ||
          activeRuangan;

        showError(
          toast,
          `Anda hanya dapat memilih layanan/paket dalam 1 ruangan yang sama per booking. Ruangan yang saat ini dipilih: "${currentRoomName}". Batalkan pilihan sebelumnya jika ingin berganti ruangan.`
        );
        return;
      }

      setSelectedMap((prev) => ({ ...prev, [key]: item }));
      setActiveRuangan(item.kode_ruangan || null);
    }
  };

  const selectedList = Object.values(selectedMap);
  const totalHarga = selectedList.reduce(
    (acc, curr) => acc + (curr.jenis === 'klaim_paket' ? 0 : (curr.harga_asal ?? curr.harga)),
    0
  );
  const totalDurasi = selectedList.reduce((acc, curr) => acc + (curr.durasi_menit || 0), 0);

  const hasOnlyKlaim = selectedList.length > 0 && selectedList.every((it) => it.jenis === 'klaim_paket');
  const hasKlaim = selectedList.some((it) => it.jenis === 'klaim_paket');

  // Evaluasi Aturan Konsultasi Seluruh Booking
  const hasWajibKonsul = selectedList.some((it) => {
    const effTipe = (it.jenis === 'klaim_paket' && it.tipe_paket ? it.tipe_paket : it.tipe || '').toString().toUpperCase();
    return effTipe === 'MEDICAL TREATMENT' || it.wajib_konsultasi === 'wajib';
  });

  const hasOpsionalKonsul = !hasWajibKonsul && selectedList.some((it) => {
    const effTipe = (it.jenis === 'klaim_paket' && it.tipe_paket ? it.tipe_paket : it.tipe || '').toString().toUpperCase();
    const isWajib = effTipe === 'MEDICAL TREATMENT' || it.wajib_konsultasi === 'wajib';
    const isService = effTipe === 'SERVICE TREATMENT' || it.wajib_konsultasi === 'tidak';
    return !isWajib && !isService;
  });

  const effectiveButuhKonsul = hasWajibKonsul ? true : hasOpsionalKonsul ? globalConsultChoice : false;

  const activeRoomObj = ruangans.find((r) => r.kode_ruangan === activeRuangan);
  const activeRoomName = activeRoomObj?.nama_ruangan || selectedList[0]?.nama_ruangan || '';

  const consultRoom = ruangans.find((r) => r.is_konsultasi === 1);
  const handleOpenJadwalDialog = () => {
    if (effectiveButuhKonsul) {
      const roomList: RoomTabOption[] = [
        {
          kodeRuangan: consultRoom?.kode_ruangan || 'RNG-007',
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

  // 4. Update DP saat total harga berubah
  useEffect(() => {
    if (hasOnlyKlaim) {
      setDpNominal(0);
      setDpPercentage(0);
    } else {
      setDpNominal(Math.round((totalHarga * dpPercentage) / 100));
    }
  }, [totalHarga, dpPercentage, hasOnlyKlaim]);

  const handlePercentageChange = (percent: number) => {
    if (hasOnlyKlaim) return;
    setDpPercentage(percent);
    setDpNominal(Math.round((totalHarga * percent) / 100));
  };

  // Helper konversi jam "HH:mm" <-> menit dari tengah malam
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const minutesToTime = (totalMin: number): string => {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const getEstimatedEndTime = (timeStr: string, duration: number) => {
    const min = timeToMinutes(timeStr) + duration;
    return minutesToTime(min);
  };

  // Jendela Jam Dokter Konsultasi Aktif
  const consultWindow = useMemo(() => {
    if (!effectiveButuhKonsul || !dokterKonsulList || dokterKonsulList.length === 0) {
      return null;
    }
    const startMins = dokterKonsulList.map((d: any) => timeToMinutes((d.jam_mulai || '').slice(0, 5)));
    const endMins = dokterKonsulList.map((d: any) => timeToMinutes((d.jam_selesai || '').slice(0, 5)));
    const docStartMin = Math.min(...startMins);
    const docEndMin = Math.max(...endMins);
    const dokterNames = dokterKonsulList.map((d: any) => d.nama_dokter).filter(Boolean).join(', ');

    return {
      docStartMin,
      docEndMin,
      docStartStr: minutesToTime(docStartMin),
      docEndStr: minutesToTime(docEndMin),
      dokterNames,
    };
  }, [effectiveButuhKonsul, dokterKonsulList]);

  // Irisan Shift Terapis & Dokter Konsultasi
  const slotOverlap = useMemo(() => {
    // Ambil shift dari selectedSlot, atau fallback ke slot pertama yang tersedia di ruangan tersebut
    const targetSlot = selectedSlot || (slots.length > 0 ? slots[0] : null);
    if (!targetSlot) return null;

    const startMin = timeToMinutes(targetSlot.jam_mulai);
    const endMin = timeToMinutes(targetSlot.jam_selesai);

    if (!consultWindow) {
      return {
        overlapStartMin: startMin,
        overlapEndMin: endMin,
        overlapStartStr: targetSlot.jam_mulai,
        overlapEndStr: targetSlot.jam_selesai,
        hasOverlap: true,
        petugasName: targetSlot.nama_petugas,
        shiftMulai: targetSlot.jam_mulai,
        shiftSelesai: targetSlot.jam_selesai,
      };
    }

    const overlapStartMin = Math.max(startMin, consultWindow.docStartMin);
    const overlapEndMin = Math.min(endMin, consultWindow.docEndMin);
    const hasOverlap = overlapStartMin < overlapEndMin;

    return {
      overlapStartMin,
      overlapEndMin,
      overlapStartStr: minutesToTime(overlapStartMin),
      overlapEndStr: minutesToTime(overlapEndMin),
      hasOverlap,
      petugasName: targetSlot.nama_petugas,
      shiftMulai: targetSlot.jam_mulai,
      shiftSelesai: targetSlot.jam_selesai,
    };
  }, [selectedSlot, slots, consultWindow]);

  // Generate daftar opsi slot jam interval 30 menit berdasarkan shift, durasi, dan irisan dokter
  const timeSlots = useMemo(() => {
    if (!selectedSlot) return [];
    const startMin = timeToMinutes(selectedSlot.jam_mulai);
    const endMin = timeToMinutes(selectedSlot.jam_selesai);
    const durasi = totalDurasi || 30;
    const bookedList = (selectedSlot.booked_times || []).map((t) => t.slice(0, 5));
    const result: {
      time: string;
      exceedsShift: boolean;
      isBooked: boolean;
      isOutsideDoctor: boolean;
      doctorDisabledReason?: string;
      endEst: string;
    }[] = [];

    for (let m = startMin; m < endMin; m += 30) {
      const time = minutesToTime(m);
      const endEstMin = m + durasi;
      const endEst = minutesToTime(endEstMin);
      const exceedsShift = endEstMin > endMin;
      const isBooked = bookedList.includes(time);

      let isOutsideDoctor = false;
      let doctorDisabledReason = '';

      if (consultWindow) {
        if (m < consultWindow.docStartMin) {
          isOutsideDoctor = true;
          doctorDisabledReason = `Dokter belum jaga (mulai ${consultWindow.docStartStr})`;
        } else if (m >= consultWindow.docEndMin) {
          isOutsideDoctor = true;
          doctorDisabledReason = `Dokter sudah selesai (${consultWindow.docEndStr})`;
        }
      }

      result.push({
        time,
        exceedsShift,
        isBooked,
        isOutsideDoctor,
        doctorDisabledReason,
        endEst,
      });
    }

    return result;
  }, [selectedSlot, totalDurasi, consultWindow]);

  // Validasi input manual jam
  const handleManualTimeChange = (val: string) => {
    setManualTimeInput(val);
    if (!val) {
      setManualTimeError('Jam tidak boleh kosong');
      return;
    }
    if (!selectedSlot) return;

    const startMin = timeToMinutes(selectedSlot.jam_mulai);
    const endMin = timeToMinutes(selectedSlot.jam_selesai);
    const inputMin = timeToMinutes(val);
    const durasi = totalDurasi || 30;
    const endEstMin = inputMin + durasi;

    if (inputMin < startMin || inputMin >= endMin) {
      setManualTimeError(
        `Jam harus di dalam jam kerja shift (${selectedSlot.jam_mulai} - ${selectedSlot.jam_selesai} WIB)`
      );
      return;
    }

    if (consultWindow) {
      if (inputMin < consultWindow.docStartMin || inputMin >= consultWindow.docEndMin) {
        setManualTimeError(
          `Dokter konsultasi (${consultWindow.dokterNames || 'Dokter'}) bertugas pukul ${consultWindow.docStartStr} - ${consultWindow.docEndStr} WIB. Jam janji temu harus berada di dalam jam jaga dokter.`
        );
        return;
      }
    }

    if (endEstMin > endMin) {
      const endEstStr = minutesToTime(endEstMin);
      setManualTimeError(
        `Tindakan selesai ${endEstStr} WIB, melebihi batas shift (${selectedSlot.jam_selesai} WIB). Total durasi: ${durasi} menit.`
      );
      return;
    }

    const bookedList = (selectedSlot.booked_times || []).map((t) => t.slice(0, 5));
    if (bookedList.includes(val)) {
      setManualTimeError(`Jam ${val} WIB sudah dipesan oleh pasien lain.`);
      return;
    }

    setManualTimeError('');
    setJamBooking(val);
  };

  // 5. Fetch Slot Jadwal saat ruangan aktif dan tanggal terpilih
  useEffect(() => {
    if (!tanggalBooking || !activeRuangan) {
      setSlots([]);
      setDokterKonsulList([]);
      setSelectedSlot(null);
      setJamBooking('');
      setIsManualTime(false);
      setManualTimeInput('');
      setManualTimeError('');
      return;
    }
    fetchSlots();
  }, [tanggalBooking, activeRuangan]);

  const fetchSlots = async () => {
    if (!activeRuangan) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    setJamBooking('');
    setIsManualTime(false);
    setManualTimeInput('');
    setManualTimeError('');
    try {
      const tglYmd = formatDateToYMD(tanggalBooking);
      const res = await postData('/transaksi/booking/slots', {
        tanggal_booking: tglYmd,
        kode_ruangan: activeRuangan,
        kode_layanan: selectedList[0]?.kode_layanan,
        jenis_layanan: selectedList[0]?.jenis,
      });

      if (res.data?.status === 200 || res.status === 200) {
        const d = res.data?.data;
        setSlots(d?.slots || []);
        setDokterKonsulList(d?.dokter_konsul || []);
      } else {
        setSlots([]);
        setDokterKonsulList([]);
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
      setSlots([]);
      setDokterKonsulList([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  // 6. Submit Booking
  const handleSubmitBooking = async () => {
    if (!selectedPasien) {
      showError(toast, 'Harap pilih pasien terlebih dahulu di Langkah 1');
      return;
    }
    if (selectedList.length === 0) {
      showError(toast, 'Harap pilih minimal satu layanan atau paket di Langkah 2');
      return;
    }
    if (effectiveButuhKonsul && dokterKonsulList.length === 0 && !loadingSlots) {
      const hariName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][tanggalBooking.getDay()];
      showError(
        toast,
        `Tidak ada dokter jaga di Ruang Konsultasi pada hari ${hariName}. Silakan pilih alur "Langsung Tindakan" atau ubah tanggal booking ke hari praktek dokter.`
      );
      return;
    }
    if (!selectedSlot) {
      showError(toast, 'Harap pilih salah satu slot jadwal petugas yang tersedia di Langkah 3');
      return;
    }
    if (!jamBooking) {
      showError(toast, 'Harap pilih jam janji temu spesifik untuk pasien');
      return;
    }

    if (effectiveButuhKonsul && consultWindow && selectedSlot) {
      if (slotOverlap && !slotOverlap.hasOverlap) {
        showError(
          toast,
          `Tidak ada irisan jam kerja antara dokter konsultasi (${consultWindow.docStartStr} - ${consultWindow.docEndStr} WIB) dan petugas treatment (${selectedSlot.jam_mulai} - ${selectedSlot.jam_selesai} WIB). Harap ganti tanggal atau pilih alur 'Langsung Tindakan'.`
        );
        return;
      }
      const inputMin = timeToMinutes(jamBooking);
      if (inputMin < consultWindow.docStartMin || inputMin >= consultWindow.docEndMin) {
        showError(
          toast,
          `Jam janji temu ${jamBooking} WIB tidak valid untuk alur konsultasi dokter. Dokter jaga (${consultWindow.dokterNames}) bertugas pukul ${consultWindow.docStartStr} - ${consultWindow.docEndStr} WIB.`
        );
        return;
      }
    }

    setLoadingSubmit(true);
    try {
      const payload = {
        no_rm: selectedPasien.no_rm,
        kode_ruangan: activeRuangan,
        kode_jadwal: selectedSlot.kode_jadwal,
        tanggal_booking: formatDateToYMD(tanggalBooking),
        jam_booking: jamBooking,
        catatan_pasien: catatanPasien.trim() || undefined,
        dp_nominal: dpNominal,
        sumber: sumber,
        butuh_konsul: effectiveButuhKonsul,
        items: selectedList.map((it) => ({
          jenis_layanan: it.jenis,
          kode_layanan: it.kode_layanan,
          nama_layanan: it.nama,
          harga: it.jenis === 'klaim_paket' ? 0 : (it.harga_asal ?? it.harga),
          durasi_menit: it.durasi_menit,
          kode_kepemilikan_paket_layanan: it.kode_kepemilikan_paket_layanan,
          kode_detail_kepemilikan_paket_layanan: it.kode_detail_kepemilikan_paket_layanan,
          butuh_konsul: effectiveButuhKonsul,
        })),
      };

      const res = await postData('/transaksi/booking/create', payload);

      if (
        res.data?.status === 201 ||
        res.data?.status === 200 ||
        res.status === 201 ||
        res.status === 200
      ) {
        const created = res.data?.data;
        showSuccess(toast, res.data?.message || 'Booking berhasil dibuat!');
        setCreatedBookingData({
          ...created,
          jam_booking: jamBooking,
          nama_pasien: selectedPasien.nama,
          nama_layanan:
            selectedList.length === 1
              ? selectedList[0].nama
              : `${selectedList[0].nama} (+${selectedList.length - 1} layanan)`,
          nama_ruangan: selectedSlot.nama_ruangan,
          nama_petugas: selectedSlot.nama_petugas,
          butuh_konsul: effectiveButuhKonsul,
          items: selectedList,
        });
        setShowDetailDialog(true);

        // Reset form
        handleResetForm();

        if (onSuccessCreated) {
          onSuccessCreated();
        }
      } else {
        showError(toast, res.data?.message || 'Gagal membuat booking');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err.message || 'Terjadi kesalahan saat menyimpan booking';
      showError(toast, msg);
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleResetForm = () => {
    setSelectedPasien(null);
    setPasienSearch('');
    setPasienList([]);
    setSelectedMap({});
    setActiveRuangan(null);
    setSelectedSlot(null);
    setJamBooking('');
    setIsManualTime(false);
    setManualTimeInput('');
    setManualTimeError('');
    setCatatanPasien('');
    setSlots([]);
    setTanggalBooking(new Date());
    setOwnedPackages([]);
    setGlobalConsultChoice(true);
  };

  return (
    <div className="p-2 sm:p-3">
      {/* Dialog Pasien Baru Cepat */}
      <DialogQuickAddPasien
        visible={showQuickAddPasien}
        toast={toast}
        onHide={() => setShowQuickAddPasien(false)}
        onSuccess={(pasienBaru) => {
          setSelectedPasien(pasienBaru);
          setPasienSearch(pasienBaru.nama || pasienBaru.no_rm);
          setPasienList([]);
        }}
      />

      {/* Dialog Detail / Bukti Booking Setelah Berhasil */}
      <DialogDetailBooking
        visible={showDetailDialog}
        booking={createdBookingData}
        onHide={() => setShowDetailDialog(false)}
      />

      <div className="grid">
        {/* KOLOM KIRI: FORM STEP */}
        <div className="col-12 lg:col-8">
          {/* STEP 1: PILIH PASIEN */}
          <div className="card surface-card border-1 surface-border border-round-xl p-4 shadow-1 mb-3">
            <div className="flex justify-content-between align-items-center mb-3">
              <div className="flex align-items-center gap-2">
                <span
                  className="flex align-items-center justify-content-center bg-primary text-white border-round-circle font-bold"
                  style={{ width: 28, height: 28 }}
                >
                  1
                </span>
                <span className="font-bold text-lg text-900">Pilih Pasien</span>
              </div>

              {!selectedPasien && (
                <Button
                  label="Pasien Baru"
                  icon={<UserPlus size={16} className="mr-1" />}
                  className="p-button-outlined p-button-primary p-button-sm"
                  onClick={() => setShowQuickAddPasien(true)}
                />
              )}
            </div>

            {selectedPasien ? (
              <div className="p-3 surface-50 border-1 border-primary-300 border-round-lg flex flex-column sm:flex-row justify-content-between align-items-start sm:align-items-center gap-3">
                <div className="flex align-items-center gap-3">
                  <div className="surface-200 border-circle p-3 text-primary">
                    <User size={28} />
                  </div>
                  <div>
                    <div className="flex align-items-center gap-2">
                      <span className="font-bold text-lg text-900">{selectedPasien.nama}</span>
                      <Tag value={selectedPasien.no_rm} severity="info" />
                    </div>
                    <div className="text-xs text-600 mt-1 flex flex-wrap gap-3">
                      {selectedPasien.nik && <span>NIK: {selectedPasien.nik}</span>}
                      {selectedPasien.no_hp && <span>No. HP: {selectedPasien.no_hp}</span>}
                      {selectedPasien.jenis_kelamin && (
                        <span>
                          Gender: {selectedPasien.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  label="Ganti Pasien"
                  icon="pi pi-refresh"
                  className="p-button-text p-button-secondary p-button-sm"
                  onClick={() => setSelectedPasien(null)}
                />
              </div>
            ) : (
              <div>
                <span className="block w-full p-input-icon-left mb-2">
                  <IconField iconPosition="left">
                    <InputIcon className="pi pi-search" />
                    <InputText
                      value={pasienSearch}
                      onChange={(e) => handleSearchPasien(e.target.value)}
                      placeholder="Cari berdasarkan No. RM, NIK, Nama Pasien, atau No. HP..."
                      className="w-full"
                    />
                  </IconField>
                </span>

                {loadingPasien && (
                  <div className="text-xs text-500 mt-1">
                    <i className="pi pi-spin pi-spinner mr-1"></i> Mencari data pasien...
                  </div>
                )}

                {pasienList.length > 0 && (
                  <div className="border-1 surface-border border-round overflow-hidden mt-2 shadow-1">
                    <DataTable
                      value={pasienList}
                      size="small"
                      className="p-datatable-sm"
                      rowClassName={() => 'cursor-pointer hover:surface-100 transition-colors transition-duration-150'}
                      onRowClick={(e) => {
                        setSelectedPasien(e.data as Pasien);
                        setPasienList([]);
                      }}
                      emptyMessage="Tidak ada pasien ditemukan"
                    >
                      <Column
                        field="no_rm"
                        header="No. RM"
                        style={{ width: '130px', verticalAlign: 'middle' }}
                        body={(rowData) => (
                          <span className="font-bold text-primary text-sm flex align-items-center">
                            {rowData.no_rm}
                          </span>
                        )}
                      />
                      <Column
                        field="nama"
                        header="Nama Pasien"
                        style={{ verticalAlign: 'middle' }}
                        body={(rowData) => (
                          <span className="font-semibold text-900 text-sm flex align-items-center">
                            {rowData.nama}
                          </span>
                        )}
                      />
                      <Column
                        field="no_hp"
                        header="No. HP"
                        style={{ verticalAlign: 'middle' }}
                        body={(rowData) => (
                          <span className="text-600 text-sm flex align-items-center">
                            {rowData.no_hp || '-'}
                          </span>
                        )}
                      />
                      <Column
                        header="Aksi"
                        align="center"
                        headerStyle={{ textAlign: 'center' }}
                        style={{ width: '90px', verticalAlign: 'middle', textAlign: 'center' }}
                        body={(rowData) => (
                          <div className="flex align-items-center justify-content-center">
                            <Button
                              label="Pilih"
                              icon="pi pi-check"
                              className="p-button-sm p-button-primary py-1 px-3 text-xs m-0 shadow-none font-semibold"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPasien(rowData);
                                setPasienList([]);
                              }}
                            />
                          </div>
                        )}
                      />
                    </DataTable>
                  </div>
                )}

                {pasienSearch && !loadingPasien && pasienList.length === 0 && (
                  <div className="text-xs text-500 mt-2 p-2 surface-100 border-round flex justify-content-between align-items-center">
                    <span>Pasien tidak ditemukan dengan kata kunci &ldquo;{pasienSearch}&rdquo;</span>
                    <Button
                      label="Daftarkan Pasien Baru"
                      icon={<UserPlus size={14} className="mr-1" />}
                      className="p-button-text p-button-primary text-xs py-0"
                      onClick={() => setShowQuickAddPasien(true)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 2: PILIH LAYANAN & PAKET TREATMENT (TAB RUANGAN & MULTI-SELECT KARTU PERSIS PENDAFTARAN PASIEN) */}
          <div className="card surface-card border-1 surface-border border-round-xl p-4 shadow-1 mb-3">
            <div className="flex flex-column sm:flex-row sm:align-items-center justify-content-between gap-2 mb-3">
              <div>
                <div className="flex align-items-center gap-2">
                  <span
                    className="flex align-items-center justify-content-center bg-primary text-white border-round-circle font-bold"
                    style={{ width: 28, height: 28 }}
                  >
                    2
                  </span>
                  <span className="font-bold text-lg text-900">Pilih Layanan & Paket Treatment</span>
                </div>
                <p className="text-xs text-500 m-0 mt-1 pl-5">
                  Pilih satu atau beberapa layanan/paket dalam ruangan yang sama untuk menentukan slot jadwal petugas.
                </p>
              </div>

              {/* Tanggal Booking (Kontainer Terpadu & Selaras Hijau/Emerald) */}
              <div className="flex align-items-center surface-50 border-1 surface-border border-round-xl px-2 py-1 shadow-1 gap-2 align-self-start sm:align-self-center">
                <div className="flex align-items-center gap-2 pl-1">
                  <i className="pi pi-calendar text-primary text-sm" />
                  <span className="text-xs font-bold text-700 white-space-nowrap">Tanggal:</span>
                </div>
                <Calendar
                  value={tanggalBooking}
                  onChange={(e) => handleDateChange(e.value as Date)}
                  dateFormat="yy-mm-dd"
                  minDate={new Date()}
                  showIcon
                  className="p-inputtext-sm font-semibold"
                  style={{ width: '135px' }}
                />
                <span className="text-xs font-bold px-2 py-1 border-round-lg bg-green-100 text-green-800 border-1 border-green-200 flex align-items-center gap-1">
                  <i className="pi pi-clock text-[10px] text-green-700" />
                  {['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][tanggalBooking.getDay()]}
                </span>
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
                {/* TAB KHUSUS: PAKET YANG SUDAH DIMILIKI PASIEN */}
                {claimablePackages.length > 0 && (
                  <TabPanel
                    key="owned_packages_tab"
                    header={`🎁 Paket Dimiliki Pasien (${claimablePackages.length})`}
                    leftIcon="pi pi-gift mr-2 text-amber-600 font-bold"
                  >
                    <div className="p-3 bg-amber-50 border-round-lg border-1 border-amber-200 mb-3 flex align-items-center gap-2">
                      <i className="pi pi-info-circle text-amber-600 text-lg" />
                      <span className="text-sm text-amber-900 font-semibold">
                        Pasien memiliki paket aktif! Pilih sesi treatment di bawah ini untuk mereservasi sesi lanjutan tanpa biaya DP / biaya tambahan (Rp 0).
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
                              wajib_konsultasi: (pkg.tipe_paket === 'MEDICAL TREATMENT' ? 'wajib' : pkg.tipe_paket === 'SERVICE TREATMENT' ? 'tidak' : 'opsional'),
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
                )}

                {ruangans.map((ruang) => {
                  const isRuangActive = activeRuangan === ruang.kode_ruangan;
                  const isRuangDisabled = activeRuangan !== null && activeRuangan !== ruang.kode_ruangan;
                  const ruangSelectedCount = (ruang.items || []).filter(
                    (item) => !!selectedMap[`${item.jenis}_${item.kode_layanan}`]
                  ).length;
                  const roomTitle = ruang.nama_ruangan || `Ruangan ${ruang.kode_ruangan}`;
                  const countSuffix = ruangSelectedCount > 0 ? ` (${ruangSelectedCount})` : '';

                  return (
                    <TabPanel
                      key={ruang.kode_ruangan}
                      header={`${roomTitle}${countSuffix}`}
                      leftIcon={`pi ${isRuangActive ? 'pi-check-circle' : 'pi-building'} mr-2`}
                    >
                      {isRuangDisabled && (
                        <div className="flex align-items-center gap-2 p-3 mb-3 bg-orange-50 border-round-lg border-1 border-orange-200">
                          <i className="pi pi-info-circle text-orange-500" />
                          <span className="text-sm text-orange-700">
                            Ruangan ini tidak bisa dipilih karena Anda sudah memilih layanan/paket dari ruangan <strong>{activeRoomName}</strong>.
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
                          {ruang.items.map((item) => (
                            <LayananCard
                              key={`${item.jenis}_${item.kode_layanan}`}
                              item={item}
                              isSelected={!!selectedMap[`${item.jenis}_${item.kode_layanan}`]}
                              isDisabled={isRuangDisabled}
                              onToggle={handleToggleItem}
                              formatPrice={formatCurrency}
                            />
                          ))}
                        </div>
                      )}
                    </TabPanel>
                  );
                })}
              </TabView>
            )}

            {/* BLOK PILIHAN ALUR KONSULTASI DOKTER PRA-TINDAKAN (BERLAKU UNTUK SELURUH BOOKING) */}
            {selectedList.length > 0 && (
              <>
                {hasWajibKonsul && (
                  <div className="p-3 bg-red-50 border-1 border-red-200 border-round-xl mt-3 flex align-items-center gap-3">
                    <div className="flex align-items-center justify-content-center bg-red-100 text-red-700 border-round-lg p-2 flex-shrink-0">
                      <i className="pi pi-user-edit text-lg" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-xs text-red-900 mb-0.5">Wajib Konsultasi Dokter Terlebih Dahulu</div>
                      <div className="text-xs text-red-700">
                        Salah satu tindakan yang Anda pilih berstatus tindakan medis (Medical Treatment). Pasien otomatis diarahkan ke Ruang Konsultasi Dokter saat check-in di klinik sebelum tindakan.
                      </div>
                    </div>
                    <Tag value="Wajib Konsul" severity="danger" className="text-xs font-bold" />
                  </div>
                )}

                {hasOpsionalKonsul && (
                  <div className="p-3 surface-50 border-1 surface-border border-round-xl mt-3">
                    <div className="flex align-items-center justify-content-between mb-2">
                      <div className="flex align-items-center gap-2">
                        <i className="pi pi-question-circle text-indigo-500 font-bold" />
                        <span className="font-bold text-sm text-900">Pilihan Alur Kunjungan Pasien</span>
                      </div>
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
                              width: '36px', height: '36px',
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
                              width: '36px', height: '36px',
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
              </>
            )}
          </div>

          {/* STEP 3: SLOT JADWAL & KUOTA */}
          <div className="card surface-card border-1 surface-border border-round-xl p-4 shadow-1 mb-3">
            <div className="flex align-items-center justify-content-between mb-3">
              <div className="flex align-items-center gap-2">
                <span
                  className="flex align-items-center justify-content-center bg-primary text-white border-round-circle font-bold"
                  style={{ width: 28, height: 28 }}
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

            {/* Informasi & Peringatan Alur Konsultasi Dokter (Muncul jika Alur Konsultasi Dokter Aktif) */}
            {activeRuangan && effectiveButuhKonsul && (
              <>
                {!loadingSlots && dokterKonsulList.length === 0 ? (
                  <div className="flex align-items-start gap-3 p-3 mb-3 bg-amber-50 border-round-xl border-1 border-amber-300">
                    <div className="flex align-items-center justify-content-center bg-amber-100 text-amber-800 border-round-lg p-2 flex-shrink-0 mt-0.5">
                      <i className="pi pi-exclamation-triangle text-base" />
                    </div>
                    <div className="flex-1 text-xs text-amber-950 leading-normal">
                      <div className="font-bold mb-0.5 text-amber-900">
                        Tidak Ada Dokter Jaga di Ruang Konsultasi pada Hari {['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][tanggalBooking.getDay()]}:
                      </div>
                      Anda memilih alur <strong>Konsultasi Dokter Dulu</strong>, namun tidak ada dokter yang bertugas di Ruang Konsultasi pada tanggal ini.
                      {hasWajibKonsul ? (
                        <div className="mt-1 font-semibold text-red-700">
                          Karena tindakan ini berstatus Medical Treatment (Wajib Konsul), silakan ubah tanggal booking ke hari praktek dokter jaga (Senin, Selasa, Rabu, atau Sabtu). Klik tombol <strong>Jadwal Dokter Konsultasi</strong> di kanan atas untuk melihat jadwal lengkap.
                        </div>
                      ) : (
                        <div className="mt-1">
                          Silakan ubah tanggal booking ke hari praktek dokter jaga (lihat tombol <strong>Jadwal Dokter Konsultasi</strong> di kanan atas), atau ubah pilihan alur di Langkah 2 menjadi <strong>"Langsung Tindakan"</strong> jika ingin tetap di tanggal ini.
                        </div>
                      )}
                    </div>
                  </div>
                ) : slotOverlap && !slotOverlap.hasOverlap ? (
                  /* Edge Case: Nol Irisan Shift antara Dokter dan Terapis */
                  <div className="flex align-items-start gap-3 p-3 mb-3 bg-amber-50 border-round-xl border-1 border-amber-300">
                    <div className="flex align-items-center justify-content-center bg-amber-100 text-amber-800 border-round-lg p-2 flex-shrink-0 mt-0.5">
                      <i className="pi pi-exclamation-triangle text-base" />
                    </div>
                    <div className="flex-1 text-xs text-amber-950 leading-normal">
                      <div className="font-bold mb-0.5 text-amber-900">
                        Tidak Ada Irisan Jam Kerja Antara Dokter & Terapis:
                      </div>
                      Petugas treatment ({selectedSlot?.nama_petugas || slotOverlap.petugasName || 'Terapis'}) bertugas pukul <strong>{selectedSlot?.jam_mulai || slotOverlap.shiftMulai}–{selectedSlot?.jam_selesai || slotOverlap.shiftSelesai} WIB</strong>, sedangkan dokter jaga Ruang Konsultasi ({consultWindow?.dokterNames}) bertugas pukul <strong>{consultWindow?.docStartStr}–{consultWindow?.docEndStr} WIB</strong>.
                      <div className="mt-1 text-amber-900 font-semibold">
                        Karena tidak ada jam kerja yang beririsan untuk konsultasi pra-tindakan, silakan <strong>ubah tanggal booking</strong> ke hari lain atau ubah alur di Langkah 2 menjadi <strong>"Langsung Tindakan"</strong> jika diizinkan.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex align-items-center gap-3 p-3 mb-4 bg-indigo-50 border-round-xl border-1 border-indigo-200 text-xs text-indigo-950">
                    <div className="flex align-items-center justify-content-center bg-indigo-100 text-indigo-700 border-round-lg p-2 flex-shrink-0">
                      <i className="pi pi-info-circle text-base" />
                    </div>
                    <div className="flex-1" style={{ lineHeight: 1.55 }}>
                      {slotOverlap && consultWindow ? (
                        <>
                          <div>
                            Konsultasi Dokter Dulu dipilih. Jam treatment dibatasi ke{' '}
                            <strong className="text-indigo-900 font-bold">
                              {slotOverlap.overlapStartStr}–{slotOverlap.overlapEndStr} WIB
                            </strong>{' '}
                            mengikuti jam praktik {consultWindow.dokterNames} ({consultWindow.docStartStr}–{consultWindow.docEndStr} WIB).
                          </div>
                          <div className="mt-1.5 text-indigo-900" style={{ lineHeight: 1.55 }}>
                            Slot di bawah adalah jadwal terapis — jadwal dokter dicek otomatis saat check-in. Lihat jadwal dokter di hari lain lewat tombol di kanan atas.
                          </div>
                        </>
                      ) : consultWindow ? (
                        <>
                          <div>
                            Konsultasi Dokter Dulu dipilih. Jadwal treatment menyesuaikan jam praktik {consultWindow.dokterNames} ({consultWindow.docStartStr}–{consultWindow.docEndStr} WIB).
                          </div>
                          <div className="mt-1.5 text-indigo-900" style={{ lineHeight: 1.55 }}>
                            Slot di bawah adalah jadwal terapis — jadwal dokter dicek otomatis saat check-in. Lihat jadwal dokter di hari lain lewat tombol di kanan atas.
                          </div>
                        </>
                      ) : (
                        <div>
                          Konsultasi Dokter Dulu dipilih. Slot di bawah adalah jadwal terapis — jadwal dokter dicek otomatis saat check-in di hari-H. Lihat jadwal dokter di hari lain lewat tombol di kanan atas.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {!activeRuangan ? (
              <div className="text-center py-4 text-500 border-1 border-dashed surface-border border-round">
                <AlertCircle size={32} className="mx-auto mb-2 text-400" />
                <div>Pilih minimal satu layanan/paket di Langkah 2 terlebih dahulu untuk memuat slot jadwal yang tersedia.</div>
              </div>
            ) : loadingSlots ? (
              <div className="text-center py-4">
                <i className="pi pi-spin pi-spinner text-primary text-3xl mb-2"></i>
                <div className="text-sm text-500">Mengecek ketersediaan jadwal dokter dan kuota ruangan...</div>
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-4 text-500 border-1 border-dashed surface-border border-round">
                <AlertCircle size={32} className="mx-auto mb-2 text-amber-500" />
                <div className="font-semibold text-900 mb-1">Tidak Ada Jadwal Dokter / Terapis Tersedia</div>
                <div className="text-sm text-600">
                  Tidak ditemukan jadwal aktif untuk ruangan <strong>{activeRoomName}</strong> pada hari{' '}
                  <span className="font-bold">
                    {['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][tanggalBooking.getDay()]}
                  </span>
                  . Silakan pilih tanggal lain atau hubungi administrator.
                </div>
              </div>
            ) : (
              <div>
                <div className="text-xs text-500 mb-3 pt-1 flex align-items-center gap-1.5">
                  <Clock size={13} className="text-400" />
                  <span>Pilih salah satu jadwal terapis di bawah ini. Slot yang penuh tidak dapat dipilih.</span>
                </div>
                <div className="grid">
                  {slots.map((slot) => {
                    const isSelected = selectedSlot?.kode_jadwal === slot.kode_jadwal;
                    const isFull = !slot.is_available;

                    return (
                      <div key={slot.kode_jadwal} className="col-12 sm:col-6">
                        <div
                          onClick={() => {
                            if (!isFull) {
                              setSelectedSlot(slot);
                              setJamBooking('');
                              setIsManualTime(false);
                              setManualTimeInput('');
                              setManualTimeError('');
                            }
                          }}
                          className={`border-round-xl p-3 border-2 transition-all transition-duration-200 ${
                            isFull
                              ? 'surface-100 border-300 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'border-primary surface-50 shadow-2 cursor-pointer'
                              : 'surface-card border-200 hover:border-primary-300 hover:shadow-1 cursor-pointer'
                          }`}
                        >
                          <div className="flex justify-content-between align-items-start mb-2">
                            <div className="flex align-items-center gap-2">
                              <Clock size={16} className={isSelected ? 'text-primary' : 'text-500'} />
                              <span className="font-bold text-900 text-base">
                                {slot.jam_mulai} - {slot.jam_selesai} WIB
                              </span>
                            </div>
                            {isSelected ? (
                              <CheckCircle2 size={20} className="text-primary" />
                            ) : isFull ? (
                              <Tag value="PENUH" severity="danger" />
                            ) : (
                              <Tag value="TERSEDIA" severity="success" />
                            )}
                          </div>

                          <div className="text-sm font-semibold text-800 mb-1">{slot.nama_petugas}</div>
                          <div className="text-xs text-500 mb-2 flex align-items-center gap-1">
                            <MapPin size={13} /> {slot.nama_ruangan}
                          </div>

                          {/* Progress Kuota */}
                          <div className="mt-2">
                            <div className="flex justify-content-between text-xs mb-1">
                              <span className="text-600">Sisa Kuota:</span>
                              <span className={`font-bold ${isFull ? 'text-red-500' : 'text-green-600'}`}>
                                {slot.sisa_kuota} dari {slot.kuota_total}
                              </span>
                            </div>
                            <ProgressBar
                              value={Math.round((slot.kuota_terisi / (slot.kuota_total || 1)) * 100)}
                              showValue={false}
                              style={{ height: '6px' }}
                              color={isFull ? '#ef4444' : '#10b981'}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sub-komponen: Pilihan Jam Janji Temu Spesifik */}
                {selectedSlot && (
                  <div className="mt-4 pt-3 border-top-1 surface-border">
                    <div className="flex flex-column sm:flex-row justify-content-between align-items-start sm:align-items-center gap-2 mb-3">
                      <div>
                        <div className="flex align-items-center gap-2">
                          <Clock size={18} className="text-primary" />
                          <span className="font-bold text-base text-900">
                            Pilih Jam Janji Temu Spesifik
                          </span>
                          {jamBooking && (
                            <Tag value={`${jamBooking} WIB`} severity="success" className="font-bold px-2 py-1" />
                          )}
                        </div>
                        <div className="text-xs text-600 mt-1">
                          Shift: <strong>{selectedSlot.jam_mulai} - {selectedSlot.jam_selesai} WIB</strong> ({selectedSlot.nama_petugas}) · Total durasi tindakan:{' '}
                          <strong>{totalDurasi || 30} menit</strong>
                        </div>
                      </div>

                      {/* Switcher Chip vs Manual */}
                      <Button
                        type="button"
                        label={isManualTime ? 'Pilih dari Chip Interval' : 'Input Jam Khusus (Manual)'}
                        icon={isManualTime ? 'pi pi-th-large' : 'pi pi-pencil'}
                        className="p-button-outlined p-button-secondary p-button-sm text-xs"
                        onClick={() => {
                          const nextManual = !isManualTime;
                          setIsManualTime(nextManual);
                          if (nextManual) {
                            setManualTimeInput(jamBooking || selectedSlot.jam_mulai);
                            setManualTimeError('');
                          }
                        }}
                      />
                    </div>

                    {!isManualTime ? (
                      <div>
                        <div className="text-xs text-500 mb-2">
                          Klik salah satu jam kedatangan yang tersedia (interval 30 menit):
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {timeSlots.map((st) => {
                            const isSelected = jamBooking === st.time;
                            const isDisabled = st.exceedsShift || st.isBooked || st.isOutsideDoctor;

                            return (
                              <button
                                key={st.time}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => setJamBooking(st.time)}
                                title={
                                  st.isOutsideDoctor
                                    ? st.doctorDisabledReason
                                    : st.exceedsShift
                                    ? `Estimasi selesai (${st.endEst} WIB) melebihi batas shift (${selectedSlot.jam_selesai} WIB)`
                                    : st.isBooked
                                    ? 'Slot jam ini sudah dibooking pasien lain'
                                    : `Pilih jam ${st.time} WIB`
                                }
                                className={`p-2 border-round-lg text-center transition-all transition-duration-150 flex flex-column align-items-center justify-content-center ${
                                  isSelected
                                    ? 'bg-primary text-white border-primary shadow-2 ring-2 ring-primary-300 cursor-pointer font-bold'
                                    : isDisabled
                                    ? 'surface-100 text-400 border-200 cursor-not-allowed opacity-50'
                                    : 'surface-card text-800 border-1 border-300 hover:border-primary-400 hover:surface-50 cursor-pointer shadow-1'
                                }`}
                                style={{ minWidth: '84px', borderStyle: 'solid' }}
                              >
                                <span className="text-sm font-bold">{st.time}</span>
                                {st.isBooked ? (
                                  <span className="text-[10px] text-red-500 font-semibold uppercase mt-0.5">
                                    Terisi
                                  </span>
                                ) : !isDisabled ? (
                                  <span className={`text-[10px] ${isSelected ? 'text-white' : 'text-500'} mt-0.5`}>
                                    s/d {st.endEst}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>

                        {timeSlots.some((s) => s.isOutsideDoctor) && (
                          <div className="text-xs text-600 mt-2.5 flex align-items-center gap-1.5">
                            <span className="inline-block w-2 h-2 border-circle bg-gray-400 flex-shrink-0"></span>
                            <span>
                              Slot jam pudar sebelum pukul <strong>{consultWindow?.docStartStr} WIB</strong> dinonaktifkan karena dokter jaga Ruang Konsultasi ({consultWindow?.dokterNames}) baru bertugas pukul <strong>{consultWindow?.docStartStr} WIB</strong>.
                            </span>
                          </div>
                        )}

                        {timeSlots.some((s) => s.exceedsShift) && (
                          <div className="text-xs text-500 mt-1 flex align-items-center gap-1.5">
                            <span className="inline-block w-2 h-2 border-circle bg-gray-400 flex-shrink-0"></span>
                            <span>
                              Slot jam pudar di akhir shift dinonaktifkan karena durasi tindakan ({totalDurasi || 30} mnt) melebihi batas shift ({selectedSlot.jam_selesai} WIB).
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="surface-50 border-1 surface-border border-round-lg p-3">
                        <div className="font-semibold text-sm text-900 mb-2">
                          Masukkan Jam Spesifik (Contoh: 10:15):
                        </div>
                        <div className="flex flex-wrap align-items-center gap-3">
                          <div className="flex align-items-center gap-2">
                            <input
                              type="time"
                              value={manualTimeInput}
                              min={selectedSlot.jam_mulai}
                              max={selectedSlot.jam_selesai}
                              onChange={(e) => handleManualTimeChange(e.target.value)}
                              className="p-inputtext p-component p-inputtext-sm font-bold text-base"
                              style={{ padding: '6px 12px' }}
                            />
                            <span className="text-sm font-semibold text-700">WIB</span>
                          </div>

                          <Button
                            type="button"
                            label="Gunakan Jam Ini"
                            icon="pi pi-check"
                            className="p-button-primary p-button-sm"
                            disabled={!manualTimeInput || !!manualTimeError}
                            onClick={() => {
                              if (manualTimeInput && !manualTimeError) {
                                setJamBooking(manualTimeInput);
                              }
                            }}
                          />
                        </div>

                        {manualTimeError ? (
                          <div className="text-xs text-red-600 font-semibold mt-2 flex align-items-center gap-1">
                            <AlertCircle size={14} />
                            <span>{manualTimeError}</span>
                          </div>
                        ) : manualTimeInput && jamBooking === manualTimeInput ? (
                          <div className="text-xs text-green-700 font-semibold mt-2 flex align-items-center gap-1">
                            <CheckCircle2 size={14} />
                            <span>
                              Jam {manualTimeInput} WIB terpilih (perkiraan selesai {getEstimatedEndTime(manualTimeInput, totalDurasi || 30)} WIB).
                            </span>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* KOLOM KANAN: RINCIAN RESERVASI & PEMBAYARAN DP */}
        <div className="col-12 lg:col-4">
          <div className="card surface-card border-1 surface-border border-round-xl p-4 shadow-1 sticky" style={{ top: '5.5rem' }}>
            <div className="flex align-items-center justify-content-between mb-3">
              <div className="flex align-items-center gap-2">
                <CreditCard size={22} className="text-primary" />
                <span className="font-bold text-lg text-900">Rincian Reservasi & DP</span>
              </div>
              {selectedList.length > 0 && (
                <Tag value={`${selectedList.length} Item`} severity="info" className="text-xs font-bold" />
              )}
            </div>

            <div className="surface-50 border-round p-3 mb-3 text-sm flex flex-column gap-2">
              <div className="flex justify-content-between">
                <span className="text-600">Pasien:</span>
                <span className="font-semibold text-900 text-right">
                  {selectedPasien ? selectedPasien.nama : <span className="text-400 italic">Belum dipilih</span>}
                </span>
              </div>

              <div className="flex justify-content-between">
                <span className="text-600">Ruangan Tujuan:</span>
                <span className="font-semibold text-primary text-right">
                  {activeRoomName || <span className="text-400 italic">Belum dipilih</span>}
                </span>
              </div>

              <div className="flex justify-content-between">
                <span className="text-600">Tanggal:</span>
                <span className="font-semibold text-900 text-right">
                  {formatDateToYMD(tanggalBooking)}
                </span>
              </div>

              <div className="flex justify-content-between">
                <span className="text-600">Jadwal:</span>
                <span className="font-semibold text-right">
                  {!selectedSlot ? (
                    <span className="text-400 italic">Belum dipilih</span>
                  ) : !jamBooking ? (
                    <span className="text-orange-600">
                      {selectedSlot.nama_petugas}{' '}
                      <span className="text-xs font-normal underline block">(Pilih jam janji temu...)</span>
                    </span>
                  ) : (
                    <span className="text-900">
                      {selectedSlot.nama_petugas}{' '}
                      <strong className="text-primary">({jamBooking} WIB)</strong>
                    </span>
                  )}
                </span>
              </div>

              {selectedList.length > 0 && (
                <div className="flex justify-content-between align-items-center">
                  <span className="text-600">Alur Kunjungan:</span>
                  <span className="font-semibold text-right">
                    {hasWajibKonsul ? (
                      <Tag value="Wajib Konsul Dokter" severity="danger" className="text-[10px] font-bold" />
                    ) : hasOpsionalKonsul ? (
                      globalConsultChoice ? (
                        <Tag value="Konsultasi Dulu" severity="info" className="text-[10px] font-bold" />
                      ) : (
                        <Tag value="Langsung Tindakan" severity="success" className="text-[10px] font-bold" />
                      )
                    ) : (
                      <Tag value="Langsung Tindakan" severity="secondary" className="text-[10px] font-bold" />
                    )}
                  </span>
                </div>
              )}

              <Divider className="my-1" />

              {/* DAFTAR LAYANAN YANG DIPILIH */}
              <div>
                <div className="text-xs font-semibold text-600 mb-1">Item Layanan / Paket:</div>
                {selectedList.length === 0 ? (
                  <div className="text-xs text-400 italic py-1">Belum ada layanan dipilih</div>
                ) : (
                  <div className="flex flex-column gap-1 max-h-12rem overflow-y-auto pr-1">
                    {selectedList.map((item) => {
                      const itemKey = item.jenis === 'klaim_paket'
                        ? `klaim_${item.kode_detail_kepemilikan_paket_layanan || item.kode_layanan}`
                        : `${item.jenis}_${item.kode_layanan}`;
                      return (
                        <div
                          key={itemKey}
                          className="flex justify-content-between align-items-start text-xs py-1 border-bottom-1 surface-border"
                        >
                          <div className="pr-2">
                            <div className="font-medium text-800">{item.nama}</div>
                            <div className="text-500 text-[11px]">
                              {item.durasi_menit ? `${item.durasi_menit} mnt · ` : ''}
                              {item.jenis === 'klaim_paket' ? (
                                <span className="text-amber-700 font-semibold">Klaim Sesi Paket</span>
                              ) : (
                                item.nama_kategori || item.jenis
                              )}
                            </div>
                          </div>
                          <div className="font-semibold text-900 white-space-nowrap">
                            {item.jenis === 'klaim_paket' ? (
                              <span className="text-amber-700 font-bold">Rp 0 (Klaim)</span>
                            ) : (
                              formatCurrency(item.harga_asal ?? item.harga)
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Divider className="my-1" />

              <div className="flex justify-content-between align-items-center">
                <span className="font-bold text-900">Total Biaya:</span>
                <span className="font-bold text-primary text-base">{formatCurrency(totalHarga)}</span>
              </div>
            </div>

            {/* Input Kalkulasi DP */}
            <div className="mb-3">
              <label className="font-medium text-sm block mb-1">
                Uang Muka / DP <span className="text-red-500">*</span>
              </label>
              {hasOnlyKlaim ? (
                <div className="p-3 bg-green-50 border-1 border-green-200 border-round-lg text-xs text-green-900 flex align-items-center gap-2">
                  <i className="pi pi-check-circle text-green-600 text-base" />
                  <span>
                    <strong>Bebas DP (Rp 0):</strong> Seluruh item merupakan klaim paket yang sudah dibayar di awal.
                  </span>
                </div>
              ) : (
                <>
                  <div className="grid formgrid p-fluid">
                    <div className="col-5">
                      <div className="p-inputgroup">
                        <InputNumber
                          value={dpPercentage}
                          onValueChange={(e) => handlePercentageChange(e.value || 0)}
                          min={0}
                          max={100}
                          className="w-full"
                        />
                        <span className="p-inputgroup-addon text-xs">%</span>
                      </div>
                    </div>
                    <div className="col-7">
                      <InputNumber
                        value={dpNominal}
                        onValueChange={(e) => setDpNominal(e.value || 0)}
                        mode="currency"
                        currency="IDR"
                        locale="id-ID"
                        className="w-full font-bold"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-500 mt-1">
                    Default 20%. Nominal DP dapat disesuaikan manual.
                  </div>
                </>
              )}
            </div>

            {/* Sumber Reservasi */}
            <div className="mb-3">
              <label className="font-medium text-sm block mb-1">Sumber Reservasi</label>
              <SelectButton
                value={sumber}
                options={[
                  { label: 'Staff / Meja', value: 'staff' },
                  { label: 'WhatsApp', value: 'whatsapp' },
                ]}
                onChange={(e) => e.value && setSumber(e.value)}
                className="w-full"
              />
            </div>

            {/* Catatan Pasien */}
            <div className="mb-3">
              <label className="font-medium text-sm block mb-1">Catatan Pasien (Opsional)</label>
              <InputTextarea
                value={catatanPasien}
                onChange={(e) => setCatatanPasien(e.target.value)}
                rows={2}
                placeholder="Keluhan awal, permintaan khusus, dll..."
                className="w-full"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-column gap-2">
              <Button
                label="Simpan & Konfirmasi Booking"
                icon="pi pi-check"
                className="p-button-primary w-full py-3 font-bold"
                onClick={handleSubmitBooking}
                loading={loadingSubmit}
                disabled={!selectedPasien || selectedList.length === 0 || !selectedSlot || !jamBooking}
              />
              <Button
                label="Reset Form"
                icon={<RotateCcw size={16} className="mr-1" />}
                className="p-button-outlined p-button-secondary w-full"
                onClick={handleResetForm}
                disabled={loadingSubmit}
              />
            </div>

            {/* Panel Ringkasan & Kebijakan Booking */}
            <div className="mt-3 p-3 surface-50 border-1 border-200 border-round-lg">
              <div className="flex align-items-center gap-2 mb-2">
                <Info size={15} className="text-primary flex-shrink-0" />
                <span className="font-bold text-xs uppercase tracking-wider text-700">
                  Ringkasan & Kebijakan Booking
                </span>
              </div>
              <ul className="m-0 pl-3 text-xs text-600 line-height-3 flex flex-column gap-2" style={{ paddingLeft: '1.1rem' }}>
                <li>
                  <strong className="text-700">Kebijakan DP:</strong> Uang muka yang telah dibayar otomatis dipotongkan ke tagihan saat pasien <em>check-in</em> di klinik. Bila pasien tidak hadir, DP dinyatakan <em>hangus</em>.
                </li>
                <li>
                  <strong className="text-700">Toleransi Keterlambatan:</strong> Maksimal <strong>30 menit</strong> dari jam booking sebelum status otomatis ditandai <em>tidak hadir</em>.
                </li>
                <li>
                  <strong className="text-700">Alokasi Jadwal:</strong> Slot & jam yang dipilih akan terkunci secara khusus untuk pasien ini saat booking disimpan.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Dialog Pendaftaran Cepat Pasien Baru */}
      <DialogQuickAddPasien
        visible={showQuickAddPasien}
        onHide={() => setShowQuickAddPasien(false)}
        onSuccess={(newPasien: any) => {
          setSelectedPasien(newPasien);
          setPasienList([]);
        }}
        toast={toast}
      />

      {/* Dialog Detail / Bukti Booking */}
      <DialogDetailBooking
        visible={showDetailDialog}
        booking={createdBookingData}
        onHide={() => setShowDetailDialog(false)}
      />

      {/* Dialog Jadwal Mingguan Ruangan (Konsultasi Dokter & Ruangan Treatment Lain) */}
      <DialogJadwalMingguanRuangan
        visible={showJadwalRuanganDialog}
        onHide={() => setShowJadwalRuanganDialog(false)}
        rooms={jadwalDialogRooms}
        tanggalTerpilih={tanggalBooking}
      />
    </div>
  );
};

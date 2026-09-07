'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { ProgressSpinner } from 'primereact/progressspinner';
import postData from '@/lib/axios/postData';
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  Building,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';

interface JadwalDetail {
  kode_jadwal: string;
  no_sip: string;
  kode_ruangan: string;
  nama_ruangan: string;
  nama_karyawan: string;
  jabatan: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  kuota: number;
  status: string;
}

export interface RoomTabOption {
  kodeRuangan: string;
  namaRuangan: string;
  iconType?: 'doctor' | 'treatment';
}

interface Props {
  visible: boolean;
  onHide: () => void;
  // Multi-room support (tab ganda bila mode konsultasi aktif)
  rooms?: RoomTabOption[];
  // Fallback single room
  kodeRuangan?: string | null;
  namaRuangan?: string;
  tanggalTerpilih?: Date;
  onSelectTanggal?: (hariKey: string) => void;
}

const DAYS_OF_WEEK = [
  { key: 'senin', label: 'Senin', short: 'Sen' },
  { key: 'selasa', label: 'Selasa', short: 'Sel' },
  { key: 'rabu', label: 'Rabu', short: 'Rab' },
  { key: 'kamis', label: 'Kamis', short: 'Kam' },
  { key: 'jumat', label: 'Jumat', short: 'Jum' },
  { key: 'sabtu', label: 'Sabtu', short: 'Sab' },
  { key: 'minggu', label: 'Minggu', short: 'Min' },
];

const HARI_MAP = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

export const DialogJadwalMingguanRuangan: React.FC<Props> = ({
  visible,
  onHide,
  rooms,
  kodeRuangan,
  namaRuangan = 'Ruang Konsultasi',
  tanggalTerpilih,
}) => {
  // Normalisasi list ruangan yang bisa dipilih sebagai tab
  const activeRoomsList: RoomTabOption[] = React.useMemo(() => {
    if (rooms && rooms.length > 0) {
      return rooms.filter((r) => Boolean(r.kodeRuangan));
    }
    if (kodeRuangan) {
      return [{ kodeRuangan, namaRuangan, iconType: 'doctor' }];
    }
    return [];
  }, [rooms, kodeRuangan, namaRuangan]);

  const [activeRoomIdx, setActiveRoomIdx] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [scheduleCache, setScheduleCache] = useState<{ [kode: string]: JadwalDetail[] }>({});

  // Reset tab ke tab pertama saat modal dibuka
  useEffect(() => {
    if (visible) {
      setActiveRoomIdx(0);
    }
  }, [visible]);

  // Ruangan yang sedang aktif ditampilkan
  const currentRoom = activeRoomsList[activeRoomIdx] || activeRoomsList[0];

  // Ambil jadwal setiap kali ruangan aktif berubah atau dialog dibuka
  useEffect(() => {
    if (!visible || !currentRoom?.kodeRuangan) return;
    if (scheduleCache[currentRoom.kodeRuangan]) return; // Gunakan cache jika sudah ada

    loadSchedule(currentRoom.kodeRuangan);
  }, [visible, currentRoom?.kodeRuangan, scheduleCache]);

  const loadSchedule = async (kdRuang: string) => {
    setLoading(true);
    try {
      const res = await postData('/master/jadwal-karyawan-data', {
        kode_ruangan: kdRuang,
        status: 'aktif',
      });
      if (res.data?.status === 200 || res.status === 200) {
        const raw: JadwalDetail[] = res.data?.data || [];
        setScheduleCache((prev) => ({ ...prev, [kdRuang]: raw }));
      } else {
        setScheduleCache((prev) => ({ ...prev, [kdRuang]: [] }));
      }
    } catch (err) {
      console.error('Gagal mengambil jadwal mingguan ruangan:', err);
      setScheduleCache((prev) => ({ ...prev, [kdRuang]: [] }));
    } finally {
      setLoading(false);
    }
  };

  // Hari yang sedang dipilih di kalender form booking (Konsisten di semua tab!)
  const selectedDayKey = tanggalTerpilih ? HARI_MAP[tanggalTerpilih.getDay()] : null;
  const formattedSelectedDate = tanggalTerpilih
    ? tanggalTerpilih.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  const activeSchedules = (currentRoom?.kodeRuangan && scheduleCache[currentRoom.kodeRuangan]) || [];

  // Kelompokkan jadwal per hari
  const scheduleByDay: { [key: string]: JadwalDetail[] } = {};
  DAYS_OF_WEEK.forEach((d) => {
    scheduleByDay[d.key] = activeSchedules.filter(
      (s) => (s.hari || '').toLowerCase() === d.key && s.status === 'aktif'
    );
  });

  const totalActiveDays = Object.values(scheduleByDay).filter((list) => list.length > 0).length;

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      style={{ width: '650px', maxWidth: '95vw' }}
      header={
        <div className="flex align-items-center gap-2">
          <div className="flex align-items-center justify-content-center bg-indigo-100 text-indigo-700 border-round-lg p-2">
            <Calendar size={20} />
          </div>
          <div>
            <div className="font-bold text-lg text-900 leading-tight">
              Jadwal Mingguan Petugas & Dokter
            </div>
            <div className="text-xs text-500 font-normal">
              Ketersediaan shift kerja Senin s.d. Minggu
            </div>
          </div>
        </div>
      }
      footer={
        <div className="flex justify-content-between align-items-center pt-2">
          <div className="text-xs text-600 flex align-items-center gap-1">
            <Info size={14} className="text-primary" />
            <span>
              {currentRoom?.namaRuangan}: aktif <strong>{totalActiveDays} dari 7 hari</strong> seminggu
            </span>
          </div>
          <Button
            label="Tutup"
            icon="pi pi-times"
            className="p-button-primary p-button-sm px-3"
            onClick={onHide}
          />
        </div>
      }
    >
      <div className="py-1">
        {/* Tab Switcher Ganda (Muncul jika ada lebih dari 1 ruangan: misal Ruang Konsul + Ruang Treatment) */}
        {activeRoomsList.length > 1 && (
          <div className="flex align-items-center gap-2 mb-3 p-1 bg-surface-100 border-round-xl border-1 surface-border">
            {activeRoomsList.map((rm, idx) => {
              const isActive = activeRoomIdx === idx;
              return (
                <button
                  key={rm.kodeRuangan}
                  type="button"
                  onClick={() => setActiveRoomIdx(idx)}
                  className={`flex-1 py-2 px-3 border-round-lg text-xs font-bold transition-all border-none cursor-pointer flex align-items-center justify-content-center gap-2 ${
                    isActive
                      ? 'bg-white text-primary shadow-2'
                      : 'bg-transparent text-600 hover:text-900 hover:bg-surface-200'
                  }`}
                >
                  {rm.iconType === 'doctor' ? (
                    <Stethoscope size={15} className={isActive ? 'text-primary' : 'text-500'} />
                  ) : (
                    <Building size={15} className={isActive ? 'text-primary' : 'text-500'} />
                  )}
                  <span>{rm.namaRuangan}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Banner Penanda Hari Terpilih di Kalender Booking (Konsisten di SEMUA Tab!) */}
        {tanggalTerpilih && (
          <div className="p-2.5 mb-3 bg-indigo-50 border-1 border-indigo-200 border-round-lg flex align-items-center justify-content-between">
            <div className="flex align-items-center gap-2">
              <span className="text-xs font-semibold text-indigo-900">
                Tanggal Booking Saat Ini:
              </span>
              <span className="text-xs font-bold text-indigo-700">
                {formattedSelectedDate}
              </span>
            </div>
            <Tag
              value={`Hari ${selectedDayKey ? selectedDayKey.toUpperCase() : ''}`}
              severity="info"
              className="text-xs font-bold uppercase"
            />
          </div>
        )}

        {loading ? (
          <div className="flex flex-column align-items-center justify-content-center py-6">
            <ProgressSpinner style={{ width: '40px', height: '40px' }} strokeWidth="4" />
            <span className="text-xs text-500 mt-2">
              Memuat jadwal {currentRoom?.namaRuangan || 'ruangan'}...
            </span>
          </div>
        ) : (
          <div className="flex flex-column gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const daySchedules = scheduleByDay[day.key] || [];
              const hasSchedule = daySchedules.length > 0;
              const isSelectedDay = selectedDayKey === day.key;

              return (
                <div
                  key={day.key}
                  className={`p-3 border-round-xl transition-all transition-duration-150 border-2 ${
                    isSelectedDay
                      ? 'border-indigo-500 shadow-2 bg-indigo-50/40'
                      : hasSchedule
                      ? 'surface-card border-200 hover:border-300'
                      : 'surface-100 border-200 opacity-80'
                  }`}
                >
                  <div className="flex flex-column sm:flex-row justify-content-between align-items-start sm:align-items-center gap-2">
                    {/* Sisi Kiri: Badge Hari & Label Terpilih */}
                    <div className="flex align-items-center gap-2">
                      <div
                        className={`font-bold text-xs py-1 px-2.5 border-round text-center min-w-4rem ${
                          isSelectedDay
                            ? 'bg-indigo-600 text-white shadow-1'
                            : hasSchedule
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-surface-300 text-500'
                        }`}
                      >
                        {day.label}
                      </div>

                      {isSelectedDay && (
                        <span className="inline-flex align-items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 border-round-md">
                          <CheckCircle2 size={13} />
                          Hari Pilihan Booking Anda
                        </span>
                      )}
                    </div>

                    {/* Sisi Kanan: Status Ketersediaan Ringkas */}
                    <div>
                      {hasSchedule ? (
                        <Tag
                          value={`${daySchedules.length} Shift Tersedia`}
                          severity="success"
                          className="text-xs font-semibold py-0 px-2"
                        />
                      ) : (
                        <Tag
                          value="Tidak Ada Jadwal"
                          severity="danger"
                          className="text-xs font-semibold py-0 px-2 opacity-80"
                        />
                      )}
                    </div>
                  </div>

                  {/* Rincian Petugas / Shift pada Hari Tersebut */}
                  <div className="mt-2 pl-1">
                    {hasSchedule ? (
                      <div className="flex flex-column gap-1.5">
                        {daySchedules.map((s, idx) => {
                          const isDoctor = (s.jabatan || '').toLowerCase().includes('dokter');
                          const jamMulai = (s.jam_mulai || '').slice(0, 5);
                          const jamSelesai = (s.jam_selesai || '').slice(0, 5);

                          return (
                            <div
                              key={idx}
                              className="flex flex-column sm:flex-row sm:align-items-center justify-content-between text-xs bg-white p-2 border-round border-1 surface-border gap-1"
                            >
                              <div className="flex align-items-center gap-2">
                                {isDoctor ? (
                                  <Stethoscope size={15} className="text-primary flex-shrink-0" />
                                ) : (
                                  <User size={15} className="text-500 flex-shrink-0" />
                                )}
                                <span className="font-bold text-900">{s.nama_karyawan}</span>
                                <span className="text-500 capitalize">({s.jabatan || 'Petugas'})</span>
                              </div>

                              <div className="flex align-items-center gap-2 ml-4 sm:ml-0">
                                <span className="text-600 font-semibold flex align-items-center gap-1 bg-surface-100 px-2 py-0.5 border-round">
                                  <Clock size={12} className="text-500" />
                                  {jamMulai} - {jamSelesai} WIB
                                </span>
                                {s.kuota > 0 && (
                                  <span className="text-500 text-[11px]">
                                    Kuota: <strong>{s.kuota}</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-500 italic flex align-items-center gap-1.5 py-1">
                        <XCircle size={14} className="text-red-400 flex-shrink-0" />
                        <span>
                          {currentRoom?.namaRuangan || 'Ruangan ini'} tidak memiliki jadwal praktek pada hari {day.label}.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Dialog>
  );
};

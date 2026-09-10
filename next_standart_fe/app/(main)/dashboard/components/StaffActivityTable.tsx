'use client';

import React from 'react';

interface DoctorItem {
  nama?: string;
  name?: string;
  total_konsul?: number;
  patients?: number;
}

interface StaffItem {
  nama?: string;
  name?: string;
  jabatan?: string;
  role?: string;
  total_tindakan?: number;
  sessions?: number;
}

interface StaffActivityTableProps {
  doctors: DoctorItem[];
  staff: StaffItem[];
}

export const getInitials = (fullName: string) => {
  if (!fullName) return '--';
  const clean = fullName.replace(/^(dr\.|drg\.|prof\.|ners\.)\s*/i, '').trim();
  const parts = clean.split(' ').filter(Boolean);
  if (parts.length === 0) return '--';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export const StaffActivityTable: React.FC<StaffActivityTableProps> = ({
  doctors,
  staff,
}) => {
  const rawDoctors: DoctorItem[] =
    doctors && doctors.length > 0
      ? doctors
      : [
          { nama: 'M. Hais Batara', total_konsul: 0 },
          { nama: 'dr. Amanda Putri Wijaya', total_konsul: 6 },
          { nama: 'dr. Bagus Santoso', total_konsul: 10 },
        ];

  const rawStaff: StaffItem[] =
    staff && staff.length > 0
      ? staff
      : [
          { nama: 'Rani Kartika, S.Kep.Ns', jabatan: 'perawat', total_tindakan: 0 },
          { nama: 'Siti Nurhaliza, S.Kep.Ns', jabatan: 'perawat', total_tindakan: 0 },
          { nama: 'Dewi Anjani', jabatan: 'terapis', total_tindakan: 0 },
          { nama: 'Fajar Ramadhan', jabatan: 'terapis', total_tindakan: 0 },
        ];

  return (
    <div className="clinic-two-col-grid">
      {/* 1. AKTIVITAS DOKTER SPESIALIS */}
      <div
        className="clinic-panel h-full flex flex-column justify-content-between bg-white"
        style={{ padding: '24px' }}
      >
        <div>
          {/* HEADER */}
          <div className="clinic-card-header">
            <h3 className="clinic-card-title">Aktivitas dokter spesialis</h3>
            <span className="clinic-pill clinic-pill-emerald">
              {rawDoctors.length} dokter terdaftar
            </span>
          </div>

          {/* TABLE */}
          <div className="w-full">
            {/* TABLE HEADER */}
            <div
              className="flex justify-content-between py-2 text-xs font-semibold"
              style={{ color: '#6F7A74', borderBottom: '1px solid #E5E7EB' }}
            >
              <span>Nama dokter</span>
              <span>Konsultasi & RM</span>
            </div>

            {/* TABLE ROWS */}
            <div className="flex flex-column">
              {rawDoctors.map((doc, idx) => {
                const docName = doc.nama || doc.name || 'Dokter';
                const consults = Number(doc.total_konsul ?? doc.patients ?? 0);
                const initials = getInitials(docName);

                return (
                  <div
                    key={idx}
                    className="clinic-table-row flex justify-content-between align-items-center"
                  >
                    <div className="flex align-items-center gap-2.5">
                      <div className="clinic-avatar">{initials}</div>
                      <span className="text-xs font-medium" style={{ color: '#202A26' }}>
                        {docName}
                      </span>
                    </div>

                    <div className="text-xs tabular-nums font-normal" style={{ color: '#6F7A74' }}>
                      {consults} pasien
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 2. AKTIVITAS BEAUTICIAN & TERAPIS */}
      <div
        className="clinic-panel h-full flex flex-column justify-content-between bg-white"
        style={{ padding: '24px' }}
      >
        <div>
          {/* HEADER */}
          <div className="clinic-card-header">
            <h3 className="clinic-card-title">Aktivitas beautician & terapis</h3>
            <span className="clinic-pill clinic-pill-emerald">
              {rawStaff.length} petugas terdaftar
            </span>
          </div>

            {/* TABLE */}
            <div className="w-full">
              {/* TABLE HEADER */}
              <div
                className="grid m-0 py-2 text-xs font-semibold"
                style={{ color: '#6F7A74', borderBottom: '1px solid #E5E7EB' }}
              >
                <div className="col-6 p-0">Nama petugas</div>
                <div className="col-3 p-0 text-center">Jabatan</div>
                <div className="col-3 p-0 text-right">Sesi ditangani</div>
              </div>

              {/* TABLE ROWS */}
              <div className="flex flex-column">
                {rawStaff.map((st, idx) => {
                  const staffName = st.nama || st.name || 'Petugas';
                  const roleName = String(st.jabatan || st.role || 'Terapis').toLowerCase();
                  const isNurse = roleName.includes('perawat');
                  const actions = Number(st.total_tindakan ?? st.sessions ?? 0);
                  const initials = getInitials(staffName);

                  return (
                    <div
                      key={idx}
                      className="clinic-table-row grid align-items-center m-0"
                    >
                      <div className="col-6 p-0 flex align-items-center gap-2.5">
                        <div className="clinic-avatar">{initials}</div>
                        <span className="text-xs font-medium truncate" style={{ color: '#202A26' }}>
                          {staffName}
                        </span>
                      </div>

                      <div className="col-3 p-0 text-center">
                        <span
                          className={`clinic-pill-role ${
                            isNurse
                              ? 'clinic-pill-role-perawat'
                              : 'clinic-pill-role-terapis'
                          }`}
                        >
                          {isNurse ? 'Perawat' : 'Terapis'}
                        </span>
                      </div>

                      <div className="col-3 p-0 text-right text-xs tabular-nums font-normal" style={{ color: '#6F7A74' }}>
                        {actions} tindakan
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default StaffActivityTable;

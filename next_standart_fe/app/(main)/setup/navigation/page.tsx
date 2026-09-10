'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Tag } from 'primereact/tag';
import postData from '@/lib/axios/postData';
import { showError, showSuccess } from '@/lib/tools/generalTools';

interface SubMenuItem {
  label: string;
  icon: string;
  to: string;
}

interface MenuGroup {
  label: string;
  icon: string;
  items: SubMenuItem[];
}

interface RoleMeta {
  role: string;
  title: string;
  icon: string;
  color: string;
  bgLight: string;
  description: string;
  // Default recommendations matching role duties
  recommendedPaths: string[];
}

const ROLES: RoleMeta[] = [
  {
    role: 'owner',
    title: 'OWNER / MANAGER',
    icon: 'pi pi-user',
    color: '#0284c7',
    bgLight: '#f0f9ff',
    description: 'KPI Klinik, Pendapatan, Monitoring Treatment, Inventory Valuation, dan Performa SDM.',
    recommendedPaths: [
      '/dashboard',
      '/pendaftaran-antrean/antrean?type=layanan',
      '/pendaftaran-antrean/antrean?type=konsul',
      '/kasir',
      '/riwayat/rekam-medis',
      '/pendaftaran-antrean/antrean',
      '/master-data/layanan',
      '/master-data/produk',
      '/master-data/promo',
    ],
  },
  {
    role: 'dokter',
    title: 'DOKTER',
    icon: 'pi pi-heart-fill',
    color: '#0f766e',
    bgLight: '#f0fdfa',
    description: 'Pemeriksaan klinis pasien, diagnosa rekam medis, treatment plan, dan antrean konsultasi.',
    recommendedPaths: [
      '/dashboard',
      '/pendaftaran-antrean/antrean?type=konsul',
      '/pendaftaran-antrean/antrean?type=layanan',
      '/riwayat/rekam-medis',
      '/master-data/layanan',
      '/master-data/paket-layanan',
    ],
  },
  {
    role: 'beautician',
    title: 'BEAUTICIAN / TERAPIS',
    icon: 'pi pi-sparkles',
    color: '#9333ea',
    bgLight: '#faf5ff',
    description: 'Pelayanan treatment estetika, antrean ruangan perawatan, SOP, dan foto before-after.',
    recommendedPaths: [
      '/dashboard',
      '/pendaftaran-antrean/antrean?type=layanan',
      '/riwayat/rekam-medis',
      '/master-data/layanan',
    ],
  },
  {
    role: 'kasir',
    title: 'KASIR',
    icon: 'pi pi-calculator',
    color: '#16a34a',
    bgLight: '#f0fdf4',
    description: 'Transaksi pembayaran layanan dan produk, invoice kasir, promo diskon, dan mutasi kas.',
    recommendedPaths: [
      '/dashboard',
      '/kasir',
      '/antrian-awal',
      '/pendaftaran-antrean/registrasi-pasien',
      '/pendaftaran-antrean/pendaftaran-pasien',
      '/pendaftaran-antrean/booking',
      '/pendaftaran-antrean/antrean',
      '/master-data-user/data-pasien',
      '/master-data/promo',
      '/master-data/detail-promo',
    ],
  },
  {
    role: 'warehouse',
    title: 'WAREHOUSE / LOGISTIK',
    icon: 'pi pi-box',
    color: '#ea580c',
    bgLight: '#fff7ed',
    description: 'Katalog stok produk, bahan medis, monitoring kadaluwarsa, supplier, dan log PO penerimaan.',
    recommendedPaths: [
      '/dashboard',
      '/master-data/kategori-produk',
      '/master-data/produk',
      '/master-data/paket-produk',
      '/master-data/supplier',
      '/master-data/alat',
    ],
  },
  {
    role: 'superadmin',
    title: 'SUPERADMIN / IT',
    icon: 'pi pi-shield',
    color: '#4f46e5',
    bgLight: '#eef2ff',
    description: 'Administrator sistem klinik dengan hak akses tak terbatas ke seluruh menu dan pengaturan.',
    recommendedPaths: ['*'], // All
  },
];

export default function ManajemenMenuPage() {
  const [selectedRole, setSelectedRole] = useState<string>('dokter');
  const [masterMenu, setMasterMenu] = useState<MenuGroup[]>([]);
  const [activePaths, setActivePaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [isCustom, setIsCustom] = useState<boolean>(false);

  const toast = useRef<Toast>(null);

  const currentRoleMeta = ROLES.find((r) => r.role === selectedRole) || ROLES[0];

  // Fetch menu template & current role menu
  const fetchRoleMenu = async (role: string) => {
    setLoading(true);
    try {
      const res = await postData('/setup/nav/base-data', { role });
      if (['00', '0000'].includes(res?.data?.status)) {
        const fullMaster: MenuGroup[] = res.data.master_menu || [];
        const currentMenu: MenuGroup[] = res.data.data || [];

        setMasterMenu(fullMaster);
        setIsCustom(Boolean(res.data.is_custom));

        // Extract all paths currently enabled for this role
        const paths = new Set<string>();
        currentMenu.forEach((group) => {
          (group.items || []).forEach((item) => {
            if (item.to) paths.add(item.to);
          });
        });
        setActivePaths(paths);
      } else {
        showError(toast, res?.data?.message || 'Gagal memuat data menu role');
      }
    } catch (err: any) {
      showError(toast, err?.response?.data?.message || err?.message || 'Gagal terhubung ke server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoleMenu(selectedRole);
  }, [selectedRole]);

  // Toggle individual item
  const handleToggleItem = (path: string) => {
    const next = new Set(activePaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setActivePaths(next);
  };

  // Toggle whole group
  const handleToggleGroup = (group: MenuGroup) => {
    const groupPaths = (group.items || []).map((it) => it.to);
    const allChecked = groupPaths.every((p) => activePaths.has(p));
    const next = new Set(activePaths);

    if (allChecked) {
      groupPaths.forEach((p) => next.delete(p));
    } else {
      groupPaths.forEach((p) => next.add(p));
    }
    setActivePaths(next);
  };

  // Apply default recommendations
  const handleApplyPreset = () => {
    if (currentRoleMeta.recommendedPaths.includes('*')) {
      // Select all
      const next = new Set<string>();
      masterMenu.forEach((g) => (g.items || []).forEach((it) => next.add(it.to)));
      setActivePaths(next);
    } else {
      setActivePaths(new Set(currentRoleMeta.recommendedPaths));
    }
    showSuccess(toast, `Rekomendasi hak akses standar untuk role '${currentRoleMeta.title}' berhasil diterapkan.`);
  };

  // Select all
  const handleSelectAll = () => {
    const next = new Set<string>();
    masterMenu.forEach((g) => (g.items || []).forEach((it) => next.add(it.to)));
    setActivePaths(next);
  };

  // Deselect all
  const handleDeselectAll = () => {
    setActivePaths(new Set());
  };

  // Save changes to database
  const handleSave = async () => {
    setSaving(true);
    try {
      // Build filtered menu tree based on activePaths
      const filteredMenu: MenuGroup[] = [];

      masterMenu.forEach((group) => {
        const matchingItems = (group.items || []).filter((it) => activePaths.has(it.to));
        if (matchingItems.length > 0) {
          filteredMenu.push({
            label: group.label,
            icon: group.icon,
            items: matchingItems,
          });
        }
      });

      const res = await postData('/setup/nav/role-save', {
        role: selectedRole,
        menu: filteredMenu,
      });

      if (['00', '0000'].includes(res?.data?.status)) {
        showSuccess(
          toast,
          res?.data?.message || `Pengaturan hak akses role '${currentRoleMeta.title}' berhasil disimpan!`
        );
        setIsCustom(true);
        fetchRoleMenu(selectedRole);
      } else {
        showError(toast, res?.data?.message || 'Gagal menyimpan pengaturan navigasi');
      }
    } catch (err: any) {
      showError(toast, err?.response?.data?.message || err?.message || 'Terjadi kesalahan sistem');
    } finally {
      setSaving(false);
    }
  };

  // Count active modules
  let totalActive = 0;
  let totalAvailable = 0;
  masterMenu.forEach((g) => {
    (g.items || []).forEach((it) => {
      totalAvailable++;
      if (activePaths.has(it.to)) totalActive++;
    });
  });

  return (
    <div className="surface-ground min-h-screen p-3 md:p-4 border-round-xl">
      <Toast ref={toast} />

      <div className="surface-card p-4 border-round-xl border-1 surface-border shadow-1 mb-4">
        {/* HEADER BAR */}
        <div className="flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center gap-3 mb-4">
          <div>
            <div className="flex align-items-center gap-2">
              <span
                className="flex align-items-center justify-content-center border-round-xl shadow-1"
                style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#1d4ed8', color: '#ffffff', flexShrink: 0 }}
              >
                <i className="pi pi-sliders-h text-lg" />
              </span>
              <h1 className="text-xl md:text-2xl font-black text-gray-800 m-0">
                Pengaturan Hak Akses Menu Role
              </h1>
            </div>
            <p className="text-gray-500 m-0 mt-1 text-xs md:text-sm">
              Super Admin dapat mengatur dan mencentang modul apa saja yang boleh diakses oleh masing-masing peran secara spesifik.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 align-items-center">
            <Button
              label="Simpan Hak Akses Role"
              icon="pi pi-check"
              className="p-button-success p-button-sm border-round-lg shadow-2 font-bold px-3 py-2"
              onClick={handleSave}
              loading={saving}
            />
          </div>
        </div>

        {/* ROLE SELECTOR BUTTONS */}
        <div className="flex flex-wrap gap-2 mb-4 pb-3 border-bottom-1 surface-border">
          {ROLES.map((cfg) => {
            const isSelected = selectedRole === cfg.role;
            return (
              <Button
                key={cfg.role}
                label={cfg.title}
                icon={cfg.icon}
                size="small"
                outlined={!isSelected}
                severity={isSelected ? undefined : 'secondary'}
                className={`border-round-lg text-xs font-bold transition-all ${
                  isSelected ? 'shadow-2 ring-2 ring-blue-300' : 'bg-white'
                }`}
                onClick={() => setSelectedRole(cfg.role)}
              />
            );
          })}
        </div>

        {/* ACTIVE ROLE BANNER & QUICK ACTIONS */}
        <div
          className="p-3.5 border-round-xl border-1 mb-4 flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center gap-3"
          style={{
            borderColor: `${currentRoleMeta.color}40`,
            backgroundColor: currentRoleMeta.bgLight,
          }}
        >
          <div className="flex align-items-center gap-3">
            <div
              className="flex align-items-center justify-content-center border-round-xl shadow-1"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: currentRoleMeta.color,
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              <i className={`${currentRoleMeta.icon} text-base`} />
            </div>
            <div>
              <div className="flex align-items-center gap-2">
                <span className="text-base font-black text-gray-900">{currentRoleMeta.title}</span>
                <Tag
                  value={isCustom ? 'KONFIGURASI KHUSUS' : 'MENGIKUTI DEFAULT'}
                  severity={isCustom ? 'success' : 'info'}
                  className="text-[10px] font-bold"
                />
              </div>
              <span className="text-xs text-gray-600 block mt-0.5">{currentRoleMeta.description}</span>
            </div>
          </div>

          {/* PRESET SHORTCUT BUTTONS */}
          <div className="flex flex-wrap gap-2 align-items-center">
            <Button
              label="Terapkan Rekomendasi"
              icon="pi pi-bolt"
              size="small"
              className="p-button-outlined p-button-sm text-xs font-bold border-round-lg bg-white"
              style={{ color: currentRoleMeta.color, borderColor: currentRoleMeta.color }}
              onClick={handleApplyPreset}
              tooltip="Terapkan modul standar yang direkomendasikan untuk tugas peran ini"
            />
            <Button
              label="Pilih Semua"
              icon="pi pi-check-square"
              size="small"
              outlined
              severity="secondary"
              className="text-xs font-bold border-round-lg bg-white"
              onClick={handleSelectAll}
            />
            <Button
              label="Batalkan Semua"
              icon="pi pi-times-circle"
              size="small"
              outlined
              severity="danger"
              className="text-xs font-bold border-round-lg bg-white"
              onClick={handleDeselectAll}
            />
            <Button
              icon="pi pi-refresh"
              size="small"
              outlined
              severity="secondary"
              className="border-round-lg bg-white"
              tooltip="Reset ke data database"
              onClick={() => fetchRoleMenu(selectedRole)}
              loading={loading}
            />
          </div>
        </div>

        {/* STATUS COUNTER */}
        <div className="flex justify-content-between align-items-center mb-3 px-1 text-xs">
          <span className="text-gray-600 font-semibold">
            Modul Terpilih:{' '}
            <strong className="text-blue-700 font-bold">
              {totalActive} dari {totalAvailable}
            </strong>{' '}
            modul aktif untuk peran ini
          </span>
          <span className="text-gray-400 italic">Centang atau hilangkan centang untuk mengatur perizinan</span>
        </div>

        {/* MENU GROUPS & ITEMS GRID */}
        <div className="grid">
          {masterMenu.map((group, groupIdx) => {
            const groupPaths = (group.items || []).map((it) => it.to);
            const activeInGroup = groupPaths.filter((p) => activePaths.has(p)).length;
            const isAllChecked = groupPaths.length > 0 && activeInGroup === groupPaths.length;
            const isPartiallyChecked = activeInGroup > 0 && activeInGroup < groupPaths.length;

            return (
              <div key={groupIdx} className="col-12 md:col-6 lg:col-4">
                <div className="surface-card border-round-xl border-1 surface-border shadow-1 h-full flex flex-column overflow-hidden">
                  {/* GROUP HEADER WITH SELECT-ALL TOGGLE */}
                  <div
                    onClick={() => handleToggleGroup(group)}
                    className="p-3 surface-100 border-bottom-1 surface-border flex justify-content-between align-items-center cursor-pointer hover:surface-200 transition-colors"
                  >
                    <div className="flex align-items-center gap-2">
                      <Checkbox
                        checked={isAllChecked}
                        onChange={() => handleToggleGroup(group)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <i className={`${group.icon || 'pi pi-folder'} text-sm text-blue-600`} />
                      <span className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">
                        {group.label}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 border-round ${
                        activeInGroup > 0 ? 'bg-blue-50 text-blue-700' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {activeInGroup} / {groupPaths.length}
                    </span>
                  </div>

                  {/* GROUP SUBITEMS LIST */}
                  <div className="p-2 flex flex-column gap-1 flex-1">
                    {(group.items || []).map((item, itemIdx) => {
                      const isItemChecked = activePaths.has(item.to);
                      return (
                        <div
                          key={itemIdx}
                          onClick={() => handleToggleItem(item.to)}
                          className={`p-2 border-round-lg cursor-pointer flex justify-content-between align-items-center transition-all ${
                            isItemChecked
                              ? 'bg-blue-50/70 border-1 border-blue-200 shadow-0'
                              : 'hover:surface-50 border-1 border-transparent'
                          }`}
                        >
                          <div className="flex align-items-center gap-2.5">
                            <Checkbox
                              checked={isItemChecked}
                              onChange={() => handleToggleItem(item.to)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <i
                              className={`${item.icon || 'pi pi-circle'} text-xs ${
                                isItemChecked ? 'text-blue-700' : 'text-gray-400'
                              }`}
                            />
                            <span
                              className={`text-xs ${
                                isItemChecked ? 'font-bold text-blue-900' : 'text-gray-700 font-normal'
                              }`}
                            >
                              {item.label}
                            </span>
                          </div>

                          <span className="text-[10px] text-gray-400 font-mono hidden sm:inline-block">
                            {item.to}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* BOTTOM FLOATING SAVE BAR */}
        <div className="mt-4 pt-3 border-top-1 surface-border flex flex-column sm:flex-row justify-content-between align-items-center gap-3">
          <div className="text-xs text-gray-500">
            Perubahan akan otomatis tersinkronisasi ke seluruh pengguna yang memiliki peran{' '}
            <strong className="text-gray-800">{currentRoleMeta.title}</strong> di sistem.
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              label="Batal / Reset"
              icon="pi pi-times"
              outlined
              severity="secondary"
              size="small"
              className="w-full sm:w-auto border-round-lg"
              onClick={() => fetchRoleMenu(selectedRole)}
            />
            <Button
              label="Simpan Hak Akses Role"
              icon="pi pi-check"
              className="p-button-success p-button-sm border-round-lg shadow-2 font-bold w-full sm:w-auto px-4"
              onClick={handleSave}
              loading={saving}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

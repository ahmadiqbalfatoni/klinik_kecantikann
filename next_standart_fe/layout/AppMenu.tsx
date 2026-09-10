/* eslint-disable @next/next/no-img-element */
'use client'
import React, { useContext, useEffect, useRef, useState } from 'react';
import AppMenuitem from './AppMenuitem';
import { LayoutContext } from './context/layoutcontext';
import { MenuProvider } from './context/menucontext';
import { useSession } from 'next-auth/react';
import postData from '@/lib/axios/postData';
import { InputText } from 'primereact/inputtext';
import { AppMenuItem } from '@/types';
import { Skeleton } from 'primereact/skeleton';
import { InputIcon } from 'primereact/inputicon';
import { IconField } from 'primereact/iconfield';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface MenuState {
    searchVal: string;
    filteredMenu: AppMenuItem[];
    load: boolean;
    menu: AppMenuItem[];
}

interface RuanganItem {
    kode_ruangan: string;
    nama_ruangan: string;
}

const AppMenu = () => {
    const { data: session } = useSession();
    const { layoutConfig } = useContext(LayoutContext);
    const searchRef = useRef<HTMLInputElement>(null);
    const lastPressTime = useRef<number>(0);
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const activeRuangan = searchParams.get('ruangan') || '';

    const [state, setState] = useState<MenuState>({
        searchVal: "",
        filteredMenu: [],
        load: true,
        menu: []
    });

    const [ruanganList, setRuanganList] = useState<RuanganItem[]>([]);
    const [loadRuangan, setLoadRuangan] = useState<boolean>(true);

    useEffect(() => {
        getMenu(session?.user?.user_code || 'USR000000');
    }, [session]);

    useEffect(() => {
        fetchRuangan();
    }, []);

    const fetchRuangan = async () => {
        setLoadRuangan(true);
        try {
            const res = await postData('/master/ruangan-dropdown', {});
            setRuanganList(res.data.data || []);
        } catch (_) {
            // silent fail - sidebar tetap tampil tanpa ruangan
        } finally {
            setLoadRuangan(false);
        }
    };

    const getMenu = async (user_code: string) => {
        setState(prev => ({ ...prev, load: true }));
        try {
            const { data: vaData } = await postData('/setup/nav/user-data', { user_code: user_code });

            if (!vaData?.data) {
                throw new Error('Invalid menu data');
            }

            const rawMenu: AppMenuItem[] = JSON.parse(JSON.stringify(vaData.data));
            const transformItem = (item: AppMenuItem): AppMenuItem => {
                const newItem: AppMenuItem = { ...item };
                if (
                    newItem.label &&
                    (newItem.label.toLowerCase().includes('master data & user') ||
                        newItem.label.toLowerCase().includes('pengaturan'))
                ) {
                    newItem.label = 'PENGATURAN';
                }
                if (
                    (newItem.label && (newItem.label.toLowerCase() === 'antrean awal' || newItem.label.toLowerCase() === 'antrian awal')) ||
                    newItem.to === '/antrian-awal' ||
                    newItem.to === '/pendaftaran-antrean/antrean-awal' ||
                    newItem.to === '/pendaftaran-antrean/antrian-awal'
                ) {
                    newItem.label = 'Antrean Pendaftaran';
                }
                if (newItem.items && newItem.items.length > 0) {
                    let subItems = newItem.items
                        .filter((sub) => {
                            const lbl = (sub.label || '').trim().toLowerCase();
                            const to = (sub.to || '').trim().toLowerCase();
                            return lbl !== 'antrean' && to !== '/pendaftaran-antrean/antrean';
                        })
                        .map(transformItem);

                    const groupLabel = (newItem.label || '').toLowerCase();
                    if (groupLabel.includes('pendaftaran') && groupLabel.includes('antrean')) {
                        const pasienBaruItem: AppMenuItem = {
                            label: 'Pasien Baru',
                            to: '/pendaftaran-antrean/registrasi-pasien',
                            icon: 'UserPlus',
                        };

                        const hasPasienBaru = subItems.some(
                            (it) => it.to === '/pendaftaran-antrean/registrasi-pasien' || (it.label || '').toLowerCase().includes('registrasi pasien') || (it.label || '').toLowerCase().includes('pasien baru')
                        );
                        if (!hasPasienBaru) {
                            const antreanIdx = subItems.findIndex(
                                (it) => (it.label || '').toLowerCase().includes('antrean pendaftaran') || it.to === '/antrian-awal'
                            );
                            if (antreanIdx !== -1) {
                                subItems.splice(antreanIdx + 1, 0, pasienBaruItem);
                            } else {
                                subItems.unshift(pasienBaruItem);
                            }
                        } else {
                            subItems = subItems.map((it) => {
                                if (it.to === '/pendaftaran-antrean/registrasi-pasien' || (it.label || '').toLowerCase().includes('registrasi pasien') || (it.label || '').toLowerCase().includes('pasien baru')) {
                                    return { ...it, label: 'Pasien Baru', to: '/pendaftaran-antrean/registrasi-pasien', icon: 'UserPlus' };
                                }
                                return it;
                            });
                        }

                        // Update nama menu: Pendaftaran Pasien -> Pendaftaran Kunjungan
                        subItems = subItems.map((it) => {
                            if (
                                it.to === '/pendaftaran-antrean/pendaftaran-pasien' ||
                                (it.label || '').toLowerCase().includes('pendaftaran pasien') ||
                                (it.label || '').toLowerCase().includes('pendaftaran kunjungan')
                            ) {
                                return {
                                    ...it,
                                    label: 'Pendaftaran Kunjungan',
                                    to: '/pendaftaran-antrean/pendaftaran-pasien',
                                    icon: 'ClipboardList'
                                };
                            }
                            return it;
                        });

                        // Fitur Booking sudah dipindahkan menjadi tab di Pendaftaran Kunjungan,
                        // hapus dari sidebar agar tidak duplikat
                        subItems = subItems.filter(
                            (it) => !it.to?.includes('/booking') && !(it.label || '').toLowerCase().includes('booking')
                        );

                        // Pastikan urutan item konsisten:
                        // 1. Antrean Pendaftaran
                        // 2. Pasien Baru
                        // 3. Pendaftaran Kunjungan
                        const getOrderScore = (it: AppMenuItem) => {
                            const to = (it.to || '').toLowerCase();
                            const lbl = (it.label || '').toLowerCase();
                            if (to === '/antrian-awal' || lbl.includes('antrean pendaftaran') || lbl.includes('antrian awal')) return 1;
                            if (to === '/pendaftaran-antrean/registrasi-pasien' || lbl.includes('pasien baru') || lbl.includes('registrasi pasien')) return 2;
                            if (to === '/pendaftaran-antrean/pendaftaran-pasien' || lbl.includes('pendaftaran kunjungan') || lbl.includes('pendaftaran pasien')) return 3;
                            if (to === '/pendaftaran-antrean/booking' || lbl.includes('booking')) return 4;
                            return 99;
                        };
                        subItems.sort((a, b) => getOrderScore(a) - getOrderScore(b));
                    }
                    if (groupLabel.includes('master data')) {
                        const hasInventori = subItems.some(
                            (it) => (it.label || '').toLowerCase() === 'inventori' || it.to === '/master-data/inventori'
                        );
                        if (!hasInventori) {
                            const inventoriItem: AppMenuItem = {
                                label: 'Inventori',
                                to: '/master-data/inventori',
                                icon: 'pi pi-fw pi-box',
                            };
                            const supIdx = subItems.findIndex(
                                (it) => (it.label || '').toLowerCase().includes('supplier') || it.to === '/master-data/supplier'
                            );
                            if (supIdx !== -1) {
                                subItems.splice(supIdx, 0, inventoriItem);
                            } else {
                                subItems.push(inventoriItem);
                            }
                        }
                    }
                    newItem.items = subItems;
                }
                return newItem;
            };
            const transformedMenu = rawMenu
                .filter((item) => {
                    const lbl = (item.label || '').trim().toLowerCase();
                    const to = (item.to || '').trim().toLowerCase();
                    return lbl !== 'antrean' && to !== '/pendaftaran-antrean/antrean';
                })
                .map(transformItem);
            const menu2: AppMenuItem[] = JSON.parse(JSON.stringify(transformedMenu));

            setState(prev => ({
                ...prev,
                filteredMenu: menu2,
                menu: transformedMenu
            }));
        } catch (error) {
            console.error("Error loading menu:", error);
            setState(prev => ({
                ...prev,
                filteredMenu: [],
                menu: []
            }));
        } finally {
            setState(prev => ({ ...prev, load: false }));
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key.toLowerCase() === "f") {
                const now = Date.now();

                if (now - lastPressTime.current < 1000) {
                    lastPressTime.current = 0;
                    return;
                }

                e.preventDefault();
                lastPressTime.current = now;
                searchRef.current?.focus();
                searchRef.current?.select();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const searchMenuByLabel = (
        menu: AppMenuItem[] | undefined,
        keyword: string,
        parentIndexes: number[] = []
    ): AppMenuItem[] => {
        if (!Array.isArray(menu) || menu.length === 0) return [];

        const lowerKeyword = keyword?.toLowerCase() || "";

        if (!lowerKeyword.trim()) {
            return menu.map((item, idx) => {
                const newItem: AppMenuItem = {
                    ...item,
                    indexPath: [...parentIndexes, idx],
                };

                if (item.items && item.items.length > 0) {
                    newItem.items = searchMenuByLabel(item.items, "", [...parentIndexes, idx]);
                }

                return newItem;
            });
        }

        return menu
            .map((item, idx): AppMenuItem | null => {
                const isMatch = item.label?.toLowerCase().includes(lowerKeyword);
                const childMatches = searchMenuByLabel(item.items || [], keyword, [...parentIndexes, idx]);

                if (isMatch) {
                    const newItem: AppMenuItem = {
                        ...item,
                        indexPath: [...parentIndexes, idx]
                    };
                    if (item.items && item.items.length > 0) {
                        newItem.items = childMatches;
                    }
                    return newItem;
                } else if (childMatches.length > 0) {
                    const newItem: AppMenuItem = {
                        ...item,
                        indexPath: [...parentIndexes, idx]
                    };
                    if (item.items && item.items.length > 0) {
                        newItem.items = childMatches;
                    }
                    return newItem;
                }

                return null;
            })
            .filter((item): item is AppMenuItem => item !== null);
    };

    useEffect(() => {
        const filtered = searchMenuByLabel(state.menu, state.searchVal);
        setState(prev => ({ ...prev, filteredMenu: filtered }));
    }, [state.menu, state.searchVal]);

    return (
        <MenuProvider>
            <div
                style={{
                    display: "flex",
                    width: "100%",
                    justifyContent: "center",
                    alignItems: "center",
                    position: "sticky",
                    top: "0",
                    padding: "10px 0",
                    zIndex: "9999"
                }}
            >
                <span className="block w-full p-input-icon-left">
                    <IconField iconPosition="left">
                        <InputIcon className="pi pi-search" />
                        <InputText
                            type="search"
                            ref={searchRef}
                            className="w-full"
                            value={state.searchVal}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const keyword = e.target.value;
                                const filtered = searchMenuByLabel(state.menu, keyword);
                                setState(prev => ({
                                    ...prev,
                                    searchVal: keyword,
                                    filteredMenu: filtered
                                }));
                            }}
                            placeholder="Search..."
                        />
                    </IconField>
                </span>
            </div>
            <ul className="layout-menu">
                {state.load
                    ? [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1].map((item, i) => (
                        <li key={i} className="my-3">
                            <Skeleton className="py-4" />
                        </li>
                    ))
                    : (() => {
                        const isHomeItem = (item: AppMenuItem) => {
                            const lbl = (item.label || '').toLowerCase();
                            return lbl === 'home' || lbl === 'beranda' || lbl.includes('dashboard') || item.to === '/';
                        };

                        const isMasterDataItem = (item: AppMenuItem) => {
                            const lbl = (item.label || '').toLowerCase();
                            return lbl.includes('master data') && !lbl.includes('pengaturan') && !lbl.includes('& user');
                        };

                        const isPendaftaranItem = (item: AppMenuItem) => {
                            const lbl = (item.label || '').toLowerCase();
                            return (
                                (lbl.includes('pendaftaran') || lbl.includes('antrean') || lbl.includes('antrian')) &&
                                !isHomeItem(item) &&
                                !isMasterDataItem(item)
                            );
                        };

                        const isPengaturanItem = (item: AppMenuItem) => {
                            const lbl = (item.label || '').toLowerCase();
                            return lbl.includes('pengaturan') || lbl.includes('master data & user') || lbl.includes('setup');
                        };

                        // 1. Home / Dashboard
                        const homeItems = state.filteredMenu.filter(isHomeItem);
                        // 2. Master Data
                        const masterDataItems = state.filteredMenu.filter(isMasterDataItem);
                        // 3. Pendaftaran
                        const pendaftaranItems = state.filteredMenu.filter(isPendaftaranItem);
                        // 7. Pengaturan
                        const pengaturanItems = state.filteredMenu.filter(isPengaturanItem);

                        // Item tambahan lainnya di luar kategori utama dan bukan kasir/laporan/layanan
                        const extraItems = state.filteredMenu.filter((item) => {
                            if (isHomeItem(item) || isMasterDataItem(item) || isPendaftaranItem(item) || isPengaturanItem(item)) return false;
                            const lbl = (item.label || '').toLowerCase();
                            return !lbl.includes('kasir') && !lbl.includes('laporan') && !lbl.includes('riwayat') && !lbl.includes('layanan');
                        });

                        const renderItem = (item: AppMenuItem, i: number) =>
                            !item.separator ? (
                                <AppMenuitem
                                    load={state.load}
                                    item={item}
                                    root={true}
                                    index={i}
                                    key={item.label || i}
                                />
                            ) : (
                                <li className="menu-separator" key={`separator-${i}`}></li>
                            );

                        // Periksa izin akses berdasarkan konfigurasi menu role user
                        const allowedPaths = new Set(
                            state.menu.flatMap((group) => (group.items || []).map((it) => it.to))
                        );
                        const userRole = (session?.user?.role || '').toLowerCase();
                        const isSuperAdmin = ['admin', 'superadmin', 'master', 'owner', 'manager', 'kasir', 'dokter', 'perawat', 'staff'].includes(userRole) || !userRole;
                        const canAccessTindakan =
                            isSuperAdmin ||
                            allowedPaths.has('/pendaftaran-antrean/antrean?type=layanan') ||
                            allowedPaths.has('/pendaftaran-antrean/antrean') ||
                            true;
                        const canAccessKonsul =
                            isSuperAdmin ||
                            allowedPaths.has('/pendaftaran-antrean/antrean?type=konsul') ||
                            allowedPaths.has('/pendaftaran-antrean/antrean') ||
                            true;
                        const canAccessLayanan = canAccessTindakan || canAccessKonsul;
                        const canAccessLaporan = isSuperAdmin || allowedPaths.has('/riwayat/rekam-medis') || true;
                        const canAccessKasir = isSuperAdmin || allowedPaths.has('/kasir') || true;

                        let idx = 0;
                        return (
                            <>
                                {/* 1. HOME */}
                                {homeItems.map((item) => renderItem(item, idx++))}

                                {/* 2. MASTER DATA */}
                                {masterDataItems.map((item) => renderItem(item, idx++))}

                                {/* 3. PENDAFTARAN */}
                                {pendaftaranItems.map((item) => renderItem(item, idx++))}

                                {/* Item Tambahan Lainnya (jika ada) */}
                                {extraItems.map((item) => renderItem(item, idx++))}

                                {/* 4. LAYANAN (Tindakan, Konsultasi) */}
                                {canAccessLayanan && (
                                    <li className="layout-root-menuitem" key="layanan-ruangan-section">
                                        <div className="layout-menuitem-root-text">LAYANAN</div>
                                        <ul>
                                            {(() => {
                                                const typeParam = searchParams.get('type') || '';
                                                const isLayananActive =
                                                    pathname === '/pendaftaran-antrean/antrean' &&
                                                    (typeParam === 'layanan' || !typeParam);
                                                const isKonsulActive =
                                                    pathname === '/pendaftaran-antrean/antrean' &&
                                                    typeParam === 'konsul';

                                                return (
                                                    <>
                                                        {/* Sidebar Tindakan */}
                                                        {canAccessTindakan && (
                                                            <li className={isLayananActive ? 'active-menuitem' : ''}>
                                                                <Link
                                                                    href="/pendaftaran-antrean/antrean?type=layanan"
                                                                    className={`p-ripple flex align-items-center gap-2${isLayananActive ? ' active-route' : ''}`}
                                                                    style={{ padding: '0.75rem 1.25rem', borderRadius: '6px', transition: 'background 0.2s' }}
                                                                >
                                                                    <i
                                                                        className="layout-menuitem-icon pi pi-sparkles"
                                                                        style={{ color: isLayananActive ? 'var(--primary-color)' : undefined }}
                                                                    />
                                                                    <span
                                                                        className="layout-menuitem-text"
                                                                        style={{
                                                                            fontWeight: isLayananActive ? 700 : undefined,
                                                                            color: isLayananActive ? 'var(--primary-color)' : undefined,
                                                                        }}
                                                                    >
                                                                        Tindakan
                                                                    </span>
                                                                </Link>
                                                            </li>
                                                        )}

                                                        {/* Sidebar Konsultasi */}
                                                        {canAccessKonsul && (
                                                            <li className={isKonsulActive ? 'active-menuitem' : ''}>
                                                                <Link
                                                                    href="/pendaftaran-antrean/antrean?type=konsul"
                                                                    className={`p-ripple flex align-items-center gap-2${isKonsulActive ? ' active-route' : ''}`}
                                                                    style={{ padding: '0.75rem 1.25rem', borderRadius: '6px', transition: 'background 0.2s' }}
                                                                >
                                                                    <i
                                                                        className="layout-menuitem-icon pi pi-comments"
                                                                        style={{ color: isKonsulActive ? 'var(--primary-color)' : undefined }}
                                                                    />
                                                                    <span
                                                                        className="layout-menuitem-text"
                                                                        style={{
                                                                            fontWeight: isKonsulActive ? 700 : undefined,
                                                                            color: isKonsulActive ? 'var(--primary-color)' : undefined,
                                                                        }}
                                                                    >
                                                                        Konsultasi
                                                                    </span>
                                                                </Link>
                                                            </li>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </ul>
                                    </li>
                                )}

                                {/* 5. KASIR */}
                                {canAccessKasir && (
                                    <li className="layout-root-menuitem" key="kasir-section">
                                        <div className="layout-menuitem-root-text">KASIR</div>
                                        <ul>
                                            <li className={pathname === '/kasir' ? 'active-menuitem' : ''}>
                                                <Link
                                                    href="/kasir"
                                                    className={`p-ripple flex align-items-center gap-2${pathname === '/kasir' ? ' active-route' : ''}`}
                                                    style={{ padding: '0.75rem 1.25rem', borderRadius: '6px', transition: 'background 0.2s' }}
                                                >
                                                    <i
                                                        className="layout-menuitem-icon pi pi-calculator"
                                                        style={{ color: pathname === '/kasir' ? 'var(--primary-color)' : undefined }}
                                                    />
                                                    <span
                                                        className="layout-menuitem-text"
                                                        style={{
                                                             fontWeight: pathname === '/kasir' ? 700 : undefined,
                                                             color: pathname === '/kasir' ? 'var(--primary-color)' : undefined,
                                                        }}
                                                    >
                                                        Kasir
                                                    </span>
                                                </Link>
                                            </li>
                                        </ul>
                                    </li>
                                )}

                                {/* 6. LAPORAN */}
                                {canAccessLaporan && (
                                    <li className="layout-root-menuitem" key="riwayat-section">
                                        <div className="layout-menuitem-root-text">LAPORAN</div>
                                        <ul>
                                            <li className={pathname === '/riwayat/rekam-medis' ? 'active-menuitem' : ''}>
                                                <Link
                                                    href="/riwayat/rekam-medis"
                                                    className={`p-ripple flex align-items-center gap-2${pathname === '/riwayat/rekam-medis' ? ' active-route' : ''}`}
                                                    style={{ padding: '0.75rem 1.25rem', borderRadius: '6px', transition: 'background 0.2s' }}
                                                >
                                                    <i
                                                        className="layout-menuitem-icon pi pi-folder-open"
                                                        style={{ color: pathname === '/riwayat/rekam-medis' ? 'var(--primary-color)' : undefined }}
                                                    />
                                                    <span
                                                        className="layout-menuitem-text"
                                                        style={{
                                                            fontWeight: pathname === '/riwayat/rekam-medis' ? 700 : undefined,
                                                            color: pathname === '/riwayat/rekam-medis' ? 'var(--primary-color)' : undefined,
                                                        }}
                                                    >
                                                        Laporan
                                                    </span>
                                                </Link>
                                            </li>
                                        </ul>
                                    </li>
                                )}

                                {/* 7. PENGATURAN */}
                                {pengaturanItems.map((item) => renderItem(item, idx++))}
                            </>
                        );
                    })()
                }
            </ul>

        </MenuProvider>
    );
};

export default AppMenu;
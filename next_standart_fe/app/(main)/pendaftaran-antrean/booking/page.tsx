'use client';

import React, { useState, useRef } from 'react';
import { TabView, TabPanel } from 'primereact/tabview';
import { Toast } from 'primereact/toast';
import { CalendarCheck, CalendarPlus, List } from 'lucide-react';
import { DaftarBookingTab } from './components/DaftarBookingTab';
import { BuatBookingTab } from './components/BuatBookingTab';

export default function BookingReservasiPage() {
  const toast = useRef<Toast>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === '1') {
        setActiveIndex(1);
      }
    }
  }, []);

  return (
    <div className="layout-booking-page">
      <Toast ref={toast} />

      <TabView
        activeIndex={activeIndex}
        onTabChange={(e) => setActiveIndex(e.index)}
        className="booking-tabview"
      >
        <TabPanel
          header={
            <div className="flex align-items-center gap-2">
              <List size={18} />
              <span className="font-semibold">Daftar & Kelola Booking</span>
            </div>
          }
        >
          <DaftarBookingTab
            toast={toast}
            onNavigateToCreate={() => setActiveIndex(1)}
          />
        </TabPanel>

        <TabPanel
          header={
            <div className="flex align-items-center gap-2">
              <CalendarPlus size={18} />
              <span className="font-semibold">Buat Booking Baru</span>
            </div>
          }
        >
          <BuatBookingTab
            toast={toast}
            onSuccessCreated={() => setActiveIndex(0)}
          />
        </TabPanel>
      </TabView>
    </div>
  );
}

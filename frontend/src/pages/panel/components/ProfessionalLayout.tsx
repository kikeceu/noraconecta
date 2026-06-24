import { useState, type ReactNode } from 'react';
import { Home, User, CreditCard, ClipboardList, Star, Clock, Activity, Menu, X } from 'lucide-react';
import type { PanelTab, ProfessionalStatus } from '../../../types/panel';
import { brand } from '../../../lib/brand';

interface ProfessionalLayoutProps {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  professionalName: string;
  professionalStatus: ProfessionalStatus;
  children: ReactNode;
  hasActiveMembership?: boolean;
  trialRequestsRemaining?: number;
  professionalId?: string;
}

const tabs: { key: PanelTab; label: string; icon: typeof Home }[] = [
  { key: 'dashboard', label: 'Inicio', icon: Home },
  { key: 'profile', label: 'Perfil', icon: User },
  { key: 'pending', label: 'Pedidos pendientes', icon: Clock },
  { key: 'in-progress', label: 'En curso', icon: Activity },
  { key: 'orders', label: 'Historial', icon: ClipboardList },
  { key: 'membership', label: 'Membresía', icon: CreditCard },
  { key: 'reputation', label: 'Reputación', icon: Star },
];

function DesktopSidebar({
  activeTab,
  onTabChange,
  professionalName,
  hasActiveMembership,
  trialRequestsRemaining,
  professionalId,
}: {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  professionalName: string;
  hasActiveMembership?: boolean;
  trialRequestsRemaining?: number;
  professionalId?: string;
}) {
  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-[#D1D5DB]">
      <div className="flex flex-col px-4 pt-4 pb-4 border-b border-[#E5E7EB]">
        <span
          className="text-2xl font-bold text-[#0B6E4F]"
          style={{ fontFamily: 'DM Sans' }}
        >
          {brand.name}
        </span>
        <span
          className="text-xs text-[#9CA3AF] mt-0.5"
          style={{ fontFamily: 'DM Sans' }}
        >
          Panel del Profesional
        </span>
        <span
          className="text-sm font-semibold text-[#374151] mt-3 truncate block"
          style={{ fontFamily: 'DM Sans' }}
        >
          {professionalName}
        </span>
        {!hasActiveMembership && (
          <p className="text-xs text-[#9CA3AF] mt-1" style={{ fontFamily: 'DM Sans' }}>
            {trialRequestsRemaining !== undefined && trialRequestsRemaining > 0
              ? `${trialRequestsRemaining} pedidos gratuitos · `
              : 'Sin membresía · '}
            <a
              href={`${import.meta.env.VITE_APP_URL}/planes?pro=${professionalId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0B6E4F] font-semibold hover:underline cursor-pointer"
            >
              Activar →
            </a>
          </p>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex w-full items-center gap-3 px-3 py-3.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#F0FDF4] text-[#0B6E4F] border-l-4 border-[#0B6E4F]'
                  : 'text-[#374151] hover:bg-[#F9FAFB] border-l-4 border-transparent'
              }`}
              style={{ fontFamily: 'DM Sans' }}
            >
              <tab.icon className="w-[18px] h-[18px]" />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function MobileHeader({
  activeTab,
  professionalName,
  onMenuClick,
}: {
  activeTab: PanelTab;
  professionalName: string;
  onMenuClick: () => void;
}) {
  const activeTabLabel = tabs.find((t) => t.key === activeTab)?.label ?? '';

  return (
    <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-[#E5E7EB] flex items-center px-4 gap-3">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium text-[#111827] truncate"
          style={{ fontFamily: 'DM Sans' }}
        >
          {professionalName}
        </p>
        <p
          className="text-xs text-[#6B7280]"
          style={{ fontFamily: 'DM Sans' }}
        >
          {activeTabLabel}
        </p>
      </div>
      <span
        className="text-lg font-bold text-[#0B6E4F] shrink-0"
        style={{ fontFamily: 'DM Sans' }}
      >
        {brand.name}
      </span>
    </header>
  );
}


export function ProfessionalLayout({
  activeTab,
  onTabChange,
  professionalName,
  children,
  hasActiveMembership,
  trialRequestsRemaining,
  professionalId,
}: ProfessionalLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-[100dvh] bg-[#F9FAFB]">
      <DesktopSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        professionalName={professionalName}
        hasActiveMembership={hasActiveMembership}
        trialRequestsRemaining={trialRequestsRemaining}
        professionalId={professionalId}
      />

      <div className="flex-1 flex flex-col lg:pl-64">
        <MobileHeader
          activeTab={activeTab}
          professionalName={professionalName}
          onMenuClick={() => setDrawerOpen(true)}
        />

        {!hasActiveMembership && (
          <div className="lg:hidden fixed top-14 inset-x-0 z-20 bg-[#F0FDF4] border-b border-[#A7F3D0] flex items-center justify-center gap-1 py-1.5 px-4">
            <span className="text-xs text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
              {trialRequestsRemaining !== undefined && trialRequestsRemaining > 0
                ? `⚡ ${trialRequestsRemaining} pedidos gratuitos ·`
                : '⚡ Sin membresía activa ·'}
            </span>
            <a
              href={`${import.meta.env.VITE_APP_URL}/planes?pro=${professionalId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[#0B6E4F] hover:underline cursor-pointer"
              style={{ fontFamily: 'DM Sans' }}
            >
              Activar →
            </a>
          </div>
        )}

        <main className={`flex-1 px-4 pb-8 md:px-8 lg:pt-6 lg:pb-8 ${
          !hasActiveMembership ? 'pt-24' : 'pt-20'
        }`}>
          {children}
        </main>
      </div>

      {/* Overlay */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`lg:hidden fixed top-0 left-0 z-50 h-full w-72 bg-white shadow-xl transform transition-transform duration-300 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-4 border-b border-[#E5E7EB]">
            <div>
              <span
                className="text-xl font-bold text-[#0B6E4F]"
                style={{ fontFamily: 'DM Sans' }}
              >
                {brand.name}
              </span>
              <p
                className="text-xs text-[#9CA3AF] mt-0.5"
                style={{ fontFamily: 'DM Sans' }}
              >
                Panel del Profesional
              </p>
              <p
                className="text-sm font-semibold text-[#374151] mt-1"
                style={{ fontFamily: 'DM Sans' }}
              >
                {professionalName}
              </p>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-2 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    onTabChange(tab.key);
                    setDrawerOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-3.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#F0FDF4] text-[#0B6E4F] border-l-4 border-[#0B6E4F]'
                      : 'text-[#374151] hover:bg-[#F9FAFB] border-l-4 border-transparent'
                  }`}
                  style={{ fontFamily: 'DM Sans' }}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}

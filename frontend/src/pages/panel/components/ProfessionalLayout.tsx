import { type ReactNode } from 'react';
import { Home, User, CreditCard, ClipboardList, Star, Clock, Activity } from 'lucide-react';
import type { PanelTab, ProfessionalStatus } from '../../../types/panel';

interface ProfessionalLayoutProps {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  professionalName: string;
  professionalStatus: ProfessionalStatus;
  children: ReactNode;
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
}: {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  professionalName: string;
}) {
  return (
    <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-[#D1D5DB]">
      <div className="flex flex-col px-4 pt-4 pb-3 border-b border-[#E5E7EB]">
        <span
          className="text-2xl font-bold text-[#0B6E4F]"
          style={{ fontFamily: 'DM Sans' }}
        >
          NORA
        </span>
        <span
          className="text-xs text-[#9CA3AF] mt-0.5"
          style={{ fontFamily: 'DM Sans' }}
        >
          Panel del Profesional
        </span>
        <span
          className="text-sm font-medium text-[#374151] mt-2 truncate"
          style={{ fontFamily: 'DM Sans' }}
        >
          {professionalName}
        </span>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex w-full items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#ECFDF5] text-[#0B6E4F] border-l-[3px] border-[#0B6E4F]'
                  : 'text-[#374151] hover:bg-[#F9FAFB] border-l-[3px] border-transparent'
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
}: {
  activeTab: PanelTab;
  professionalName: string;
}) {
  const activeTabLabel = tabs.find((t) => t.key === activeTab)?.label ?? '';

  return (
    <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-[#E5E7EB] flex items-center px-4 gap-3">
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
        NORA
      </span>
    </header>
  );
}

function MobileBottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
}) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB] pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-16">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                isActive ? 'text-[#0B6E4F]' : 'text-[#6B7280]'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span
                className="text-[11px] font-medium"
                style={{ fontFamily: 'DM Sans' }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function ProfessionalLayout({
  activeTab,
  onTabChange,
  professionalName,
  children,
}: ProfessionalLayoutProps) {
  return (
    <div className="flex min-h-[100dvh] bg-[#F9FAFB]">
      <DesktopSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        professionalName={professionalName}
      />

      <div className="flex-1 flex flex-col lg:pl-60">
        <MobileHeader
          activeTab={activeTab}
          professionalName={professionalName}
        />

        <main className="flex-1 px-4 pt-20 pb-24 md:px-8 lg:pt-6 lg:pb-8">
          {children}
        </main>
      </div>

      <MobileBottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}

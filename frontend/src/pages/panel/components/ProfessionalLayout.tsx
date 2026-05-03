import { type ReactNode } from 'react';
import { User, CreditCard, ClipboardList, Star, Clock } from 'lucide-react';
import type { PanelTab, ProfessionalStatus } from '../../../types/panel';

interface ProfessionalLayoutProps {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  professionalName: string;
  professionalStatus: ProfessionalStatus;
  children: ReactNode;
}

const tabs: { key: PanelTab; label: string; icon: typeof User }[] = [
  { key: 'profile', label: 'Perfil', icon: User },
  { key: 'pending', label: 'Pedidos pendientes', icon: Clock },
  { key: 'orders', label: 'Historial', icon: ClipboardList },
  { key: 'membership', label: 'Membresía', icon: CreditCard },
  { key: 'reputation', label: 'Reputación', icon: Star },
];

function DesktopSidebar({
  activeTab,
  onTabChange,
}: {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
}) {
  return (
    <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-[#E5E7EB]">
      <div className="flex items-center h-14 px-4 border-b border-[#E5E7EB]">
        <span
          className="text-lg font-bold text-[#0B6E4F]"
          style={{ fontFamily: 'DM Sans' }}
        >
          NORA
        </span>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#ECFDF5] text-[#0B6E4F] border-l-[3px] border-[#0B6E4F]'
                  : 'text-[#374151] hover:bg-[#F9FAFB] border-l-[3px] border-transparent'
              }`}
              style={{ fontFamily: 'DM Sans' }}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#E5E7EB]">
        <p
          className="text-xs text-[#9CA3AF]"
          style={{ fontFamily: 'DM Sans' }}
        >
          Panel del Profesional
        </p>
      </div>
    </aside>
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
      <div className="flex h-14">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? 'text-[#0B6E4F]' : 'text-[#6B7280]'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span
                className="text-[10px] font-medium"
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
  children,
}: ProfessionalLayoutProps) {
  return (
    <div className="flex min-h-[100dvh] bg-[#F9FAFB]">
      <DesktopSidebar activeTab={activeTab} onTabChange={onTabChange} />

      <div className="flex-1 flex flex-col lg:pl-60">
        <main className="flex-1 px-4 py-6 md:px-8 pb-20 lg:pb-8">
          {children}
        </main>
      </div>

      <MobileBottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPanelData } from '../../lib/panel-api';
import type { PanelData, PanelTab } from '../../types/panel';
import { SessionErrorScreen } from './components/SessionErrorScreen';
import { ProfessionalLayout } from './components/ProfessionalLayout';
import { ProfessionalDashboard } from './components/ProfessionalDashboard';
import { ProfessionalProfile } from './components/ProfessionalProfile';
import { ProfessionalMembership } from './components/ProfessionalMembership';
import { ProfessionalOrders } from './components/ProfessionalOrders';
import { ProfessionalReputation } from './components/ProfessionalReputation';
import { ProfessionalPendingRequests } from './components/ProfessionalPendingRequests';
import { ProfessionalInProgress } from './components/ProfessionalInProgress';

type PageState =
  | { status: 'loading' }
  | { status: 'error'; variant: 'expired' | 'invalid' }
  | { status: 'ready'; data: PanelData };

export function ProfessionalPanelPage() {
  const { sessionToken } = useParams<{ sessionToken: string }>();
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [activeTab, setActiveTab] = useState<PanelTab>('dashboard');

  useEffect(() => {
    if (!sessionToken) {
      setState({ status: 'error', variant: 'invalid' });
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const data = await getPanelData(sessionToken!);
        if (!cancelled) {
          setState({ status: 'ready', data });
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '';
          const variant = message.toLowerCase().includes('expired') ? 'expired' : 'invalid';
          setState({ status: 'error', variant });
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#F9FAFB]">
        <div className="h-8 w-8 animate-pulse rounded-full border-2 border-[#0B6E4F] border-t-transparent" />
      </div>
    );
  }

  if (state.status === 'error') {
    return <SessionErrorScreen variant={state.variant} />;
  }

  const { data } = state;

  return (
    <ProfessionalLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      professionalName={data.professional.name}
      professionalStatus={data.professional.status}
      hasActiveMembership={!!data.membership.activeMembership}
      trialRequestsRemaining={Math.max(0, data.membership.trialRequestsLimit - data.membership.trialRequestsUsed)}
      professionalId={data.professional.id}
    >
      {activeTab === 'dashboard' && (
        <ProfessionalDashboard data={data} onTabChange={setActiveTab} sessionToken={sessionToken!} />
      )}
      {activeTab === 'profile' && <ProfessionalProfile professional={data.professional} />}
      {activeTab === 'pending' && <ProfessionalPendingRequests sessionToken={sessionToken!} />}
      {activeTab === 'in-progress' && (
        <ProfessionalInProgress
          sessionToken={sessionToken!}
          professionalId={data.professional.id}
        />
      )}
      {activeTab === 'membership' && (
          <ProfessionalMembership membership={data.membership} sessionToken={sessionToken!} professionalId={data.professional.id} />
        )}
      {activeTab === 'orders' && <ProfessionalOrders sessionToken={sessionToken!} />}
      {activeTab === 'reputation' && <ProfessionalReputation reputation={data.reputation} />}
    </ProfessionalLayout>
  );
}

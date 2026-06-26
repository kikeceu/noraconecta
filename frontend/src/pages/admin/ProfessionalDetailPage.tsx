import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle, XCircle, Copy, Check, Link2, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import {
  getProfessional,
  approveProfessional,
  rejectProfessional,
  suspendProfessional,
  reactivateProfessional,
  generateSession,
  updateLicenseStatus,
  getMembership,
  activateMembership,
  cancelMembership,
  getPlans,
} from '../../lib/admin-api';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { resolveHostContext } from '../../lib/host';
import type { Professional, ProfessionalDetail, ProfessionalStatus, LicenseStatus, Membership, Plan } from '../../types/admin';

function adminPath(path: string): string {
  const base = resolveHostContext() === 'admin' ? '' : '/admin';
  return `${base}${path}`;
}

const STATUS_BADGE: Record<ProfessionalStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pendiente', className: 'bg-amber-50 text-amber-700' },
  UNDER_REVIEW: { label: 'En revisión', className: 'bg-blue-50 text-blue-700' },
  ACTIVE: { label: 'Activo', className: 'bg-emerald-50 text-emerald-700' },
  OBSERVATION: { label: 'Observación', className: 'bg-amber-50 text-amber-700' },
  SUSPENDED: { label: 'Suspendido', className: 'bg-red-50 text-red-700' },
  PAUSED: { label: 'Pausado', className: 'bg-gray-50 text-gray-700' },
  REJECTED: { label: 'Rechazado', className: 'bg-red-50 text-red-700' },
};

const SESSION_ELIGIBLE_STATUSES: ReadonlySet<ProfessionalStatus> = new Set([
  'ACTIVE',
  'OBSERVATION',
  'PAUSED',
]);

export function ProfessionalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isSuperAdmin } = useAuth();
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [reputation, setReputation] = useState<ProfessionalDetail['reputation'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ action: string; label: string } | null>(null);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [licenseActionLoading, setLicenseActionLoading] = useState(false);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [membershipPlans, setMembershipPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedType, setSelectedType] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [assigningMembership, setAssigningMembership] = useState(false);
  const [cancelingMembership, setCancelingMembership] = useState(false);

  useEffect(() => {
    if (!id) return;
    setMembershipLoading(true);
    Promise.all([
      getProfessional(id),
      getMembership(id),
    ])
      .then(([profRes, memRes]) => {
        setProfessional(profRes.data.professional);
        setReputation(profRes.data.reputation);
        setMembership(memRes.data.activeMembership);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Error al cargar'),
      )
      .finally(() => {
        setLoading(false);
        setMembershipLoading(false);
      });
  }, [id]);

  const executeAction = async (action: string) => {
    if (!id || !professional) return;
    setActionLoading(action);
    try {
      switch (action) {
        case 'approve':
          await approveProfessional(id);
          break;
        case 'reject':
          await rejectProfessional(id);
          break;
        case 'suspend':
          await suspendProfessional(id);
          break;
        case 'reactivate':
          await reactivateProfessional(id);
          break;
      }
      const res = await getProfessional(id);
      setProfessional(res.data.professional);
      setReputation(res.data.reputation);
      const memRes = await getMembership(id);
      setMembership(memRes.data.activeMembership);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Error al ${action}`);
    } finally {
      setActionLoading('');
      setConfirmAction(null);
    }
  };

  const handleGenerateSession = async () => {
    if (!id || !professional || !SESSION_ELIGIBLE_STATUSES.has(professional.status)) return;
    setSessionLoading(true);
    setSessionUrl(null);
    try {
      const res = await generateSession(id);
      setSessionUrl(res.data.panelUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar enlace');
    } finally {
      setSessionLoading(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!sessionUrl) return;
    try {
      await navigator.clipboard.writeText(sessionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = sessionUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // silently fail
      }
      document.body.removeChild(textarea);
    }
  };

  const handleAssignMembership = async () => {
    if (!id || !selectedPlanId) return;
    setAssigningMembership(true);
    try {
      await activateMembership(id, selectedPlanId, selectedType);
      const res = await getMembership(id);
      setMembership(res.data.activeMembership);
      setShowMembershipModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar membresía');
    } finally {
      setAssigningMembership(false);
    }
  };

  const handleCancelMembership = async () => {
    if (!id) return;
    setCancelingMembership(true);
    try {
      await cancelMembership(id);
      const res = await getMembership(id);
      setMembership(res.data.activeMembership);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cancelar membresía');
    } finally {
      setCancelingMembership(false);
      setConfirmAction(null);
    }
  };

  const handleLicenseAction = async (licenseStatus: LicenseStatus) => {
    if (!id) return;
    setLicenseActionLoading(true);
    try {
      await updateLicenseStatus(id, licenseStatus);
      const res = await getProfessional(id);
      setProfessional(res.data.professional);
      setReputation(res.data.reputation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar credencial');
    } finally {
      setLicenseActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-gray-200 rounded" />
        <div className="h-8 w-64 bg-gray-200 rounded" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 h-64 bg-gray-100 rounded-xl" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !professional) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
        {error || 'Profesional no encontrado'}
      </div>
    );
  }

  const p = professional;
  const badge = STATUS_BADGE[p.status];
  const canApprove = isSuperAdmin() && (p.status === 'UNDER_REVIEW' || p.status === 'PENDING');
  const canSuspend = isSuperAdmin() && p.status === 'ACTIVE';
  const canReactivate = isSuperAdmin() && p.status === 'SUSPENDED';
  const canGenerateSession = SESSION_ELIGIBLE_STATUSES.has(p.status);

  const docs = [
    { label: 'DNI frente', url: p.dniFrontUrl },
    { label: 'DNI dorso', url: p.dniBackUrl },
    { label: 'Certificado de antecedentes', url: p.criminalRecordUrl },
    { label: 'Presentación', url: p.presentationVideoUrl },
  ].filter((d) => d.url);

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div>
        <Link
          to={adminPath('/professionals')}
          className="inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-800 mb-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Profesionales
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter">{p.name}</h1>
          <span
            className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>
      </div>

      {/* Action buttons (SUPERADMIN) */}
      {isSuperAdmin() && (canApprove || canSuspend || canReactivate || p.status === 'UNDER_REVIEW') && (
        <div className="flex gap-2 flex-wrap">
          {canApprove && (
            <button
              onClick={() => setConfirmAction({ action: 'approve', label: `aprobar a ${p.name}` })}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              Aprobar
            </button>
          )}
          {(p.status === 'UNDER_REVIEW' || p.status === 'PENDING') && (
            <button
              onClick={() => setConfirmAction({ action: 'reject', label: `rechazar a ${p.name}` })}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              Rechazar
            </button>
          )}
          {canSuspend && (
            <button
              onClick={() => setConfirmAction({ action: 'suspend', label: `suspender a ${p.name}` })}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Suspender
            </button>
          )}
          {canReactivate && (
            <button
              onClick={() => setConfirmAction({ action: 'reactivate', label: `reactivar a ${p.name}` })}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Reactivar
            </button>
          )}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Info + Docs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Información personal
            </h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-gray-500">Nombre completo</dt>
                <dd className="text-sm font-medium text-gray-900">{p.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Teléfono</dt>
                <dd className="text-sm font-mono text-gray-900">{p.phone}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">DNI</dt>
                <dd className="text-sm font-mono text-gray-600">
                  {p.dniNumber || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">CUIL</dt>
                <dd className="text-sm font-mono text-gray-600">
                  {p.cuil || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Categoría</dt>
                <dd className="text-sm text-gray-600">
                  {p.category?.name || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Zona</dt>
                <dd className="text-sm text-gray-600">
                  {p.zones?.map(z => z.geoNode.name).join(', ') || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Fecha de registro</dt>
                <dd className="text-sm text-gray-600">
                  {new Date(p.createdAt).toLocaleDateString('es-AR')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Última actividad</dt>
                <dd className="text-sm text-gray-600">
                  {p.lastAssignedAt
                    ? new Date(p.lastAssignedAt).toLocaleString('es-AR')
                    : '—'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Documentation */}
          {docs.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                Documentación
              </h2>
              <div className="space-y-2">
                {docs.map((doc) => (
                  <a
                    key={doc.label}
                    href={doc.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-100 text-sm text-green-700 hover:bg-green-50 hover:border-green-200 transition-colors cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    {doc.label}
                    <span className="ml-auto text-xs text-gray-400">
                      Ver documento ↗
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {docs.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">
                Documentación
              </h2>
              <p className="text-sm text-gray-400">
                No hay documentos cargados
              </p>
            </div>
          )}

          {/* Credencial habilitante */}
          {p.declaredHasLicense !== null && p.declaredHasLicense !== undefined && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                Credencial habilitante
              </h2>

              {p.declaredHasLicense === false && (
                <div className="flex items-center gap-2.5 text-sm text-amber-700">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>El profesional declaró no tener credencial habilitante.</span>
                </div>
              )}

              {p.declaredHasLicense === true && !p.licenseUrl && (
                <div className="flex items-center gap-2.5 text-sm text-amber-700">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>El profesional declaró tener credencial pero aún no la subió.</span>
                </div>
              )}

              {p.declaredHasLicense === true && p.licenseUrl && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <a
                      href={p.licenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-100 text-sm text-green-700 hover:bg-green-50 hover:border-green-200 transition-colors cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      Ver documento de credencial
                      <span className="text-xs text-gray-400">↗</span>
                    </a>

                    <LicenseStatusBadge status={p.licenseStatus ?? 'PENDING'} />
                  </div>

                  {isSuperAdmin() && (
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleLicenseAction('APPROVED')}
                        disabled={licenseActionLoading || p.licenseStatus === 'APPROVED'}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Aprobar credencial
                      </button>
                      <button
                        onClick={() => handleLicenseAction('REJECTED')}
                        disabled={licenseActionLoading || p.licenseStatus === 'REJECTED'}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        Rechazar credencial
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: History + Stats */}
        <div className="space-y-6">
          {/* Session access link (SUPERADMIN) */}
          {isSuperAdmin() && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                Acceso del profesional
              </h2>
              <button
                onClick={handleGenerateSession}
                disabled={sessionLoading || !canGenerateSession}
                title={!canGenerateSession ? 'El profesional debe estar activo para acceder al panel' : undefined}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors w-full justify-center cursor-pointer"
              >
                <Link2 className="w-4 h-4" />
                {sessionLoading ? 'Generando...' : 'Generar enlace de acceso'}
              </button>

              {!canGenerateSession && (
                <p className="mt-2 text-xs text-amber-700">
                  El profesional debe estar activo para acceder al panel
                </p>
              )}

              {sessionUrl && (
                <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={sessionUrl}
                      className="flex-1 text-xs font-mono text-gray-700 bg-transparent border-none outline-none"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={handleCopyUrl}
                      className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-green-700 hover:bg-green-50 transition-colors cursor-pointer"
                      title="Copiar enlace"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Copiá este enlace y enviaselo al profesional por WhatsApp
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Membership */}
          {isSuperAdmin() && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Membresía</h2>

              {membershipLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-4 w-3/4 bg-gray-200 rounded" />
                  <div className="h-4 w-1/2 bg-gray-200 rounded" />
                  <div className="h-4 w-2/3 bg-gray-200 rounded" />
                </div>
              ) : membership && membership.status === 'ACTIVE' && new Date(membership.endDate) > new Date() ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Plan activo</span>
                    <span className="text-sm font-medium text-emerald-700">{membership.plan?.name ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Tipo</span>
                    <span className="text-sm font-mono text-gray-900">{membership.type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Vence</span>
                    <span className="text-sm font-mono text-gray-900">
                      {new Date(membership.endDate).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                </div>
              ) : membership && (membership.status === 'EXPIRED' || membership.status === 'CANCELED' || new Date(membership.endDate) <= new Date()) ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Estado</span>
                    <span className="text-sm font-medium text-amber-700">
                      {membership.status === 'CANCELED' ? 'Cancelada' : 'Vencida'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Plan</span>
                    <span className="text-sm font-medium text-gray-700">{membership.plan?.name ?? '—'}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 mb-3">Sin membresía activa</p>
              )}

              <button
                onClick={async () => {
                  const res = await getPlans();
                  setMembershipPlans(res.data.filter(p => p.isActive && p.monthlyPrice > 0));
                  setSelectedPlanId('');
                  setSelectedType('MONTHLY');
                  setShowMembershipModal(true);
                }}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors w-full justify-center cursor-pointer"
              >
                {!membership
                  ? 'Asignar membresía'
                  : membership.status === 'ACTIVE' && new Date(membership.endDate) > new Date()
                    ? 'Cambiar plan'
                    : 'Renovar membresía'}
              </button>

              {membership && membership.status === 'ACTIVE' && new Date(membership.endDate) > new Date() && (
                <button
                  onClick={() => setConfirmAction({ action: 'cancelMembership', label: 'cancelar la membresía de este profesional' })}
                  disabled={cancelingMembership}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors w-full justify-center cursor-pointer"
                >
                  Cancelar membresía
                </button>
              )}
            </div>
          )}

          {/* Event history */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Historial
            </h2>
            <div className="space-y-3">
              <EventItem
                date={p.lastAssignedAt || p.updatedAt}
                label={p.lastAssignedAt ? 'Último pedido asignado' : 'Última actualización'}
              />
              <EventItem date={p.createdAt} label="Registro completado" />
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Estadísticas
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Trial usado</span>
                <span className="text-sm font-mono font-medium text-gray-900">
                  {p.trialRequestsUsed}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Badge</span>
                <span className="text-sm font-medium">
                  {p.hasBadge ? (
                    <span className="text-green-700">Verificado</span>
                  ) : (
                    <span className="text-gray-400">Sin badge</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Reputation */}
          {reputation && reputation.totalRequests > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                Reputación
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Pedidos completados</span>
                  <span className="text-sm font-mono font-medium text-gray-900">
                    {reputation.completedRequests}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Pedidos no cumplidos</span>
                  <span className="text-sm font-mono font-medium text-gray-900">
                    {reputation.notFulfilledRequests}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">% Recomendación</span>
                  <span className="text-sm font-mono font-medium text-gray-900">
                    {reputation.wouldRecommendPct}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Calificación promedio</span>
                  <span className="text-sm font-mono font-medium text-gray-900">
                    {reputation.averageRating}/5
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Puntualidad</span>
                  <span className="text-sm font-mono font-medium text-gray-900">
                    {reputation.averagePunctuality}/5
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Calidad</span>
                  <span className="text-sm font-mono font-medium text-gray-900">
                    {reputation.averageQuality}/5
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Comunicación</span>
                  <span className="text-sm font-mono font-medium text-gray-900">
                    {reputation.averageCommunication}/5
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Precio justo</span>
                  <span className="text-sm font-mono font-medium text-gray-900">
                    {reputation.averagePriceFairness}/5
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign membership modal */}
      {showMembershipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Asignar membresía</h3>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Plan</label>
              <select
                value={selectedPlanId}
                onChange={e => setSelectedPlanId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-600"
              >
                <option value="">Seleccionar plan</option>
                {membershipPlans.map(plan => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — ${plan.monthlyPrice.toLocaleString('es-AR')}/mes
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value as 'MONTHLY' | 'ANNUAL')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-600"
              >
                <option value="MONTHLY">Mensual</option>
                <option value="ANNUAL">Anual</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowMembershipModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssignMembership}
                disabled={!selectedPlanId || assigningMembership}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {assigningMembership ? 'Asignando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        title={
          confirmAction?.action === 'approve'
            ? 'Aprobar profesional'
            : confirmAction?.action === 'reject'
              ? 'Rechazar profesional'
              : confirmAction?.action === 'suspend'
                ? 'Suspender profesional'
                : confirmAction?.action === 'cancelMembership'
                  ? 'Cancelar membresía'
                  : 'Reactivar profesional'
        }
        description={
          confirmAction
            ? `¿Estás seguro de que querés ${confirmAction.label}?`
            : ''
        }
        confirmLabel={
          confirmAction?.action === 'approve'
            ? 'Aprobar'
            : confirmAction?.action === 'reject'
              ? 'Rechazar'
              : confirmAction?.action === 'suspend'
                ? 'Suspender'
                : confirmAction?.action === 'cancelMembership'
                  ? 'Cancelar membresía'
                  : 'Reactivar'
        }
        variant={
          confirmAction?.action === 'approve' || confirmAction?.action === 'reactivate'
            ? 'success'
            : 'danger'
        }
        loading={!!actionLoading || cancelingMembership}
        onConfirm={() => confirmAction && (confirmAction.action === 'cancelMembership' ? handleCancelMembership() : executeAction(confirmAction.action))}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

function EventItem({ date, label }: { date: string; label: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {new Date(date).toLocaleString('es-AR')}
        </p>
      </div>
    </div>
  );
}

function LicenseStatusBadge({ status }: { status: LicenseStatus }) {
  const config: Record<LicenseStatus, { label: string; className: string; icon: React.ReactNode }> = {
    PENDING: {
      label: 'Pendiente de revisión',
      className: 'bg-amber-50 text-amber-700',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
    },
    APPROVED: {
      label: 'Aprobada',
      className: 'bg-emerald-50 text-emerald-700',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
    },
    REJECTED: {
      label: 'Rechazada',
      className: 'bg-red-50 text-red-700',
      icon: <ShieldX className="w-3.5 h-3.5" />,
    },
  };

  const { label, className, icon } = config[status] || config.PENDING;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
      {icon}
      {label}
    </span>
  );
}

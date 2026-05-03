import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle, XCircle, Copy, Check, Link2 } from 'lucide-react';
import {
  getProfessional,
  approveProfessional,
  rejectProfessional,
  suspendProfessional,
  reactivateProfessional,
  generateSession,
} from '../../lib/admin-api';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { resolveHostContext } from '../../lib/host';
import type { Professional, ProfessionalStatus } from '../../types/admin';

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

export function ProfessionalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isSuperAdmin } = useAuth();
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ action: string; label: string } | null>(null);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    getProfessional(id)
      .then((res) => setProfessional(res.data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Error al cargar'),
      )
      .finally(() => setLoading(false));
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
      setProfessional(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Error al ${action}`);
    } finally {
      setActionLoading('');
      setConfirmAction(null);
    }
  };

  const handleGenerateSession = async () => {
    if (!id) return;
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
      // fallback: select text manually
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
          className="inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-800 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Profesionales
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold text-gray-900">{p.name}</h1>
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
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Aprobar
            </button>
          )}
          {(p.status === 'UNDER_REVIEW' || p.status === 'PENDING') && (
            <button
              onClick={() => setConfirmAction({ action: 'reject', label: `rechazar a ${p.name}` })}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Rechazar
            </button>
          )}
          {canSuspend && (
            <button
              onClick={() => setConfirmAction({ action: 'suspend', label: `suspender a ${p.name}` })}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Suspender
            </button>
          )}
          {canReactivate && (
            <button
              onClick={() => setConfirmAction({ action: 'reactivate', label: `reactivar a ${p.name}` })}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
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
                  {p.zones?.[0]?.geoNode?.name || '—'}
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
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-100 text-sm text-green-700 hover:bg-green-50 hover:border-green-200 transition-colors"
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
                disabled={sessionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors w-full justify-center"
              >
                <Link2 className="w-4 h-4" />
                {sessionLoading ? 'Generando...' : 'Generar enlace de acceso'}
              </button>

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
                      className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-green-700 hover:bg-green-50 transition-colors"
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
        </div>
      </div>

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
                : 'Reactivar'
        }
        variant={
          confirmAction?.action === 'approve' || confirmAction?.action === 'reactivate'
            ? 'success'
            : 'danger'
        }
        loading={!!actionLoading}
        onConfirm={() => confirmAction && executeAction(confirmAction.action)}
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

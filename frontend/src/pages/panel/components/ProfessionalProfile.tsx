import type { PanelProfessional, ProfessionalStatus } from '../../../types/panel';
import { PanelCard } from './PanelCard';
import { brand } from '../../../lib/brand';
import { useState } from 'react';
import { uploadProfileFile, uploadProfilePhoto } from '../../../lib/panel-api';

interface ProfessionalProfileProps {
  professional: PanelProfessional;
  onEdit: () => void;
  sessionToken: string;
  onPhotoUploaded: (url: string) => void;
}

const STATUS_CONFIG: Record<ProfessionalStatus, { label: string; bg: string; text: string }> = {
  ACTIVE: { label: 'Activo', bg: '#ECFDF5', text: '#059669' },
  SUSPENDED: { label: 'Suspendido', bg: '#FEF2F2', text: '#DC2626' },
  OBSERVATION: { label: 'En observación', bg: '#FFFBEB', text: '#D97706' },
  PENDING: { label: 'Pendiente', bg: '#EFF6FF', text: '#2563EB' },
  UNDER_REVIEW: { label: 'En revisión', bg: '#EFF6FF', text: '#2563EB' },
  PAUSED: { label: 'Pausado', bg: '#F3F4F6', text: '#6B7280' },
  REJECTED: { label: 'Rechazado', bg: '#FEF2F2', text: '#DC2626' },
};

const DOCS: { key: string; label: string; url: string | null | undefined }[] = [
  { key: 'dniFront', label: 'DNI Frente.pdf', url: 'dniFrontUrl' },
  { key: 'dniBack', label: 'DNI Dorso.pdf', url: 'dniBackUrl' },
  { key: 'criminalRecord', label: 'Certificado de antecedentes.pdf', url: 'criminalRecordUrl' },
];

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] mb-3 pb-2 border-b border-[#F3F4F6]"
      style={{ fontFamily: 'DM Sans' }}
    >
      {children}
    </h3>
  );
}

export function ProfessionalProfile({ professional, onEdit, sessionToken, onPhotoUploaded }: ProfessionalProfileProps) {
  const status = STATUS_CONFIG[professional.status] || STATUS_CONFIG.PENDING;
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const photoUrl = await uploadProfileFile(file);
      await uploadProfilePhoto(sessionToken, photoUrl);
      onPhotoUploaded(photoUrl);
    } catch (err) {
      console.error('Failed to upload photo:', err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-8">
      {!professional.photoUrl && (
        <div
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-2"
          style={{ fontFamily: 'DM Sans' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p className="text-sm text-amber-800">
            <strong>Completá tu perfil:</strong> subí tu foto para que los usuarios puedan reconocerte antes de la visita.
          </p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1
          className="text-3xl font-bold text-[#111827]"
          style={{ fontFamily: 'DM Sans' }}
        >
          Mi Perfil
        </h1>
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[#0B6E4F] text-white hover:bg-[#095c41] transition-colors cursor-pointer"
          style={{ fontFamily: 'DM Sans' }}
        >
          Editar perfil
        </button>
      </div>

      <PanelCard>
        <SectionHeader>Foto de perfil</SectionHeader>
        <div className="flex items-center gap-6">
          <div className="shrink-0">
            {professional.photoUrl ? (
              <img
                src={professional.photoUrl}
                alt="Foto de perfil"
                className="w-20 h-20 rounded-full object-cover border-2 border-[#E5E7EB]"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#F3F4F6] flex items-center justify-center border-2 border-dashed border-[#D1D5DB]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
              {professional.photoUrl ? 'Tu foto actual' : 'Todavía no subiste una foto'}
            </p>
            <label
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB] transition-colors cursor-pointer"
              style={{ fontFamily: 'DM Sans' }}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              {professional.photoUrl ? 'Cambiar foto' : 'Subir foto'}
            </label>
            {uploadingPhoto && (
              <p className="text-xs text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>Subiendo...</p>
            )}
          </div>
        </div>
      </PanelCard>

      <PanelCard>
        <SectionHeader>Estado del Profesional</SectionHeader>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="text-sm text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
            Estado:
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium"
            style={{
              backgroundColor: status.bg,
              color: status.text,
              fontFamily: 'DM Sans',
            }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: status.text }}
            />
            {status.label}
          </span>

          {professional.hasBadge && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-medium"
              style={{
                backgroundColor: '#FEF3C7',
                color: '#92400E',
                fontFamily: 'DM Sans',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Excelencia {brand.name}
            </span>
          )}
        </div>

        <div>
          <span
            className="text-xs font-medium text-[#6B7280] block mb-2"
            style={{ fontFamily: 'DM Sans' }}
          >
            Disponibilidad
          </span>
          {professional.availability ? (
            <div className="flex flex-wrap gap-2">
              {professional.availability.split(',').map((slot) => (
                <span
                  key={slot}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs bg-[#F3F4F6] text-[#374151]"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {slot.trim()}
                </span>
              ))}
            </div>
          ) : (
            <p
              className="text-sm italic text-[#9CA3AF]"
              style={{ fontFamily: 'DM Sans' }}
            >
              No declaraste disponibilidad todavía
            </p>
          )}
        </div>
      </PanelCard>

      <PanelCard>
        <SectionHeader>Datos Personales</SectionHeader>
        <div className="divide-y divide-[#F3F4F6]">
          <FieldRow label="Nombre completo" value={professional.name} />
          <FieldRow label="Teléfono" value={professional.phone} />
          <FieldRow
            label="Rubro"
            value={professional.category?.name || '—'}
          />
          <FieldRow
            label="Zonas de cobertura"
            value={
              professional.zones.length > 0
                ? professional.zones.map((z) => z.name).join(', ')
                : '—'
            }
          />
          {professional.cuil && <FieldRow label="CUIL" value={professional.cuil} />}
        </div>
      </PanelCard>

      <PanelCard>
        <SectionHeader>Documentación Enviada</SectionHeader>
        <div className="divide-y divide-[#F3F4F6]">
          {DOCS.map((doc) => {
            const url = professional[doc.url as keyof PanelProfessional] as string | null;
            if (!url) return null;
            return (
              <div key={doc.key} className="flex items-center justify-between py-3.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6B7280"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span
                    className="text-sm text-[#111827] truncate"
                    style={{ fontFamily: 'DM Sans' }}
                  >
                    {doc.label}
                  </span>
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[#0B6E4F] hover:underline shrink-0 ml-4"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Ver
                </a>
              </div>
            );
          })}
          {professional.references && (
            <div className="py-3">
              <span
                className="text-xs font-medium text-[#6B7280] block mb-1"
                style={{ fontFamily: 'DM Sans' }}
              >
                Referencias
              </span>
              <p
                className="text-sm text-[#374151]"
                style={{ fontFamily: 'DM Sans' }}
              >
                {professional.references}
              </p>
            </div>
          )}
        </div>
      </PanelCard>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-4">
      <span
        className="text-sm font-medium text-[#6B7280]"
        style={{ fontFamily: 'DM Sans' }}
      >
        {label}
      </span>
      <span
        className="text-base font-semibold text-[#111827] text-right ml-4"
        style={{ fontFamily: 'DM Sans' }}
      >
        {value}
      </span>
    </div>
  );
}

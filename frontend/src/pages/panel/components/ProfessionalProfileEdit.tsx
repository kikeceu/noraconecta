import { useState, useEffect, useRef } from 'react';
import { Upload, ExternalLink, Loader2 } from 'lucide-react';
import { updateProfile, uploadProfileFile, getDepartments } from '../../../lib/panel-api';
import type { PanelProfessional } from '../../../types/panel';

type EditTab = 'basicos' | 'identidad' | 'perfil';

const TABS: { key: EditTab; label: string }[] = [
  { key: 'basicos', label: 'Básicos' },
  { key: 'identidad', label: 'Identidad' },
  { key: 'perfil', label: 'Perfil' },
];

const DAY_NAMES: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

function FileField({
  label,
  currentUrl,
  uploading,
  onUpload,
}: {
  label: string;
  currentUrl: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  const fileInputId = `file-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block" style={{ fontFamily: 'DM Sans' }}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        {currentUrl && (
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-green-700 hover:bg-green-50 transition-colors cursor-pointer"
            style={{ fontFamily: 'DM Sans' }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Ver archivo actual
          </a>
        )}
        <label
          htmlFor={fileInputId}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer ${
            uploading ? 'opacity-50 pointer-events-none' : ''
          }`}
          style={{ fontFamily: 'DM Sans' }}
        >
          {uploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Subiendo...
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" />
              {currentUrl ? 'Reemplazar' : 'Subir'}
            </>
          )}
        </label>
        <input
          id={fileInputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/quicktime"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

interface ProfessionalProfileEditProps {
  professional: PanelProfessional;
  sessionToken: string;
  onSave: () => void;
  onCancel: () => void;
}

export function ProfessionalProfileEdit({
  professional,
  sessionToken,
  onSave,
  onCancel,
}: ProfessionalProfileEditProps) {
  const [activeTab, setActiveTab] = useState<EditTab>('basicos');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const structured = professional.availabilityStructured;
  const initialDays = structured?.slots?.map((s) => s.day) || [];
  const initialTimeSlots: Record<number, { from: string; to: string }> = {};
  structured?.slots?.forEach((s) => {
    initialTimeSlots[s.day] = { from: s.from, to: s.to };
  });

  const [form, setForm] = useState({
    name: professional.name,
    zoneIds: professional.zones.map((z) => z.id),
    selectedDays: initialDays,
    timeSlots: initialTimeSlots,
    dniNumber: professional.dniNumber || '',
    cuil: professional.cuil || '',
    dniFrontUrl: professional.dniFrontUrl || '',
    dniBackUrl: professional.dniBackUrl || '',
    criminalRecordUrl: professional.criminalRecordUrl || '',
    references: professional.references || '',
    presentationVideoUrl: professional.presentationVideoUrl || '',
    licenseUrl: professional.licenseUrl || '',
    declaredHasLicense: professional.declaredHasLicense ?? null as boolean | null,
  });

  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  const [sameSchedule, setSameSchedule] = useState(false);

  const [uploadingDniFront, setUploadingDniFront] = useState(false);
  const [uploadingDniBack, setUploadingDniBack] = useState(false);
  const [uploadingCriminalRecord, setUploadingCriminalRecord] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingLicense, setUploadingLicense] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{ dniNumber?: string; cuil?: string }>({});

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    getDepartments(sessionToken)
      .then((res) => setDepartments(res.data))
      .catch(() => setError('Error al cargar zonas'));
  }, [sessionToken]);

  const handleFileUpload = async (
    file: File,
    field: 'dniFrontUrl' | 'dniBackUrl' | 'criminalRecordUrl' | 'presentationVideoUrl' | 'licenseUrl',
    setUploading: (v: boolean) => void,
  ) => {
    setUploading(true);
    try {
      const url = await uploadProfileFile(file);
      setForm((prev) => ({ ...prev, [field]: url }));
    } catch (err) {
      setError('Error al subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  const formatCuil = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  };

  const handleDniChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    setForm((prev) => ({ ...prev, dniNumber: digits }));
  };

  const handleCuilChange = (value: string) => {
    setForm((prev) => ({ ...prev, cuil: formatCuil(value) }));
  };

  const handleSave = async () => {
    setSaving(true);
    const form = formRef.current;
    setError(null);

    const errors: { dniNumber?: string; cuil?: string } = {};
    if (form.dniNumber && !/^\d{7,8}$/.test(form.dniNumber)) {
      errors.dniNumber = 'Ingresá un DNI válido (7 a 8 dígitos)';
    }
    if (form.cuil && form.cuil.replace(/\D/g, '').length !== 11) {
      errors.cuil = 'Ingresá un CUIL válido (11 dígitos)';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSaving(false);
      return;
    }
    setFieldErrors({});

    try {
      const slots = form.selectedDays
        .filter((day) => form.timeSlots[day]?.from && form.timeSlots[day]?.to)
        .map((day) => ({ day, from: form.timeSlots[day].from, to: form.timeSlots[day].to }));

      const availability = slots.length > 0
        ? slots.map((s) => `${DAY_NAMES[s.day]}: ${s.from} a ${s.to}`).join(', ')
        : undefined;

      await updateProfile(sessionToken, {
        name: form.name,
        zoneIds: form.zoneIds,
        availability,
        availabilityStructured: slots.length > 0 ? { slots } : undefined,
        dniNumber: form.dniNumber || undefined,
        cuil: form.cuil || undefined,
        dniFrontUrl: form.dniFrontUrl || undefined,
        dniBackUrl: form.dniBackUrl || undefined,
        criminalRecordUrl: form.criminalRecordUrl || undefined,
        licenseUrl: form.licenseUrl || undefined,
        declaredHasLicense: form.declaredHasLicense ?? undefined,
        references: form.references || undefined,
        presentationVideoUrl: form.presentationVideoUrl || undefined,
      });

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1
          className="text-3xl font-bold text-[#111827]"
          style={{ fontFamily: 'DM Sans' }}
        >
          Editar perfil
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.key
                ? 'border-[#0B6E4F] text-[#0B6E4F]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            style={{ fontFamily: 'DM Sans' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Básicos */}
      {activeTab === 'basicos' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block" style={{ fontFamily: 'DM Sans' }}>
              Nombre completo
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0B6E4F]"
              style={{ fontFamily: 'DM Sans' }}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block" style={{ fontFamily: 'DM Sans' }}>
              Zonas de cobertura
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {departments.map((d) => (
                <label
                  key={d.id}
                  className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  <input
                    type="checkbox"
                    checked={form.zoneIds.includes(d.id)}
                    onChange={() => {
                      const zones = form.zoneIds.includes(d.id)
                        ? form.zoneIds.filter((z) => z !== d.id)
                        : [...form.zoneIds, d.id];
                      setForm({ ...form, zoneIds: zones });
                    }}
                    className="rounded border-gray-300 text-[#0B6E4F] cursor-pointer"
                  />
                  {d.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block" style={{ fontFamily: 'DM Sans' }}>
              Disponibilidad (opcional)
            </label>
            <p className="text-sm text-gray-500 mb-3" style={{ fontFamily: 'DM Sans' }}>
              Seleccioná los días y horarios de trabajo.
            </p>

            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <label
                  key={day}
                  className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  <input
                    type="checkbox"
                    checked={form.selectedDays.includes(day)}
                    onChange={() => {
                      setForm((prev) => {
                        const isAdding = !prev.selectedDays.includes(day);
                        const days = isAdding
                          ? [...prev.selectedDays, day]
                          : prev.selectedDays.filter((d) => d !== day);
                        const newTimeSlots = { ...prev.timeSlots };
                        if (sameSchedule && isAdding && prev.selectedDays.length > 0) {
                          newTimeSlots[day] = { ...prev.timeSlots[prev.selectedDays[0]] };
                        }
                        return { ...prev, selectedDays: days, timeSlots: newTimeSlots };
                      });
                    }}
                    className="rounded border-gray-300 text-[#0B6E4F] cursor-pointer"
                  />
                  {DAY_NAMES[day]}
                </label>
              ))}
            </div>

            {form.selectedDays.length > 0 && (
              <label
                className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mt-3"
                style={{ fontFamily: 'DM Sans' }}
              >
                <input
                  type="checkbox"
                  checked={sameSchedule}
                  onChange={() => {
                    const newSameSchedule = !sameSchedule;
                    setSameSchedule(newSameSchedule);
                    if (newSameSchedule && form.selectedDays.length > 0) {
                      const firstWithSlot = form.selectedDays.find(
                        (d) => form.timeSlots[d]?.from && form.timeSlots[d]?.to
                      );
                      if (firstWithSlot) {
                        setForm((prev) => {
                          const newTimeSlots = { ...prev.timeSlots };
                          for (const day of prev.selectedDays) {
                            newTimeSlots[day] = { ...prev.timeSlots[firstWithSlot] };
                          }
                          return { ...prev, timeSlots: newTimeSlots };
                        });
                      }
                    }
                  }}
                  className="rounded border-gray-300 text-[#0B6E4F] cursor-pointer"
                />
                Mismo horario para todos los días
              </label>
            )}

            {!sameSchedule &&
              [...form.selectedDays]
                .sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b))
                .map((day) => (
                  <div key={day} className="flex items-center gap-3 mt-2">
                    <span
                      className="text-sm text-gray-600 w-24"
                      style={{ fontFamily: 'DM Sans' }}
                    >
                      {DAY_NAMES[day]}
                    </span>
                    <input
                      type="time"
                      value={form.timeSlots[day]?.from || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          timeSlots: {
                            ...form.timeSlots,
                            [day]: { ...form.timeSlots[day], from: e.target.value },
                          },
                        })
                      }
                      className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
                    />
                    <span className="text-sm text-gray-400">a</span>
                    <input
                      type="time"
                      value={form.timeSlots[day]?.to || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          timeSlots: {
                            ...form.timeSlots,
                            [day]: { ...form.timeSlots[day], to: e.target.value },
                          },
                        })
                      }
                      className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
                    />
                  </div>
                ))}

            {sameSchedule && form.selectedDays.length > 0 && (
              <div className="flex items-center gap-3 mt-2">
                <span
                  className="text-sm text-gray-600 w-24"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Horario
                </span>
                <input
                  type="time"
                  value={form.timeSlots[form.selectedDays[0]]?.from || ''}
                  onChange={(e) => {
                    const newTimeSlots = { ...form.timeSlots };
                    for (const day of form.selectedDays) {
                      newTimeSlots[day] = {
                        ...newTimeSlots[day],
                        from: e.target.value,
                      };
                    }
                    setForm({ ...form, timeSlots: newTimeSlots });
                  }}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
                />
                <span className="text-sm text-gray-400">a</span>
                <input
                  type="time"
                  value={form.timeSlots[form.selectedDays[0]]?.to || ''}
                  onChange={(e) => {
                    const newTimeSlots = { ...form.timeSlots };
                    for (const day of form.selectedDays) {
                      newTimeSlots[day] = {
                        ...newTimeSlots[day],
                        to: e.target.value,
                      };
                    }
                    setForm({ ...form, timeSlots: newTimeSlots });
                  }}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Identidad */}
      {activeTab === 'identidad' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800" style={{ fontFamily: 'DM Sans' }}>
            ⚠️ Los cambios en esta sección serán revisados por el equipo de NORA.
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block" style={{ fontFamily: 'DM Sans' }}>
              DNI número
            </label>
            <input
              type="text"
              value={form.dniNumber}
              onChange={(e) => handleDniChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0B6E4F] font-mono"
              placeholder="12345678"
            />
            {fieldErrors.dniNumber && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.dniNumber}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block" style={{ fontFamily: 'DM Sans' }}>
              CUIL
            </label>
            <input
              type="text"
              value={form.cuil}
              onChange={(e) => handleCuilChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0B6E4F] font-mono"
              placeholder="XX-XXXXXXXX-X"
            />
            {fieldErrors.cuil && <p className="mt-1 text-xs text-red-600">{fieldErrors.cuil}</p>}
          </div>

          <FileField
            label="DNI frente"
            currentUrl={form.dniFrontUrl || null}
            uploading={uploadingDniFront}
            onUpload={(file) => handleFileUpload(file, 'dniFrontUrl', setUploadingDniFront)}
          />

          <FileField
            label="DNI dorso"
            currentUrl={form.dniBackUrl || null}
            uploading={uploadingDniBack}
            onUpload={(file) => handleFileUpload(file, 'dniBackUrl', setUploadingDniBack)}
          />

          <FileField
            label="Antecedentes penales"
            currentUrl={form.criminalRecordUrl || null}
            uploading={uploadingCriminalRecord}
            onUpload={(file) =>
              handleFileUpload(file, 'criminalRecordUrl', setUploadingCriminalRecord)
            }
          />
        </div>
      )}

      {/* Tab: Perfil */}
      {activeTab === 'perfil' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block" style={{ fontFamily: 'DM Sans' }}>
              Referencias
            </label>
            <textarea
              value={form.references}
              onChange={(e) => setForm({ ...form, references: e.target.value })}
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0B6E4F] resize-y"
              style={{ fontFamily: 'DM Sans' }}
              placeholder="Referencias opcionales..."
            />
          </div>

          <FileField
            label="Video de presentación"
            currentUrl={form.presentationVideoUrl || null}
            uploading={uploadingVideo}
            onUpload={(file) => handleFileUpload(file, 'presentationVideoUrl', setUploadingVideo)}
          />

          <div>
            <label className="text-xs text-gray-500 mb-1 block" style={{ fontFamily: 'DM Sans' }}>
              ¿Tiene credencial habilitante?
            </label>
            <select
              value={
                form.declaredHasLicense === true
                  ? 'true'
                  : form.declaredHasLicense === false
                    ? 'false'
                    : ''
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  declaredHasLicense:
                    e.target.value === 'true'
                      ? true
                      : e.target.value === 'false'
                        ? false
                        : null,
                })
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0B6E4F]"
              style={{ fontFamily: 'DM Sans' }}
            >
              <option value="">No aplica / sin datos</option>
              <option value="true">Sí, tengo</option>
              <option value="false">No tengo</option>
            </select>
          </div>

          {form.declaredHasLicense === true && (
            <FileField
              label="Credencial habilitante"
              currentUrl={form.licenseUrl || null}
              uploading={uploadingLicense}
              onUpload={(file) => handleFileUpload(file, 'licenseUrl', setUploadingLicense)}
            />
          )}
        </div>
      )}

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-between items-center z-40">
        <div className="w-64 hidden lg:block" />
        <div className="flex items-center justify-between w-full max-w-5xl mx-auto gap-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
            style={{ fontFamily: 'DM Sans' }}
          >
            Cancelar
          </button>
          {error && (
            <p className="text-sm text-red-600 flex-1 text-center" style={{ fontFamily: 'DM Sans' }}>
              {error}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 text-sm font-medium text-white bg-[#0B6E4F] rounded-lg hover:bg-[#095c41] disabled:opacity-50 cursor-pointer"
            style={{ fontFamily: 'DM Sans' }}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

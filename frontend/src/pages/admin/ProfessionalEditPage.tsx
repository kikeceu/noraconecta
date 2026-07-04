import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Upload, ExternalLink, Loader2 } from 'lucide-react';
import {
  getProfessional,
  updateProfessional,
  uploadProfessionalFile,
  getCategories,
  getDepartments,
} from '../../lib/admin-api';
import { resolveHostContext } from '../../lib/host';
import type { Professional, Category } from '../../types/admin';

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

function adminPath(path: string): string {
  const base = resolveHostContext() === 'admin' ? '' : '/admin';
  return `${base}${path}`;
}

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
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <div className="flex items-center gap-2">
        {currentUrl && (
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-green-700 hover:bg-green-50 transition-colors cursor-pointer"
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

export function ProfessionalEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<EditTab>('basicos');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    categoryId: '',
    zoneIds: [] as string[],
    selectedDays: [] as number[],
    timeSlots: {} as Record<number, { from: string; to: string }>,
    dniNumber: '',
    cuil: '',
    dniFrontUrl: '',
    dniBackUrl: '',
    criminalRecordUrl: '',
    references: '',
    presentationVideoUrl: '',
    licenseUrl: '',
    licenseStatus: '' as string,
    declaredHasLicense: null as boolean | null,
  });

  const [sameSchedule, setSameSchedule] = useState(false);

  const [uploadingDniFront, setUploadingDniFront] = useState(false);
  const [uploadingDniBack, setUploadingDniBack] = useState(false);
  const [uploadingCriminalRecord, setUploadingCriminalRecord] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingLicense, setUploadingLicense] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{ dniNumber?: string; cuil?: string }>({});

  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [proRes, catsRes, deptsRes] = await Promise.all([
          getProfessional(id),
          getCategories(),
          getDepartments(),
        ]);
        const p = proRes.data.professional as Professional & {
          availabilityStructured?: { slots: { day: number; from: string; to: string }[] } | null;
        };

        setCategories(catsRes.data.filter((c) => c.isActive));
        setDepartments(deptsRes.data);

        const structured = p.availabilityStructured;
        const selectedDays = structured?.slots?.map((s) => s.day) || [];
        const timeSlots: Record<number, { from: string; to: string }> = {};
        structured?.slots?.forEach((s) => {
          timeSlots[s.day] = { from: s.from, to: s.to };
        });

        setForm({
          name: p.name,
          categoryId: p.categoryId,
          zoneIds: p.zones?.map((z) => z.geoNode.id) || [],
          selectedDays,
          timeSlots,
          dniNumber: p.dniNumber || '',
          cuil: p.cuil || '',
          dniFrontUrl: p.dniFrontUrl || '',
          dniBackUrl: p.dniBackUrl || '',
          criminalRecordUrl: p.criminalRecordUrl || '',
          references: p.references || '',
          presentationVideoUrl: p.presentationVideoUrl || '',
          licenseUrl: p.licenseUrl || '',
          licenseStatus: p.licenseStatus || '',
          declaredHasLicense: p.declaredHasLicense ?? null,
        });
      } catch (err) {
        setError('Error al cargar el profesional');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const handleFileUpload = async (
    file: File,
    field: 'dniFrontUrl' | 'dniBackUrl' | 'criminalRecordUrl' | 'presentationVideoUrl' | 'licenseUrl',
    setUploading: (v: boolean) => void,
    onDone?: () => void,
  ) => {
    setUploading(true);
    try {
      const url = await uploadProfessionalFile(file);
      setForm((prev) => ({ ...prev, [field]: url }));
      onDone?.();
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
    if (!id) return;
    setSaving(true);
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

      await updateProfessional(id, {
        name: form.name,
        categoryId: form.categoryId,
        zoneIds: form.zoneIds,
        availability,
        availabilityStructured: slots.length > 0 ? { slots } : undefined,
        dniNumber: form.dniNumber || undefined,
        cuil: form.cuil || undefined,
        dniFrontUrl: form.dniFrontUrl || undefined,
        dniBackUrl: form.dniBackUrl || undefined,
        criminalRecordUrl: form.criminalRecordUrl || undefined,
        licenseUrl: form.licenseUrl || undefined,
        licenseStatus: form.licenseStatus || undefined,
        declaredHasLicense: form.declaredHasLicense ?? undefined,
        references: form.references || undefined,
        presentationVideoUrl: form.presentationVideoUrl || undefined,
      });

      setSaved(true);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      navigate(adminPath(`/professionals/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-gray-200 rounded" />
        <div className="h-8 w-64 bg-gray-200 rounded" />
        <div className="h-96 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (!id) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
        ID de profesional no proporcionado
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {saved && (
        <div className="fixed top-4 right-4 z-50 rounded-xl bg-green-700 px-5 py-3 text-sm font-medium text-white shadow-lg">
          ✓ Cambios guardados correctamente
        </div>
      )}
      <div>
        <Link
          to={adminPath(`/professionals/${id}`)}
          className="inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-800 mb-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al profesional
        </Link>
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter">
          Editar profesional
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
                ? 'border-green-700 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Básicos */}
      {activeTab === 'basicos' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nombre completo</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-600"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-600"
            >
              <option value="">Seleccionar categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block">Zonas de cobertura</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {departments.map((d) => (
                <label
                  key={d.id}
                  className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
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
                    className="rounded border-gray-300 text-green-700 cursor-pointer"
                  />
                  {d.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block">Disponibilidad (opcional)</label>
            <p className="text-sm text-gray-500 mb-3">
              Seleccioná los días y horarios de trabajo del profesional.
            </p>

            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <label
                  key={day}
                  className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={form.selectedDays.includes(day)}
                    onChange={() => {
                      const isAdding = !form.selectedDays.includes(day);
                      const days = isAdding
                        ? [...form.selectedDays, day]
                        : form.selectedDays.filter((d) => d !== day);

                      const newTimeSlots = { ...form.timeSlots };
                      if (sameSchedule && isAdding && form.selectedDays.length > 0) {
                        newTimeSlots[day] = { ...form.timeSlots[form.selectedDays[0]] };
                      }

                      setForm({ ...form, selectedDays: days, timeSlots: newTimeSlots });
                    }}
                    className="rounded border-gray-300 text-green-700 cursor-pointer"
                  />
                  {DAY_NAMES[day]}
                </label>
              ))}
            </div>

            {form.selectedDays.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mt-3">
                <input
                  type="checkbox"
                  checked={sameSchedule}
                  onChange={() => setSameSchedule(!sameSchedule)}
                  className="rounded border-gray-300 text-green-700 cursor-pointer"
                />
                Mismo horario para todos los días
              </label>
            )}

            {!sameSchedule &&
              form.selectedDays
                .sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b))
                .map((day) => (
                  <div key={day} className="flex items-center gap-3 mt-2">
                    <span className="text-sm text-gray-600 w-24">{DAY_NAMES[day]}</span>
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
                <span className="text-sm text-gray-600 w-24">Horario</span>
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
          <div>
            <label className="text-xs text-gray-500 mb-1 block">DNI número</label>
            <input
              type="text"
              value={form.dniNumber}
              onChange={(e) => handleDniChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-600 font-mono"
              placeholder="12345678"
            />
            {fieldErrors.dniNumber && <p className="mt-1 text-xs text-red-600">{fieldErrors.dniNumber}</p>}
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">CUIL</label>
            <input
              type="text"
              value={form.cuil}
              onChange={(e) => handleCuilChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-600 font-mono"
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
            onUpload={(file) => handleFileUpload(file, 'criminalRecordUrl', setUploadingCriminalRecord)}
          />
        </div>
      )}

      {/* Tab: Perfil */}
      {activeTab === 'perfil' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Referencias</label>
            <textarea
              value={form.references}
              onChange={(e) => setForm({ ...form, references: e.target.value })}
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-600 resize-y"
              placeholder="Referencias opcionales del profesional..."
            />
          </div>

          <FileField
            label="Video de presentación"
            currentUrl={form.presentationVideoUrl || null}
            uploading={uploadingVideo}
            onUpload={(file) => handleFileUpload(file, 'presentationVideoUrl', setUploadingVideo)}
          />

          <div>
            <label className="text-xs text-gray-500 mb-1 block">¿Tiene credencial habilitante?</label>
            <select
              value={form.declaredHasLicense === true ? 'true' : form.declaredHasLicense === false ? 'false' : ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  declaredHasLicense: e.target.value === 'true' ? true : e.target.value === 'false' ? false : null,
                })
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-600"
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
              onUpload={(file) => handleFileUpload(file, 'licenseUrl', setUploadingLicense, () => setForm((prev) => ({ ...prev, licenseStatus: 'APPROVED' })))}
            />
          )}
        </div>
      )}

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-between items-center z-40">
        <div className="w-64 hidden lg:block" />
        <div className="flex items-center justify-between w-full max-w-5xl mx-auto gap-4">
          <button
            onClick={() => navigate(adminPath(`/professionals/${id}`))}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            Cancelar
          </button>
          {error && <p className="text-sm text-red-600 flex-1 text-center">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

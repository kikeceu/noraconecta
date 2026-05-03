import { useState } from 'react';

interface PersonalDataStepProps {
  dniNumber: string;
  cuil: string;
  onUpdate: (field: 'dniNumber' | 'cuil', value: string) => void;
  onNext: () => void;
}

const DNI_REGEX = /^\d{1,8}$/;

export function PersonalDataStep({ dniNumber, cuil, onUpdate, onNext }: PersonalDataStepProps) {
  const [errors, setErrors] = useState<{ dni?: string; cuil?: string }>({});

  const formatCuil = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 11);

    if (digits.length <= 2) return digits;
    if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  };

  const handleCuilChange = (value: string) => {
    onUpdate('cuil', formatCuil(value));
  };

  const handleDniChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    onUpdate('dniNumber', digits);
  };

  const validate = (): boolean => {
    const newErrors: { dni?: string; cuil?: string } = {};

    if (!DNI_REGEX.test(dniNumber) || dniNumber.length < 7) {
      newErrors.dni = 'Ingresá un DNI válido (7 a 8 dígitos)';
    }

    const cuilDigits = cuil.replace(/\D/g, '');
    if (cuilDigits.length !== 11) {
      newErrors.cuil = 'Ingresá un CUIL válido (11 dígitos)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onNext();
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 overflow-auto px-4 py-5">
        <div className="rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-6">
            <div>
              <label
                className="mb-2 block text-[14px] font-medium text-[#111827]"
                style={{ fontFamily: 'DM Sans' }}
              >
                Número de DNI
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={dniNumber}
                onChange={(e) => handleDniChange(e.target.value)}
                placeholder="XX.XXX.XXX"
                className="w-full rounded-lg border-[1.5px] px-3 py-3.5 text-[15px] text-[#111827] outline-none transition-colors placeholder:text-[#9CA3AF]"
                style={{
                  fontFamily: 'JetBrains Mono',
                  borderColor: errors.dni ? '#DC2626' : dniNumber ? '#0B6E4F' : '#E5E7EB',
                  boxShadow: dniNumber ? '0 0 0 3px rgba(11,110,79,0.1)' : 'none',
                  minHeight: '48px',
                }}
                autoFocus
              />
              {errors.dni && (
                <p className="mt-1.5 text-[13px] text-[#DC2626]" style={{ fontFamily: 'DM Sans' }}>
                  {errors.dni}
                </p>
              )}
            </div>

            <div>
              <label
                className="mb-2 block text-[14px] font-medium text-[#111827]"
                style={{ fontFamily: 'DM Sans' }}
              >
                CUIL
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={cuil}
                onChange={(e) => handleCuilChange(e.target.value)}
                placeholder="XX-XXXXXXXX-X"
                className="w-full rounded-lg border-[1.5px] border-[#E5E7EB] px-3 py-3.5 text-[15px] text-[#111827] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#0B6E4F]"
                style={{
                  fontFamily: 'JetBrains Mono',
                  boxShadow: cuil ? '0 0 0 3px rgba(11,110,79,0.1)' : 'none',
                  minHeight: '48px',
                  borderColor: errors.cuil ? '#DC2626' : cuil ? '#0B6E4F' : '#E5E7EB',
                }}
              />
              {errors.cuil && (
                <p className="mt-1.5 text-[13px] text-[#DC2626]" style={{ fontFamily: 'DM Sans' }}>
                  {errors.cuil}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-[#E5E7EB] bg-white px-4 pb-[env(safe-area-inset-bottom,16px)] pt-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 rounded-xl py-3 text-center text-[16px] font-medium text-white transition-all active:translate-y-px"
            style={{ fontFamily: 'DM Sans', backgroundColor: '#0B6E4F', minHeight: '48px' }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}

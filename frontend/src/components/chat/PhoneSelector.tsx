interface PhoneSelectorProps {
  readonly phone: string;
  readonly role: 'USER' | 'PROFESSIONAL';
  readonly onPhoneChange: (phone: string) => void;
  readonly onRoleChange: (role: 'USER' | 'PROFESSIONAL') => void;
}

export function PhoneSelector({
  phone,
  role,
  onPhoneChange,
  onRoleChange,
}: PhoneSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={phone}
        onChange={(e) => onPhoneChange(e.target.value)}
        placeholder="+54 261 123-4567"
        className="h-8 min-w-0 rounded-lg border border-border bg-elevated px-2.5 text-sm text-steel outline-none transition-colors placeholder:text-iron hover:border-zinc-muted focus:border-emerald/50"
      />
      <div className="flex rounded-lg border border-border bg-elevated p-0.5">
        <button
          type="button"
          onClick={() => onRoleChange('USER')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            role === 'USER'
              ? 'bg-emerald text-[#09090b]'
              : 'text-iron hover:text-steel'
          }`}
        >
          Usuario
        </button>
        <button
          type="button"
          onClick={() => onRoleChange('PROFESSIONAL')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            role === 'PROFESSIONAL'
              ? 'bg-emerald text-[#09090b]'
              : 'text-iron hover:text-steel'
          }`}
        >
          Profesional
        </button>
      </div>
    </div>
  );
}

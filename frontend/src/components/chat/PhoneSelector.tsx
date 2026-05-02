import { SimulatedPhone } from '../../types/chat';

interface PhoneSelectorProps {
  readonly phones: readonly SimulatedPhone[];
  readonly selected: SimulatedPhone;
  readonly onSelect: (phone: SimulatedPhone) => void;
}

export function PhoneSelector({ phones, selected, onSelect }: PhoneSelectorProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <label className="font-mono text-[0.6875rem] uppercase tracking-wider text-iron">
        SIMULAR COMO
      </label>
      <select
        value={`${selected.phone}|${selected.role}`}
        onChange={(e) => {
          const [phone, role] = e.target.value.split('|');
          const match = phones.find(
            (p) => p.phone === phone && p.role === role,
          );
          if (match) onSelect(match);
        }}
        className="cursor-pointer appearance-none rounded-lg border border-border bg-elevated px-3 py-1.5 text-sm text-steel outline-none transition-colors hover:border-zinc-muted focus:border-emerald/50"
      >
        {phones.map((p) => (
          <option
            key={p.phone}
            value={`${p.phone}|${p.role}`}
            className="bg-elevated text-steel"
          >
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}

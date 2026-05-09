interface PanelCardProps {
  children: React.ReactNode;
  className?: string;
}

export function PanelCard({ children, className = '' }: PanelCardProps) {
  return (
    <div className={`rounded-2xl bg-white border border-[#E5E7EB] shadow-sm p-6 ${className}`}>
      {children}
    </div>
  );
}

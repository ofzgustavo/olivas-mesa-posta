interface HeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-3xl font-titulo font-medium text-oliva-escuro leading-tight">
          {title}
        </h1>
        {subtitle && <p className="text-cinza text-sm mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

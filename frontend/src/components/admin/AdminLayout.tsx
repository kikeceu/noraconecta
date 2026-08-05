import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  ShoppingBag,
  AlertTriangle,
  MapPin,
  Tag,
  CreditCard,
  Percent,
  Settings,
  Sparkles,
  TrendingUp,
  Zap,
  MessageCircle,
  DollarSign,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveHostContext } from '../../lib/host';
import { countPendingDataChanges } from '../../lib/admin-api';

interface NavGroupItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  superAdminOnly?: boolean;
  items: NavGroupItem[];
}

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { admin, logout, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingDataChangesCount, setPendingDataChangesCount] = useState(0);

  const adminContext = resolveHostContext() === 'admin';
  const basePath = adminContext ? '' : '/admin';
  const homePath = basePath || '/';
  const loginPath = `${basePath}/login`;

  const navGroups: NavGroup[] = [
    {
      id: 'gestion',
      label: 'Gestión',
      items: [
        { to: homePath, label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: `${basePath}/orders`, label: 'Pedidos', icon: ShoppingBag },
        { to: `${basePath}/escalations`, label: 'Escaladas', icon: AlertTriangle },
        { to: `${basePath}/demand`, label: 'Demanda', icon: TrendingUp },
      ],
    },
    {
      id: 'comunidad',
      label: 'Comunidad',
      items: [
        { to: `${basePath}/professionals`, label: 'Profesionales', icon: UserCheck },
        { to: `${basePath}/users`, label: 'Usuarios', icon: Users },
      ],
    },
    {
      id: 'catalogo',
      label: 'Catálogo',
      items: [
        { to: `${basePath}/categories`, label: 'Categorías', icon: Tag },
        { to: `${basePath}/zones`, label: 'Zonas', icon: MapPin },
        { to: `${basePath}/plans`, label: 'Planes', icon: CreditCard },
      ],
    },
    {
      id: 'costos',
      label: 'Costos operativos',
      superAdminOnly: true,
      items: [
        { to: `${basePath}/llm-costs`, label: 'Costos LLM', icon: Zap },
        { to: `${basePath}/whatsapp-costs`, label: 'Costos WhatsApp', icon: MessageCircle },
        { to: `${basePath}/whatsapp-pricing`, label: 'Precios WhatsApp', icon: DollarSign },
      ],
    },
    {
      id: 'configuracion',
      label: 'Configuración',
      superAdminOnly: true,
      items: [
        { to: `${basePath}/promotions`, label: 'Promociones', icon: Percent },
        { to: `${basePath}/prompts`, label: 'Prompts IA', icon: Sparkles },
        { to: `${basePath}/settings`, label: 'Sistema', icon: Settings },
      ],
    },
  ];

  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const currentPath = window.location.pathname;
    const activeGroup = navGroups.find((g) =>
      g.items.some((item) => {
        if (item.end) return currentPath === item.to;
        return currentPath.startsWith(item.to);
      }),
    );
    return activeGroup ? [activeGroup.id] : ['gestion'];
  });

  // Auto-open the group containing the current route
  useEffect(() => {
    const activeGroup = navGroups.find((g) =>
      g.items.some((item) => {
        if (item.end) return location.pathname === item.to;
        return location.pathname.startsWith(item.to);
      }),
    );
    if (activeGroup && !openGroups.includes(activeGroup.id)) {
      setOpenGroups((prev) => [...prev, activeGroup.id]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    const fetchCount = () => {
      countPendingDataChanges()
        .then((res) => setPendingDataChangesCount(res.data.count))
        .catch(() => {});
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  };

  const handleLogout = async () => {
    await logout();
    navigate(loginPath);
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-emerald-900/40 text-emerald-400 border-l-[3px] border-emerald-400'
      : 'text-white/75 hover:bg-white/6 hover:text-white border-l-[3px] border-transparent'
  }`;

  const initials = admin?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'NA';

  const sidebar = (
    <div className="flex flex-col h-full bg-[#111110] border-r border-white/8">
      <div className="flex items-center justify-between h-14 px-4 border-b border-white/8">
        <Link to={homePath} className="flex items-center gap-2 cursor-pointer">
            <img
              src="/logo-nora.svg"
              alt="NORA"
              className="h-10 w-auto"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
        </Link>
        <button
          className="lg:hidden p-1 text-white/40 hover:text-white cursor-pointer"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navGroups.map((group) => {
          if (group.superAdminOnly && !isSuperAdmin()) return null;

          const isOpen = openGroups.includes(group.id);

          return (
            <div key={group.id}>
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white/45 uppercase tracking-wider hover:text-white/70 transition-colors cursor-pointer"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                />
                {group.label}
              </button>

              {isOpen && (
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={linkClass}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                      {item.label === 'Profesionales' && pendingDataChangesCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs font-bold text-white bg-red-500 rounded-full">
                          {pendingDataChangesCount}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-green-700 text-white flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/80 truncate">
                {admin?.name}
              </p>
              <p className="text-xs text-white/35">{admin?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-white/30 hover:text-red-400 transition-colors cursor-pointer"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="fixed inset-0 bg-gray-600/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-60 z-50">
            {sidebar}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:pl-60">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center h-14 px-4 bg-[#111110] border-b border-white/8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-white/70 hover:text-white mr-3 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <img
            src="/logo-nora.svg"
            alt="NORA"
            className="h-10 w-auto"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        </div>

        <main className="flex-1 overflow-y-auto p-6 md:p-8 min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Link({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <a
      href={to}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
      }}
      className={className}
    >
      {children}
    </a>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, Building2, CheckSquare, ChevronsUpDown, FileBarChart2, FolderOpen, Gauge,
  History, LayoutGrid, LogOut, Menu, Moon, Plus, Rows3, Search, Settings, ShieldCheck,
  Sun, TrendingUp, Truck, Users, Wrench, X,
} from "lucide-react";
import { Toaster } from "sonner";
import { useTheme } from "next-themes";
import { useAuth } from "@/context/AuthContext";
import { useBuilding } from "@/context/BuildingContext";
import { api } from "@/lib/api";
import { useSettings } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { AddBuildingModal } from "./AddBuildingModal";
import { PriorityChip } from "./kit";
import { LiveDot, ToneBadge } from "./ui";

const NAV = [
  { label: "Overview", to: "/app", icon: Gauge, end: true },
  { label: "Building Profile", to: "/app/profile", icon: Building2 },
  { label: "Financials", to: "/app/financials", icon: TrendingUp },
  { label: "Rent Roll", to: "/app/rent-roll", icon: Rows3 },
  { label: "Tenants & Units", to: "/app/tenants", icon: Users },
  { label: "Work Orders", to: "/app/work-orders", icon: Wrench },
  { label: "Compliance", to: "/app/compliance", icon: ShieldCheck },
  { label: "Vendors", to: "/app/vendors", icon: Truck },
  { label: "Documents", to: "/app/documents", icon: FolderOpen },
  { label: "Reports", to: "/app/reports", icon: FileBarChart2 },
  { label: "Activity", to: "/app/activity", icon: History },
  { label: "Settings", to: "/app/settings", icon: Settings },
];

export const RequireAuth = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <div className="flex items-center gap-3">
          <span className="h-4 w-[3px] bg-gold animate-pulse-dot" aria-hidden="true" />
          <span className="font-serif text-xl text-strong">Obelix</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  return children;
};

const useOutside = (ref, onAway) => {
  useEffect(() => {
    const fn = (e) => ref.current && !ref.current.contains(e.target) && onAway();
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [ref, onAway]);
};

// ------------------------------------------------------------- building selector
const BuildingSelector = ({ onAdd }) => {
  const { buildings, selectedId, setSelectedId, selected, isPortfolio, recentIds } = useBuilding();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));

  const filtered = buildings.filter((b) =>
    `${b.label} ${b.street || ""} ${b.borough || ""}`.toLowerCase().includes(q.toLowerCase()),
  );
  const recents = recentIds.map((id) => buildings.find((b) => b.id === id)).filter(Boolean).filter((b) => b.id !== selectedId);

  const pick = (id) => {
    setSelectedId(id);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="building-selector"
        className="flex max-w-[52vw] items-center gap-2.5 border border-line bg-surface/60 px-3 py-1.5 text-left transition-colors hover:border-line-strong sm:max-w-none"
      >
        {isPortfolio ? <LayoutGrid size={13} strokeWidth={1.5} className="shrink-0 text-gold" /> : <Building2 size={13} strokeWidth={1.5} className="shrink-0 text-gold" />}
        <span className="min-w-0">
          {/* full address, never abbreviated except on very narrow screens */}
          <span className="block truncate text-[12.5px] font-medium text-strong sm:overflow-visible sm:text-clip">
            {isPortfolio ? "All buildings" : selected?.label || "Select building"}
          </span>
          <span className="block truncate text-[10px] text-dim sm:overflow-visible sm:text-clip">
            {isPortfolio ? `Portfolio · ${buildings.length}` : selected?.borough || ""}
          </span>
        </span>
        <ChevronsUpDown size={13} strokeWidth={1.5} className="ml-1 shrink-0 text-dim" />
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-[70] mt-1 w-[340px] max-w-[92vw] -translate-x-1/2 border border-line bg-surface shadow-pop">
          <div className="border-b border-line p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or address…"
              className="w-full border border-line bg-panel px-3 py-2 text-[12.5px] text-strong placeholder:text-faint outline-none focus:border-gold/70"
            />
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            <button
              type="button"
              onClick={() => pick("portfolio")}
              className={cn("flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-tint/[0.04]", isPortfolio && "bg-gold/[0.06]")}
            >
              <LayoutGrid size={13} strokeWidth={1.5} className="text-gold" />
              <span className="text-[12.5px] text-body">Portfolio — all buildings</span>
            </button>
            {recents.length > 0 && !q && (
              <>
                <p className="label-xs px-3.5 pb-1 pt-2.5">Recent</p>
                {recents.map((b) => (
                  <button key={`r-${b.id}`} type="button" onClick={() => pick(b.id)} className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left transition-colors hover:bg-tint/[0.04]">
                    <span className="truncate text-[12.5px] text-body">{b.label}</span>
                    <span className="label-xs shrink-0">{b.borough}</span>
                  </button>
                ))}
              </>
            )}
            <p className="label-xs px-3.5 pb-1 pt-2.5">{q ? "Matches" : "All buildings"}</p>
            {filtered.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => pick(b.id)}
                className={cn("flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left transition-colors hover:bg-tint/[0.04]", b.id === selectedId && "bg-gold/[0.06]")}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] text-body">{b.label}</span>
                  <span className="block text-[10px] text-dim">
                    {b.borough} · {(b.summary || {}).hpd_open ?? 0} open HPD
                  </span>
                </span>
                {(b.summary || {}).hpd_by_class?.C ? <ToneBadge tone="urgent">{b.summary.hpd_by_class.C} C</ToneBadge> : null}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3.5 py-3 text-[12px] text-dim">No buildings match.</p>}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onAdd();
            }}
            className="flex w-full items-center gap-2 border-t border-line px-3.5 py-2.5 text-[12.5px] font-medium text-gold transition-colors hover:bg-gold/[0.06]"
          >
            <Plus size={13} strokeWidth={1.75} /> Add new building
          </button>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------- global search
const GlobalSearch = () => {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { setSelectedId } = useBuilding();
  useOutside(ref, () => setOpen(false));

  const { data } = useQuery({
    queryKey: ["search", q],
    queryFn: () => api.get("/search", { params: { q } }).then((r) => r.data),
    enabled: q.trim().length >= 2,
  });

  const go = (r) => {
    if (r.building_id) setSelectedId(r.building_id);
    const dest = { building: "/app", tenant: "/app/tenants", unit: "/app/tenants", work_order: "/app/work-orders", vendor: "/app/vendors", document: "/app/documents" }[r.type] || "/app";
    navigate(dest);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={ref} className="relative hidden min-w-0 max-w-[280px] flex-1 md:block">
      <Search size={13} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search tenants, units, work orders…"
        className="w-full border border-line bg-panel py-1.5 pl-9 pr-3 text-[12px] text-strong placeholder:text-faint outline-none transition-colors focus:border-gold/60"
      />
      {open && q.trim().length >= 2 && (data?.results?.length || 0) > 0 && (
        <ul className="absolute right-0 top-full z-[70] mt-1 w-[320px] border border-line bg-surface shadow-pop">
          {data.results.map((r) => (
            <li key={`${r.type}-${r.id}`}>
              <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left transition-colors hover:bg-tint/[0.04]">
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] text-body">{r.label}</span>
                  <span className="block truncate text-[10px] text-dim">{r.sub}</span>
                </span>
                <span className="label-xs shrink-0 text-faint">{r.type.replace("_", " ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ------------------------------------------------------------- notifications
const Notifications = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setSelectedId } = useBuilding();
  useOutside(ref, () => setOpen(false));

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications").then((r) => r.data),
    refetchInterval: 120_000,
  });

  const dismiss = async (key) => {
    await api.post("/notifications/dismiss", { key });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markAllRead = async () => {
    await api.post("/notifications/dismiss-all");
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const go = (n) => {
    if (n.building_id) setSelectedId(n.building_id);
    navigate(`/app/${n.tab === "overview" ? "" : n.tab}`);
    setOpen(false);
  };

  const unread = data?.unread || 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center border border-line text-mid transition-colors hover:border-line-strong hover:text-strong"
        aria-label="Notifications"
      >
        <Bell size={14} strokeWidth={1.5} />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center bg-gold px-1 text-[9px] font-semibold text-ink">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-[70] mt-1 w-[380px] border border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <span className="text-[13px] font-medium text-strong">Notifications</span>
            <span className="flex items-center gap-3">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[11px] font-medium text-gold transition-colors hover:text-gold-hover"
                >
                  Mark all read
                </button>
              )}
              <span className="label-xs">{unread} unread</span>
            </span>
          </div>
          <ul className="max-h-[380px] divide-y divide-line/70 overflow-y-auto">
            {[...(data?.items || [])].sort((a, b) => (a.read ? 1 : 0) - (b.read ? 1 : 0)).slice(0, 20).map((n) => (
              <li key={n.key} className={cn("flex items-start gap-2 px-4 py-2.5", n.read && "opacity-50")}>
                <button type="button" onClick={() => go(n)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[12.5px] text-body">{n.title}</p>
                  <p className="mt-0.5 truncate text-[10.5px] text-dim">
                    {n.building ? `${n.building} · ` : ""}{n.sub}
                  </p>
                  <p className="mt-1 text-[10px] text-gold/80">{n.action}</p>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <PriorityChip p={n.priority} />
                  {!n.read && (
                    <button type="button" onClick={() => dismiss(n.key)} className="label-xs text-faint hover:text-mid">
                      mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
            {(data?.items || []).length === 0 && <li className="px-4 py-8 text-center text-[12px] text-dim">All clear.</li>}
          </ul>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------- theme toggle
const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const light = resolvedTheme === "light";
  const label = light ? "Switch to dark mode" : "Switch to light mode";
  return (
    <button
      type="button"
      onClick={() => setTheme(light ? "dark" : "light")}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center border border-line text-mid transition-colors hover:border-line-strong hover:text-strong"
    >
      {light ? <Moon size={14} strokeWidth={1.5} /> : <Sun size={14} strokeWidth={1.5} />}
    </button>
  );
};

// ------------------------------------------------------------- shell
export const Shell = () => {
  const { user, signOut } = useAuth();
  const { data: settings } = useSettings();
  const { resolvedTheme } = useTheme();
  const [addOpen, setAddOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const { data: notif } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications").then((r) => r.data),
    refetchInterval: 120_000,
  });
  const tasksWaiting = (notif?.items || []).filter((i) => i.priority === 3 && !i.read).length;

  useEffect(() => setMobileNav(false), [pathname]);

  const initials = (user?.name || user?.email || "?")
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-ink">
      <Toaster
        theme={resolvedTheme === "light" ? "light" : "dark"}
        position="bottom-right"
        toastOptions={{ style: { background: "rgb(var(--surface))", border: "1px solid rgb(var(--line))", color: "rgb(var(--text-body))", borderRadius: 0 } }}
      />

      {/* sidebar */}
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-0 z-[60] w-56 border-r border-line bg-sidebar transition-transform lg:translate-x-0",
          mobileNav ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Link to="/app" className="flex h-14 items-center gap-2 border-b border-line px-5" aria-label="Obelix — overview">
          <span className="h-4 w-[3px] bg-gold" aria-hidden="true" />
          <span className="font-serif text-[20px] leading-none tracking-[0.02em] text-strong">Obelix</span>
          <span className="label-xs ml-1 text-faint">OS</span>
        </Link>
        <nav aria-label="Primary" className="flex flex-col gap-0.5 overflow-y-auto p-3" style={{ height: "calc(100% - 3.5rem - 3rem)" }}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 border-l-2 px-3 py-2 text-[12.5px] font-medium transition-colors",
                  isActive
                    ? "border-gold bg-gold/[0.07] text-strong"
                    : "border-transparent text-mid hover:bg-tint/[0.03] hover:text-strong",
                )
              }
            >
              <n.icon size={14} strokeWidth={1.5} className="shrink-0" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 flex h-12 items-center justify-between border-t border-line px-5">
          <LiveDot label="NYC Open Data" />
        </div>
      </aside>
      {mobileNav && <div className="fixed inset-0 z-[55] bg-black/60 lg:hidden" onClick={() => setMobileNav(false)} />}

      {/* topbar */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-line bg-ink/95 backdrop-blur-md lg:left-56">
        {/* side columns may shrink below their content so the centre stays centred */}
        <div className="grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileNav(true)} className="flex h-8 w-8 items-center justify-center border border-line text-mid lg:hidden" aria-label="Open menu">
              <Menu size={15} strokeWidth={1.5} />
            </button>
            <span className="label-xs hidden xl:block max-w-[140px] truncate text-dim">
              {settings?.company_name || user?.company || "Portfolio"}
            </span>
          </div>
          <div className="flex min-w-0 justify-center">
            <BuildingSelector onAdd={() => setAddOpen(true)} />
          </div>
          <div className="flex items-center justify-end gap-2.5">
            <GlobalSearch />
            <ThemeToggle />
            <button
              type="button"
              onClick={() => navigate("/app/work-orders")}
              title="Tasks requiring attention"
              className="relative flex h-8 w-8 items-center justify-center border border-line text-mid transition-colors hover:border-line-strong hover:text-strong"
            >
              <CheckSquare size={14} strokeWidth={1.5} />
              {tasksWaiting > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center bg-strong px-1 text-[9px] font-semibold text-ink">{tasksWaiting}</span>
              )}
            </button>
            <Notifications />
            <ProfileMenu initials={initials} email={user?.email} onSignOut={signOut} />
          </div>
        </div>
      </header>

      <main className="pt-14 lg:pl-56">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-7 sm:px-6 lg:px-8">
          <Outlet context={{ openAddBuilding: () => setAddOpen(true) }} />
        </div>
      </main>

      <AddBuildingModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
};

const ProfileMenu = ({ initials, email, onSignOut }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useOutside(ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center border border-gold/40 bg-gold/10 text-[11px] font-semibold text-gold transition-colors hover:bg-gold/20"
        aria-label="Profile"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-[70] mt-1 w-[220px] border border-line bg-surface shadow-pop">
          <p className="truncate border-b border-line px-4 py-2.5 text-[11px] text-mid">{email}</p>
          <button
            type="button"
            onClick={() => {
              navigate("/app/settings");
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[12.5px] text-body transition-colors hover:bg-tint/[0.04]"
          >
            <Settings size={13} strokeWidth={1.5} /> Settings
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-[12.5px] text-body transition-colors hover:bg-tint/[0.04]"
          >
            <LogOut size={13} strokeWidth={1.5} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
};

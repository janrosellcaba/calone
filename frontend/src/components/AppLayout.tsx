import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-full px-3.5 py-1.5 text-[13px] font-medium tracking-tight transition",
    isActive
      ? "bg-white/70 text-[#1d1d1f] shadow-sm ring-1 ring-white/80"
      : "text-[#1d1d1f]/65 hover:bg-white/40 hover:text-[#1d1d1f]",
  ].join(" ");

const tabClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-tight",
    isActive ? "text-[#007aff]" : "text-[#1d1d1f]/40",
  ].join(" ");

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 9h18" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.6M17.5 16.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.6M17.5 7.1l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AppLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const isCalendar = location.pathname === "/";

  return (
    <div className="relative flex h-svh flex-col overflow-hidden text-[#1d1d1f]">
      <div className="pointer-events-none absolute inset-0 apple-mesh" />

      <header className="relative z-20 shrink-0 border-b border-white/40 bg-white/35 pt-[env(safe-area-inset-top)] backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-2.5">
          <span className="text-[21px] font-semibold tracking-tight">Calone</span>
          <nav className="hidden items-center gap-1 rounded-full bg-black/5 p-1 ring-1 ring-white/50 md:flex">
            <NavLink to="/" end className={desktopLinkClass}>
              Calendar
            </NavLink>
            <NavLink to="/settings" className={desktopLinkClass}>
              Settings
            </NavLink>
          </nav>
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Log out"
            title="Log out"
            className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#1d1d1f]/55 hover:bg-white/50"
          >
            {user?.username ?? "Log out"}
          </button>
        </div>
      </header>

      <main
        className={
          isCalendar
            ? "relative z-10 min-h-0 flex-1 overflow-hidden p-2 pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:p-3 md:pb-3"
            : "relative z-10 min-h-0 flex-1 overflow-auto p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6"
        }
      >
        <Outlet />
      </main>

      <nav className="glass-panel absolute inset-x-3 bottom-[max(0.65rem,env(safe-area-inset-bottom))] z-30 flex rounded-[22px] p-1 md:hidden">
        <NavLink to="/" end className={tabClass}>
          <CalendarIcon />
          Calendar
        </NavLink>
        <NavLink to="/settings" className={tabClass}>
          <SettingsIcon />
          Settings
        </NavLink>
      </nav>
    </div>
  );
}

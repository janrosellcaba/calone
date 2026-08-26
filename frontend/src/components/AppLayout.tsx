import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-stone-800 text-stone-50"
      : "text-stone-600 hover:bg-stone-200 hover:text-stone-900",
  ].join(" ");

export function AppLayout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-svh bg-stone-100 text-stone-900">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl tracking-tight text-stone-900">
              Calone
            </span>
            <span className="text-xs text-stone-500">calendarios unificados</span>
          </div>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={linkClass}>
              Calendario
            </NavLink>
            <NavLink to="/integrations" className={linkClass}>
              Integraciones
            </NavLink>
            <button
              type="button"
              onClick={() => void logout()}
              className="ml-2 rounded-md px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200 hover:text-stone-900"
            >
              Salir
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

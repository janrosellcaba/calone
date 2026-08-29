import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ApiError } from "../api/client";
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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className={`text-[#1d1d1f]/40 transition ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 4H7.5A2.5 2.5 0 0 0 5 6.5v11A2.5 2.5 0 0 0 7.5 20H10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10 12h9M16 8l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4.5 7h15M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7M6.5 7l.8 12.2A1.5 1.5 0 0 0 8.8 20.5h6.4a1.5 1.5 0 0 0 1.5-1.3L17.5 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const DELETE_STEPS = [
  {
    title: "Delete Account?",
    body: "This will permanently remove your Calone account.",
    confirm: "Continue",
  },
  {
    title: "Are you sure?",
    body: "Connected Google and Microsoft calendars will be disconnected. This cannot be undone.",
    confirm: "Continue",
  },
  {
    title: "Last chance",
    body: "Delete this account now? There is no going back.",
    confirm: "Delete Account",
  },
] as const;

function DeleteAccountDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = DELETE_STEPS[step] ?? DELETE_STEPS[0];
  const last = step === DELETE_STEPS.length - 1;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);

  async function confirm() {
    if (!last) {
      setError(null);
      setStep((prev) => prev + 1);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not delete the account",
      );
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Cancel"
        disabled={busy}
        onClick={onCancel}
        className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className="relative w-full max-w-[320px] overflow-hidden rounded-[22px] bg-white/86 p-5 shadow-[0_24px_80px_rgba(30,55,90,0.28)] ring-1 ring-white/90 backdrop-blur-2xl backdrop-saturate-150"
      >
        <h2
          id="delete-account-title"
          className="text-center text-[17px] font-semibold tracking-tight"
        >
          {current.title}
        </h2>
        <p className="mt-2 text-center text-[13px] leading-snug text-[#1d1d1f]/55">
          {current.body}
        </p>
        {error ? (
          <p className="mt-3 text-center text-[13px] text-[#ff3b30]" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            className={`min-h-11 rounded-full text-[15px] font-semibold disabled:opacity-60 ${
              last
                ? "bg-[#ff3b30] text-white"
                : "bg-[#007aff] text-white"
            }`}
          >
            {busy ? "Deleting…" : current.confirm}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 rounded-full bg-black/5 text-[15px] font-semibold text-[#1d1d1f] disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function AccountMenu({
  username,
  onLogout,
  onDeleteAccount,
}: {
  username: string;
  onLogout: () => void;
  onDeleteAccount: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const initial = (username.trim()[0] ?? "?").toUpperCase();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-full py-0.5 pr-1.5 pl-0.5 text-[13px] font-medium text-[#1d1d1f]/70 transition hover:bg-white/50"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-[#007aff] text-[12px] font-semibold text-white shadow-sm">
          {initial}
        </span>
        <span className="hidden max-w-[8rem] truncate sm:inline">{username}</span>
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[220px] overflow-hidden rounded-2xl bg-white/78 p-1.5 shadow-[0_12px_40px_rgba(30,55,90,0.16)] ring-1 ring-white/80 backdrop-blur-2xl backdrop-saturate-150"
        >
          <p className="truncate px-3 py-2 text-[12px] font-medium text-[#1d1d1f]/40">
            {username}
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2 text-left text-[14px] font-medium text-[#1d1d1f]/80 transition hover:bg-black/5"
          >
            <LogoutIcon />
            Sign Out
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDeleteAccount();
            }}
            className="flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2 text-left text-[14px] font-medium text-[#ff3b30] transition hover:bg-[#ff3b30]/8"
          >
            <TrashIcon />
            Delete Account
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AppLayout() {
  const { logout, deleteAccount, user } = useAuth();
  const location = useLocation();
  const isCalendar = location.pathname === "/";
  const [confirmDelete, setConfirmDelete] = useState(false);

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
          {user ? (
            <AccountMenu
              username={user.username}
              onLogout={() => void logout()}
              onDeleteAccount={() => setConfirmDelete(true)}
            />
          ) : null}
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

      {confirmDelete ? (
        <DeleteAccountDialog
          onCancel={() => setConfirmDelete(false)}
          onConfirm={deleteAccount}
        />
      ) : null}
    </div>
  );
}

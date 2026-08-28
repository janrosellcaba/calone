import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import { APPLE_CALENDAR_COLORS } from "../theme/appleColors";
import type {
  CalendarAccountSummary,
  CalendarSource,
  SubCalendarSummary,
} from "../types/events";

type AccountsResponse = {
  accounts: CalendarAccountSummary[];
};

type PatchResponse = {
  calendar: SubCalendarSummary;
};

type SyncResponse = {
  calendars: SubCalendarSummary[];
};

const PROVIDER_LABEL: Record<CalendarSource, string> = {
  GOOGLE: "Google",
  MICROSOFT: "Microsoft",
};

function providerLabel(provider: CalendarSource) {
  return PROVIDER_LABEL[provider] ?? provider;
}

function toColorInputValue(hex: string) {
  const v = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  }
  return "#78716c";
}

function updateSubCalendarInAccounts(
  accounts: CalendarAccountSummary[],
  accountId: string,
  calendarId: string,
  patch: Partial<SubCalendarSummary>,
): CalendarAccountSummary[] {
  return accounts.map((account) => {
    if (account.id !== accountId) return account;
    return {
      ...account,
      subCalendars: account.subCalendars.map((calendar) =>
        calendar.id === calendarId ? { ...calendar, ...patch } : calendar,
      ),
    };
  });
}

function SubCalendarRow({
  calendar,
  onPatched,
  onError,
}: {
  calendar: SubCalendarSummary;
  onPatched: (updated: SubCalendarSummary) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(calendar.name);
  const nameRef = useRef(calendar.name);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    setName(calendar.name);
    nameRef.current = calendar.name;
  }, [calendar.name]);

  async function patch(
    body: Partial<Pick<SubCalendarSummary, "name" | "color" | "isActive">>,
  ) {
    const result = await apiFetch<PatchResponse>(
      `/subcalendars/${calendar.id}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    );
    onPatched(result.calendar);
    return result.calendar;
  }

  async function onToggle(event: ChangeEvent<HTMLInputElement>) {
    const isActive = event.target.checked;
    onPatched({ ...calendar, isActive });
    try {
      await patch({ isActive });
    } catch (err) {
      onPatched({ ...calendar, isActive: calendar.isActive });
      onError(
        err instanceof ApiError
          ? err.message
          : "No se pudo actualizar el calendario",
      );
    }
  }

  async function applyColor(color: string) {
    onPatched({ ...calendar, color });
    try {
      await patch({ color });
    } catch (err) {
      onPatched({ ...calendar, color: calendar.color });
      onError(
        err instanceof ApiError
          ? err.message
          : "No se pudo actualizar el color",
      );
    }
  }

  function scheduleNameSave(nextName: string) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void saveName(nextName);
    }, 400);
  }

  async function saveName(nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === nameRef.current) return;
    try {
      const updated = await patch({ name: trimmed });
      nameRef.current = updated.name;
    } catch (err) {
      setName(nameRef.current);
      onError(
        err instanceof ApiError
          ? err.message
          : "No se pudo renombrar el calendario",
      );
    }
  }

  const current = toColorInputValue(calendar.color);

  return (
    <li className="flex flex-col gap-2 border-t border-white/40 py-3 first:border-t-0 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <label className="inline-flex cursor-pointer items-center">
          <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={calendar.isActive}
              onChange={onToggle}
              aria-label={`Mostrar ${calendar.name}`}
            />
            <span className="h-5 w-9 rounded-full bg-black/15 transition peer-checked:bg-[#34c759] peer-focus-visible:ring-2 peer-focus-visible:ring-[#007aff]/40" />
            <span className="absolute left-0.5 size-4 rounded-full bg-white shadow-sm transition peer-checked:translate-x-4" />
          </span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            scheduleNameSave(event.target.value);
          }}
          onBlur={() => void saveName(name)}
          className="glass-input min-w-0 flex-1 rounded-xl px-3 py-2 text-[16px] text-[#1d1d1f] outline-none focus:ring-2 focus:ring-[#007aff]/25 sm:text-[14px]"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-12 sm:pl-0">
        {APPLE_CALENDAR_COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`Usar color ${swatch}`}
            onClick={() => void applyColor(swatch)}
            className="size-5 rounded-full ring-2 ring-white/70 transition hover:scale-110"
            style={{
              backgroundColor: swatch,
              boxShadow:
                current === swatch.toLowerCase()
                  ? "0 0 0 2px #1d1d1f"
                  : "none",
            }}
          />
        ))}
        <label className="relative size-5 overflow-hidden rounded-full ring-2 ring-white/70">
          <span className="pointer-events-none absolute inset-0 rounded-full bg-[conic-gradient(#007aff,#34c759,#ff9f0a,#ff375f,#af52de,#007aff)]" />
          <input
            type="color"
            value={current}
            onChange={(event) => void applyColor(event.target.value)}
            aria-label={`Color personalizado de ${calendar.name}`}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </li>
  );
}

export function IntegrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<CalendarAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const oauthError = searchParams.get("error");

    if (connected === "google") {
      setBanner("Cuenta de Google conectada correctamente.");
    } else if (connected === "microsoft") {
      setBanner("Cuenta de Microsoft conectada correctamente.");
    } else if (oauthError) {
      const detail = searchParams.get("detail");
      const provider =
        oauthError.startsWith("microsoft") ? "Microsoft" : "Google";
      setBanner(
        detail
          ? `No se pudo conectar con ${provider}: ${detail}`
          : `No se pudo conectar con ${provider}.`,
      );
    }

    if (connected || oauthError) {
      const next = new URLSearchParams(searchParams);
      next.delete("connected");
      next.delete("error");
      next.delete("detail");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadAccounts() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<AccountsResponse>("/accounts");
        if (!cancelled) {
          setAccounts(data.accounts);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "No se pudieron cargar las cuentas",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAccounts();
    return () => {
      cancelled = true;
    };
  }, []);

  function applySubCalendarPatch(
    accountId: string,
    updated: SubCalendarSummary,
  ) {
    setAccounts((prev) =>
      updateSubCalendarInAccounts(prev, accountId, updated.id, updated),
    );
  }

  async function disconnectAccount(id: string) {
    setDisconnectingId(id);
    setError(null);
    try {
      await apiFetch<void>(`/accounts/${id}`, { method: "DELETE" });
      setAccounts((prev) => prev.filter((account) => account.id !== id));
      setBanner("Cuenta desconectada.");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo desconectar la cuenta",
      );
    } finally {
      setDisconnectingId(null);
    }
  }

  async function syncAccount(id: string) {
    setSyncingId(id);
    setError(null);
    try {
      const result = await apiFetch<SyncResponse>(
        `/accounts/${id}/sync-calendars`,
        { method: "POST" },
      );
      setAccounts((prev) =>
        prev.map((account) =>
          account.id === id
            ? { ...account, subCalendars: result.calendars }
            : account,
        ),
      );
      setBanner("Calendarios sincronizados.");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudieron sincronizar los calendarios",
      );
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-[28px] font-semibold tracking-tight">Calendarios</h1>
        <p className="text-sm text-[#1d1d1f]/50">
          Elige qué calendarios ver y con qué color.
        </p>
      </div>

      {banner ? (
        <p className="glass-panel px-4 py-3 text-sm text-[#1d1d1f]/80" role="status">
          {banner}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="glass-panel p-4 sm:p-5">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#1d1d1f]/40">
          Conectar
        </h2>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/oauth/google/start"
            className="inline-flex min-h-11 items-center rounded-full bg-[#007aff] px-4 text-[15px] font-semibold text-white shadow-sm"
          >
            Conectar Google
          </a>
          <a
            href="/api/oauth/microsoft/start"
            className="inline-flex min-h-11 items-center rounded-full bg-white/55 px-4 text-[15px] font-semibold text-[#1d1d1f] ring-1 ring-white/80"
          >
            Conectar Microsoft
          </a>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#1d1d1f]/40">
          Cuentas
        </h2>

        {loading ? (
          <p className="text-sm text-[#1d1d1f]/45">Cargando cuentas…</p>
        ) : accounts.length === 0 ? (
          <p className="glass-panel px-4 py-5 text-sm text-[#1d1d1f]/45">
            Todavía no hay cuentas conectadas.
          </p>
        ) : (
          <ul className="space-y-4">
            {accounts.map((account) => (
              <li key={account.id} className="glass-panel overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">
                      {account.displayName ?? account.email ?? "Sin nombre"}
                    </p>
                    <p className="truncate text-[13px] text-[#1d1d1f]/45">
                      {providerLabel(account.provider)}
                      {account.email ? ` · ${account.email}` : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={syncingId === account.id}
                      onClick={() => void syncAccount(account.id)}
                      className="min-h-10 rounded-full px-3 text-[13px] font-medium text-[#007aff] disabled:opacity-60"
                    >
                      {syncingId === account.id
                        ? "Sincronizando…"
                        : "Sincronizar"}
                    </button>
                    <button
                      type="button"
                      disabled={disconnectingId === account.id}
                      onClick={() => void disconnectAccount(account.id)}
                      className="min-h-10 rounded-full px-3 text-[13px] font-medium text-[#ff3b30] disabled:opacity-60"
                    >
                      {disconnectingId === account.id
                        ? "…"
                        : "Desconectar"}
                    </button>
                  </div>
                </div>

                <div className="border-t border-white/50 px-4 pb-1">
                  {!account.subCalendars || account.subCalendars.length === 0 ? (
                    <p className="py-3 text-sm text-[#1d1d1f]/45">
                      No hay calendarios. Pulsa Sincronizar.
                    </p>
                  ) : (
                    <ul>
                      {account.subCalendars.map((calendar) => (
                        <SubCalendarRow
                          key={calendar.id}
                          calendar={calendar}
                          onPatched={(updated) =>
                            applySubCalendarPatch(account.id, updated)
                          }
                          onError={setError}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

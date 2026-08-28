import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type { CalendarAccountSummary, CalendarSource } from "../types/events";

type AccountsResponse = {
  accounts: CalendarAccountSummary[];
};

const PROVIDER_LABEL: Record<CalendarSource, string> = {
  GOOGLE: "Google",
  MICROSOFT: "Microsoft",
};

function providerLabel(provider: CalendarSource) {
  return PROVIDER_LABEL[provider] ?? provider;
}

export function IntegrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<CalendarAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
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

  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl tracking-tight">Integraciones</h1>
        <p className="text-stone-600">
          Conecta cuentas de calendario para unificar eventos en Calone.
        </p>
      </div>

      {banner ? (
        <p
          className="rounded-md border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700"
          role="status"
        >
          {banner}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
          Conectar
        </h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/oauth/google/start"
            className="inline-flex rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-stone-800"
          >
            Conectar Google
          </a>
          <a
            href="/api/oauth/microsoft/start"
            className="inline-flex rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-50"
          >
            Conectar Microsoft
          </a>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
          Cuentas conectadas
        </h2>

        {loading ? (
          <p className="text-sm text-stone-500">Cargando cuentas…</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-stone-500">
            Todavía no hay cuentas conectadas.
          </p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-900">
                    {account.displayName ?? account.email ?? "Sin nombre"}
                  </p>
                  <p className="truncate text-sm text-stone-500">
                    {providerLabel(account.provider)}
                    {account.email ? ` · ${account.email}` : null}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={disconnectingId === account.id}
                  onClick={() => void disconnectAccount(account.id)}
                  className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-60"
                >
                  {disconnectingId === account.id
                    ? "Desconectando…"
                    : "Desconectar"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

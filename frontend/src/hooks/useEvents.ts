import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "../api/client";
import type { EventsResponse } from "../types/events";

export function useEvents(from: string, to: string) {
  const [data, setData] = useState<EventsResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(from && to));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!from || !to) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ from, to });
        const result = await apiFetch<EventsResponse>(
          `/events?${params.toString()}`,
        );
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(
            err instanceof ApiError
              ? err.message
              : "No se pudieron cargar los eventos",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  return {
    events: data?.events ?? [],
    errors: data?.errors ?? [],
    loading,
    error,
  };
}

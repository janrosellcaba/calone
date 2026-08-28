import { useMemo, useState } from "react";
import type {
  DatesSetArg,
  EventClickArg,
  EventInput,
} from "@fullcalendar/core";
import esLocale from "@fullcalendar/core/locales/es";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useEvents } from "../hooks/useEvents";
import type { UnifiedEvent } from "../types/events";

type DateRange = {
  from: string;
  to: string;
};

function toCalendarEvents(events: UnifiedEvent[]): EventInput[] {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    url: event.originalUrl,
    backgroundColor: event.color,
    borderColor: event.color,
    textColor: "#ffffff",
    extendedProps: {
      source: event.source,
      accountEmail: event.accountEmail,
    },
  }));
}

export function CalendarPage() {
  const [range, setRange] = useState<DateRange | null>(null);
  const { events, errors, loading, error } = useEvents(
    range?.from ?? "",
    range?.to ?? "",
  );

  const calendarEvents = useMemo(() => toCalendarEvents(events), [events]);

  function onDatesSet(arg: DatesSetArg) {
    const next = {
      from: arg.start.toISOString(),
      to: arg.end.toISOString(),
    };
    setRange((prev) => {
      if (prev && prev.from === next.from && prev.to === next.to) {
        return prev;
      }
      return next;
    });
  }

  function onEventClick(arg: EventClickArg) {
    arg.jsEvent.preventDefault();
    const url = arg.event.url;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl tracking-tight">Calendario</h1>
          <p className="text-sm text-stone-600">
            Vista unificada. Clic en un evento para abrirlo en el proveedor.
          </p>
        </div>
        {loading ? (
          <p className="text-xs text-stone-500">Actualizando…</p>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {errors.length > 0 ? (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          Algunas cuentas no respondieron:{" "}
          {errors
            .map(
              (item) =>
                `${item.email ?? item.accountId} (${item.provider}): ${item.message}`,
            )
            .join(" · ")}
        </div>
      ) : null}

      <div className="calone-calendar overflow-hidden rounded-lg border border-stone-200 bg-white p-3 sm:p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={esLocale}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          buttonText={{
            today: "Hoy",
            month: "Mes",
            week: "Semana",
            day: "Día",
          }}
          height="auto"
          editable={false}
          selectable={false}
          nowIndicator
          dayMaxEvents={3}
          events={calendarEvents}
          datesSet={onDatesSet}
          eventClick={onEventClick}
        />
      </div>
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DatesSetArg,
  EventClickArg,
  EventInput,
} from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useEvents } from "../hooks/useEvents";
import { useMediaQuery } from "../hooks/useMediaQuery";
import type { UnifiedEvent } from "../types/events";

type DateRange = {
  from: string;
  to: string;
};

const SCROLL_TIME = "08:00:00";

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
  const calendarRef = useRef<FullCalendar>(null);
  const isPhone = useMediaQuery("(max-width: 767px)");
  const [range, setRange] = useState<DateRange | null>(null);
  const { events, errors, loading, error } = useEvents(
    range?.from ?? "",
    range?.to ?? "",
  );

  const calendarEvents = useMemo(() => toCalendarEvents(events), [events]);

  function scrollToMorning() {
    requestAnimationFrame(() => {
      calendarRef.current?.getApi().scrollToTime(SCROLL_TIME);
    });
  }

  useEffect(() => {
    scrollToMorning();
  }, [calendarEvents]);

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
    scrollToMorning();
  }

  function onEventClick(arg: EventClickArg) {
    arg.jsEvent.preventDefault();
    const url = arg.event.url;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      {error ? (
        <p className="glass-panel px-4 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {errors.length > 0 ? (
        <div
          className="glass-panel px-4 py-2 text-sm text-[#1d1d1f]/70"
          role="status"
        >
          Some accounts did not respond:{" "}
          {errors
            .map(
              (item) =>
                `${item.email ?? item.accountId} (${item.provider}): ${item.message}`,
            )
            .join(" · ")}
        </div>
      ) : null}

      <div className="calone-calendar glass-panel relative min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
        {loading ? (
          <p className="absolute right-4 top-3 z-10 text-[12px] font-medium text-[#1d1d1f]/45">
            Updating…
          </p>
        ) : null}
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale="en"
          firstDay={1}
          headerToolbar={
            isPhone
              ? { left: "prev,next", center: "title", right: "today" }
              : {
                  left: "prev,today,next",
                  center: "title",
                  right: "timeGridWeek,timeGridDay,dayGridMonth",
                }
          }
          footerToolbar={
            isPhone
              ? { center: "timeGridWeek,timeGridDay,dayGridMonth" }
              : undefined
          }
          height="100%"
          stickyHeaderDates
          editable={false}
          selectable={false}
          nowIndicator
          allDaySlot
          dayMaxEvents={false}
          eventMaxStack={24}
          slotEventOverlap
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          scrollTime={SCROLL_TIME}
          scrollTimeReset={false}
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          slotLabelFormat={{
            hour: "numeric",
            minute: "2-digit",
            hour12: false,
          }}
          eventTimeFormat={{
            hour: "numeric",
            minute: "2-digit",
            hour12: false,
          }}
          displayEventEnd
          weekends
          events={calendarEvents}
          datesSet={onDatesSet}
          eventClick={onEventClick}
        />
      </div>
    </section>
  );
}

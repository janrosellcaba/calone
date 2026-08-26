export type CalendarSource = "GOOGLE" | "MICROSOFT";
export interface UnifiedEvent {
    id: string;
    title: string;
    start: string;
    end: string;
    allDay: boolean;
    source: CalendarSource;
    accountId: string;
    accountEmail?: string;
    originalUrl: string;
    location?: string;
    description?: string;
}
//# sourceMappingURL=events.d.ts.map
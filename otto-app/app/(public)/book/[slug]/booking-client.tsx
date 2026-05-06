"use client";

import { useState, useTransition } from "react";
import {
  CalendarDays,
  Clock,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { createBooking } from "./book-action";
import type { BookingTypePublic } from "./book-action";

type BusyInterval = { start: Date; end: Date };

type Props = {
  bookingType: BookingTypePublic;
  busySlots: string[]; // "ISO|ISO" pairs
};

const HE_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const HE_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

function formatDateHe(date: Date): string {
  return `${date.getDate()} ב${HE_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTimeHe(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function isBusy(slotStart: Date, slotEnd: Date, busyIntervals: BusyInterval[]): boolean {
  return busyIntervals.some((b) => slotStart < b.end && slotEnd > b.start);
}

function buildTimeSlots(date: Date, durationMinutes: number, busyIntervals: BusyInterval[]) {
  const slots: { time: Date; available: boolean }[] = [];
  const start = new Date(date);
  start.setHours(9, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(18, 0, 0, 0);

  const now = new Date();

  while (start < endOfDay) {
    const slotEnd = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const available = slotEnd <= endOfDay && start > now && !isBusy(start, slotEnd, busyIntervals);
    slots.push({ time: new Date(start), available });
    start.setMinutes(start.getMinutes() + 30);
  }
  return slots;
}

function buildNext14Days(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    // דלג על שישי / שבת
    if (d.getDay() !== 5 && d.getDay() !== 6) {
      days.push(d);
    }
  }
  return days;
}

type Step = "date" | "time" | "details" | "success";

export function BookingClient({ bookingType, busySlots }: Props) {
  const [step, setStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ startAt: string; title: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const busyIntervals: BusyInterval[] = busySlots.map((s) => {
    const parts = s.split("|");
    return { start: new Date(parts[0] ?? ""), end: new Date(parts[1] ?? "") };
  });

  const days = buildNext14Days();

  function handleDateSelect(day: Date) {
    setSelectedDate(day);
    setSelectedTime(null);
    setStep("time");
  }

  function handleTimeSelect(time: Date) {
    setSelectedTime(time);
    setStep("details");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTime) return;
    if (!form.name.trim()) return setFormError("שם חובה");
    if (!form.email.trim()) return setFormError("אימייל חובה");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setFormError("אימייל לא תקין");

    setFormError(null);

    startTransition(async () => {
      const res = await createBooking({
        bookingTypeId: bookingType.id,
        startAt: selectedTime.toISOString(),
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });

      if (!res.ok) {
        setFormError(res.error);
      } else {
        setSuccessInfo({ startAt: res.startAt, title: res.title });
        setStep("success");
      }
    });
  }

  return (
    <div className="min-h-screen bg-[#F8F6F1] px-4 py-8">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="bg-navy/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
            <CalendarDays size={26} className="text-navy" />
          </div>
          <h1 className="text-navy text-2xl font-bold">{bookingType.title}</h1>
          {bookingType.description && (
            <p className="text-ink-soft mt-2 text-sm">{bookingType.description}</p>
          )}
          <div className="text-ink-faded mt-2 inline-flex items-center gap-1.5 text-sm">
            <Clock size={14} />
            <span dir="ltr">{bookingType.duration_minutes} דקות</span>
          </div>
        </div>

        {/* Step indicator */}
        {step !== "success" && (
          <div className="mb-6 flex items-center justify-center gap-2 text-xs">
            {(["date", "time", "details"] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    step === s
                      ? "bg-navy text-white"
                      : ["time", "details"].indexOf(step) > i
                        ? "bg-navy/20 text-navy"
                        : "border-ink-line border bg-white text-slate-400"
                  }`}
                >
                  {i + 1}
                </div>
                {i < 2 && <div className="border-ink-line w-8 border-t" />}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl bg-white shadow-sm">
          {/* שלב 1 — בחירת תאריך */}
          {step === "date" && (
            <div className="p-6">
              <p className="text-navy mb-4 text-center font-semibold">בחר תאריך</p>
              <div className="grid grid-cols-7 gap-1.5">
                {days.map((day) => (
                  <button
                    key={day.toISOString()}
                    onClick={() => handleDateSelect(day)}
                    className="hover:bg-navy hover:text-cream-paper flex flex-col items-center rounded-xl py-2.5 text-center transition-colors"
                  >
                    <span className="text-ink-faded text-xs">{HE_DAYS[day.getDay()]}</span>
                    <span className="text-navy mt-1 text-sm font-semibold">{day.getDate()}</span>
                    <span className="text-ink-faded text-[10px]">
                      {(HE_MONTHS[day.getMonth()] ?? "").slice(0, 3)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* שלב 2 — בחירת שעה */}
          {step === "time" && selectedDate && (
            <div className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <button
                  onClick={() => setStep("date")}
                  className="text-ink-soft hover:text-navy rounded-lg p-1 transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
                <p className="text-navy font-semibold">{formatDateHe(selectedDate)}</p>
              </div>

              {(() => {
                const slots = buildTimeSlots(
                  selectedDate,
                  bookingType.duration_minutes,
                  busyIntervals,
                );
                const available = slots.filter((s) => s.available);

                if (available.length === 0) {
                  return (
                    <div className="py-8 text-center">
                      <p className="text-ink-soft text-sm">אין שעות פנויות ביום זה</p>
                      <button
                        onClick={() => setStep("date")}
                        className="text-navy mt-3 text-sm underline"
                      >
                        חזור לבחירת תאריך
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((s) => (
                      <button
                        key={s.time.toISOString()}
                        onClick={() => s.available && handleTimeSelect(s.time)}
                        disabled={!s.available}
                        className={`rounded-xl border py-3 text-sm font-medium transition-colors ${
                          s.available
                            ? "border-ink-line hover:bg-navy hover:text-cream-paper hover:border-navy text-navy"
                            : "border-ink-line cursor-not-allowed text-slate-300 line-through"
                        }`}
                        dir="ltr"
                      >
                        {formatTimeHe(s.time)}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* שלב 3 — פרטים אישיים */}
          {step === "details" && selectedDate && selectedTime && (
            <div className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <button
                  onClick={() => setStep("time")}
                  className="text-ink-soft hover:text-navy rounded-lg p-1 transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
                <div>
                  <p className="text-navy font-semibold">
                    {formatDateHe(selectedDate)}, {formatTimeHe(selectedTime)}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-navy mb-1 block text-sm font-medium">
                    שם מלא <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    required
                    placeholder="ישראל ישראלי"
                    className="border-ink-line text-navy focus:ring-navy/20 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2"
                  />
                </div>

                <div>
                  <label className="text-navy mb-1 block text-sm font-medium">
                    אימייל <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    required
                    dir="ltr"
                    placeholder="israel@example.com"
                    className="border-ink-line text-navy focus:ring-navy/20 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2"
                  />
                </div>

                <div>
                  <label className="text-navy mb-1 block text-sm font-medium">
                    טלפון <span className="text-ink-faded text-xs font-normal">(אופציונלי)</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    dir="ltr"
                    placeholder="050-0000000"
                    className="border-ink-line text-navy focus:ring-navy/20 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2"
                  />
                </div>

                <div>
                  <label className="text-navy mb-1 block text-sm font-medium">
                    הערה <span className="text-ink-faded text-xs font-normal">(אופציונלי)</span>
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    placeholder="ספר/י על הצורך שלך..."
                    className="border-ink-line text-navy focus:ring-navy/20 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2"
                  />
                </div>

                {formError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-navy text-cream-paper flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold transition-opacity disabled:opacity-60"
                >
                  {isPending ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <>
                      אשר פגישה
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* מסך אישור */}
          {step === "success" && successInfo && (
            <div className="p-8 text-center">
              <CheckCircle size={48} className="mx-auto mb-4 text-emerald-500" />
              <h2 className="text-navy mb-2 text-xl font-bold">הפגישה נקבעה!</h2>
              <p className="text-ink-soft mb-1 text-sm">{successInfo.title}</p>
              <p className="text-navy font-semibold" dir="ltr">
                {formatDateHe(new Date(successInfo.startAt))},{" "}
                {formatTimeHe(new Date(successInfo.startAt))}
              </p>
              <p className="text-ink-faded mt-4 text-xs">אישור יישלח לאימייל שלך בקרוב</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

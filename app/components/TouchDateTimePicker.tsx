"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./TouchDateTimePicker.module.css";

type TouchDateTimePickerProps = {
  date: string;
  time: string;
  minDate: string;
  maxDate?: string;
  minTime?: string;
  helperText?: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
};

type OpenPanel = "date" | "time" | null;

const weekDays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const baseTimeOptions = Array.from({ length: 31 }, (_, index) => {
  const minutes = 8 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function monthFromDate(value: string) {
  const [year, month] = value.split("-").map(Number);
  return { year, month: month - 1 };
}

function shiftMonth(year: number, month: number, amount: number) {
  const shifted = new Date(year, month + amount, 1, 12);
  return { year: shifted.getFullYear(), month: shifted.getMonth() };
}

function formatDate(value: string) {
  if (!value) return "Tarih seç";
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

function formatMonth(year: number, month: number) {
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" })
    .format(new Date(year, month, 1, 12));
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function TouchDateTimePicker({
  date,
  time,
  minDate,
  maxDate,
  minTime,
  helperText,
  onDateChange,
  onTimeChange,
}: TouchDateTimePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedTimeRef = useRef<HTMLButtonElement>(null);
  const initialMonth = monthFromDate(date || minDate);
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [viewYear, setViewYear] = useState(initialMonth.year);
  const [viewMonth, setViewMonth] = useState(initialMonth.month);

  const timeOptions = useMemo(() => {
    if (!time || baseTimeOptions.includes(time)) return baseTimeOptions;
    return [...baseTimeOptions, time].sort();
  }, [time]);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpenPanel(null);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenPanel(null);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (openPanel === "time") selectedTimeRef.current?.scrollIntoView({ block: "center" });
  }, [openPanel]);

  const firstDayOffset = (new Date(viewYear, viewMonth, 1, 12).getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0, 12).getDate();
  const previousMonth = shiftMonth(viewYear, viewMonth, -1);
  const nextMonth = shiftMonth(viewYear, viewMonth, 1);
  const previousMonthEnd = toIsoDate(
    previousMonth.year,
    previousMonth.month,
    new Date(previousMonth.year, previousMonth.month + 1, 0, 12).getDate(),
  );
  const nextMonthStart = toIsoDate(nextMonth.year, nextMonth.month, 1);
  const canGoPrevious = previousMonthEnd >= minDate;
  const canGoNext = !maxDate || nextMonthStart <= maxDate;

  function openDatePanel() {
    const selectedMonth = monthFromDate(date || minDate);
    setViewYear(selectedMonth.year);
    setViewMonth(selectedMonth.month);
    setOpenPanel((current) => (current === "date" ? null : "date"));
  }

  function moveMonth(amount: number) {
    const next = shiftMonth(viewYear, viewMonth, amount);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  function selectDate(value: string) {
    onDateChange(value);
    setOpenPanel(null);
  }

  function selectTime(value: string) {
    onTimeChange(value);
    setOpenPanel(null);
  }

  return (
    <div className={styles.picker} ref={rootRef}>
      <div className={styles.controls}>
        <button
          className={styles.trigger}
          type="button"
          onClick={openDatePanel}
          aria-expanded={openPanel === "date"}
          aria-controls="bonj-date-picker"
        >
          <span className={styles.calendarIcon} aria-hidden="true" />
          <span className={styles.triggerCopy}>
            <small>Tarih</small>
            <strong>{formatDate(date)}</strong>
          </span>
          <span className={styles.triggerChevron} aria-hidden="true" />
        </button>

        <button
          className={styles.trigger}
          type="button"
          onClick={() => setOpenPanel((current) => (current === "time" ? null : "time"))}
          aria-expanded={openPanel === "time"}
          aria-controls="bonj-time-picker"
        >
          <span className={styles.clockIcon} aria-hidden="true" />
          <span className={styles.triggerCopy}>
            <small>Saat</small>
            <strong>{time || "Saat seç"}</strong>
          </span>
          <span className={styles.triggerChevron} aria-hidden="true" />
        </button>
      </div>

      {openPanel === "date" ? (
        <div className={`${styles.popover} ${styles.calendarPopover}`} id="bonj-date-picker" role="dialog" aria-label="Tarih seçimi">
          <div className={styles.calendarHeader}>
            <button className={styles.monthButton} type="button" onClick={() => moveMonth(-1)} disabled={!canGoPrevious} aria-label="Önceki ay">
              <span className={`${styles.monthChevron} ${styles.previous}`} aria-hidden="true" />
            </button>
            <strong>{formatMonth(viewYear, viewMonth)}</strong>
            <button className={styles.monthButton} type="button" onClick={() => moveMonth(1)} disabled={!canGoNext} aria-label="Sonraki ay">
              <span className={styles.monthChevron} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.weekDays} aria-hidden="true">
            {weekDays.map((weekDay) => <span key={weekDay}>{weekDay}</span>)}
          </div>

          <div className={styles.daysGrid}>
            {Array.from({ length: 42 }, (_, index) => {
              const day = index - firstDayOffset + 1;
              if (day < 1 || day > daysInMonth) return <span className={styles.emptyDay} key={`empty-${index}`} />;

              const value = toIsoDate(viewYear, viewMonth, day);
              const disabled = value < minDate || Boolean(maxDate && value > maxDate);
              const selected = value === date;

              return (
                <button
                  className={`${styles.dayButton} ${selected ? styles.selectedDay : ""}`}
                  type="button"
                  key={value}
                  disabled={disabled}
                  onClick={() => selectDate(value)}
                  aria-label={dayLabel(value)}
                  aria-pressed={selected}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {openPanel === "time" ? (
        <div className={`${styles.popover} ${styles.timePopover}`} id="bonj-time-picker" role="dialog" aria-label="Saat seçimi">
          <div className={styles.timeHeader}>
            <span>Uygun saati seç</span>
            <strong>{time || "—"}</strong>
          </div>
          <div className={styles.timeGrid} role="listbox" aria-label="Saat seçenekleri">
            {timeOptions.map((value) => {
              const disabled = Boolean(minTime && value < minTime);
              const selected = value === time;
              return (
                <button
                  className={`${styles.timeButton} ${selected ? styles.selectedTime : ""}`}
                  type="button"
                  role="option"
                  key={value}
                  ref={selected ? selectedTimeRef : undefined}
                  disabled={disabled}
                  onClick={() => selectTime(value)}
                  aria-selected={selected}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {helperText ? <p className={styles.helper}>{helperText}</p> : null}
    </div>
  );
}

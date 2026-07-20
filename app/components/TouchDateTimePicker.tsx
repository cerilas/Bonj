"use client";

import styles from "./TouchDateTimePicker.module.css";

type TouchDateTimePickerProps = {
  date: string;
  time: string;
  minDate: string;
  maxDate?: string;
  minTime?: string;
  tone?: "light" | "dark";
  helperText?: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
};

const timeOptions = Array.from({ length: 31 }, (_, index) => {
  const minutes = 8 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

function dateAtOffset(date: string, offset: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + offset);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function shortDateLabel(value: string, index: number) {
  if (index === 0) return "Bugün";
  if (index === 1) return "Yarın";
  return new Intl.DateTimeFormat("tr-TR", { weekday: "short" }).format(new Date(`${value}T12:00:00`));
}

function numericDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));
}

function fullDate(value: string) {
  if (!value) return "Tarih seçilmedi";
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${value}T12:00:00`));
}

export function TouchDateTimePicker({
  date,
  time,
  minDate,
  maxDate,
  minTime,
  tone = "light",
  helperText = "Tarih ve saati tek dokunuşla seçebilirsin.",
  onDateChange,
  onTimeChange,
}: TouchDateTimePickerProps) {
  const quickDates = Array.from({ length: 3 }, (_, index) => dateAtOffset(minDate, index));
  const quickDateSelected = quickDates.includes(date);

  return (
    <div className={styles.picker} data-tone={tone}>
      <div className={styles.group}>
        <span className={styles.groupTitle}>Tarih</span>
        <div className={styles.dateGrid}>
          {quickDates.map((value, index) => (
            <button
              className={`${styles.dateButton} ${date === value ? styles.selected : ""}`}
              type="button"
              key={value}
              onClick={() => onDateChange(value)}
              aria-pressed={date === value}
            >
              <span>{shortDateLabel(value, index)}</span>
              <strong>{numericDate(value)}</strong>
            </button>
          ))}
          <label className={`${styles.nativePicker} ${date && !quickDateSelected ? styles.selected : ""}`}>
            <span>Başka tarih</span>
            <strong>{date && !quickDateSelected ? numericDate(date) : "Takvimi aç"}</strong>
            <input
              type="date"
              min={minDate}
              max={maxDate}
              value={date}
              onChange={(event) => onDateChange(event.target.value)}
              aria-label="Takvimden tarih seç"
            />
          </label>
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>Saat</span>
        <div className={styles.timeScroller} aria-label="Saat seçenekleri">
          {timeOptions.map((value) => {
            const disabled = Boolean(minTime && value < minTime);
            return (
              <button
                className={`${styles.timeButton} ${time === value ? styles.selected : ""}`}
                type="button"
                key={value}
                disabled={disabled}
                onClick={() => onTimeChange(value)}
                aria-pressed={time === value}
              >
                {value}
              </button>
            );
          })}
          <label className={`${styles.nativePicker} ${styles.nativeTime} ${time && !timeOptions.includes(time) ? styles.selected : ""}`}>
            <span>Farklı</span>
            <strong>{time && !timeOptions.includes(time) ? time : "Saat seç"}</strong>
            <input
              type="time"
              step="900"
              min={minTime}
              value={time}
              onChange={(event) => onTimeChange(event.target.value)}
              aria-label="Farklı bir saat seç"
            />
          </label>
        </div>
      </div>

      <div className={styles.summary} aria-live="polite">
        <span>{helperText}</span>
        <strong>{date && time ? `${fullDate(date)} · ${time}` : "Seçim bekleniyor"}</strong>
      </div>
    </div>
  );
}

import { memo, useId, useState } from "react";
import { WEEKDAY_ABBREVIATIONS, WEEKDAY_NAMES, weekdayIndex } from "../dateFormat";
import type { Recurrence } from "../types";
import "./RecurrencePicker.css";

const MIN_INTERVAL = 1;
const MAX_INTERVAL = 52;

interface Props {
  value: Recurrence | null;
  onChange: (value: Recurrence | null) => void;
  // Names the whole control: the id of a visible heading when there is one, otherwise a
  // plain label.
  labelledBy?: string;
  label?: string;
}

// Parses the interval field's raw text, or null when it isn't a whole number at all.
function parseInterval(raw: string): number | null {
  return /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : null;
}

// Controlled: every change is reported through onChange and the picker only shows what
// `value` says, so the caller decides whether a change is a draft (the add-quest form)
// or saved straight away (QuestDetail). The one piece of local state is the interval
// field's in-progress text, so a half-typed or cleared number isn't forced back while
// the user is still typing.
export const RecurrencePicker = memo(function RecurrencePicker({
  value,
  onChange,
  labelledBy,
  label,
}: Props) {
  // null whenever the field is showing the committed interval; set only while the user
  // is typing, and dropped again on blur.
  const [intervalDraft, setIntervalDraft] = useState<string | null>(null);
  const intervalErrorId = useId();

  const weekly = value?.frequency === "weekly" ? value : null;
  const intervalText = intervalDraft ?? (weekly ? weekly.interval.toString() : "");
  const draftInterval = intervalDraft === null ? null : parseInterval(intervalDraft);
  const isIntervalInvalid =
    intervalDraft !== null &&
    (draftInterval === null || draftInterval < MIN_INTERVAL || draftInterval > MAX_INTERVAL);

  // Choosing a mode that is already active is a no-op rather than a reset, so pressing
  // Weekly again never throws away the chosen days.
  function chooseOff() {
    if (value !== null) onChange(null);
  }

  function chooseDaily() {
    if (value?.frequency !== "daily") onChange({ frequency: "daily" });
  }

  // Defaults to today's weekday at every week -- the rule then starts today, which is the
  // least surprising first occurrence.
  function chooseWeekly() {
    if (weekly) return;
    setIntervalDraft(null);
    onChange({ frequency: "weekly", interval: 1, weekdays: [weekdayIndex(new Date())] });
  }

  function toggleWeekday(weekday: number) {
    if (!weekly) return;
    const isSelected = weekly.weekdays.includes(weekday);
    // A weekly rule needs at least one day; the last one stays pressed (and says why via
    // its aria-disabled + tooltip) instead of leaving a rule the server would reject.
    if (isSelected && weekly.weekdays.length === 1) return;
    const weekdays = isSelected
      ? weekly.weekdays.filter((d) => d !== weekday)
      : [...weekly.weekdays, weekday].sort((a, b) => a - b);
    onChange({ ...weekly, weekdays });
  }

  function handleIntervalChange(raw: string) {
    setIntervalDraft(raw);
    const interval = parseInterval(raw);
    if (
      weekly &&
      interval !== null &&
      interval >= MIN_INTERVAL &&
      interval <= MAX_INTERVAL &&
      interval !== weekly.interval
    ) {
      onChange({ ...weekly, interval });
    }
  }

  // Leaving the field settles it: a number out of range is clamped into range and
  // committed, anything else (empty, not a number) falls back to the committed interval.
  function handleIntervalBlur() {
    if (weekly && draftInterval !== null) {
      const clamped = Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, draftInterval));
      if (clamped !== weekly.interval) onChange({ ...weekly, interval: clamped });
    }
    setIntervalDraft(null);
  }

  return (
    <div
      className="recurrence-picker"
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
    >
      <div className="recurrence-picker-modes">
        <button
          type="button"
          className="recurrence-picker-button"
          aria-pressed={value === null}
          onClick={chooseOff}
        >
          Off
        </button>
        <button
          type="button"
          className="recurrence-picker-button"
          aria-pressed={value?.frequency === "daily"}
          onClick={chooseDaily}
        >
          Every day
        </button>
        <button
          type="button"
          className="recurrence-picker-button"
          aria-pressed={weekly !== null}
          onClick={chooseWeekly}
        >
          Weekly
        </button>
      </div>

      {weekly && (
        <>
          <div className="recurrence-picker-interval">
            <span aria-hidden="true">every</span>
            <input
              type="number"
              inputMode="numeric"
              className="recurrence-picker-interval-input"
              min={MIN_INTERVAL}
              max={MAX_INTERVAL}
              value={intervalText}
              aria-label={`Repeat every how many weeks (${MIN_INTERVAL.toString()} to ${MAX_INTERVAL.toString()})`}
              aria-invalid={isIntervalInvalid}
              aria-describedby={isIntervalInvalid ? intervalErrorId : undefined}
              onChange={(e) => {
                handleIntervalChange(e.target.value);
              }}
              onBlur={handleIntervalBlur}
            />
            <span aria-hidden="true">{weekly.interval === 1 ? "week" : "weeks"}</span>
            {/* The red ring alone says only that something is wrong; this says what. Shown
                while the draft is out of range, gone once blur clamps it back in. */}
            {isIntervalInvalid && (
              <span id={intervalErrorId} className="recurrence-picker-interval-error">
                {`Must be ${MIN_INTERVAL.toString()}–${MAX_INTERVAL.toString()}`}
              </span>
            )}
          </div>
          <div className="recurrence-picker-days" role="group" aria-label="Repeat on">
            {WEEKDAY_ABBREVIATIONS.map((abbreviation, weekday) => {
              const isSelected = weekly.weekdays.includes(weekday);
              const isLastSelected = isSelected && weekly.weekdays.length === 1;
              return (
                <button
                  key={abbreviation}
                  type="button"
                  className="recurrence-picker-button recurrence-picker-day"
                  aria-pressed={isSelected}
                  aria-disabled={isLastSelected}
                  aria-label={WEEKDAY_NAMES[weekday]}
                  title={isLastSelected ? "At least one day is required" : undefined}
                  onClick={() => {
                    toggleWeekday(weekday);
                  }}
                >
                  {abbreviation}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
});

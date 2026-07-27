"use client";

// 한글 날짜 선택기 — 브라우저 기본 date 입력(영문 달력) 대신 사용한다.
// 값은 항상 "YYYY-MM-DD" 문자열로 주고받는다.
import { useEffect, useRef, useState } from "react";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const pad = (n) => String(n).padStart(2, "0");
const toValue = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseValue = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ""));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
};
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function DatePicker({ value, onChange, placeholder = "날짜 선택" }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => parseValue(value) || new Date());
  const rootRef = useRef(null);

  const selected = parseValue(value);
  const today = new Date();

  useEffect(() => {
    const d = parseValue(value);
    if (d) setCursor(d);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 6주 그리드 (앞뒤 달 날짜 포함)
  const cells = [];
  for (let i = 0; i < firstDow; i++) {
    const d = new Date(year, month, i - firstDow + 1);
    cells.push({ date: d, outside: true });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ date: new Date(year, month, i), outside: false });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), outside: true });
  }

  function pick(d) {
    onChange(toValue(d));
    setOpen(false);
  }

  const label = selected
    ? `${selected.getFullYear()}년 ${selected.getMonth() + 1}월 ${selected.getDate()}일 (${WEEKDAYS[selected.getDay()]})`
    : "";

  return (
    <div className="datepicker" ref={rootRef}>
      <button type="button" className={"datepicker-trigger" + (open ? " open" : "")} onClick={() => setOpen((v) => !v)}>
        <span className={label ? "" : "ph"}>{label || placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="3" y="4.5" width="14" height="13" rx="3" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 8.5h14M7 2.5v4M13 2.5v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="datepicker-pop">
          <div className="datepicker-head">
            <button type="button" className="dp-nav" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="이전 달">‹</button>
            <div className="dp-title">
              <select value={year} onChange={(e) => setCursor(new Date(Number(e.target.value), month, 1))}>
                {Array.from({ length: 11 }, (_, i) => today.getFullYear() - 5 + i).map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <select value={month} onChange={(e) => setCursor(new Date(year, Number(e.target.value), 1))}>
                {Array.from({ length: 12 }, (_, i) => i).map((m) => (
                  <option key={m} value={m}>{m + 1}월</option>
                ))}
              </select>
            </div>
            <button type="button" className="dp-nav" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="다음 달">›</button>
          </div>

          <div className="dp-grid dp-dow">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={"dp-dow-cell" + (i === 0 ? " sun" : i === 6 ? " sat" : "")}>{w}</div>
            ))}
          </div>

          <div className="dp-grid">
            {cells.map(({ date, outside }, i) => {
              const dow = date.getDay();
              const cls = [
                "dp-day",
                outside ? "outside" : "",
                sameDay(date, selected) ? "on" : "",
                !outside && sameDay(date, today) ? "today" : "",
                dow === 0 ? "sun" : dow === 6 ? "sat" : ""
              ].filter(Boolean).join(" ");
              return (
                <button type="button" key={i} className={cls} onClick={() => pick(date)}>
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="dp-foot">
            <button type="button" className="dp-foot-btn" onClick={() => { onChange(""); setOpen(false); }}>지우기</button>
            <button type="button" className="dp-foot-btn primary" onClick={() => pick(new Date())}>오늘</button>
          </div>
        </div>
      )}
    </div>
  );
}

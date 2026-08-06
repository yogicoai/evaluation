"use client";

// 연도 + 월(1~12) + 분기(Q1~Q4) 기간 선택 바.
// - 월 버튼: 단일 선택. '월별 묶어보기'를 켜면 여러 달을 함께 선택할 수 있다.
// - 분기 버튼(Q1~Q4): 해당 3개월을 한 번에 선택.
// - 초기화: 월 선택과 상세검색을 모두 해제 → 해당 연도 전체.
// - 상세검색: 시작일~종료일을 직접 지정. 지정하면 연/월 선택보다 우선한다.
import { useEffect, useRef, useState } from "react";
import DatePicker from "./DatePicker";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const QUARTERS = [
  { key: "Q1", months: [1, 2, 3] },
  { key: "Q2", months: [4, 5, 6] },
  { key: "Q3", months: [7, 8, 9] },
  { key: "Q4", months: [10, 11, 12] }
];

export default function PeriodBar({
  title,
  logo,
  year,
  onYearChange,
  months,
  onMonthsChange,
  multi,
  onMultiChange,
  range,          // { start, end } | null — 상세검색
  onRangeChange,
  right,
  className = ""
}) {
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => thisYear - 4 + i);
  const sel = months || [];
  const [searchOpen, setSearchOpen] = useState(false);
  const [draft, setDraft] = useState({ start: range?.start || "", end: range?.end || "" });
  const popRef = useRef(null);

  useEffect(() => {
    if (!searchOpen) return;
    const onDown = (e) => { if (popRef.current && !popRef.current.contains(e.target)) setSearchOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [searchOpen]);

  const rangeOn = !!(range?.start || range?.end);

  function clickMonth(m) {
    onRangeChange?.(null); // 월을 고르면 상세검색은 해제
    if (multi) {
      onMonthsChange(sel.includes(m) ? sel.filter((x) => x !== m) : [...sel, m].sort((a, b) => a - b));
    } else {
      onMonthsChange(sel.length === 1 && sel[0] === m ? [] : [m]);
    }
  }

  function clickQuarter(q) {
    onRangeChange?.(null);
    const on = q.months.every((m) => sel.includes(m));
    if (on) onMonthsChange(sel.filter((m) => !q.months.includes(m)));
    else onMonthsChange([...new Set([...(multi ? sel : []), ...q.months])].sort((a, b) => a - b));
  }

  function reset() {
    onMonthsChange([]);
    onRangeChange?.(null);
    onMultiChange?.(false);
    setDraft({ start: "", end: "" });
    setSearchOpen(false);
  }

  return (
    <div className={"periodbar " + className}>
      <div className="periodbar-inner">
        <div className="brand">
          {logo && <img className="brand-logo" src={logo} alt="" />}
          <div>{title}</div>
        </div>

        <div className="period-controls">
          <select className="period-year" value={year} onChange={(e) => { onRangeChange?.(null); onYearChange(Number(e.target.value)); }} disabled={rangeOn}>
            {years.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>

          <div className="period-months">
            {MONTHS.map((m) => (
              <button
                key={m}
                type="button"
                className={"period-chip" + (!rangeOn && sel.includes(m) ? " on" : "")}
                onClick={() => clickMonth(m)}
              >
                {m}월
              </button>
            ))}
          </div>

          <div className="period-sep" />
          <span className="period-label">분기</span>
          <div className="period-months">
            {QUARTERS.map((q) => (
              <button
                key={q.key}
                type="button"
                className={"period-chip q" + (!rangeOn && q.months.every((m) => sel.includes(m)) ? " on" : "")}
                onClick={() => clickQuarter(q)}
                title={`${q.months[0]}~${q.months[2]}월`}
              >
                {q.key}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={"period-toggle" + (multi ? " on" : "")}
            onClick={() => onMultiChange(!multi)}
            title="여러 달을 함께 선택해서 봅니다"
          >
            월별 묶어보기
          </button>

          {/* 상세검색: 날짜 범위 직접 지정 */}
          <div className="period-search" ref={popRef}>
            <button
              type="button"
              className={"period-toggle" + (rangeOn ? " on" : "")}
              onClick={() => { setDraft({ start: range?.start || "", end: range?.end || "" }); setSearchOpen((v) => !v); }}
            >
              상세 검색
            </button>
            {searchOpen && (
              <div className="period-search-pop">
                <div className="lbl">기간 직접 지정</div>
                <div className="field" style={{ marginTop: 8 }}><span>시작일</span>
                  <DatePicker value={draft.start} onChange={(v) => setDraft((d) => ({ ...d, start: v }))} placeholder="시작일 선택" />
                </div>
                <div className="field" style={{ marginTop: 10 }}><span>종료일</span>
                  <DatePicker value={draft.end} onChange={(v) => setDraft((d) => ({ ...d, end: v }))} placeholder="종료일 선택" />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    className="btn primary"
                    onClick={() => {
                      if (!draft.start && !draft.end) { onRangeChange?.(null); setSearchOpen(false); return; }
                      onMonthsChange([]);
                      onRangeChange?.({ start: draft.start, end: draft.end });
                      setSearchOpen(false);
                    }}
                  >
                    적용
                  </button>
                  <button className="btn ghost" onClick={() => { setDraft({ start: "", end: "" }); onRangeChange?.(null); setSearchOpen(false); }}>
                    해제
                  </button>
                </div>
              </div>
            )}
          </div>

          {(sel.length > 0 || rangeOn || multi) && (
            <button type="button" className="period-reset" onClick={reset} title="기간 선택 초기화">초기화</button>
          )}

          {right}
        </div>
      </div>
    </div>
  );
}

// 선택된 기간에 날짜가 드는지 판정 (range 우선)
export function inPeriod(dateLike, year, months, range) {
  if (!dateLike) return false;
  const d = new Date(dateLike);
  if (isNaN(d.getTime())) return false;

  if (range?.start || range?.end) {
    const t = d.getTime();
    if (range.start) {
      const s = new Date(range.start);
      s.setHours(0, 0, 0, 0);
      if (t < s.getTime()) return false;
    }
    if (range.end) {
      const e = new Date(range.end);
      e.setHours(23, 59, 59, 999);
      if (t > e.getTime()) return false;
    }
    return true;
  }

  if (d.getFullYear() !== year) return false;
  if (!months || !months.length) return true;
  return months.includes(d.getMonth() + 1);
}

export function periodLabel(year, months, range) {
  if (range?.start || range?.end) return `${range.start || "처음"} ~ ${range.end || "오늘"}`;
  if (!months || !months.length) return `${year}년 전체`;
  if (months.length === 1) return `${year}년 ${months[0]}월`;
  for (const q of QUARTERS) {
    if (months.length === 3 && q.months.every((m) => months.includes(m))) return `${year}년 ${q.key}`;
  }
  return `${year}년 ${months.join("·")}월`;
}

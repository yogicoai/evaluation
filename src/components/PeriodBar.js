"use client";

// 연도 + 월(1~12) + 분기(Q1~Q4) 기간 선택 바.
// - 월 버튼: 단일 선택. '월별 묶어보기'를 켜면 여러 달을 함께 선택할 수 있다.
// - 분기 버튼(Q1~Q4): 해당 3개월을 한 번에 선택.
// - 값은 선택된 월 번호 배열(1~12). 빈 배열이면 그 해 전체.
import { useMemo } from "react";

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
  right,
  className = ""
}) {
  const thisYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: 6 }, (_, i) => thisYear - 4 + i),
    [thisYear]
  );
  const sel = months || [];

  function clickMonth(m) {
    if (multi) {
      onMonthsChange(sel.includes(m) ? sel.filter((x) => x !== m) : [...sel, m].sort((a, b) => a - b));
    } else {
      onMonthsChange(sel.length === 1 && sel[0] === m ? [] : [m]); // 같은 달 다시 누르면 해제(= 연간)
    }
  }

  function clickQuarter(q) {
    const on = q.months.every((m) => sel.includes(m));
    if (on) onMonthsChange(sel.filter((m) => !q.months.includes(m)));
    else onMonthsChange([...new Set([...(multi ? sel : []), ...q.months])].sort((a, b) => a - b));
  }

  return (
    <div className={"periodbar " + className}>
      <div className="periodbar-inner">
        <div className="brand">
          {logo && <img className="brand-logo" src={logo} alt="" />}
          <div>{title}</div>
        </div>

        <div className="period-controls">
          <select className="period-year" value={year} onChange={(e) => onYearChange(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>

          <div className="period-months">
            {MONTHS.map((m) => (
              <button
                key={m}
                type="button"
                className={"period-chip" + (sel.includes(m) ? " on" : "")}
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
                className={"period-chip q" + (q.months.every((m) => sel.includes(m)) ? " on" : "")}
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

          {right}
        </div>
      </div>
    </div>
  );
}

// 선택된 연/월 기준으로 날짜 문자열이 범위에 드는지 판정
export function inPeriod(dateLike, year, months) {
  if (!dateLike) return false;
  const d = new Date(dateLike);
  if (isNaN(d.getTime())) return false;
  if (d.getFullYear() !== year) return false;
  if (!months || !months.length) return true; // 월 미선택 = 해당 연도 전체
  return months.includes(d.getMonth() + 1);
}

export function periodLabel(year, months) {
  if (!months || !months.length) return `${year}년 전체`;
  if (months.length === 1) return `${year}년 ${months[0]}월`;
  for (const q of QUARTERS) {
    if (months.length === 3 && q.months.every((m) => months.includes(m))) return `${year}년 ${q.key}`;
  }
  return `${year}년 ${months.join("·")}월`;
}

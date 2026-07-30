"use client";

// 숫자만 입력하면 구분 기호(/)가 자동으로 붙는 날짜 입력.
//   단일 날짜  : 20260502      → 2026/05/02
//   기간(range): 2026050120260731 → 2026/05/01 ~ 2026/07/31
// 붙여넣기·삭제도 숫자 기준으로 동작하며, 숫자 외 문자는 무시한다.

const digitsOf = (v) => String(v || "").replace(/\D/g, "");

function formatOne(d) {
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}/${d.slice(4)}`;
  return `${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6, 8)}`;
}

export function formatDateDigits(value, range = false) {
  const d = digitsOf(value).slice(0, range ? 16 : 8);
  if (!range) return formatOne(d);
  const a = d.slice(0, 8);
  const b = d.slice(8);
  if (!b) return formatOne(a);
  return `${formatOne(a)} ~ ${formatOne(b)}`;
}

export default function DateTextInput({ value, onChange, range = false, placeholder, ...rest }) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      value={value || ""}
      placeholder={placeholder || (range ? "예: 2026/05/01 ~ 2026/07/31" : "예: 2026/05/02")}
      onChange={(e) => onChange(formatDateDigits(e.target.value, range))}
      onPaste={(e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData("text");
        onChange(formatDateDigits(text, range));
      }}
    />
  );
}

"use client";

// 팝업 창으로 열렸을 때만 나타나는 '전체 페이지 보기' 버튼.
// 누르면 같은 화면을 일반 탭으로 열고 팝업은 닫는다.
import { useEffect, useState } from "react";
import { isPopupWindow, expandToFullPage } from "@/lib/popup";

export default function PopupExpandButton({ className = "btn ghost" }) {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(isPopupWindow()), []);
  if (!show) return null;
  return (
    <button className={className} onClick={expandToFullPage} title="이 화면을 전체 페이지로 엽니다">
      전체 페이지 보기
    </button>
  );
}

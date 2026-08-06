// 다른 평가 화면을 팝업 창으로 연다.
// 새 탭이 아니라 별도 창이라 보던 화면이 그대로 남고, 같은 이름의 창은 재사용된다.
export function openPopup(url, name = "yogibo_eval") {
  if (typeof window === "undefined") return;
  const aw = window.screen?.availWidth || 1440;
  const ah = window.screen?.availHeight || 900;
  const w = Math.min(1480, Math.max(1024, aw - 120));
  const h = Math.min(940, Math.max(700, ah - 120));
  const left = Math.max(0, Math.round((aw - w) / 2));
  const top = Math.max(0, Math.round((ah - h) / 2));
  const win = window.open(
    url,
    name,
    `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes,menubar=no,toolbar=no,location=no,status=no`
  );
  // 팝업 차단 시에는 안내 (차단 해제 없이 이동해 버리면 보던 화면이 사라진다)
  if (!win) {
    alert("브라우저가 팝업을 차단했습니다.\n주소창의 팝업 차단 아이콘에서 이 사이트의 팝업을 허용해 주세요.");
    return;
  }
  win.focus();
}

// 지금 창이 팝업으로 열린 것인지
export function isPopupWindow() {
  if (typeof window === "undefined") return false;
  try {
    return !!window.opener && !window.opener.closed;
  } catch {
    return false;
  }
}

// 팝업 내용을 일반 탭으로 옮기고 팝업은 닫는다
export function expandToFullPage() {
  if (typeof window === "undefined") return;
  window.open(window.location.href, "_blank");
  window.close();
}

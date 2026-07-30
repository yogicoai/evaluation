"use client";

// 평가자용 페이지 공용 비밀번호 게이트 (기본 2026, 내부에서 변경 가능)
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const LOGO_YOGIBO = "https://yogibo.kr/web/img/icon/logo3_on.png";

// scope: "store"(매장) | "hq"(본사&물류) — 영역별로 비밀번호와 세션이 분리되어 있다.
export default function EvaluatorGate({ title = "평가자 페이지", scope = "store", logo = LOGO_YOGIBO, children }) {
  const [state, setState] = useState("checking"); // checking | locked | open
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/me?scope=${scope}`)
      .then((r) => r.json())
      .then((d) => setState(d.authenticated ? "open" : "locked"))
      .catch(() => setState("locked"));
  }, [scope]);

  async function login(e) {
    e?.preventDefault();
    if (!pw || busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, password: pw })
      });
      if (res.ok) {
        setState("open");
      } else {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || "비밀번호가 올바르지 않습니다.");
        setPw("");
      }
    } catch {
      setErr("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking") {
    return (
      <main className="wrap">
        <p style={{ textAlign: "center", marginTop: 140, color: "#8b95a1", fontWeight: 600 }}>확인 중...</p>
      </main>
    );
  }

  if (state === "locked") {
    return (
      <main className="wrap narrow">
        <div className="card login-card">
          <img className="brand-logo lg" src={logo} alt="" style={{ marginBottom: 20 }} />
          <h1 style={{ fontSize: 23 }}>{title}</h1>
          <p>평가자 전용 페이지입니다. 비밀번호를 입력해 주세요.</p>
          <form onSubmit={login} style={{ marginTop: 18 }}>
            <label className="field"><span>비밀번호</span>
              <input
                type="password"
                value={pw}
                autoFocus
                placeholder="비밀번호 입력"
                onChange={(e) => setPw(e.target.value)}
              />
            </label>
            {err && <div className="lockbox" style={{ marginTop: 12, padding: 13 }}>{err}</div>}
            <div className="actions">
              <button type="submit" className="btn primary" style={{ width: "100%" }} disabled={busy}>
                {busy ? "확인 중..." : "접속하기"}
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return children;
}

// 상단바용: 비밀번호 변경 + 로그아웃 (모달)
export function PasswordManageButton({ scope = "store", scopeLabel = "매장" }) {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [msg, setMsg] = useState(null); // {type:'ok'|'err', text}
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function reset() {
    setCur(""); setNext(""); setNext2(""); setMsg(null);
  }

  async function save() {
    if (busy) return;
    setMsg(null);
    if (!cur) { setMsg({ type: "err", text: "현재 비밀번호를 입력해 주세요." }); return; }
    if (next.trim().length < 4) { setMsg({ type: "err", text: "새 비밀번호는 4자 이상이어야 합니다." }); return; }
    if (next !== next2) { setMsg({ type: "err", text: "새 비밀번호가 서로 일치하지 않습니다." }); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, currentPassword: cur, newPassword: next.trim() })
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ type: "ok", text: `${scopeLabel} 비밀번호가 변경되었습니다. 다른 기기는 새 비밀번호로 다시 접속해야 합니다.` });
        setCur(""); setNext(""); setNext2("");
      } else {
        setMsg({ type: "err", text: d.error || "변경에 실패했습니다." });
      }
    } catch {
      setMsg({ type: "err", text: "네트워크 오류가 발생했습니다." });
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope })
    });
    location.reload();
  }

  // 이 버튼은 상단바(.topbar) 안에서 렌더된다. .topbar에 backdrop-filter가 걸려 있어
  // 그대로 두면 position:fixed 모달의 기준 박스가 상단바가 되어 화면 위로 잘린다.
  // → 모달만 body로 포털시킨다.
  const modal = (
    <div className="criteria-modal no-print" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="criteria-panel" style={{ width: "min(460px, 100%)" }}>
        <button className="btn ghost criteria-close" onClick={() => setOpen(false)}>닫기</button>
        <div style={{ paddingRight: 80, paddingBottom: 18, borderBottom: "1px solid #eaebee", marginBottom: 4 }}>
          <h2 style={{ fontSize: 22, margin: 0 }}>{scopeLabel} 비밀번호 관리</h2>
          <p style={{ marginTop: 8 }}>
            <b>{scopeLabel}</b> 평가 페이지에만 적용됩니다. 매장과 본사&물류의 비밀번호는 서로 분리되어 있습니다.
          </p>
        </div>
        <div className="criteria-block">
          <label className="field"><span>현재 비밀번호</span>
            <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="현재 비밀번호" />
          </label>
          <label className="field" style={{ display: "block", marginTop: 12 }}><span>새 비밀번호 (4자 이상)</span>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="새 비밀번호" />
          </label>
          <label className="field" style={{ display: "block", marginTop: 12 }}><span>새 비밀번호 확인</span>
            <input type="password" value={next2} onChange={(e) => setNext2(e.target.value)} placeholder="한 번 더 입력" />
          </label>
          {msg && (
            <div className={msg.type === "ok" ? "status-box" : "lockbox"} style={{ marginTop: 14, padding: 13 }}>
              {msg.text}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button className="btn primary" disabled={busy} onClick={save}>{busy ? "변경 중..." : "비밀번호 변경"}</button>
            <button className="btn ghost" onClick={logout}>로그아웃</button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button className="btn ghost" onClick={() => { reset(); setOpen(true); }}>비밀번호 관리</button>
      {open && mounted && createPortal(modal, document.body)}
    </>
  );
}

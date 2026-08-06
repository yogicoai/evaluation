"use client";

// 메인: 오프라인 통합관리 화면과 같은 사이드바 + 메인 레이아웃
import { useState } from "react";
import { useRouter } from "next/navigation";
import { openPopup } from "@/lib/popup";

const LOGO_YOGIBO = "https://yogibo.kr/web/img/icon/logo3_on.png";
const LOGO_YOGICO = "https://www.yogico.kr/img/coMake2.png";

// popup: 평가자용 화면은 팝업 창으로 띄운다(여러 화면을 오가도 보던 화면이 남는다).
// 직원용 시험은 응시자가 쓰는 화면이라 같은 창에서 이동한다.
const MENU = [
  {
    title: "요기보 · 매장",
    items: [
      { label: "수습평가시험", href: "/exam", desc: "매장 직원이 응시하는 역량평가 시험", role: "직원용", icon: "pen" },
      { label: "수습평가시험 관리", href: "/grading", desc: "제출된 시험지 자동/수동 채점, 문항·정답 관리", role: "평가자용", icon: "check", popup: "yogibo_grading" },
      { label: "수습 종합평가", href: "/overall", desc: "인사카드 + 매출 + 역량 합산 및 PDF 출력", role: "평가자용", icon: "chart", popup: "yogibo_overall" }
    ]
  },
  {
    title: "요기코퍼레이션 · 본사&물류",
    items: [
      { label: "수습기간 평가표", href: "/hq", desc: "본사·물류 수습직원 평가표 작성 및 PDF 출력", role: "평가자용", icon: "doc", popup: "yogibo_hq" }
    ]
  }
];

function Icon({ name }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "pen") return <svg {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>;
  if (name === "check") return <svg {...common}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>;
  if (name === "chart") return <svg {...common}><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="4" width="3" height="14" /></svg>;
  return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></svg>;
}

export default function Home() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function go(item) {
    setOpen(false);
    if (item.popup) openPopup(item.href, item.popup);
    else router.push(item.href);
  }

  return (
    <div className="hub">
      <aside className={"hub-side" + (open ? " open" : "")}>
        <div className="hub-logo">
          <img src={LOGO_YOGIBO} alt="Yogibo" />
          <span>수습직원 평가 관리</span>
        </div>
        <nav className="hub-nav">
          {MENU.map((g) => (
            <div key={g.title} className="hub-nav-group">
              <div className="hub-nav-title">{g.title}</div>
              {g.items.map((it) => (
                <button key={it.href} className="hub-nav-item" onClick={() => go(it)}>
                  <Icon name={it.icon} />
                  <span>{it.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="hub-side-foot">
          평가자용 페이지는 접속할 때마다<br />비밀번호 입력이 필요합니다.
        </div>
      </aside>

      <div className={"hub-dim" + (open ? " on" : "")} onClick={() => setOpen(false)} />

      <main className="hub-main">
        <header className="hub-header">
          <button className="hub-menu-btn" onClick={() => setOpen((v) => !v)} aria-label="메뉴 열기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <div className="hub-header-title">수습직원 평가 관리</div>
          <img className="hub-header-logo" src={LOGO_YOGICO} alt="요기코퍼레이션" />
        </header>

        <div className="hub-content">
          <div className="hub-hero">
            <h1>수습직원 평가 시스템</h1>
            <p>매장(요기보)과 본사·물류(요기코퍼레이션)의 수습 평가를 한곳에서 관리합니다.</p>
          </div>

          {MENU.map((g) => (
            <section key={g.title} className="hub-section">
              <div className="hub-section-title">{g.title}</div>
              <div className="hub-cards">
                {g.items.map((it) => (
                  <button key={it.href} className="hub-card" onClick={() => go(it)}>
                    <div className="hub-card-top">
                      <span className="hub-card-icon"><Icon name={it.icon} /></span>
                      <span className={"badge " + (it.role === "직원용" ? "blue" : "gray")}>{it.role}</span>
                    </div>
                    <div className="hub-card-label">{it.label}</div>
                    <div className="hub-card-desc">{it.desc}</div>
                    <div className="hub-card-go">바로가기 →</div>
                  </button>
                ))}
              </div>
            </section>
          ))}

          <p className="hub-foot">
            직원에게 배포하는 주소는 <b>/exam</b> 입니다. 평가자용 페이지는 비밀번호 입력 후 이용할 수 있으며, 매장과 본사&물류의 비밀번호는 각각 관리됩니다.
          </p>
        </div>
      </main>
    </div>
  );
}

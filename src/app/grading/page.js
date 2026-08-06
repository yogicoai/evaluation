"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import EvaluatorGate, { PasswordManageButton } from "@/components/EvaluatorGate";
import PeriodBar, { inPeriod, periodLabel } from "@/components/PeriodBar";
import { autoScore, finalScore, statusOf, scoreQuestion, normalize } from "@/lib/scoring";
import { QUESTION_LABELS, QUESTION_SCORES, AUTO_QUESTION_IDS, PASS_SCORE } from "@/lib/examDefaults";

const PAGE_SIZE = 10;

function fmtDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtDateCSV(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtTime(sec) {
  if (!sec) return "-";
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
}
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}
function keyText(key) {
  return Array.isArray(key) ? key.join(" / ") : String(key ?? "");
}

export default function GradingPage() {
  return (
    <EvaluatorGate title="요기보 평가자 대시보드">
      <GradingInner />
    </EvaluatorGate>
  );
}

function GradingInner() {
  const [submissions, setSubmissions] = useState([]);
  const [config, setConfig] = useState(null); // {questions, answerKey}
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);

  // 기간 필터 (제출일 기준)
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [months, setMonths] = useState([]);
  const [multiMonth, setMultiMonth] = useState(false);
  const [range, setRange] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const [subs, cfg] = await Promise.all([
        fetch("/api/exam/submissions").then((r) => r.json()),
        fetch("/api/exam/config").then((r) => r.json())
      ]);
      if (subs.submissions) setSubmissions(subs.submissions);
      if (cfg.questions) setConfig({ questions: cfg.questions, answerKey: cfg.answerKey });
    } finally {
      setLoading(false);
    }
  }

  // 응시 데이터 삭제 — 개인별 / 선택 다건 공통.
  // 복구가 불가능하므로 확인창에서 반드시 경고한다.
  async function removeSubmissions(list) {
    const rows = (Array.isArray(list) ? list : [list]).filter(Boolean);
    if (!rows.length) return;

    const who = rows.length === 1
      ? `${rows[0].name}${rows[0].store ? ` (${rows[0].store})` : ""}님의 응시 데이터`
      : `선택한 응시자 ${rows.length}명의 응시 데이터`;
    if (!confirm(`${who}를 삭제하시겠습니까?\n\n⚠ 삭제한 데이터는 복원할 수 없습니다.\n답안·채점 결과가 모두 사라지며, 해당 직원은 다시 응시할 수 있게 됩니다.`)) return;

    let failed = 0;
    for (const r of rows) {
      const res = await fetch(`/api/exam/submissions/${r.submissionId}`, { method: "DELETE" });
      if (!res.ok) failed++;
    }
    if (rows.some((r) => r.submissionId === selectedId)) setSelectedId(null);
    await refresh();
    alert(failed ? `일부 삭제에 실패했습니다. (실패 ${failed}건)` : "삭제되었습니다.");
  }

  const answerKey = config?.answerKey || {};
  const questions = config?.questions || [];
  // 선택한 기간(제출일 기준)으로 거른 목록
  const periodSubmissions = submissions.filter((s) => inPeriod(s.submittedAt, year, months, range));
  const selected = submissions.find((s) => s.submissionId === selectedId) || null;

  return (
    <>
      {/* 상단: 연도 · 월 · 분기 기간 선택 + 새로고침 + 설정(톱니바퀴) */}
      <PeriodBar
        title="수습평가시험 관리"
        logo="https://yogibo.kr/web/img/icon/logo3_on.png"
        year={year}
        onYearChange={setYear}
        months={months}
        onMonthsChange={setMonths}
        multi={multiMonth}
        onMultiChange={setMultiMonth}
        range={range}
        onRangeChange={setRange}
        right={
          <>
            <button className="btn ghost" onClick={refresh}>{loading ? "불러오는 중..." : "새로고침"}</button>
            <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="설정" aria-label="설정">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </>
        }
      />

      <main className="wrap">
        <section className="card">
          <h1>요기보 직원 역량평가 결과</h1>
          <p>
            1~24번은 자동채점, 25번 서술형은 평가자가 0~4점으로 수동 채점합니다.
            <br />조회 기간: <b>{periodLabel(year, months, range)}</b> · 제출일 기준
          </p>
          <div className="tabs">
            {[["dashboard", "대시보드"], ["analysis", "문항 분석"], ["examEdit", "시험지 편집"], ["key", "정답 한눈에 보기"]].map(([k, label]) => (
              <button key={k} className={"tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
        </section>

        {!config && (
          <section className="card" style={{ marginTop: 18 }}>
            <div className="empty-state">{loading ? "데이터를 불러오는 중입니다..." : "데이터를 불러오지 못했습니다. 새로고침을 눌러 주세요."}</div>
          </section>
        )}

        {tab === "dashboard" && config && (
          <DashboardTab
            submissions={periodSubmissions}
            answerKey={answerKey}
            questions={questions}
            onDelete={removeSubmissions}
            onDeleteMany={removeSubmissions}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            onSaved={refresh}
          />
        )}
        {tab === "analysis" && config && <AnalysisTab submissions={periodSubmissions} answerKey={answerKey} />}
        {tab === "examEdit" && config && (
          <ExamEditTab questions={questions} answerKey={answerKey} onSaved={refresh} />
        )}
        {tab === "key" && config && <KeyTab answerKey={answerKey} />}
      </main>

      {settingsOpen && <GradingSettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  );
}

/* ─── 설정 (톱니바퀴) — 페이지 이동 · 비밀번호 관리 ─── */
function GradingSettingsModal({ onClose }) {
  return (
    <div className="criteria-modal no-print" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="criteria-panel" style={{ width: "min(500px, 100%)" }}>
        <button className="btn ghost criteria-close" onClick={onClose}>닫기</button>
        <div style={{ paddingRight: 80, paddingBottom: 18, borderBottom: "1px solid #eaebee", marginBottom: 4 }}>
          <h2 style={{ fontSize: 22, margin: 0 }}>설정</h2>
          <p style={{ marginTop: 8 }}>페이지 이동과 비밀번호 관리를 여기서 처리합니다.</p>
        </div>

        <div className="criteria-block">
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>페이지 이동</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/overall" className="btn primary">수습 종합평가</Link>
            <Link href="/" className="btn ghost">메인으로</Link>
          </div>
        </div>

        <div className="criteria-block">
          <h3 style={{ fontSize: 15, marginBottom: 6 }}>보안</h3>
          <p className="subtle" style={{ marginBottom: 12 }}>매장 평가 페이지의 접속 비밀번호를 변경합니다.</p>
          <PasswordManageButton scope="store" scopeLabel="매장" />
        </div>
      </div>
    </div>
  );
}

function DashboardTab({ submissions, answerKey, questions, selectedId, setSelectedId, onSaved, onDelete, onDeleteMany }) {
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const stores = useMemo(() => [...new Set(submissions.map((x) => x.store).filter(Boolean))].sort(), [submissions]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return submissions
      .filter((r) => {
        const text = normalize([r.name, r.store, r.role].join(" "));
        const okQ = !q || text.includes(q);
        const okStore = !storeFilter || r.store === storeFilter;
        const status = statusOf(r, answerKey);
        const okSt = !statusFilter || status === statusFilter || (statusFilter === "done" && status !== "pending");
        return okQ && okStore && okSt;
      })
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }, [submissions, search, storeFilter, statusFilter, answerKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const kpi = useMemo(() => {
    const total = submissions.length;
    const avg = total ? Math.round(submissions.reduce((s, r) => s + finalScore(r, answerKey), 0) / total) : 0;
    const pass = total ? Math.round((submissions.filter((r) => statusOf(r, answerKey) === "pass").length / total) * 100) : 0;
    const pending = submissions.filter((r) => statusOf(r, answerKey) === "pending").length;
    const avgSec = total ? Math.round(submissions.reduce((s, r) => s + (r.durationSec || 0), 0) / total) : 0;
    return { total, avg, pass, pending, avgMin: Math.round(avgSec / 60) };
  }, [submissions, answerKey]);

  const storeSummary = useMemo(() => {
    const map = {};
    submissions.forEach((r) => {
      const k = r.store || "미입력";
      (map[k] = map[k] || []).push(r);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [submissions]);

  const selected = submissions.find((x) => x.submissionId === selectedId);

  // 선택 삭제용 체크박스 상태 — 목록이 바뀌면 사라진 항목은 자동으로 정리한다.
  const [checkedIds, setCheckedIds] = useState([]);
  const pageIds = pageRows.map((r) => r.submissionId);
  const allChecked = pageIds.length > 0 && pageIds.every((id) => checkedIds.includes(id));
  const toggleOne = (id) =>
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () =>
    setCheckedIds((prev) => (allChecked ? prev.filter((id) => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])]));
  useEffect(() => {
    const alive = new Set(submissions.map((s) => s.submissionId));
    setCheckedIds((prev) => prev.filter((id) => alive.has(id)));
  }, [submissions]);

  return (
    <>
      <div className="kpis">
        <div className="kpi"><div className="label">총 응시자</div><div className="val">{kpi.total}</div><div className="sub">제출 완료 기준</div></div>
        <div className="kpi"><div className="label">평균 점수</div><div className="val">{kpi.avg}</div><div className="sub">자동·수동 수정 포함</div></div>
        <div className="kpi"><div className="label">합격률</div><div className="val">{kpi.pass}%</div><div className="sub">{PASS_SCORE}점 이상 기준</div></div>
        <div className="kpi"><div className="label">서술형 미채점</div><div className="val">{kpi.pending}</div><div className="sub">25번 점수 미입력</div></div>
        <div className="kpi"><div className="label">평균 소요시간</div><div className="val">{kpi.avgMin}분</div><div className="sub">제출 시간 기준</div></div>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="panel-title">
          <div><h2>응시자 리스트</h2></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {checkedIds.length > 0 && (
              <button className="btn danger" onClick={() => onDeleteMany(submissions.filter((s) => checkedIds.includes(s.submissionId)))}>
                선택 {checkedIds.length}건 삭제
              </button>
            )}
            <span className="badge gray">{filtered.length ? `${filtered.length}명 · ${currentPage}/${totalPages} 페이지` : "0명"}</span>
          </div>
        </div>
        <div className="toolbar">
          <input placeholder="이름/소속/직급 검색" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select value={storeFilter} onChange={(e) => { setStoreFilter(e.target.value); setPage(1); }}>
            <option value="">전체 매장</option>
            {stores.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">전체 상태</option>
            <option value="pending">서술형 미채점</option>
            <option value="done">채점 완료</option>
            <option value="pass">합격</option>
            <option value="fail">불합격</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <colgroup>
              <col style={{ width: 44 }} /><col style={{ width: 130 }} /><col style={{ width: 190 }} /><col style={{ width: 170 }} />
              <col style={{ width: 80 }} /><col style={{ width: 80 }} /><col style={{ width: 80 }} /><col style={{ width: 100 }} /><col style={{ width: 80 }} />
            </colgroup>
            <thead>
              <tr>
                <th onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    style={{ width: "auto", accentColor: "var(--primary)" }}
                    checked={allChecked}
                    onChange={toggleAll}
                    title="현재 페이지 전체 선택"
                  />
                </th>
                <th>제출일</th><th>소속</th><th>이름 / 직급</th><th>자동</th><th>서술</th><th>총점</th><th>상태</th><th>관리</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr><td colSpan={9} className="empty-state">응시 데이터가 없습니다.</td></tr>
              )}
              {pageRows.map((r) => {
                const a = autoScore(r, answerKey).total;
                const m = r.manualScore === null || r.manualScore === "" || typeof r.manualScore === "undefined" ? "-" : r.manualScore;
                const f = finalScore(r, answerKey);
                const st = statusOf(r, answerKey);
                return (
                  <tr key={r.submissionId} className={selectedId === r.submissionId ? "selected" : ""} onClick={() => setSelectedId(r.submissionId)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        style={{ width: "auto", accentColor: "var(--primary)" }}
                        checked={checkedIds.includes(r.submissionId)}
                        onChange={() => toggleOne(r.submissionId)}
                      />
                    </td>
                    <td>{fmtDate(r.submittedAt)}</td>
                    <td><b>{r.store}</b></td>
                    <td><b>{r.name}</b><br /><span style={{ color: "#6b7280" }}>{r.role || ""}</span></td>
                    <td><b>{a}</b></td>
                    <td>{m}</td>
                    <td><b style={{ fontSize: 16 }}>{f}</b></td>
                    <td>
                      {st === "pending" ? <span className="badge warn">미채점</span> : st === "pass" ? <span className="badge ok">합격</span> : <span className="badge danger">불합격</span>}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn danger" style={{ padding: "7px 10px", fontSize: 12 }} onClick={() => onDelete(r)}>삭제</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={currentPage} totalPages={totalPages} onPage={setPage} />
      </section>

      {/* 매장별 요약 배너는 제거하고 응시자 상세만 전체 폭으로 둔다 */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="detail-head">
          <div>
            <h2>응시자 상세</h2>
            <p>응시자 리스트에서 한 명을 선택하면 답안·자동채점·서술형 채점을 확인할 수 있습니다.</p>
          </div>
        </div>
        {!selected && <div className="badge gray">선택된 응시자 없음</div>}
        {selected && (
          <SubmissionDetail
            record={selected}
            answerKey={answerKey}
            questions={questions}
            onSaved={onSaved}
          />
        )}
      </section>
    </>
  );
}

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  const start = Math.max(1, Math.min(page - 3, Math.max(1, totalPages - 6)));
  const end = Math.min(totalPages, start + 6);
  const nums = [];
  for (let i = start; i <= end; i++) nums.push(i);
  return (
    <div className="pagination">
      <span className="page-info">페이지 {page} / {totalPages}</span>
      <button className="page-btn" disabled={page === 1} onClick={() => onPage(page - 1)}>‹</button>
      {nums.map((i) => (
        <button key={i} className={"page-btn" + (i === page ? " active" : "")} onClick={() => onPage(i)}>{i}</button>
      ))}
      <button className="page-btn" disabled={page === totalPages} onClick={() => onPage(page + 1)}>›</button>
    </div>
  );
}

function SubmissionDetail({ record, answerKey, questions, onSaved }) {
  const [manualScore, setManualScore] = useState(record.manualScore ?? "");
  const [memo, setMemo] = useState(record.evaluatorMemo || "");
  const [evalName, setEvalName] = useState(record.evaluatorName || "");
  const [autoEditOpen, setAutoEditOpen] = useState(false); // 자동채점 점수 수정 (같은 화면에서 처리)

  useEffect(() => {
    setManualScore(record.manualScore ?? "");
    setMemo(record.evaluatorMemo || "");
    setEvalName(record.evaluatorName || "");
    setAutoEditOpen(false);
  }, [record.submissionId]);

  const scored = autoScore(record, answerKey);
  const final = finalScore(record, answerKey);
  const st = statusOf(record, answerKey);
  const m = record.manualScore === null || record.manualScore === "" || typeof record.manualScore === "undefined" ? "" : record.manualScore;

  async function saveManual() {
    const val = Number(manualScore);
    if (!Number.isFinite(val) || val < 0 || val > 4) {
      alert("서술형 점수는 0~4점 사이로 입력해 주세요.");
      return;
    }
    const res = await fetch(`/api/exam/submissions/${record.submissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manualScore: val, evaluatorMemo: memo, evaluatorName: evalName })
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      // 채점이 확정되면 서버가 종합평가 대상자로 자동 등록한다.
      alert(
        d.sync?.created
          ? `저장되었습니다.\n${d.sync.name} 님이 수습 종합평가 대상자로 자동 등록되었습니다.`
          : "저장되었습니다."
      );
      onSaved();
    } else {
      alert(d.error || "저장 실패");
    }
  }

  async function deleteSubmission() {
    if (!confirm(`${record.name}${record.store ? ` (${record.store})` : ""}님의 응시 데이터를 삭제하시겠습니까?\n\n⚠ 삭제한 데이터는 복원할 수 없습니다.\n답안·채점 결과가 모두 사라지며, 해당 직원은 다시 응시할 수 있게 됩니다.`)) return;
    const res = await fetch(`/api/exam/submissions/${record.submissionId}`, { method: "DELETE" });
    if (res.ok) {
      alert("삭제되었습니다.");
      onSaved();
    } else {
      alert("삭제 실패");
    }
  }

  return (
    <div>
      <div className="detail-head">
        <div>
          <h2>{record.name} <span style={{ fontSize: 14, color: "#6b7280" }}>/ {record.store}</span></h2>
          <p>{fmtDate(record.submittedAt)} 제출 · {fmtTime(record.durationSec)} 소요</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button className="btn ghost" onClick={() => printExamPDF(record, questions, answerKey)}>응시지 PDF 저장/인쇄</button>
            <button className="btn danger" onClick={deleteSubmission}>응시 삭제 (재응시 허용)</button>
          </div>
          <p className="subtle" style={{ marginTop: 8 }}>버튼을 누른 뒤 브라우저 인쇄창에서 'PDF로 저장'을 선택하면 직원별 응시지를 PDF로 보관할 수 있습니다.</p>
        </div>
        <div style={{ textAlign: "right" }}>
          {st === "pending" ? <span className="badge warn">서술형 미채점</span> : st === "pass" ? <span className="badge ok">합격</span> : <span className="badge danger">불합격</span>}
          <div className="scorebig">{final}</div>
          <p>자동 {scored.total} + 서술 {m === "" ? 0 : m}</p>
        </div>
      </div>
      <div className="detail-meta">
        <div className="meta"><b>직급/구분</b><span>{record.role || "-"}</span></div>
        <div className="meta"><b>제출 ID</b><span>{record.submissionId}</span></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>자동채점 문항</h3>
        <button className="btn ghost" style={{ padding: "8px 12px", fontSize: 13 }} onClick={() => setAutoEditOpen((v) => !v)}>
          {autoEditOpen ? "수정 닫기" : "자동채점 점수 수정"}
        </button>
      </div>
      {autoEditOpen && <AutoScoreEditor record={record} answerKey={answerKey} onSaved={onSaved} onClose={() => setAutoEditOpen(false)} />}
      {!autoEditOpen && (
      <div className="answers">
        {AUTO_QUESTION_IDS.map((qid) => {
          const ans = record.answers?.[qid];
          const s = scored.result[qid];
          const ansText = Array.isArray(ans) ? ans.join(" / ") : ans || "미응답";
          return (
            <div key={qid} className={"ans-row " + (s.overridden ? "manual" : s.correct ? "correct" : "wrong")}>
              <div className="qno">{qid.replace("q", "")}번</div>
              <div className="txt">
                <b>{QUESTION_LABELS[qid]}</b><br />
                답변: {ansText}<br />
                <span style={{ color: "#6b7280" }}>정답: {keyText(answerKey[qid])}</span>
                {s.overridden && (
                  <><br /><span className="override-note">수정 적용: 자동 {s.rawScore}/{s.max} → {s.score}/{s.max}{s.overrideMemo ? ` · ${s.overrideMemo}` : ""}</span></>
                )}
              </div>
              <div><b>{s.score}/{s.max}</b></div>
            </div>
          );
        })}
      </div>
      )}
      <div className="essay-box">
        <h3>25번 서술형 수동채점</h3>
        <p>평가기준: 공감 표현, 가격 방어, 요기보 특징 설명, 자연스러운 응대 흐름</p>
        <div className="essay-answer">{record.answers?.q25 || "미응답"}</div>
        <div className="manual-grid">
          <label className="field"><span>서술형 점수 0~4점</span>
            <input type="number" min={0} max={4} step={1} value={manualScore} onChange={(e) => setManualScore(e.target.value)} />
          </label>
          <label className="field"><span>평가자</span>
            <input value={evalName} placeholder="평가자 이름" onChange={(e) => setEvalName(e.target.value)} />
          </label>
        </div>
        <label className="field" style={{ display: "block", marginTop: 10 }}><span>평가자 메모</span>
          <textarea rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </label>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn ok" onClick={saveManual}>서술형 점수 저장</button>
        </div>
      </div>
    </div>
  );
}

function AnalysisTab({ submissions, answerKey }) {
  const total = submissions.length;
  return (
    <section className="card" style={{ marginTop: 18 }}>
      <h2>문항별 정답률</h2>
      <p style={{ marginBottom: 14 }}>정답률이 낮은 문항은 교육 보완 포인트로 활용할 수 있습니다. 25번은 수동채점 문항이라 분석에서 제외됩니다.</p>
      <div className="item-grid">
        {AUTO_QUESTION_IDS.map((qid) => {
          let correct = 0, avg = 0;
          submissions.forEach((r) => {
            const s = autoScore(r, answerKey).result[qid];
            if (s.correct) correct++;
            avg += s.score;
          });
          const rate = total ? Math.round((correct / total) * 100) : 0;
          const avgScore = total ? Math.round((avg / total) * 10) / 10 : 0;
          const cls = rate < 70 ? "danger" : rate < 85 ? "warn" : "ok";
          return (
            <div key={qid} className="item-row">
              <div><b>{qid.replace("q", "")}번</b></div>
              <div>
                {QUESTION_LABELS[qid]}
                <div className="barline" style={{ marginTop: 8 }}><span style={{ width: `${rate}%` }} /></div>
              </div>
              <div><span className={"badge " + cls}>{rate}%</span></div>
              <div>{avgScore} / {QUESTION_SCORES[qid]}점</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// 자동채점 점수 수정 — 응시자 상세 안에서 펼쳐 쓴다 (별도 탭을 오가지 않도록 통합)
function AutoScoreEditor({ record, answerKey, onSaved, onClose }) {
  const [edits, setEdits] = useState({});
  const [editorName, setEditorName] = useState("");

  useEffect(() => {
    setEdits({});
  }, [record?.submissionId]);

  if (!record) return null;

  const scored = autoScore(record, answerKey);

  function getEdit(qid) {
    const s = scored.result[qid];
    const override = record.autoOverrides?.[qid] || {};
    return edits[qid] ?? { score: String(s.score), memo: override.memo || "" };
  }

  async function save() {
    const overrides = {};
    for (const qid of AUTO_QUESTION_IDS) {
      const raw = scoreQuestion(qid, record.answers?.[qid], answerKey);
      const e = getEdit(qid);
      const val = Number(e.score);
      const memo = (e.memo || "").trim();
      if (!Number.isFinite(val) || val < 0 || val > raw.max) {
        alert(`${qid.replace("q", "")}번 점수는 0~${raw.max} 사이로 입력해야 합니다.`);
        return;
      }
      if (val !== raw.score || memo) {
        overrides[qid] = { score: val, memo, evaluatorName: editorName, editedAt: new Date().toISOString() };
      }
    }
    const res = await fetch(`/api/exam/submissions/${record.submissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoOverrides: overrides })
    });
    if (res.ok) {
      alert("자동채점 수정값이 저장되었습니다.");
      onSaved();
      onClose?.();
    } else {
      alert("저장 실패");
    }
  }

  async function reset() {
    if (!confirm("모든 자동채점 수정값을 삭제하고 기본 자동채점 결과로 되돌리시겠습니까?")) return;
    const res = await fetch(`/api/exam/submissions/${record.submissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoOverrides: {} })
    });
    if (res.ok) {
      setEdits({});
      alert("기본 자동채점 결과로 되돌렸습니다.");
      onSaved();
    }
  }

  return (
    <div className="auto-edit-panel">
      <div className="panel-title" style={{ alignItems: "center" }}>
        <div>
          <b style={{ fontSize: 14 }}>자동채점 점수 수정</b>
          <p style={{ fontSize: 13, marginTop: 4 }}>자동채점이 예외적으로 잘못 적용된 경우에만 사용하세요. 수정값은 총점·CSV·대시보드에 반영됩니다.</p>
        </div>
        <label className="field" style={{ width: 190, flex: "none" }}><span>수정 평가자 이름</span>
          <input value={editorName} placeholder="선택 입력" onChange={(e) => setEditorName(e.target.value)} />
        </label>
      </div>
      <div className="auto-edit-list">
        {AUTO_QUESTION_IDS.map((qid) => {
          const s = scored.result[qid];
          const ans = record.answers?.[qid];
          const answerText = Array.isArray(ans) ? ans.join(" / ") : ans || "미응답";
          const e = getEdit(qid);
          return (
            <div key={qid} className="auto-edit-row">
              <div><b>{qid.replace("q", "")}번</b><br /><span style={{ fontSize: 12, color: "#6b7280" }}>{QUESTION_LABELS[qid]}</span></div>
              <div className="answer">
                <b>응시자 답변</b>{answerText}<br />
                <span style={{ color: "#6b7280" }}>정답: {keyText(answerKey[qid])}</span>
              </div>
              <div className="auto">자동 {s.rawScore}/{s.max}</div>
              <label className="field"><span>적용 점수</span>
                <input
                  type="number" min={0} max={s.max} step={0.5} value={e.score}
                  onChange={(ev) => setEdits((prev) => ({ ...prev, [qid]: { ...e, score: ev.target.value } }))}
                />
              </label>
              <label className="field"><span>수정 사유/메모</span>
                <input
                  value={e.memo} placeholder="필요 시 입력"
                  onChange={(ev) => setEdits((prev) => ({ ...prev, [qid]: { ...e, memo: ev.target.value } }))}
                />
              </label>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <button className="btn ok" onClick={save}>자동채점 수정 저장</button>
        <button className="btn ghost" onClick={reset}>자동채점 점수로 되돌리기</button>
        <button className="btn ghost" onClick={onClose}>취소</button>
      </div>
    </div>
  );
}

function splitLines(v) { return String(v || "").split(/\n/).map((x) => x.trim()).filter(Boolean); }
function splitComma(v) { return String(v || "").split(",").map((x) => x.trim()).filter(Boolean); }
function splitPipe(v) { return String(v || "").split("|").map((x) => x.trim()).filter(Boolean); }

// 문항 하나를 편집 폼 상태로 변환
function buildExamForm(q, answerKey) {
  const isChoice = (q.type === "single" || q.type === "multi") && q.options;
  const key = answerKey[q.id];
  return {
    title: q.title || "",
    context: q.context || "",
    options: q.options ? [...q.options] : null,
    rows: q.rows ? q.rows.join("\n") : null,
    choices: q.choices ? q.choices.join("\n") : null,
    fields: q.type === "multiShort" ? (q.fields || []).map((f) => (Array.isArray(f) ? f[0] : f)).join("\n") : null,
    answerCount: isChoice ? (Array.isArray(key) ? key.length : 1) : null,
    answerNums: isChoice ? (Array.isArray(key) ? [...key] : [String(key || "1")]) : null,
    answerRaw: !isChoice
      ? q.id === "q22" || q.id === "q23" || q.id === "q24" || q.type === "short" || q.type === "multiShort"
        ? (Array.isArray(key) ? key : [key]).filter(Boolean).join(" | ")
        : Array.isArray(key) ? key.join(", ") : String(key ?? "")
      : null
  };
}

function ExamEditTab({ questions, answerKey, onSaved }) {
  const [selectedQid, setSelectedQid] = useState("q1");
  const q = questions.find((x) => x.id === selectedQid) || questions[0];
  // 폼을 effect가 아니라 렌더 중에 동기화한다.
  // effect로 채우면 문항 전환 직후 한 프레임 동안 이전 문항의 폼이 남아
  // (객관식 → 단답형 이동 시) answerRaw가 null인 채로 input에 들어간다.
  // src에는 문항·정답 객체 참조를 담아, 저장/복원으로 원본이 갱신될 때도 폼이 다시 만들어지도록 한다.
  const [state, setState] = useState({ src: null, form: null });
  if (q && (state.src?.q !== q || state.src?.key !== answerKey[q.id])) {
    setState({ src: { q, key: answerKey[q.id] }, form: buildExamForm(q, answerKey) });
  }
  const form = state.src?.q === q ? state.form : null;
  const setForm = (next) => setState((prev) => ({ ...prev, form: typeof next === "function" ? next(prev.form) : next }));

  // 문항을 고르면 편집 영역으로 이동한다.
  // (좁은 화면에서는 폼이 문항 목록 아래에 있어 매번 직접 스크롤해서 찾아야 했다)
  const formRef = useRef(null);
  function selectQuestion(qid) {
    setSelectedQid(qid);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  if (!q || !form) return null;
  const isChoice = (q.type === "single" || q.type === "multi") && q.options;
  const typeName = isChoice ? "객관식" : ({ match: "연결형", oxgroup: "OX형", short: "단답형", multiShort: "다중 단답형", essay: "서술형" }[q.type] || q.type);

  async function save() {
    if (!form.title.trim()) { alert("문제 문구를 입력해 주세요."); return; }
    const nextQ = { ...q, title: form.title.trim() };
    if (form.context.trim()) nextQ.context = form.context.trim(); else delete nextQ.context;

    if (form.options) {
      const opts = form.options.map((v) => v.trim());
      if (opts.some((v) => !v)) { alert("모든 보기를 입력해 주세요."); return; }
      nextQ.options = opts;
    }
    if (form.rows !== null) {
      const rows = splitLines(form.rows);
      if (rows.length !== q.rows.length) { alert(`세부 문항은 ${q.rows.length}개를 유지해 주세요.`); return; }
      nextQ.rows = rows;
    }
    if (form.choices !== null) {
      const choices = splitLines(form.choices);
      if (choices.length !== q.choices.length) { alert(`연결 선택지는 ${q.choices.length}개를 유지해 주세요.`); return; }
      nextQ.choices = choices;
    }
    if (form.fields !== null) {
      const fields = splitLines(form.fields);
      if (fields.length !== q.fields.length) { alert(`약자 항목은 ${q.fields.length}개를 유지해 주세요.`); return; }
      nextQ.fields = fields.map((f) => [f, ""]);
    }

    let nextKey = answerKey[q.id];
    if (q.type !== "essay") {
      if (isChoice) {
        const count = form.answerCount;
        const selected = form.answerNums.slice(0, count);
        if (selected.some((v) => !v)) { alert("정답 번호를 모두 선택해 주세요."); return; }
        if (new Set(selected).size !== selected.length) { alert("정답 번호는 서로 다르게 선택해 주세요."); return; }
        nextQ.type = count === 2 ? "multi" : "single";
        nextKey = count === 2 ? selected : selected[0];
      } else {
        const raw = form.answerRaw.trim();
        if (!raw) { alert("정답을 입력해 주세요."); return; }
        if (q.type === "match") nextKey = splitComma(raw).map((v) => v.toLowerCase());
        else if (q.type === "oxgroup") nextKey = splitComma(raw).map((v) => v.toUpperCase());
        else if (q.type === "short" || q.type === "multiShort") nextKey = splitPipe(raw);
      }
    }

    if (!confirm("저장하면 변경된 정답 기준으로 기존 응시자의 자동점수도 다시 계산됩니다. 저장하시겠습니까?")) return;

    const nextQuestions = questions.map((x) => (x.id === q.id ? nextQ : x));
    const nextAnswerKey = { ...answerKey, [q.id]: nextKey };
    delete nextAnswerKey.q25;

    const res = await fetch("/api/exam/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: nextQuestions, answerKey: nextAnswerKey })
    });
    if (res.ok) {
      alert("문항과 정답이 저장되었습니다. 직원용 시험지는 다음 응시부터 변경 내용이 반영됩니다.");
      onSaved();
    } else {
      alert("저장 실패");
    }
  }

  async function restoreDefault() {
    if (!confirm("기본 시험지와 기본 정답으로 복원하시겠습니까? 현재 수정 내용은 삭제됩니다.")) return;
    const res = await fetch("/api/exam/config", { method: "DELETE" });
    if (res.ok) {
      alert("기본 시험지로 복원되었습니다.");
      onSaved();
    }
  }

  const answerHelp =
    q.id === "q25" ? "25번은 평가자 수동채점 문항입니다. 정답 입력이 없습니다."
      : q.type === "match" ? "행 순서대로 선택값을 쉼표로 구분해 입력하세요. 예: c, b, a"
        : q.type === "oxgroup" ? "행 순서대로 O 또는 X를 쉼표로 구분해 입력하세요. 예: O, O, X, O"
          : q.type === "short" ? "복수 정답을 허용하려면 | 기호로 구분하세요. 띄어쓰기는 자동채점에 영향이 없습니다."
            : q.type === "multiShort" ? "각 항목의 정답을 | 기호로 구분하세요. 예: 의자 | 리클라이너 | 침대 | 소파 | 세탁 가능 | 내구성 | 공간 활용 | 가벼움"
              : "";

  return (
    <section className="card" style={{ marginTop: 18 }}>
      <div className="panel-title">
        <div>
          <h2>시험지 문항 · 정답 편집</h2>
          <p>문항 수와 유형은 유지하면서 문제 문구, 상황 설명, 보기, 정답을 수정할 수 있습니다.</p>
        </div>
        <span className="badge blue">직원용 시험지 연동</span>
      </div>
      <div className="editor-note">
        정답을 변경하면 기존 응시자의 자동채점 점수도 변경된 기준으로 다시 계산됩니다.
        실제 시험 진행 중에는 문항과 정답을 수정하지 않는 것을 권장합니다.
      </div>
      <div className="exam-editor-layout">
        <div className="exam-question-menu">
          {questions.map((x) => (
            <button key={x.id} className={"exam-q-btn" + (x.id === selectedQid ? " active" : "")} onClick={() => selectQuestion(x.id)}>
              <span className="exam-q-num">{x.no}</span>
              <span className="exam-q-txt">{x.title}</span>
            </button>
          ))}
        </div>
        <div className="exam-editor-form" ref={formRef}>
          <div className="panel-title">
            <div>
              <h2 style={{ margin: 0 }}>문항 {q.no} 편집</h2>
              <p style={{ marginTop: 5 }}>문항 유형: {typeName} · 배점 {q.score}점</p>
            </div>
            <span className="badge gray">{typeName}</span>
          </div>
          <div className="editor-section">
            <h3>문제 문구</h3>
            <textarea rows={3} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="editor-section">
            <h3>상황/설명 문구</h3>
            <textarea rows={4} placeholder="해당 문항에 설명문이 없으면 비워두세요." value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} />
          </div>
          {form.options && (
            <div className="editor-section">
              <h3>보기 편집</h3>
              {form.options.map((op, i) => (
                <div key={i} className="editor-option-row">
                  <div className="editor-option-no">{i + 1}</div>
                  <textarea
                    rows={2} value={op}
                    onChange={(e) => {
                      const next = [...form.options];
                      next[i] = e.target.value;
                      setForm({ ...form, options: next });
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          {form.rows !== null && (
            <div className="editor-section">
              <h3>{q.type === "match" ? "연결할 항목" : "세부 문항"} 편집</h3>
              <textarea rows={Math.max(4, q.rows.length)} value={form.rows} onChange={(e) => setForm({ ...form, rows: e.target.value })} />
              <div className="editor-answer-help">한 줄에 하나씩 입력하세요.</div>
            </div>
          )}
          {form.choices !== null && (
            <div className="editor-section">
              <h3>연결 선택지 편집</h3>
              <textarea rows={Math.max(4, q.choices.length)} value={form.choices} onChange={(e) => setForm({ ...form, choices: e.target.value })} />
              <div className="editor-answer-help">한 줄에 하나씩 입력하세요. 선택값은 기존 순서(a, b, c)를 유지합니다.</div>
            </div>
          )}
          {form.fields !== null && (
            <div className="editor-section">
              <h3>약자 항목 편집</h3>
              <textarea rows={Math.max(4, (q.fields || []).length)} value={form.fields} onChange={(e) => setForm({ ...form, fields: e.target.value })} />
              <div className="editor-answer-help">한 줄에 하나씩 입력하세요.</div>
            </div>
          )}
          {q.type === "essay" ? (
            <div className="editor-section">
              <h3>채점 방식</h3>
              <div className="editor-note" style={{ marginTop: 0 }}>서술형은 평가자가 답변을 확인한 후 0~4점으로 직접 채점합니다.</div>
            </div>
          ) : isChoice ? (
            <div className="editor-section">
              <h3>정답 편집</h3>
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12, alignItems: "end" }}>
                <label className="field">
                  <span>정답 개수</span>
                  <select
                    value={form.answerCount}
                    onChange={(e) => {
                      const count = Number(e.target.value);
                      let nums = form.answerNums.slice(0, count);
                      while (nums.length < count) {
                        const cand = q.options.map((_, i) => String(i + 1)).find((v) => !nums.includes(v)) || "";
                        nums.push(cand);
                      }
                      setForm({ ...form, answerCount: count, answerNums: nums });
                    }}
                  >
                    <option value={1}>1개</option>
                    <option value={2}>2개</option>
                  </select>
                </label>
                <div style={{ display: "grid", gridTemplateColumns: form.answerCount === 1 ? "1fr" : "1fr 1fr", gap: 10 }}>
                  {Array.from({ length: form.answerCount }, (_, i) => (
                    <label key={i} className="field">
                      <span>정답 번호 {i + 1}</span>
                      <select
                        value={form.answerNums[i] || ""}
                        onChange={(e) => {
                          const next = [...form.answerNums];
                          next[i] = e.target.value;
                          setForm({ ...form, answerNums: next });
                        }}
                      >
                        <option value="">번호 선택</option>
                        {q.options.map((_, j) => (
                          <option key={j} value={String(j + 1)}>{j + 1}번</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
              <div className="editor-answer-help">정답 개수를 1개로 설정하면 직원용 시험에서 단일선택으로, 2개로 설정하면 복수선택으로 표시됩니다.</div>
            </div>
          ) : (
            <div className="editor-section">
              <h3>정답 편집</h3>
              <input value={form.answerRaw} onChange={(e) => setForm({ ...form, answerRaw: e.target.value })} />
              <div className="editor-answer-help">{answerHelp}</div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <button className="btn primary" onClick={save}>문항·정답 저장</button>
            <button className="btn ghost" onClick={restoreDefault}>기본 시험지로 복원</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function KeyTab({ answerKey }) {
  return (
    <section className="card" style={{ marginTop: 18 }}>
      <h2>정답 한눈에 보기</h2>
      <p style={{ marginBottom: 14 }}>
        현재 적용 중인 정답입니다. 직원용 화면에는 정답 데이터가 내려가지 않으며, 평가자용에서만 자동채점합니다.
        <br />정답을 수정하려면 <b>시험지 편집</b> 탭을 이용하세요.
      </p>
      <div className="answer-key">
        {Object.entries(answerKey).map(([qid, key]) => (
          <div key={qid} className="key-item">
            <b>{qid.replace("q", "")}번</b><br />
            {QUESTION_LABELS[qid]}<br />
            <span style={{ color: "#1d4ed8", fontWeight: 900 }}>{keyText(key)}</span>
          </div>
        ))}
        <div className="key-item">
          <b>25번</b><br />서술형<br />
          <span style={{ color: "#b45309", fontWeight: 900 }}>평가자 수동채점</span>
        </div>
      </div>
    </section>
  );
}

// ---- CSV / PDF ----
function exportCSV(submissions, answerKey) {
  const headers = ["제출일시", "소속", "이름", "직급", "소요시간(분)", "자동점수", "서술점수", "총점", "평가자", "평가메모"];
  const rows = submissions.map((r) => {
    const minutes = r.durationSec ? Math.round((r.durationSec / 60) * 10) / 10 : "";
    return [fmtDateCSV(r.submittedAt), r.store, r.name, r.role, minutes, autoScore(r, answerKey).total, r.manualScore, finalScore(r, answerKey), r.evaluatorName, r.evaluatorMemo];
  });
  const csv = "﻿" + [headers, ...rows].map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "yogibo_exam_results.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

function printOptionLine(n, text, selected, correct) {
  return `<div class="opt ${selected ? "selected" : ""} ${correct ? "correct" : ""}"><span class="box">${selected ? "✓" : ""}</span><span>${n}) ${esc(text)}</span>${correct ? '<span class="key">정답</span>' : ""}</div>`;
}

function renderPrintQuestion(q, r, answerKey) {
  const qid = q.id;
  const ans = r.answers?.[qid];
  const key = answerKey[qid];
  let body = "";
  if (q.type === "single" || q.type === "multi") {
    const vals = Array.isArray(ans) ? ans : [ans];
    const keys = Array.isArray(key) ? key : [key];
    body = q.options.map((op, i) => printOptionLine(i + 1, op, vals.includes(String(i + 1)), keys.includes(String(i + 1)))).join("");
  } else if (q.type === "match") {
    body = `<table class="match"><thead><tr><th>항목</th><th>응시자 답변</th><th>정답</th></tr></thead><tbody>${q.rows
      .map((row, i) => `<tr><td>${esc(row)}</td><td class="${normalize((ans || [])[i]) === normalize(key[i]) ? "correct-text" : ""}">${esc((ans || [])[i] || "미응답")}</td><td>${esc(key[i])}</td></tr>`)
      .join("")}</tbody></table>`;
  } else if (q.type === "oxgroup") {
    body = q.rows
      .map((row, i) => `<div class="opt ${(ans || [])[i] === key[i] ? "selected correct" : ""}"><span class="box">${(ans || [])[i] || ""}</span><span>${i + 1}) ${esc(row)}</span><span class="key">정답 ${key[i]}</span></div>`)
      .join("");
  } else if (q.type === "short") {
    const keys = Array.isArray(key) ? key : [key];
    const ok = keys.map(normalize).includes(normalize(ans));
    body = `<div class="answer-line ${ok ? "correct" : ""}"><b>응시자 답변:</b> ${esc(ans || "미응답")}<br><span>정답: ${esc(keys.join(" / "))}</span></div>`;
  } else if (q.type === "multiShort") {
    body = `<table class="match"><thead><tr><th>약자</th><th>응시자 답변</th><th>정답</th></tr></thead><tbody>${q.fields
      .map((field, i) => {
        const label = Array.isArray(field) ? field[0] : field;
        return `<tr><td>${esc(label)}</td><td class="${normalize((ans || [])[i]) === normalize(key[i]) ? "correct-text" : ""}">${esc((ans || [])[i] || "미응답")}</td><td>${esc(key[i])}</td></tr>`;
      })
      .join("")}</tbody></table>`;
  } else if (q.type === "essay") {
    body = `<div class="essay"><b>응시자 답변</b><br>${esc(ans || "미응답").replace(/\n/g, "<br>")}<hr><b>평가자 수동채점:</b> ${r.manualScore ?? "미채점"} / 4점<br><b>평가자 메모:</b> ${esc(r.evaluatorMemo || "-")}</div>`;
  }
  const score = qid === "q25" ? r.manualScore ?? "미채점" : autoScore(r, answerKey).result[qid].score;
  return `<section class="question"><div class="qhead"><b>${q.no}. ${esc(q.title)}</b><span>${score} / ${q.score}점</span></div>${q.context ? `<div class="context">${esc(q.context).replace(/\n/g, "<br>")}</div>` : ""}${body}</section>`;
}

function printExamPDF(r, questions, answerKey) {
  const auto = autoScore(r, answerKey);
  const total = finalScore(r, answerKey);
  const html = questions.map((q) => renderPrintQuestion(q, r, answerKey)).join("");
  const w = window.open("", "_blank", "width=920,height=900");
  if (!w) {
    alert("팝업이 차단되었습니다. 브라우저 팝업 차단을 해제한 뒤 다시 시도해 주세요.");
    return;
  }
  w.document.open();
  w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(r.name)}_요기보_응시지</title><style>
    body{font-family:Pretendard,'Noto Sans KR',Arial,sans-serif;color:#111827;margin:28px;font-size:12px;line-height:1.55}
    .header{border-bottom:2px solid #111827;padding-bottom:14px;margin-bottom:18px}
    .title{font-size:24px;font-weight:900;margin:0 0 8px}
    .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    .meta div{background:#f4f6f8;border:1px solid #dfe3e8;border-radius:8px;padding:8px}
    .question{break-inside:avoid;border:1px solid #dfe3e8;border-radius:10px;padding:13px;margin:0 0 12px}
    .qhead{display:flex;justify-content:space-between;gap:12px;font-size:14px;margin-bottom:10px}
    .qhead span{white-space:nowrap;font-weight:900;color:#1d4ed8}
    .context{padding:10px;border:1px solid #bfdbfe;background:#f8fbff;border-radius:8px;white-space:pre-line;margin-bottom:10px;color:#1e3a8a}
    .opt{display:flex;gap:8px;align-items:flex-start;padding:7px 8px;border-radius:7px}
    .opt.selected{background:#eef4ff}
    .opt.correct{outline:1px solid #86efac;background:#f0fdf4}
    .box{display:inline-grid;place-items:center;width:17px;height:17px;border:1px solid #9ca3af;border-radius:3px;font-weight:900;flex:none}
    .key{margin-left:auto;color:#047857;font-weight:900;white-space:nowrap}
    .answer-line,.essay{border:1px solid #dfe3e8;background:#fafafa;border-radius:8px;padding:10px}
    .answer-line.correct{border-color:#86efac;background:#f0fdf4}
    .match{width:100%;border-collapse:collapse}
    .match th,.match td{border:1px solid #dfe3e8;padding:7px;text-align:left}
    .match th{background:#f4f6f8}
    .correct-text{background:#f0fdf4;font-weight:900}
    .footer{margin-top:18px;color:#6b7280;font-size:10px}
    @media print{body{margin:12mm}.question{page-break-inside:avoid}}
  </style></head><body>
  <div class="header"><img src="https://yogibo.kr/web/img/icon/logo3_on.png" alt="Yogibo" style="height:18px;display:block;margin-bottom:10px"><h1 class="title">직원 역량평가 응시지</h1>
  <div class="meta">
    <div><b>소속</b><br>${esc(r.store)}</div><div><b>이름</b><br>${esc(r.name)}</div>
    <div><b>직급</b><br>${esc(r.role || "-")}</div><div><b>제출일</b><br>${esc(fmtDate(r.submittedAt))}</div>
    <div><b>자동점수</b><br>${auto.total} / 96점</div><div><b>서술형</b><br>${r.manualScore ?? "미채점"} / 4점</div>
    <div><b>총점</b><br>${total} / 100점</div><div><b>소요시간</b><br>${esc(fmtTime(r.durationSec))}</div>
  </div></div>
  ${html}
  <div class="footer">출력일: ${new Date().toLocaleString("ko-KR")} · 평가자: ${esc(r.evaluatorName || "-")}</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),250);<\/script></body></html>`);
  w.document.close();
}

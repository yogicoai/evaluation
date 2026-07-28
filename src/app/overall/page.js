"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import EvaluatorGate, { PasswordManageButton } from "@/components/EvaluatorGate";
import DatePicker from "@/components/DatePicker";
import { normalize } from "@/lib/scoring";
import { HR_ITEMS, GRADE_SCORE, matchName, parseNumberValue, isSalesExcluded } from "@/lib/salesEval";
import { calculateTotal, calculateCompetency, completion, matchExam, fmtNum, fmtMoney, fmtPct, formatRawCell } from "@/lib/overallCalc";

const PAGE_SIZE = 10;

function fmtDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function toDateInput(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function OverallPage() {
  return (
    <EvaluatorGate title="요기보 수습 종합평가">
      <OverallInner />
    </EvaluatorGate>
  );
}

function OverallInner() {
  const [employees, setEmployees] = useState([]);
  const [exams, setExams] = useState([]);
  const [answerKey, setAnswerKey] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("overview");
  const [modal, setModal] = useState(null); // overall | hr | sales | staff
  const [printMode, setPrintMode] = useState("summary");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [emps, subs, cfg] = await Promise.all([
        fetch("/api/evaluation/employees").then((r) => r.json()),
        fetch("/api/exam/submissions").then((r) => r.json()),
        fetch("/api/exam/config").then((r) => r.json())
      ]);
      const list = emps.employees || [];
      setEmployees(list);
      setExams(subs.submissions || []);
      setAnswerKey(cfg.answerKey || {});
      setSelectedId((prev) => (prev && list.some((e) => e.id === prev) ? prev : list[0]?.id || null));
    } finally {
      setLoading(false);
    }
  }

  async function saveEmployee(id, patch, { silent = true } = {}) {
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const res = await fetch(`/api/evaluation/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    if (!res.ok) {
      alert("저장에 실패했습니다. 네트워크를 확인해 주세요.");
      loadAll();
      return false;
    }
    if (!silent) alert("저장되었습니다.");
    return true;
  }

  const selected = employees.find((e) => e.id === selectedId) || null;

  async function addEmployee() {
    const name = prompt("직원 이름을 입력해 주세요.");
    if (!name) return;
    const store = prompt("소속 매장을 입력해 주세요.", "") ?? "";
    const role = prompt("직급을 입력해 주세요. (매니저/부매니저/시니어/수습)", "수습") || "수습";
    const res = await fetch("/api/evaluation/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, store, role })
    });
    const data = await res.json();
    if (res.ok) {
      setEmployees((prev) => [data.employee, ...prev]);
      setSelectedId(data.employee.id);
    } else {
      alert(data.error || "추가 실패");
    }
  }

  async function addFromStaff(members) {
    let added = 0;
    for (const m of members) {
      const exists = employees.some((e) => normalize(e.name) === normalize(m.name) && normalize(e.store) === normalize(m.store));
      if (exists) continue;
      const res = await fetch("/api/evaluation/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: m.name, store: m.store, role: m.role || "수습" })
      });
      if (res.ok) added++;
    }
    await loadAll();
    setModal(null);
    alert(`${added}명을 종합평가 대상자로 추가했습니다.${members.length - added > 0 ? ` (이미 등록된 ${members.length - added}명 제외)` : ""}`);
  }

  async function importFromExam() {
    if (!exams.length) {
      alert("불러올 시험 응시 데이터가 없습니다.");
      return;
    }
    let added = 0;
    for (const x of exams) {
      if (!x.name) continue;
      const exists = employees.some((e) => normalize(e.name) === normalize(x.name) && normalize(e.store) === normalize(x.store));
      if (exists) continue;
      const res = await fetch("/api/evaluation/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: x.name, store: x.store || "", role: x.role || "수습" })
      });
      if (res.ok) {
        const data = await res.json();
        await fetch(`/api/evaluation/employees/${data.employee.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ competency: { ...data.employee.competency, sourceId: x.submissionId || "" } })
        });
        added++;
      }
    }
    await loadAll();
    alert(`${added}명을 종합평가 대상자로 추가했습니다.`);
  }

  async function syncCompetency(emp, { silent = false } = {}) {
    const m = matchExam(emp, exams);
    if (!m) {
      if (!silent) alert("이름/소속 기준으로 연결할 시험 응시 결과를 찾지 못했습니다.");
      return false;
    }
    await saveEmployee(emp.id, {
      competency: { ...(emp.competency || {}), sourceId: m.submissionId, override: "", lastSyncAt: new Date().toISOString() }
    });
    if (!silent) alert("역량평가 점수를 동기화했습니다.");
    return true;
  }

  async function syncAll() {
    let n = 0;
    for (const e of employees) {
      if (await syncCompetency(e, { silent: true })) n++;
    }
    alert(`${n}명의 역량평가 점수를 동기화했습니다.`);
  }

  function doPrint(mode) {
    if (!selected) {
      alert("인쇄할 직원을 선택해 주세요.");
      return;
    }
    setPrintMode(mode);
    setTimeout(() => window.print(), 120);
  }

  // 평가 대상자 삭제 (해당 직원의 인사카드·매출·역량 평가가 함께 삭제됨)
  async function deleteEmployee(emp) {
    if (!emp) return;
    if (!confirm(`${emp.name}${emp.store ? ` (${emp.store})` : ""}님에 대한 수습 평가 삭제를 진행하시겠습니까?\n인사카드·매출·역량 평가 내용이 모두 삭제되며 복구할 수 없습니다.`)) return;
    const res = await fetch(`/api/evaluation/employees/${emp.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("삭제에 실패했습니다.");
      return;
    }
    await loadAll();
    alert("삭제되었습니다.");
  }

  // 평가 대상자 전체 삭제 (테스트 데이터 정리용)
  async function deleteAllEmployees() {
    if (!employees.length) {
      alert("삭제할 평가 대상자가 없습니다.");
      return;
    }
    if (!confirm(`등록된 수습 평가 ${employees.length}건을 모두 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.`)) return;
    if (!confirm("정말 전체 삭제를 진행하시겠습니까?")) return;
    let failed = 0;
    for (const e of employees) {
      const res = await fetch(`/api/evaluation/employees/${e.id}`, { method: "DELETE" });
      if (!res.ok) failed++;
    }
    await loadAll();
    alert(failed ? `일부 삭제에 실패했습니다. (실패 ${failed}건)` : "전체 삭제되었습니다.");
  }

  function exportCSV() {
    const headers = ["소속", "이름", "직급", "평가기간", "인사카드 원점수", "인사카드 반영점수", "매장매출기여도", "기여도점수", "개인매출순위", "개인매출점수", "매출총점", "역량평가 원점수", "역량평가 반영점수", "종합점수", "종합평가 의견"];
    const rows = employees.map((e) => {
      const r = calculateTotal(e, exams, answerKey);
      return [e.store, e.name, e.role, e.period, r.hr.raw, fmtNum(r.hr.weighted, 1), fmtPct(r.sales.share), r.sales.contribution, `${r.sales.rank || ""}/${r.sales.population || ""}`, r.sales.individual, r.sales.total, fmtNum(r.comp.raw, 1), fmtNum(r.comp.weighted, 1), fmtNum(r.total, 1), e.finalMemo];
    });
    const csv = "﻿" + [headers, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Yogibo_수습직원_종합평가.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <div className="app-screen">
        <div className="topbar no-print">
          <div className="topbar-inner" style={{ maxWidth: 1520 }}>
            <div className="brand"><img className="brand-logo" src="https://yogibo.kr/web/img/icon/logo3_on.png" alt="Yogibo" /><div>수습 종합평가</div></div>
            <div className="top-actions">
              <Link href="/" className="btn ghost">홈</Link>
              <Link href="/grading" className="btn ghost">수습평가시험 관리 →</Link>
              <button className="btn ghost" onClick={syncAll}>역량평가 점수 동기화</button>
              <button className="btn ghost" onClick={exportCSV}>CSV 다운로드</button>
              <button className="btn ghost" onClick={() => doPrint("hr")}>인사카드 인쇄</button>
              <button className="btn ghost" onClick={() => doPrint("sales")}>매출 평가 인쇄</button>
              <PasswordManageButton />
              <button className="btn primary" onClick={() => doPrint("summary")}>종합평가표 인쇄</button>
            </div>
          </div>
        </div>

        <main className="wrap" style={{ maxWidth: 1520 }}>
          <section style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <h1>수습직원 종합 평가 대시보드</h1>
              <p>인사카드 평가 · 매출 평가 · 역량평가를 하나의 기준으로 합산합니다. 매출 평가는 오프라인 서버 자동 연동 또는 엑셀 업로드로 산정합니다.</p>
            </div>
            <div style={{ display: "grid", gap: 10, justifyItems: "end" }}>
              <button className="btn ghost" onClick={() => setModal("overall")}>종합 평가 기준</button>
              <div className="weight-pill">
                <span className="pill">인사카드 <b>20%</b></span>
                <span className="pill">매출 <b>50%</b></span>
                <span className="pill">역량평가 <b>30%</b></span>
              </div>
            </div>
          </section>

          <Kpis employees={employees} exams={exams} answerKey={answerKey} selected={selected} />

          <nav className="tabs">
            {[["overview", "종합 대시보드"], ["hr", "1. 인사카드 평가"], ["sales", "2. 매출 평가"], ["competency", "3. 역량평가 연동"], ["settings", "기준 및 데이터 관리"]].map(([k, label]) => (
              <button key={k} className={"tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>{label}</button>
            ))}
            <button className="btn ghost" style={{ marginLeft: "auto" }} onClick={loadAll}>{loading ? "불러오는 중..." : "새로고침"}</button>
          </nav>

          {tab === "overview" && (
            <OverviewTab
              employees={employees} exams={exams} answerKey={answerKey}
              selectedId={selectedId} setSelectedId={setSelectedId}
              addEmployee={addEmployee} importFromExam={importFromExam}
              openStaffModal={() => setModal("staff")} setTab={setTab}
              onDelete={deleteEmployee} onDeleteAll={deleteAllEmployees}
            />
          )}
          {tab === "hr" && <HrTab emp={selected} saveEmployee={saveEmployee} openCriteria={() => setModal("hr")} />}
          {tab === "sales" && <SalesTab emp={selected} exams={exams} answerKey={answerKey} saveEmployee={saveEmployee} openCriteria={() => setModal("sales")} />}
          {tab === "competency" && <CompetencyTab emp={selected} exams={exams} answerKey={answerKey} saveEmployee={saveEmployee} syncCompetency={syncCompetency} />}
          {tab === "settings" && <SettingsTab emp={selected} saveEmployee={saveEmployee} onDelete={() => deleteEmployee(selected)} onDeleteAll={deleteAllEmployees} count={employees.length} />}
        </main>

        {modal === "overall" && <OverallCriteriaModal onClose={() => setModal(null)} />}
        {modal === "hr" && <HrCriteriaModal onClose={() => setModal(null)} />}
        {modal === "sales" && <SalesCriteriaModal onClose={() => setModal(null)} />}
        {modal === "staff" && <StaffPickModal onClose={() => setModal(null)} onAdd={addFromStaff} />}
      </div>

      {selected && <PrintSheet mode={printMode} emp={selected} exams={exams} answerKey={answerKey} />}
    </>
  );
}

function Kpis({ employees, exams, answerKey, selected }) {
  const n = employees.length;
  const avg = n ? employees.reduce((s, e) => s + calculateTotal(e, exams, answerKey).total, 0) / n : 0;
  const salesLoaded = employees.filter((e) => e.sales?.uploadedAt).length;
  const done = employees.filter((e) => completion(e, exams, answerKey).done).length;
  const sel = selected ? calculateTotal(selected, exams, answerKey) : null;
  return (
    <section className="kpis">
      <div className="kpi total">
        <div className="label">선택 직원 종합점수</div>
        <div className="val">{sel ? fmtNum(sel.total, 1) : "-"}<span style={{ fontSize: 16, letterSpacing: 0 }}> / 100</span></div>
        <div className="sub">{selected ? `${selected.name} · 인사카드 ${fmtNum(sel.hr.weighted, 1)}점 + 매출 ${fmtNum(sel.sales.total, 0)}점 + 역량 ${fmtNum(sel.comp.weighted, 1)}점` : "직원을 선택해 주세요."}</div>
      </div>
      <div className="kpi"><div className="label">평가 대상자</div><div className="val">{n}</div><div className="sub">종합평가 등록 기준</div></div>
      <div className="kpi"><div className="label">평균 종합점수</div><div className="val">{fmtNum(avg, 1)}</div><div className="sub">3개 항목 반영 기준</div></div>
      <div className="kpi"><div className="label">매출 데이터 반영</div><div className="val">{salesLoaded}</div><div className="sub">자동연동·업로드 인원</div></div>
      <div className="kpi"><div className="label">평가 진행률</div><div className="val">{n ? Math.round((done / n) * 100) : 0}%</div><div className="sub">3개 항목 입력 완료</div></div>
    </section>
  );
}

function OverviewTab({ employees, exams, answerKey, selectedId, setSelectedId, addEmployee, importFromExam, openStaffModal, setTab, onDelete, onDeleteAll }) {
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [progFilter, setProgFilter] = useState("");
  const [page, setPage] = useState(1);

  const stores = useMemo(() => [...new Set(employees.map((e) => e.store).filter(Boolean))].sort(), [employees]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return [...employees]
      .filter((e) => {
        const matches = !q || normalize(`${e.name} ${e.store} ${e.role}`).includes(q);
        const sm = !storeFilter || e.store === storeFilter;
        const c = completion(e, exams, answerKey);
        const pm = !progFilter || (progFilter === "complete" ? c.done : !c.done);
        return matches && sm && pm;
      })
      .sort((a, b) => calculateTotal(b, exams, answerKey).total - calculateTotal(a, exams, answerKey).total);
  }, [employees, search, storeFilter, progFilter, exams, answerKey]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const selected = employees.find((e) => e.id === selectedId);

  return (
    <div className="dashboard-grid">
      <section className="card">
        <div className="panel-title">
          <div>
            <h2>평가 대상자 리스트</h2>
            <p>시험 채점이 완료(합격/불합격 확정)되면 응시자가 이 목록에 자동으로 등록됩니다. 대상을 선택해 평가를 진행하세요.</p>
          </div>
          <span className="badge gray">{filtered.length ? `${filtered.length}명 · ${cur}/${pages} 페이지` : "0명"}</span>
        </div>
        <div className="toolbar" style={{ gridTemplateColumns: "1.4fr 1fr 1fr auto auto auto" }}>
          <input placeholder="이름·소속·직급 검색" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select value={storeFilter} onChange={(e) => { setStoreFilter(e.target.value); setPage(1); }}>
            <option value="">전체 소속</option>
            {stores.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={progFilter} onChange={(e) => { setProgFilter(e.target.value); setPage(1); }}>
            <option value="">전체 진행 상태</option>
            <option value="complete">평가완료</option>
            <option value="pending">입력 진행 중</option>
          </select>
          <button className="btn ghost" onClick={openStaffModal}>스태프에서 추가</button>
          <button className="btn ghost" onClick={importFromExam}>미채점 응시자 불러오기</button>
          <button className="btn ghost" onClick={addEmployee}>직접 추가</button>
          <button className="btn danger" onClick={onDeleteAll}>전체 삭제</button>
        </div>
        <div className="table-wrap" style={{ maxHeight: 540 }}>
          <table>
            <thead>
              <tr><th>소속</th><th>이름 / 직급</th><th>인사카드</th><th>매출</th><th>역량</th><th>종합</th><th>상태</th><th>관리</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8} className="empty-state">등록된 대상자가 없습니다.</td></tr>}
              {rows.map((e) => {
                const r = calculateTotal(e, exams, answerKey);
                const c = completion(e, exams, answerKey);
                return (
                  <tr key={e.id} className={e.id === selectedId ? "selected" : ""} onClick={() => setSelectedId(e.id)}>
                    <td style={{ whiteSpace: "nowrap" }}>{e.store || "-"}</td>
                    <td><b>{e.name}</b><br /><span style={{ color: "#6b7280" }}>{e.role || "-"}</span></td>
                    <td>{r.hr.raw} / 100</td>
                    <td>{r.sales.excluded ? <span style={{ color: "#8b95a1" }}>제외</span> : `${fmtNum(r.sales.total, 0)} / 50`}</td>
                    <td>{fmtNum(r.comp.raw, 0)} / 100</td>
                    <td><b style={{ fontSize: 16 }}>{fmtNum(r.total, 1)}</b></td>
                    <td>{c.done ? <span className="badge ok">완료</span> : <span className="badge warn">진행 중</span>}</td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <button className="btn danger" style={{ padding: "8px 11px", fontSize: 12 }} onClick={() => onDelete(e)}>삭제</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="pagination">
            <span className="page-info">페이지 {cur} / {pages}</span>
            <button className="page-btn" disabled={cur === 1} onClick={() => setPage(cur - 1)}>‹</button>
            {Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, cur - 4), Math.max(0, cur - 4) + 7).map((i) => (
              <button key={i} className={"page-btn" + (i === cur ? " active" : "")} onClick={() => setPage(i)}>{i}</button>
            ))}
            <button className="page-btn" disabled={cur === pages} onClick={() => setPage(cur + 1)}>›</button>
          </div>
        )}
      </section>

      <aside className="card">
        <div className="panel-title">
          <div>
            <h2>선택 직원 종합 결과</h2>
            <p>가중치 반영 기준: 인사카드 20점 · 매출 50점 · 역량 30점</p>
          </div>
        </div>
        {!selected && <div className="empty-state">평가 대상자를 선택해 주세요.</div>}
        {selected && <SummaryPanel emp={selected} exams={exams} answerKey={answerKey} setTab={setTab} />}
      </aside>
    </div>
  );
}

function SummaryPanel({ emp, exams, answerKey, setTab }) {
  const r = calculateTotal(emp, exams, answerKey);
  const c = completion(emp, exams, answerKey);
  // 매출 제외 대상은 인사카드+역량 50점을 100점으로 환산하므로 항목 만점도 2배로 표시한다.
  const excl = r.sales.excluded;
  const items = excl
    ? [
        ["인사카드", `${r.hr.raw} / 100`, r.hr.weighted * 2, 40, "bluebar"],
        ["매출", "평가 제외", 0, 0, "greenbar"],
        ["역량평가", `${fmtNum(r.comp.raw, 0)} / 100`, r.comp.weighted * 2, 60, "orangebar"]
      ]
    : [
        ["인사카드", `${r.hr.raw} / 100`, r.hr.weighted, 20, "bluebar"],
        ["매출", `${fmtNum(r.sales.total, 0)} / 50`, r.sales.total, 50, "greenbar"],
        ["역량평가", `${fmtNum(r.comp.raw, 0)} / 100`, r.comp.weighted, 30, "orangebar"]
      ];
  return (
    <div className="employee-summary">
      <div>
        <div className="employee-name">{emp.name}</div>
        <div className="meta-line">{emp.store || "소속 미입력"} · {emp.role || "직급 미입력"}<br />평가기간: {emp.period || "-"}</div>
      </div>
      <div className="score-banner">
        <div className="label">종합평가 점수</div>
        <div className="score">{fmtNum(r.total, 1)}<span className="den"> / 100</span></div>
      </div>
      <div className="breakdown">
        {items.map((x) => (
          <div key={x[0]} className="break-row">
            <div className="name">{x[0]}<br /><span style={{ fontSize: 11, color: "#6b7280" }}>{x[1]}</span></div>
            <div className="barline"><span className={x[4]} style={{ width: `${Math.min(100, (x[2] / x[3]) * 100)}%` }} /></div>
            <div className="value">{fmtNum(x[2], 1)} / {x[3]}</div>
          </div>
        ))}
      </div>
      <div className="status-box">
        <b>{c.done ? "3개 평가 항목 입력 완료" : "평가 입력 상태 확인 필요"}</b>
        <span>인사카드 {c.hrDone ? "완료" : "미입력"} · 매출 {c.salesDone ? "완료" : "미입력"} · 역량평가 {c.compDone ? "완료" : "미입력"}</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn primary" onClick={() => setTab("sales")}>매출 평가</button>
        <button className="btn ghost" onClick={() => setTab("hr")}>인사카드 평가</button>
      </div>
    </div>
  );
}

function HrTab({ emp, saveEmployee, openCriteria }) {
  const [memo, setMemo] = useState(emp?.hr?.memo || "");
  useEffect(() => setMemo(emp?.hr?.memo || ""), [emp?.id]);

  if (!emp) return <section className="card"><div className="empty-state">평가 대상자를 먼저 선택해 주세요.</div></section>;

  const grades = emp.hr?.grades || [];
  const raw = grades.reduce((s, g) => s + (GRADE_SCORE[g] ?? 0), 0);

  function setGrade(i, g) {
    const next = [...grades];
    while (next.length < HR_ITEMS.length) next.push("");
    next[i] = g;
    saveEmployee(emp.id, { hr: { ...(emp.hr || {}), grades: next } });
  }

  return (
    <section className="card">
      <div className="panel-title">
        <div>
          <h2>1. 인사카드 평가</h2>
          <p>A 10점 · B 8점 · C 6점 · D 4점 · F 0점 / 총 100점 중 20점 반영</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={openCriteria}>인사 평가 기준표</button>
          <span className="badge blue">반영 점수 {fmtNum(raw * 0.2, 1)} / 20</span>
        </div>
      </div>
      <div className="eval-table-wrap">
        <table className="eval-table">
          <thead>
            <tr><th style={{ width: 105 }}>평가 영역</th><th>평가 내용</th><th style={{ width: 115 }}>평가</th><th style={{ width: 72 }}>배점</th><th style={{ width: 75 }}>점수</th></tr>
          </thead>
          <tbody>
            {HR_ITEMS.map((item, i) => (
              <tr key={i} style={{ cursor: "default" }}>
                <td className="category-cell">{item.category}</td>
                <td>{item.content}</td>
                <td>
                  <select className="grade-select" value={grades[i] || ""} onChange={(e) => setGrade(i, e.target.value)}>
                    <option value="">-</option>
                    {["A", "B", "C", "D", "F"].map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </td>
                <td style={{ textAlign: "center" }}>10</td>
                <td className="grade-score">{GRADE_SCORE[grades[i]] ?? 0}</td>
              </tr>
            ))}
            <tr className="total-row" style={{ cursor: "default" }}>
              <td colSpan={3} style={{ textAlign: "right" }}>합계</td>
              <td style={{ textAlign: "center" }}>100</td>
              <td className="grade-score">{raw}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="field"><span>인사카드 평가 메모</span>
          <textarea rows={4} value={memo} placeholder="근태·고객응대·매장운영 등 종합 피드백을 기록해 주세요." onChange={(e) => setMemo(e.target.value)} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button className="btn primary" onClick={() => saveEmployee(emp.id, { hr: { ...(emp.hr || {}), grades, memo } }, { silent: false })}>인사카드 평가 저장</button>
        <button
          className="btn danger"
          onClick={() => {
            if (!confirm(`${emp.name}님의 인사카드 평가 내용을 초기화하시겠습니까?\n선택한 등급과 메모가 모두 삭제됩니다.`)) return;
            setMemo("");
            saveEmployee(emp.id, { hr: { grades: [], memo: "" } }, { silent: false });
          }}
        >
          인사카드 평가 초기화
        </button>
      </div>
    </section>
  );
}

// 기본 산정 기간 = 올해 1월 1일 ~ 전월 말일 (7월이면 1/1~6/30).
// 진행 중인 달은 매출이 덜 쌓여 기여도·순위가 흔들리므로 완료된 달까지만 잡는다.
// 단 1월에는 완료된 달이 없으므로 오늘까지로 둔다.
function defaultSalesPeriod() {
  const now = new Date();
  const y = now.getFullYear();
  const end = now.getMonth() === 0 ? now : new Date(y, now.getMonth(), 0);
  return { start: toDateInput(new Date(y, 0, 1)), end: toDateInput(end) };
}

function SalesTab({ emp, exams, answerKey, saveEmployee, openCriteria }) {
  const [uploadStatus, setUploadStatus] = useState(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [start, setStart] = useState(() => defaultSalesPeriod().start);
  const [end, setEnd] = useState(() => defaultSalesPeriod().end);
  const autoTriedRef = useRef({}); // 직원별 자동 산정 1회 시도 여부

  // 매출 데이터가 없으면 탭 진입 시 한 번만 자동 산정한다.
  // 이미 데이터가 있으면 건드리지 않는다 (엑셀 업로드본·확정한 기간이 덮어써지지 않도록).
  useEffect(() => {
    if (!emp || !emp.id) return;
    if (isSalesExcluded(emp)) return;         // 제외 대상은 산정하지 않음
    if (emp.sales?.uploadedAt) return;        // 이미 산정/업로드됨
    if (!emp.store) return;                   // 소속 없으면 불가
    if (autoTriedRef.current[emp.id]) return; // 이 직원은 이미 시도함
    autoTriedRef.current[emp.id] = true;
    autoCalc({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emp?.id]);

  if (!emp) return <section className="card"><div className="empty-state">평가 대상자를 먼저 선택해 주세요.</div></section>;

  const r = calculateTotal(emp, exams, answerKey);
  const s = r.sales;

  // ── 오프라인 서버 자동 산정 (ERP 자동 업데이트) ──
  // silent: 탭 진입 시 자동 실행된 경우 — 성공 알림을 띄우지 않는다.
  async function autoCalc(opts = {}) {
    const silent = !!opts.silent;
    if (!emp.store) {
      if (!silent) alert("대상자의 소속 매장이 입력되어 있어야 자동 산정이 가능합니다. '기준 및 데이터 관리' 탭에서 소속을 입력해 주세요.");
      return;
    }
    if (!start || !end) {
      if (!silent) alert("산정 기간을 선택해 주세요.");
      return;
    }
    setAutoBusy(true);
    setUploadStatus({ title: "자동 산정 중", desc: "오프라인 서버에서 기간 주문 데이터를 집계하고 있습니다." });
    try {
      const res = await fetch("/api/sales/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: emp.name, store: emp.store, startDate: start, endDate: end })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "자동 산정 실패");

      // 서버가 제외 대상으로 판정하면 점수를 만들지 않고 제외 사실만 기록한다.
      if (d.meta?.excluded) {
        await saveEmployee(emp.id, { sales: { autoMeta: d.meta, excludedAt: new Date().toISOString() } });
        setUploadStatus(null);
        if (!silent) alert(`${emp.name} 님은 매출 평가 제외 대상입니다.\n사유: ${d.meta.excludeReason || "제외 직급"}\n종합점수는 인사카드·역량평가로 환산됩니다.`);
        return;
      }

      const sales = {
        ...(emp.sales || {}),
        rawStoreTable: d.storeRows,
        rawPersonalTable: d.personalRows,
        uploadedAt: new Date().toISOString(),
        fileName: `오프라인서버 자동연동 (${d.meta.period})`,
        source: "auto",
        autoMeta: d.meta
      };
      const ok = await saveEmployee(emp.id, { sales, period: emp.period || d.meta.period });
      setUploadStatus(null);
      if (ok && !silent) alert(`매출 데이터를 자동 산정했습니다.\n기간: ${d.meta.period}\n개인매출 ${fmtMoney(d.meta.candidateSales)}원 / 매장매출 ${fmtMoney(d.meta.storeTotal)}원 (기여도 ${d.meta.contributionPct}%)\n상대평가 ${d.meta.rank || "-"}위 / ${d.meta.population}명`);
    } catch (e) {
      setUploadStatus(silent ? null : { title: "자동 산정 실패", desc: String(e.message || e) });
    } finally {
      setAutoBusy(false);
    }
  }

  async function handleUpload(ev) {
    const file = ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    setUploadStatus({ title: "파일 읽는 중", desc: `${file.name} 파일을 분석하고 있습니다.` });
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheets = {};
      wb.SheetNames.forEach((name) => {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });
        sheets[name] = rows
          .filter((row) => (row || []).some((v) => v !== "" && v !== null && typeof v !== "undefined"))
          .map((row) => row.map((v) => (typeof v === "undefined" ? null : v)));
      });
      const storeRows = Object.entries(sheets).find(([k]) => k.replace(/\s/g, "").includes("매장"))?.[1];
      const personalRows = Object.entries(sheets).find(([k]) => k.replace(/\s/g, "").includes("개인"))?.[1];
      if (!storeRows || !personalRows) throw new Error("필요한 시트(매장 매출 기여도 / 개인매출)를 찾지 못했습니다.");
      const sales = {
        ...(emp.sales || {}),
        rawStoreTable: storeRows,
        rawPersonalTable: personalRows,
        uploadedAt: new Date().toISOString(),
        fileName: file.name,
        source: "excel",
        autoMeta: null
      };
      await saveEmployee(emp.id, { sales });
      setUploadStatus(null);
      alert("매출 로우데이터를 반영했습니다.");
    } catch (e) {
      setUploadStatus({ title: "업로드 실패", desc: String(e.message || e) });
    }
  }

  return (
    <section className="card">
      <div className="panel-title">
        <div>
          <h2>2. 매출 평가</h2>
          <p>
            {s.excluded
              ? "중간관리 매장 · 일급제 · 서포터는 매출 평가(상대평가) 대상이 아닙니다."
              : "오프라인 서버 자동 연동(권장) 또는 엑셀 업로드로 ① 매장 매출 기여도 ② 개인매출 상대평가를 산정합니다."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={openCriteria}>매출 평가 기준표</button>
          {!s.excluded && <a className="btn ghost" href="/수습평가_매출_로우데이터_양식.xlsx" download>양식 다운로드</a>}
          {s.excluded
            ? <span className="badge gray">평가 제외 대상</span>
            : <span className="badge ok">반영 점수 {fmtNum(s.total, 0)} / 50</span>}
        </div>
      </div>

      {s.excluded && (
        <div className="info-box" style={{ marginTop: 4 }}>
          <strong>{emp.name} 님은 매출 평가 제외 대상입니다{s.excludeReason ? ` (${s.excludeReason})` : ""}.</strong><br />
          평가 기준상 <b>중간관리 매장 / 일급제 / 서포터</b>는 개인매출 상대평가에서 제외됩니다.
          종합점수는 매출 50점을 빼고 <b>인사카드(20) + 역량평가(30) = 50점을 100점으로 환산</b>해 산정하므로,
          제외로 인한 불이익은 없습니다.
        </div>
      )}

      {!s.excluded && (
      <>
      <div className="sales-auto">
        <div className="sales-auto-title">① 오프라인 서버 자동 산정 (ERP 매출 자동 연동)</div>
        <p className="subtle" style={{ marginTop: 6 }}>
          기간을 선택하면 <b>{emp.store || "소속 미입력"}</b> 매장의 주문 데이터와 전체 직영직원 매출을 집계해 기여도·상대평가 점수를 자동 산정합니다.
          중간관리 매장 / 일급제 / 서포터는 상대평가에서 제외됩니다.
        </p>
        <div className="sales-auto-grid">
          <div className="field"><span>시작일</span>
            <DatePicker value={start} onChange={setStart} placeholder="시작일 선택" />
          </div>
          <div className="field"><span>종료일</span>
            <DatePicker value={end} onChange={setEnd} placeholder="종료일 선택" />
          </div>
          <button className="btn primary" disabled={autoBusy} onClick={autoCalc}>{autoBusy ? "산정 중..." : "매출 자동 산정"}</button>
        </div>
      </div>

      <div className="sales-upload">
        <div className="sales-upload-head">
          <div>
            <div className="upload-title">② 엑셀 로우데이터 업로드 (수동 방식)</div>
            <p className="subtle">시트 `1. 매장 매출 기여도`, `2. 개인매출 (상대평가)`가 포함된 엑셀 파일</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label className="btn ghost" style={{ display: "inline-block" }}>
              파일 선택
              <input type="file" accept=".xlsx,.xlsm" className="hidden" onChange={handleUpload} />
            </label>
            <button
              className="btn danger"
              onClick={() => {
                if (!emp.sales?.uploadedAt) {
                  alert("삭제할 매출 데이터가 없습니다.");
                  return;
                }
                if (!confirm(`${emp.name}님의 매출 데이터를 삭제하시겠습니까?\n산정된 기여도·개인매출 순위와 원본표가 모두 삭제됩니다.`)) return;
                setUploadStatus(null);
                saveEmployee(emp.id, { sales: {} }, { silent: false });
              }}
            >
              매출 데이터 삭제
            </button>
          </div>
        </div>
        <div className="status-box" style={{ marginTop: 12 }}>
          {uploadStatus ? (
            <><b>{uploadStatus.title}</b><span>{uploadStatus.desc}</span></>
          ) : emp.sales?.uploadedAt ? (
            <><b>{emp.sales.source === "auto" ? "자동 연동 완료" : "업로드 완료"}</b><span>{emp.sales.fileName || ""} · 매칭: 매장표 {s.storeEmployee || "-"}, 개인표 {s.personalName || "-"} · {fmtDate(emp.sales.uploadedAt)}</span></>
          ) : (
            <><b>산정 안내</b><span>자동 산정 버튼을 누르거나, 엑셀 파일을 업로드해 주세요.</span></>
          )}
        </div>
      </div>

      <div style={{ margin: "18px 0 10px", fontSize: 18, fontWeight: 950, letterSpacing: "-0.04em", color: "#17233d" }}>매출 평가 점수</div>
      <div className="sales-cards">
        <section className="sales-card">
          <div className="sales-card-top">
            <div className="sales-card-title">[매장 매출 기여도]</div>
            <div className="sales-card-chip">30점 만점</div>
          </div>
          <div className="sales-card-score">{s.hasData ? <>{fmtNum(s.contribution, 0)}<small>점</small></> : <span style={{ fontSize: 28 }}>미산정</span>}</div>
          <div className="sales-card-desc">
            {s.contributionPct
              ? <>{s.headcount || 3}인 근무 기준<br />매출 기여도 <b style={{ color: "#dc2626" }}>{fmtPct(s.contributionPct)}</b></>
              : "자동 산정 또는 엑셀 업로드 필요"}
          </div>
        </section>
        <section className="sales-card">
          <div className="sales-card-top">
            <div className="sales-card-title">[개인매출(상대평가)]</div>
            <div className="sales-card-chip">20점 만점</div>
          </div>
          <div className="sales-card-score">{s.hasData ? <>{fmtNum(s.individual, 0)}<small>점</small></> : <span style={{ fontSize: 28 }}>미산정</span>}</div>
          <div className="sales-card-desc">
            {s.rank
              ? <>{s.rank}위 / {s.population}명<br />상위 <b style={{ color: "#dc2626" }}>{fmtNum(s.rankPct, 1)}%</b> · 개인매출 {fmtMoney(s.personalSales)}원</>
              : "자동 산정 또는 엑셀 업로드 필요"}
          </div>
        </section>
        <section className="sales-card total">
          <div className="sales-card-top">
            <div className="sales-card-title">[총점]</div>
            <div className="sales-card-chip">50점 만점</div>
          </div>
          <div className="sales-card-score">{s.hasData ? <>{fmtNum(s.total, 0)}<small>점</small></> : <span style={{ fontSize: 28 }}>미산정</span>}</div>
          <div className="sales-card-desc">
            {s.hasData ? `기여도 ${fmtNum(s.contribution, 0)} + 개인 ${fmtNum(s.individual, 0)}` : "매출 데이터를 산정하면 점수가 반영됩니다"}
          </div>
        </section>
      </div>

      {(s.rawStoreTable || s.rawPersonalTable) ? (
        <>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <h3>1) 매장 매출 기여도</h3>
              <p className="subtle" style={{ margin: "6px 0 10px" }}>
                평가 대상자: <b style={{ color: "#2563eb" }}>{(s.storeEmployee || emp.name).replace(/\s+(매니저|부매니저|시니어|일급제|중간관리|서포터|수습)$/, "")}</b>
              </p>
              <div className="clean-table-wrap"><StoreTable rows={s.rawStoreTable || []} highlightName={s.storeEmployee} /></div>
            </div>
            <div>
              <h3>2) 개인매출(상대평가)</h3>
              <p className="subtle" style={{ margin: "6px 0 10px" }}>순위: <b style={{ color: "#2563eb" }}>{s.rank || "-"}위 / {s.population || "-"}명</b></p>
              <div className="clean-table-wrap"><PersonalTable rows={s.rawPersonalTable || []} highlightName={s.personalName} /></div>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">산정된 매출 데이터가 없습니다. 자동 산정 또는 엑셀 업로드를 진행해 주세요.</div>
      )}
      </>
      )}
    </section>
  );
}

function useStoreTableData(rows) {
  const headerIdx = (rows || []).findIndex((r) => (r || []).some((v) => String(v || "").includes("구분")));
  const header = rows[headerIdx] || [];
  const totalCol = header.findIndex((v) => String(v || "").includes("합계"));
  const employeeCols = header.map((v, i) => ({ name: v, i })).filter((x) => x.name && x.i !== totalCol && !String(x.name).includes("구분"));
  const monthRows = (rows || []).filter((r, idx) => idx > headerIdx && (r || []).some((v) => /20\d{2}년/.test(String(v || ""))));
  const sumRow = (rows || []).find((r, idx) => idx > headerIdx && (r || []).some((v, i) => i <= 3 && String(v || "").includes("합계")) && !(r || []).some((v) => String(v || "").includes("매출 기여도"))) || [];
  const teamTotal = totalCol >= 0 ? parseNumberValue(sumRow[totalCol]) : employeeCols.reduce((acc, x) => acc + parseNumberValue(sumRow[x.i]), 0);
  const contributionValues = employeeCols.map((x) => {
    const value = parseNumberValue(sumRow[x.i]);
    return teamTotal ? (value / teamTotal) * 100 : 0;
  });
  return { headerIdx, employeeCols, totalCol, monthRows, sumRow, contributionValues };
}

function StoreTable({ rows, highlightName }) {
  const { employeeCols, totalCol, monthRows, sumRow, contributionValues } = useStoreTableData(rows);
  const targetCol = employeeCols.find((x) => matchName(x.name, highlightName))?.i ?? -1;
  const hl = { color: "#2563eb", fontWeight: 950 };
  return (
    <table className="clean-table">
      <thead>
        <tr>
          <th>구분</th>
          {employeeCols.map((x) => <th key={x.i} style={x.i === targetCol ? hl : undefined}>{x.name}</th>)}
          <th>합계</th>
        </tr>
      </thead>
      <tbody>
        {monthRows.map((r, ri) => {
          const label = (r || []).find((v) => /20\d{2}년/.test(String(v || ""))) || "";
          return (
            <tr key={ri}>
              <td className="left">{label}</td>
              {employeeCols.map((x) => <td key={x.i}>{formatRawCell(r[x.i])}</td>)}
              <td>{formatRawCell(r[totalCol])}</td>
            </tr>
          );
        })}
        {sumRow.length > 0 && (
          <tr className="target-row">
            <td className="left">합계</td>
            {employeeCols.map((x) => <td key={x.i}>{formatRawCell(sumRow[x.i])}</td>)}
            <td>{formatRawCell(sumRow[totalCol])}</td>
          </tr>
        )}
        <tr>
          <td className="left">매출 기여도</td>
          {employeeCols.map((x, idx) => <td key={x.i} style={x.i === targetCol ? hl : undefined}>{fmtPct(contributionValues[idx])}</td>)}
          <td>-</td>
        </tr>
      </tbody>
    </table>
  );
}

function usePersonalTableData(rows) {
  const headerIdx = (rows || []).findIndex((r) => (r || []).some((v) => String(v || "").includes("순위")) && (r || []).some((v) => String(v || "").includes("담당자")));
  const header = rows[headerIdx] || [];
  const rankCol = header.findIndex((v) => String(v || "").includes("순위"));
  const nameCol = header.findIndex((v) => String(v || "").includes("담당자"));
  const totalCol = header.findIndex((v) => String(v || "").includes("합계"));
  const data = rows.slice(headerIdx + 1).filter((r) => parseNumberValue(r[rankCol]) > 0 && String(r[nameCol] || "").trim());
  return { rankCol, nameCol, totalCol, data };
}

function PersonalTable({ rows, highlightName }) {
  const { rankCol, nameCol, totalCol, data } = usePersonalTableData(rows);
  const hl = { color: "#2563eb", fontWeight: 950 };
  return (
    <table className="clean-table">
      <thead><tr><th>순위</th><th>담당자</th><th>합계</th></tr></thead>
      <tbody>
        {data.map((r, i) => {
          const isTarget = matchName(r[nameCol], highlightName);
          return (
            <tr key={i} className={isTarget ? "target-row" : ""}>
              <td style={isTarget ? hl : undefined}>{formatRawCell(r[rankCol])}</td>
              <td className="left" style={isTarget ? hl : undefined}>{r[nameCol]}</td>
              <td style={isTarget ? hl : undefined}>{formatRawCell(r[totalCol])}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CompetencyTab({ emp, exams, answerKey, saveEmployee, syncCompetency }) {
  const [memo, setMemo] = useState(emp?.competency?.memo || "");
  useEffect(() => {
    setMemo(emp?.competency?.memo || "");
  }, [emp?.id]);

  if (!emp) return <section className="card"><div className="empty-state">평가 대상자를 먼저 선택해 주세요.</div></section>;

  const r = calculateCompetency(emp, exams, answerKey);
  const ov = emp.competency?.override;
  const hasOverride = ov !== "" && ov !== null && typeof ov !== "undefined";

  return (
    <div className="dashboard-grid">
      <section className="card">
        <div className="panel-title">
          <div>
            <h2>3. 역량평가 연동</h2>
            <p>역량평가 시험 결과가 자동으로 반영됩니다. (100점 기준 → 30점 환산)</p>
          </div>
          <button className="btn ghost" onClick={() => syncCompetency(emp)}>시험 결과 다시 연결</button>
        </div>
        <div style={{ padding: 16, border: "1px solid var(--line)", borderRadius: 17, background: "#fff" }}>
          <div style={{ fontSize: 12, fontWeight: 850, color: "var(--muted)" }}>연동된 역량평가 점수</div>
          <div><span className="scorebig" style={{ color: "#1e3a8a" }}>{fmtNum(r.raw, 0)}</span><span style={{ fontSize: 16, fontWeight: 850, color: "#64748b" }}> / 100</span></div>
          <p className="subtle" style={{ marginTop: 7 }}>
            {r.matched
              ? <>연동 응시자: <b>{r.matched.name}</b> · {r.matched.store || "소속 미입력"} · 시험 제출 {fmtDate(r.matched.submittedAt)} · 시험 점수 {fmtNum(r.linked, 0)}점</>
              : "연결된 시험 결과가 없습니다. 해당 직원이 시험에 응시하고 채점이 완료되면 자동으로 반영됩니다."}
          </p>
        </div>

        {/* 과거에 수동 점수를 넣어 둔 데이터만 여기서 해제할 수 있게 한다.
            역량평가 점수는 시험 결과로만 산정하므로 새로 입력하는 경로는 두지 않는다. */}
        {hasOverride && (
          <div className="info-box" style={{ marginTop: 14 }}>
            <strong>수동 점수 {fmtNum(Number(emp.competency.override), 0)}점이 적용 중입니다.</strong><br />
            시험 결과 대신 수동 입력값이 반영되고 있습니다. 시험 점수로 되돌리려면 아래 버튼을 눌러 주세요.
            <div style={{ marginTop: 10 }}>
              <button
                className="btn ghost"
                onClick={() => saveEmployee(emp.id, { competency: { ...(emp.competency || {}), override: "" } }, { silent: false })}
              >
                시험 점수로 되돌리기
              </button>
            </div>
          </div>
        )}

        <div className="form-grid" style={{ marginTop: 14 }}>
          <label className="field"><span>시험 점수 (100점 기준)</span>
            <input readOnly value={`${fmtNum(r.raw, 0)} / 100`} />
          </label>
          <label className="field"><span>가중 반영 점수</span>
            <input readOnly value={`${fmtNum(r.weighted, 1)} / 30`} />
          </label>
        </div>
        <label className="field" style={{ display: "block", marginTop: 14 }}><span>역량평가 메모</span>
          <textarea rows={4} value={memo} placeholder="보완 의견을 기록해 주세요." onChange={(e) => setMemo(e.target.value)} />
        </label>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            className="btn primary"
            onClick={() => saveEmployee(emp.id, { competency: { ...(emp.competency || {}), memo } }, { silent: false })}
          >
            메모 저장
          </button>
        </div>
      </section>
      <aside className="card">
        <div className="panel-title">
          <div>
            <h2>연동 방식</h2>
            <p>DB에 저장된 역량평가 시험 결과를 이름/소속 기준으로 자동 매칭합니다.</p>
          </div>
        </div>
        <div className="info-box">
          <strong>자동 연결 기준</strong><br />
          이름과 소속이 동일한 응시자를 우선 매칭합니다. 소속 정보가 없거나 다르면 동일 이름 응시자 중 가장 최근 시험을 연결합니다.
        </div>
        <div className="status-box" style={{ marginTop: 14 }}>
          <b>현재 역량 데이터</b>
          <span>시험 응시 결과 {exams.length}건 (DB 실시간 연동)</span>
        </div>
      </aside>
    </div>
  );
}

function SettingsTab({ emp, saveEmployee, onDelete, onDeleteAll, count }) {
  const [form, setForm] = useState({ name: "", store: "", role: "수습", period: "", finalMemo: "" });
  useEffect(() => {
    setForm({
      name: emp?.name || "",
      store: emp?.store || "",
      role: emp?.role || "수습",
      period: emp?.period || "",
      finalMemo: emp?.finalMemo || ""
    });
  }, [emp?.id]);

  if (!emp) return <section className="card"><div className="empty-state">평가 대상자를 먼저 선택해 주세요.</div></section>;

  return (
    <div className="dashboard-grid">
      <section className="card">
        <div className="panel-title">
          <div>
            <h2>평가 대상자 관리</h2>
            <p>직원 기본 정보와 최종 종합평가 의견을 관리합니다.</p>
          </div>
        </div>
        <div className="form-grid">
          <label className="field"><span>이름</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="field"><span>소속</span>
            <input value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })} />
          </label>
          <label className="field"><span>직급</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {[form.role, "매니저", "부매니저", "시니어", "수습", "서포터", "일급제"].filter((v, i, a) => v && a.indexOf(v) === i).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="field"><span>수습 평가 기간</span>
            <input value={form.period} placeholder="예: 2026-04-01 ~ 2026-06-30" onChange={(e) => setForm({ ...form, period: e.target.value })} />
          </label>
        </div>
        <label className="field" style={{ display: "block", marginTop: 14 }}><span>종합 평가 의견</span>
          <textarea rows={5} value={form.finalMemo} placeholder="종합 평가 결과, 보완 과제, 향후 교육 계획 등을 기록해 주세요." onChange={(e) => setForm({ ...form, finalMemo: e.target.value })} />
        </label>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={() => saveEmployee(emp.id, form, { silent: false })}>기본정보 저장</button>
          <button className="btn danger" onClick={onDelete}>선택 직원 삭제</button>
        </div>
      </section>
      <aside className="card">
        <div className="panel-title">
          <div>
            <h2>데이터 관리</h2>
            <p>모든 평가 데이터는 MongoDB에 저장됩니다.</p>
          </div>
        </div>
        <div className="status-box">
          <b>데이터 구조</b>
          <span>매출 자동 산정/엑셀 업로드 시 원본 표, 기여도 산정값, 개인매출 순위, 점수가 평가 대상자별로 저장됩니다.</span>
        </div>
        <div className="info-box" style={{ marginTop: 15 }}>
          <strong>권장 운영 순서</strong><br />
          ⓪ 대상자 등록(<b>시험 채점 완료 시 자동 등록</b>, 필요 시 스태프에서 추가) → ① 인사카드 평가 입력 → ② 매출 자동 산정 → ③ 역량평가 동기화 → ④ 종합 의견 작성 및 인쇄
        </div>
        <div className="status-box" style={{ marginTop: 15 }}>
          <b>평가 데이터 삭제</b>
          <span>
            잘못 진행한 평가는 항목별로 초기화하거나(인사카드·매출 탭), 대상자 단위로 삭제할 수 있습니다.
            전체 삭제는 등록된 평가 {count ?? 0}건을 모두 지웁니다.
          </span>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button className="btn danger" onClick={onDelete}>선택 직원 삭제</button>
            <button className="btn danger" onClick={onDeleteAll}>전체 삭제 ({count ?? 0}건)</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ---- 기준표 모달 ----
function Modal({ title, subtitle, chip, children, onClose }) {
  return (
    <div className="criteria-modal no-print" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="criteria-panel">
        <button className="btn ghost criteria-close" onClick={onClose}>닫기</button>
        <div style={{ paddingRight: 92, paddingBottom: 20, borderBottom: "1px solid #e5e7eb", marginBottom: 4 }}>
          <h2 style={{ fontSize: 26, margin: 0 }}>{title}</h2>
          {subtitle && <p style={{ marginTop: 10 }}>{subtitle}</p>}
          {chip && <div className="badge blue" style={{ marginTop: 12 }}>{chip}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

// ---- 스태프 명단에서 대상자 추가 ----
function StaffPickModal({ onClose, onAdd }) {
  const [stores, setStores] = useState(null);
  const [storeSel, setStoreSel] = useState("");
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [checked, setChecked] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/staff/stores")
      .then((r) => r.json())
      .then((d) => setStores(d.ok ? d.stores : []))
      .catch(() => setStores([]));
  }, []);

  function pickStore(v) {
    setStoreSel(v);
    setChecked({});
    setMembers([]);
    if (!v) return;
    setLoadingMembers(true);
    fetch(`/api/staff/members?store=${encodeURIComponent(v)}`)
      .then((r) => r.json())
      .then((d) => setMembers(d.ok ? d.members : []))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }

  const selectedMembers = members.filter((m) => checked[m.name]);

  async function submit() {
    if (!selectedMembers.length) {
      alert("추가할 직원을 선택해 주세요.");
      return;
    }
    setBusy(true);
    try {
      await onAdd(selectedMembers);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="스태프 명단에서 대상자 추가"
      subtitle="오프라인 통합관리 서버의 매장 직원 명단에서 종합평가 대상자를 선택해 등록합니다."
      chip={stores === null ? "명단 불러오는 중..." : `연동 매장 ${stores.length}곳`}
      onClose={onClose}
    >
      <div className="criteria-block">
        <label className="field"><span>매장 선택</span>
          <select value={storeSel} onChange={(e) => pickStore(e.target.value)} disabled={stores === null}>
            <option value="">{stores === null ? "불러오는 중..." : stores.length ? "매장 선택" : "명단 연동 실패"}</option>
            {(stores || []).map((s) => <option key={s.name} value={s.name}>{s.name} ({s.staffCount}명)</option>)}
          </select>
        </label>
        {stores !== null && stores.length === 0 && (
          <div className="staff-hint error" style={{ marginTop: 10 }}>스태프 명단 연동에 실패했습니다. '직접 추가' 버튼을 이용해 주세요.</div>
        )}
        {loadingMembers && <div className="staff-hint" style={{ marginTop: 10 }}>직원 명단 불러오는 중...</div>}
        {!loadingMembers && storeSel && members.length === 0 && (
          <div className="staff-hint" style={{ marginTop: 10 }}>해당 매장의 활성 직원이 없습니다.</div>
        )}
        {members.length > 0 && (
          <div className="staff-pick-list">
            {members.map((m) => (
              <label key={m.name} className="staff-pick-row">
                <input
                  type="checkbox"
                  checked={!!checked[m.name]}
                  onChange={(e) => setChecked((prev) => ({ ...prev, [m.name]: e.target.checked }))}
                />
                <span><b>{m.name}</b></span>
                <span className="badge gray">{m.role}</span>
              </label>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button className="btn primary" disabled={busy || !selectedMembers.length} onClick={submit}>
            {busy ? "추가 중..." : `선택한 ${selectedMembers.length}명 추가`}
          </button>
          <button className="btn ghost" onClick={onClose}>닫기</button>
        </div>
      </div>
    </Modal>
  );
}

function OverallCriteriaModal({ onClose }) {
  return (
    <Modal title="수습 근로자 평가" subtitle="수습 근로자 평가 운영 기준 및 각 담당 주체의 역할을 정리한 기준표입니다." chip="평가 비율: 인사카드 20% + 매출 50% + 역량평가 30%" onClose={onClose}>
      <div className="criteria-block">
        <h3 style={{ fontSize: 18 }}>1. 목적 및 근거 규정</h3>
        <p style={{ color: "#374151", fontWeight: 700 }}>
          ① 취업규칙 제 11 조 "수습기간"에 의거하여 신규로 채용된 자(신입/경력)는 최초로 근무를 개시한 날부터 3개월간을 수습기간으로 하며, 사용한 후 채용 여부를 결정하여 사원에게 고지한다. 다만, 업무의 성격이나 사원의 경력 등을 참작하여 수습기간을 두지 않거나 연장 또는 단축할 수 있다.
          <br /><br />
          ② 수습기간 중 또는 수습기간이 만료된 자로써 등 기간 중에 업무수행에 필요한 적격성을 평정한 후 그 성적이 불량하거나 업무적격성이 부족하다고 판단되는 경우에는 본채용을 거부할 수 있다.
        </p>
      </div>
      <div className="criteria-block">
        <h3 style={{ fontSize: 18 }}>2. 평가 지침</h3>
        <div style={{ overflow: "auto" }}>
          <table className="criteria-table" style={{ minWidth: 780 }}>
            <thead>
              <tr><th style={{ width: 110 }}>내 용</th><th style={{ width: 320 }}>경영지원(인사팀)</th><th>수습 근로자의 부서장(또는 상급자)</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><b>수습 근로자</b></td>
                <td style={{ textAlign: "left" }}>신규 직원(신입/경력)의 수습기간 평가에 따른 고용확정/수습연장/고용취소 등의 내용을 안내</td>
                <td style={{ textAlign: "left" }}>해당 부서장은 신규로 입사한 직원(신입/경력)의 수습기간(3개월) 동안 업무능력, 근무태도, 그리고 발전 가능성을 관찰하여 평가</td>
              </tr>
              <tr>
                <td><b>평가 / 제출</b></td>
                <td style={{ textAlign: "left" }}>1. 해당 부서장이 작성한 수습기간 평가표 참조<br />2. 수습 근로자가 진행한 역량 평가 참조<br />3. 제출된 평가표 및 역량 평가를 참조하여 해당 부서장(또는 상급자)과 미팅</td>
                <td style={{ textAlign: "left" }}>1. 수습 만료 30일 전까지 평가표 작성 및 결재 상신(역량 평가 포함)<br />2. 수습 만료 25일 전까지 인사부에 제출 및 미팅</td>
              </tr>
              <tr>
                <td><b>통 보</b></td>
                <td style={{ textAlign: "left" }}>평가 결과에 따른 업무 진행<br />- 고용확정<br />- 수습연장 (2차 평가 대상)<br />- 고용취소 (통보 후 10일 내 계약 해지)</td>
                <td style={{ textAlign: "left" }}>수습 만료 20일 전까지 수습대상자에 통보<br />- 고용확정<br />- 수습연장 (2차 평가 대상)<br />- 고용취소 (통보 후 10일 내 계약 해지)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="criteria-block">
        <h3 style={{ fontSize: 18 }}>3. 기타 사항</h3>
        <p style={{ color: "#374151", fontWeight: 700 }}>
          ① 역량 평가는 최초 1회에 한하여 진행한다.<br />
          ② 시험 진행 시간은 회사 내부 규정에 따라 지정한 시간으로 진행한다.
        </p>
      </div>
    </Modal>
  );
}

function HrCriteriaModal({ onClose }) {
  return (
    <Modal title="평가 기준" subtitle="수습기간 동안 태도·자질·학습능력·학습활동을 객관적으로 평가합니다." onClose={onClose}>
      <div className="criteria-block">
        <h3 style={{ fontSize: 18 }}>평가 항목 구성</h3>
        <p style={{ color: "#475569", fontWeight: 700 }}>근태 1건, 제품 지식 1건, 의사소통 2건, 고객응대 3건, 매장운영 2건, 재고관리 1건으로 총 10개 항목을 평가합니다.</p>
      </div>
      <div className="criteria-block">
        <h3 style={{ fontSize: 18 }}>등급 기준표</h3>
        <div style={{ overflow: "auto" }}>
          <table className="criteria-table" style={{ minWidth: 560 }}>
            <thead><tr><th style={{ width: 120 }}>등급</th><th style={{ width: 120 }}>점수</th><th>해석</th></tr></thead>
            <tbody>
              <tr><td><b>A</b></td><td><b>10</b></td><td style={{ textAlign: "left" }}>기대 수준을 안정적으로 충족</td></tr>
              <tr><td><b>B</b></td><td><b>8</b></td><td style={{ textAlign: "left" }}>대체로 충족, 일부 보완 필요</td></tr>
              <tr><td><b>C</b></td><td><b>6</b></td><td style={{ textAlign: "left" }}>기본 수준, 개선 필요</td></tr>
              <tr><td><b>D</b></td><td><b>4</b></td><td style={{ textAlign: "left" }}>개선 요구 수준</td></tr>
              <tr><td><b>F</b></td><td><b>0</b></td><td style={{ textAlign: "left" }}>평가 미달 또는 미수행</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function SalesCriteriaModal({ onClose }) {
  return (
    <Modal title="매출 평가 기준표" subtitle="매장 매출 기여도 30점 + 개인매출 상대평가 20점, 총 50점 기준입니다." chip="기준표는 대시보드 점수 산정 로직과 동일하게 적용됩니다." onClose={onClose}>
      <div className="criteria-block">
        <h3 style={{ fontSize: 18 }}>매장 매출 기여도</h3>
        <div style={{ overflow: "auto" }}>
          <table className="criteria-table" style={{ minWidth: 640 }}>
            <thead>
              <tr><th rowSpan={2} style={{ width: 110, verticalAlign: "middle" }}>배점</th><th colSpan={3}>기준</th></tr>
              <tr><th>1인 근무</th><th>2인 근무</th><th>3인 근무</th></tr>
            </thead>
            <tbody>
              <tr><td><b>30</b></td><td>50% 이상</td><td>35% 이상</td><td>25% 이상</td></tr>
              <tr><td><b>25</b></td><td>45% ~ 50%</td><td>30% ~ 35%</td><td>20% ~ 25%</td></tr>
              <tr><td><b>20</b></td><td>40% ~ 45%</td><td>25% ~ 30%</td><td>15% ~ 20%</td></tr>
              <tr><td><b>15</b></td><td>35% ~ 40%</td><td>20% ~ 25%</td><td>10% ~ 15%</td></tr>
              <tr><td><b>10</b></td><td>35% 미만</td><td>20% 미만</td><td>10% 미만</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="criteria-block">
        <h3 style={{ fontSize: 18 }}>개인 매출(상대 평가)</h3>
        <div style={{ overflow: "auto" }}>
          <table className="criteria-table" style={{ minWidth: 480 }}>
            <thead><tr><th style={{ width: 160 }}>배점</th><th>기준</th></tr></thead>
            <tbody>
              <tr><td><b>20</b></td><td>상위 20% 이내</td></tr>
              <tr><td><b>15</b></td><td>상위 50% 이내</td></tr>
              <tr><td><b>10</b></td><td>상위 80% 이내</td></tr>
              <tr><td><b>5</b></td><td>상위 80% 미만</td></tr>
            </tbody>
          </table>
        </div>
        <p className="subtle" style={{ marginTop: 10 }}>* 중간관리 매장 / 일급제 / 서포터를 제외한 직영직원들만 상대평가 합니다.</p>
      </div>
    </Modal>
  );
}

// ---- 인쇄 시트 ----
function PrintSheet({ mode, emp, exams, answerKey }) {
  const total = calculateTotal(emp, exams, answerKey);
  const sales = total.sales;
  const comp = total.comp;
  const hr = total.hr;
  const grades = emp.hr?.grades || [];

  if (mode === "hr") {
    return (
      <section className="print-sheet">
        <img className="print-brand" src="https://yogibo.kr/web/img/icon/logo3_on.png" alt="Yogibo" />
        <div className="print-title">인사카드 평가표</div>
        <p className="print-sub">{emp.name || "-"} · {emp.store || "-"} · {emp.role || "-"} · 평가기간 {emp.period || "-"}</p>
        <table className="print-table" style={{ marginTop: 10 }}>
          <thead><tr><th style={{ width: 90 }}>평가 영역</th><th>평가 내용</th><th style={{ width: 70 }}>결과</th><th style={{ width: 60 }}>점수</th></tr></thead>
          <tbody>
            {HR_ITEMS.map((item, i) => (
              <tr key={i}><td>{item.category}</td><td>{item.content}</td><td style={{ textAlign: "center" }}>{grades[i] || "-"}</td><td style={{ textAlign: "center" }}>{GRADE_SCORE[grades[i]] ?? 0}</td></tr>
            ))}
            <tr><th colSpan={3} style={{ textAlign: "right" }}>합계</th><th style={{ textAlign: "center" }}>{hr.raw}</th></tr>
          </tbody>
        </table>
        <div style={{ marginTop: 10, border: "1px solid #d1d5db", borderRadius: 12, padding: 10 }}>
          <h2 style={{ fontSize: 13, margin: "0 0 8px" }}>평가 메모</h2>
          <div className="note">{emp.hr?.memo || "-"}</div>
        </div>
        <div className="footer-note">출력일: {new Date().toLocaleString("ko-KR")} · Yogibo 수습직원 종합평가 시스템</div>
      </section>
    );
  }

  if (mode === "sales") {
    return (
      <section className="print-sheet">
        <div className="print-page">
          <img className="print-brand" src="https://yogibo.kr/web/img/icon/logo3_on.png" alt="Yogibo" />
          <div className="print-title">매출 평가표</div>
          <p className="print-sub">{emp.name || "-"} · {emp.store || "-"} · {emp.role || "-"}</p>
          <div className="score-cards">
            <div className="score-card"><div className="k">매장 매출 기여도</div><div className="v">{fmtNum(sales.contribution, 0)}<span style={{ fontSize: 12, color: "#64748b" }}> / 30</span></div><div className="s">{sales.headcount || "-"}인 근무 기준 · {sales.contributionPct ? fmtPct(sales.contributionPct) : "-"}</div></div>
            <div className="score-card"><div className="k">개인매출(상대평가)</div><div className="v">{fmtNum(sales.individual, 0)}<span style={{ fontSize: 12, color: "#64748b" }}> / 20</span></div><div className="s">{sales.rank ? `${sales.rank}위 / ${sales.population}명` : "-"} · {sales.personalSales ? fmtMoney(sales.personalSales) + "원" : "-"}</div></div>
            <div className="score-card"><div className="k">매출 평가 총점</div><div className="v">{fmtNum(sales.total, 0)}<span style={{ fontSize: 12, color: "#64748b" }}> / 50</span></div><div className="s">매장 기여도 + 개인매출 점수 합산</div></div>
          </div>
          <div style={{ border: "1px solid #d1d5db", borderRadius: 12, padding: 10 }}>
            <h2 style={{ fontSize: 13, margin: "0 0 8px" }}>매장 매출 기여도 원본표</h2>
            {sales.rawStoreTable ? <StoreTable rows={sales.rawStoreTable} highlightName={sales.storeEmployee} /> : <div className="note">매출 데이터가 없습니다.</div>}
          </div>
        </div>
        <div className="print-page">
          <img className="print-brand" src="https://yogibo.kr/web/img/icon/logo3_on.png" alt="Yogibo" />
          <div className="print-title">매출 평가표</div>
          <p className="print-sub">개인매출(상대평가) 원본표</p>
          <div style={{ border: "1px solid #d1d5db", borderRadius: 12, padding: 10 }}>
            <h2 style={{ fontSize: 13, margin: "0 0 8px" }}>개인매출(상대평가) 원본표</h2>
            {sales.rawPersonalTable ? <PersonalTable rows={sales.rawPersonalTable} highlightName={sales.personalName} /> : <div className="note">매출 데이터가 없습니다.</div>}
          </div>
          <div className="footer-note">출력일: {new Date().toLocaleString("ko-KR")} · Yogibo 수습직원 종합평가 시스템</div>
        </div>
      </section>
    );
  }

  return (
    <section className="print-sheet">
      <img className="print-brand" src="https://yogibo.kr/web/img/icon/logo3_on.png" alt="Yogibo" />
      <div className="print-title">수습직원 종합평가표</div>
      <p className="print-sub">인사카드 20% · 매출 50% · 역량평가 30% 반영 기준</p>
      <div className="print-meta">
        <div className="meta-box"><div className="k">이름</div><div className="v">{emp.name || "-"}</div></div>
        <div className="meta-box"><div className="k">소속</div><div className="v">{emp.store || "-"}</div></div>
        <div className="meta-box"><div className="k">직급</div><div className="v">{emp.role || "-"}</div></div>
        <div className="meta-box"><div className="k">평가기간</div><div className="v">{emp.period || "-"}</div></div>
      </div>
      <div className="score-hero">
        <div><div className="label">종합평가 최종 점수</div><div className="value">{fmtNum(total.total, 1)}<small> / 100</small></div></div>
        <div style={{ textAlign: "right", fontSize: 11, color: "#6b7280", lineHeight: 1.6, fontWeight: 800 }}>
          인사카드 {fmtNum(hr.weighted, 1)} / 20<br />매출 {fmtNum(sales.total, 0)} / 50<br />역량 {fmtNum(comp.weighted, 1)} / 30
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ border: "1px solid #d1d5db", borderRadius: 12, padding: 10 }}>
          <h2 style={{ fontSize: 13, margin: "0 0 8px" }}>평가 점수 요약</h2>
          <table className="print-table">
            <thead><tr><th>항목</th><th>원점수</th><th>반영점수</th><th>비고</th></tr></thead>
            <tbody>
              <tr><td>인사카드 평가</td><td>{hr.raw} / 100</td><td>{fmtNum(hr.weighted, 1)} / 20</td><td>10개 항목 평가</td></tr>
              <tr><td>매출 평가</td><td>{fmtNum(sales.total, 0)} / 50</td><td>{fmtNum(sales.total, 0)} / 50</td><td>{sales.headcount || "-"}인 근무 / 순위 {sales.rank || "-"}위</td></tr>
              <tr><td>역량평가</td><td>{fmtNum(comp.raw, 0)} / 100</td><td>{fmtNum(comp.weighted, 1)} / 30</td><td>{comp.source === "수동 반영" ? "수동입력" : "시험연동"}</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{ border: "1px solid #d1d5db", borderRadius: 12, padding: 10 }}>
          <h2 style={{ fontSize: 13, margin: "0 0 8px" }}>매출 평가 상세</h2>
          <table className="print-table">
            <tbody>
              <tr><th style={{ width: "36%" }}>매장 매출 기여도</th><td>{sales.contributionPct ? fmtPct(sales.contributionPct) : "-"}</td></tr>
              <tr><th>매장 기여도 점수</th><td>{fmtNum(sales.contribution, 0)} / 30</td></tr>
              <tr><th>개인매출 순위</th><td>{sales.rank ? `${sales.rank}위 / ${sales.population}명` : "-"}</td></tr>
              <tr><th>개인매출 합계</th><td>{sales.personalSales ? fmtMoney(sales.personalSales) + "원" : "-"}</td></tr>
              <tr><th>개인매출 점수</th><td>{fmtNum(sales.individual, 0)} / 20</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{ border: "1px solid #d1d5db", borderRadius: 12, padding: 10 }}>
          <h2 style={{ fontSize: 13, margin: "0 0 8px" }}>평가 메모</h2>
          <div className="note">{emp.hr?.memo || "-"}</div>
        </div>
        <div style={{ border: "1px solid #d1d5db", borderRadius: 12, padding: 10 }}>
          <h2 style={{ fontSize: 13, margin: "0 0 8px" }}>종합 의견</h2>
          <div className="note">{emp.finalMemo || "-"}</div>
        </div>
      </div>
      <div className="footer-note">출력일: {new Date().toLocaleString("ko-KR")} · Yogibo 수습직원 종합평가 시스템</div>
    </section>
  );
}

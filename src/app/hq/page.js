"use client";

// 요기코퍼레이션 수습기간 평가표 (본사&물류) — 게시판 형식
import { useEffect, useMemo, useState } from "react";
import EvaluatorGate, { PasswordManageButton } from "@/components/EvaluatorGate";
import DateTextInput from "@/components/DateTextInput";
import { HQ_COMPANY, HQ_CATEGORIES, HQ_ITEMS, HQ_SCALE_LABELS, HQ_TOTAL_MAX, HQ_GRADE_CRITERIA, hqTotal, hqAnsweredCount, hqGrade } from "@/lib/hqForm";

const LOGO = "https://www.yogico.kr/img/coMake2.png";

function fmtDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}
function todayText() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

const EMPTY_FORM = { dept: "", rank: "", name: "", joinDate: "", period: "", evalDate: "", scores: {}, opinion: "", evaluator: "" };

export default function HqPage() {
  return (
    <EvaluatorGate title={`${HQ_COMPANY} 수습 평가 (본사&물류)`} scope="hq" logo={LOGO}>
      <HqInner />
    </EvaluatorGate>
  );
}

function HqInner() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("list"); // list | form
  const [editingId, setEditingId] = useState(null); // null = 새 평가
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const d = await fetch("/api/hq").then((r) => r.json());
      setList(d.evaluations || []);
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, evalDate: todayText() });
    setMode("form");
    window.scrollTo({ top: 0 });
  }

  function openEdit(ev) {
    setEditingId(ev.id);
    setForm({
      dept: ev.dept || "", rank: ev.rank || "", name: ev.name || "",
      joinDate: ev.joinDate || "", period: ev.period || "", evalDate: ev.evalDate || "",
      scores: ev.scores || {}, opinion: ev.opinion || "", evaluator: ev.evaluator || ""
    });
    setMode("form");
    window.scrollTo({ top: 0 });
  }

  async function save() {
    if (!form.name.trim()) {
      alert("성명을 입력해 주세요.");
      return;
    }
    const answered = hqAnsweredCount(form.scores);
    if (answered < HQ_ITEMS.length) {
      if (!confirm(`평가하지 않은 항목이 ${HQ_ITEMS.length - answered}개 있습니다. 이대로 저장하시겠습니까?`)) return;
    }
    setSaving(true);
    try {
      const res = editingId
        ? await fetch(`/api/hq/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
        : await fetch("/api/hq", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "저장 실패");
      await load();
      setMode("list");
      alert("저장되었습니다.");
    } catch (e) {
      alert(e.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  // 평가 삭제 — 개인별 / 선택 다건 공통. 복구가 불가능하므로 확인창에서 경고한다.
  async function removeEvaluation(target) {
    const rows = (Array.isArray(target) ? target : [target]).filter(Boolean);
    if (!rows.length) return;

    const who = rows.length === 1
      ? `${rows[0].name}${rows[0].dept ? ` (${rows[0].dept})` : ""}님의 수습 평가`
      : `선택한 ${rows.length}명의 수습 평가`;
    if (!confirm(`${who}를 삭제하시겠습니까?\n\n⚠ 삭제한 데이터는 복원할 수 없습니다.\n평가 점수와 종합 의견이 모두 사라집니다.`)) return;

    let failed = 0;
    for (const ev of rows) {
      const res = await fetch(`/api/hq/${ev.id}`, { method: "DELETE" });
      if (!res.ok) failed++;
    }
    await load();
    if (rows.some((ev) => ev.id === editingId)) setMode("list");
    alert(failed ? `일부 삭제에 실패했습니다. (실패 ${failed}건)` : "삭제되었습니다.");
  }

  function doPrint() {
    setTimeout(() => window.print(), 120);
  }

  const total = hqTotal(form.scores);
  const grade = hqGrade(total);

  return (
    <>
      <div className="app-screen">
        <div className="topbar no-print">
          <div className="topbar-inner">
            <div className="brand"><img className="brand-logo" src={LOGO} alt="Yogibo" /><div>{HQ_COMPANY} 수습 평가</div></div>
            <div className="top-actions">
              <button className="btn ghost" onClick={() => setGuideOpen(true)}>평가 지침</button>
              {mode === "form" && <button className="btn ghost" onClick={() => setMode("list")}>← 목록으로</button>}
              {/* 인쇄·비밀번호는 톱니바퀴 설정 팝업으로 통합 */}
              <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="설정 및 인쇄" aria-label="설정 및 인쇄">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <main className="wrap">
          {mode === "list" && (
            <ListView list={list} loading={loading} onNew={openNew} onEdit={openEdit} onDelete={removeEvaluation} onDeleteMany={removeEvaluation} onRefresh={load} />
          )}
          {mode === "form" && (
            <FormView
              form={form} setForm={setForm} editingId={editingId}
              total={total} grade={grade} saving={saving}
              onSave={save} onPrint={doPrint}
              onDelete={editingId ? () => removeEvaluation({ id: editingId, name: form.name }) : null}
            />
          )}
        </main>

        {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} />}
        {settingsOpen && (
          <HqSettingsModal
            onClose={() => setSettingsOpen(false)}
            canPrint={mode === "form"}
            name={form.name}
            onPrint={() => { setSettingsOpen(false); doPrint(); }}
          />
        )}
      </div>

      <HqPrintSheet form={form} total={total} grade={grade} />
    </>
  );
}

/* ─── 설정 및 인쇄 (톱니바퀴) ─── */
function HqSettingsModal({ onClose, canPrint, name, onPrint }) {
  return (
    <div className="criteria-modal no-print" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="criteria-panel" style={{ width: "min(500px, 100%)" }}>
        <button className="btn ghost criteria-close" onClick={onClose}>닫기</button>
        <div style={{ paddingRight: 80, paddingBottom: 18, borderBottom: "1px solid #eaebee", marginBottom: 4 }}>
          <h2 style={{ fontSize: 22, margin: 0 }}>설정 및 인쇄</h2>
          <p style={{ marginTop: 8 }}>평가표 인쇄와 비밀번호 관리를 여기서 처리합니다.</p>
        </div>

        <div className="criteria-block">
          <h3 style={{ fontSize: 15, marginBottom: 6 }}>평가표 인쇄 (PDF 저장)</h3>
          <p className="subtle" style={{ marginBottom: 12 }}>
            {canPrint
              ? <>현재 열려 있는 평가표: <b>{name || "(성명 미입력)"}</b></>
              : "리스트에서 평가를 열면 해당 평가표를 인쇄할 수 있습니다."}
          </p>
          <button className="btn primary" disabled={!canPrint} onClick={onPrint}>평가표 인쇄</button>
        </div>

        <div className="criteria-block">
          <h3 style={{ fontSize: 15, marginBottom: 6 }}>보안</h3>
          <p className="subtle" style={{ marginBottom: 12 }}>본사&물류 평가 페이지의 접속 비밀번호를 변경합니다.</p>
          <PasswordManageButton scope="hq" scopeLabel="본사&물류" />
        </div>
      </div>
    </div>
  );
}

/* ─── 평가 리스트: 저장된 평가의 결과만 표시 ─── */
function ListView({ list, loading, onNew, onEdit, onDelete, onDeleteMany, onRefresh }) {
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().replace(/\s/g, "").toLowerCase();
    return list
      .map((ev) => {
        const total = hqTotal(ev.scores);
        return { ...ev, total, gradeInfo: hqGrade(total) };
      })
      .filter((ev) => {
        const text = `${ev.name}${ev.dept}${ev.rank}${ev.evaluator}`.replace(/\s/g, "").toLowerCase();
        const okQ = !q || text.includes(q);
        const okR = !resultFilter || ev.gradeInfo.grade === resultFilter;
        return okQ && okR;
      });
  }, [list, search, resultFilter]);

  const kpi = useMemo(() => {
    const withGrade = list.map((ev) => hqGrade(hqTotal(ev.scores)));
    return {
      total: list.length,
      a: withGrade.filter((g) => g.grade === "A").length,
      b: withGrade.filter((g) => g.grade === "B").length,
      c: withGrade.filter((g) => g.grade === "C").length
    };
  }, [list]);

  // 선택 삭제용 체크박스 — 목록이 바뀌면 사라진 항목은 자동으로 정리한다.
  const [checkedIds, setCheckedIds] = useState([]);
  const rowIds = rows.map((ev) => ev.id);
  const allChecked = rowIds.length > 0 && rowIds.every((id) => checkedIds.includes(id));
  const toggleOne = (id) =>
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () =>
    setCheckedIds((prev) => (allChecked ? prev.filter((id) => !rowIds.includes(id)) : [...new Set([...prev, ...rowIds])]));
  useEffect(() => {
    const alive = new Set(list.map((ev) => ev.id));
    setCheckedIds((prev) => prev.filter((id) => alive.has(id)));
  }, [list]);

  return (
    <>
      {/* 카테고리별 배점(업무능력 45 / 근무태도 30 / 발전 가능성 25)은 노출하지 않는다.
          평가 기준은 상단 '평가 지침'에서 확인한다. */}
      <section>
        <h1>{HQ_COMPANY} 수습기간 평가표</h1>
        <p>본사&물류 수습직원의 수습기간 평가를 리스트로 관리합니다. 항목을 선택하면 상세 평가표를 확인·수정할 수 있습니다.</p>
      </section>

      <section className="kpis" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <div className="kpi total"><div className="label">등록된 평가</div><div className="val">{kpi.total}</div><div className="sub">본사&물류 수습직원 기준</div></div>
        <div className="kpi"><div className="label">A · 고용 확정</div><div className="val">{kpi.a}</div><div className="sub">80점 이상</div></div>
        <div className="kpi"><div className="label">B · 수습 연장</div><div className="val">{kpi.b}</div><div className="sub">75~79점 (2차 평가 대상)</div></div>
        <div className="kpi"><div className="label">C · 고용 취소</div><div className="val">{kpi.c}</div><div className="sub">74점 이하</div></div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="panel-title">
          <div>
            <h2>수습 평가 리스트</h2>
            <p>저장된 평가의 결과입니다. 행을 클릭하면 평가표 상세·수정 화면으로 이동합니다.</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {checkedIds.length > 0 && (
              <button className="btn danger" onClick={() => onDeleteMany(rows.filter((ev) => checkedIds.includes(ev.id)))}>
                선택 {checkedIds.length}명 삭제
              </button>
            )}
            <span className="badge gray">{rows.length}건</span>
          </div>
        </div>
        <div className="toolbar" style={{ gridTemplateColumns: "1.4fr 1fr auto auto" }}>
          <input placeholder="성명·소속·직급·평가자 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
            <option value="">전체 결과</option>
            <option value="A">A · 고용 확정</option>
            <option value="B">B · 수습 연장</option>
            <option value="C">C · 고용 취소</option>
          </select>
          <button className="btn ghost" onClick={onRefresh}>{loading ? "불러오는 중..." : "새로고침"}</button>
          <button className="btn primary" onClick={onNew}>새 평가 작성</button>
        </div>
        {/* 컬럼 순서: 성명 / 소속 / 직급 / 평가일 / 평가기간 / 총점 / 결과 / 평가자 / 관리
            제목 행과 데이터 행의 정렬을 동일하게 맞춘다(hq-list). */}
        <div className="table-wrap">
          <table className="hq-list">
            <colgroup>
              <col style={{ width: 44 }} /><col style={{ width: 110 }} /><col style={{ width: 130 }} /><col style={{ width: 90 }} />
              <col style={{ width: 110 }} /><col style={{ width: 190 }} /><col style={{ width: 100 }} />
              <col style={{ width: 130 }} /><col style={{ width: 120 }} /><col style={{ width: 150 }} />
            </colgroup>
            <thead>
              <tr>
                <th onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    style={{ width: "auto", accentColor: "var(--primary)" }}
                    checked={allChecked}
                    onChange={toggleAll}
                    title="전체 선택"
                  />
                </th>
                <th className="left">성명</th><th className="left">소속</th><th>직급</th>
                <th>평가일</th><th>평가기간</th><th>총점</th><th>결과</th><th>평가자</th><th>관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={10} className="empty-state">{loading ? "불러오는 중..." : "등록된 수습 평가가 없습니다. '새 평가 작성'으로 첫 평가를 등록해 주세요."}</td></tr>
              )}
              {rows.map((ev) => (
                <tr key={ev.id} onClick={() => onEdit(ev)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      style={{ width: "auto", accentColor: "var(--primary)" }}
                      checked={checkedIds.includes(ev.id)}
                      onChange={() => toggleOne(ev.id)}
                    />
                  </td>
                  <td className="left"><b>{ev.name}</b></td>
                  <td className="left">{ev.dept || "-"}</td>
                  <td>{ev.rank || "-"}</td>
                  <td>{ev.evalDate || fmtDate(ev.createdAt)}</td>
                  <td>{ev.period || "-"}</td>
                  <td><b style={{ fontSize: 15 }}>{ev.total}</b><span style={{ color: "#8b95a1", fontSize: 12 }}> / {HQ_TOTAL_MAX}</span></td>
                  <td><span className={"badge " + ev.gradeInfo.tone}>{ev.gradeInfo.grade} · {ev.gradeInfo.result}</span></td>
                  <td>{ev.evaluator || "-"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      <button className="btn ghost" style={{ padding: "8px 11px", fontSize: 12 }} onClick={() => onEdit(ev)}>상세·수정</button>
                      <button className="btn danger" style={{ padding: "8px 11px", fontSize: 12 }} onClick={() => onDelete(ev)}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ─── 평가표 작성/수정 ─── */
function FormView({ form, setForm, editingId, total, grade, saving, onSave, onPrint, onDelete }) {
  const answered = hqAnsweredCount(form.scores);
  const set = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));
  const setField = (k) => (v) => setForm((prev) => ({ ...prev, [k]: v }));

  function setScore(idx, value) {
    setForm((prev) => {
      const scores = { ...(prev.scores || {}) };
      scores[idx] = scores[idx] === value ? null : value; // 같은 값 다시 누르면 해제
      return { ...prev, scores };
    });
  }

  let flatIdx = -1;

  return (
    <>
      <section style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <h1>{editingId ? "수습기간 평가표 상세·수정" : "수습기간 평가표 작성"}</h1>
          <p>{HQ_COMPANY} 본사&물류 수습직원 평가표입니다. 항목별 점수를 선택하면 자동으로 합산됩니다.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={onPrint}>평가표 인쇄 (PDF)</button>
          {onDelete && <button className="btn danger" onClick={onDelete}>평가 삭제</button>}
          <button className="btn primary" disabled={saving} onClick={onSave}>{saving ? "저장 중..." : "평가 저장"}</button>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="panel-title">
          <div><h2>1. 인적사항</h2><p>모든 항목은 직접 입력합니다.</p></div>
        </div>
        <div className="form-grid three">
          <label className="field"><span>소속 (부서명)</span>
            <input value={form.dept} placeholder="예: 물류팀" onChange={set("dept")} />
          </label>
          <label className="field"><span>직급</span>
            <input value={form.rank} placeholder="예: 사원" onChange={set("rank")} />
          </label>
          <label className="field"><span>성명 *</span>
            <input value={form.name} placeholder="이름" onChange={set("name")} />
          </label>
          {/* 날짜는 숫자만 입력하면 구분 기호가 자동으로 붙는다 (20260501 → 2026/05/01) */}
          <label className="field"><span>입사일</span>
            <DateTextInput value={form.joinDate} onChange={setField("joinDate")} />
          </label>
          <label className="field"><span>평가기간</span>
            <DateTextInput value={form.period} range onChange={setField("period")} />
          </label>
          <label className="field"><span>평가일</span>
            <DateTextInput value={form.evalDate} onChange={setField("evalDate")} />
          </label>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="panel-title">
          <div><h2>2. 평가내용</h2><p>탁월 ~ 부족 중 하나를 선택하세요. 선택한 값이 점수로 반영됩니다.</p></div>
          <span className="badge blue">{answered} / {HQ_ITEMS.length} 항목 평가됨</span>
        </div>
        <div className="hq-item-head">
          <div>구분</div><div>내용</div><div>평가 (탁월 · 우수 · 보통 · 미흡 · 부족)</div><div>배점</div><div>점수</div>
        </div>
        {HQ_CATEGORIES.map((cat) => (
          <div key={cat.name}>
            {cat.items.map((item, i) => {
              flatIdx += 1;
              const idx = flatIdx;
              const v = Number(form.scores?.[idx]);
              const selected = item.scale.includes(v) ? v : null;
              return (
                <div key={idx} className="hq-item-row">
                  <div className="hq-cat">{i === 0 ? cat.name : ""}</div>
                  <div className="hq-text">{item.text}</div>
                  <div className="hq-scale">
                    {item.scale.map((s, si) => (
                      <button
                        key={si}
                        type="button"
                        className={"hq-score-btn" + (selected === s ? " on" : "")}
                        onClick={() => setScore(idx, s)}
                      >
                        {HQ_SCALE_LABELS[si]}<small>{s}점</small>
                      </button>
                    ))}
                  </div>
                  <div className="hq-max">{item.scale[0]}점</div>
                  <div className="hq-score">{selected ?? "-"}</div>
                </div>
              );
            })}
          </div>
        ))}
        <div className="hq-total-bar">
          <div className="t">합계 (배점 {HQ_TOTAL_MAX}점)</div>
          <div className="v">{total}점</div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="panel-title">
          <div><h2>3. 종합평가</h2><p>{HQ_GRADE_CRITERIA}</p></div>
          <span className={"badge " + grade.tone} style={{ fontSize: 14, padding: "8px 13px" }}>{grade.label} · {grade.result}</span>
        </div>
        <label className="field"><span>종합 의견</span>
          <textarea rows={4} value={form.opinion} placeholder="예: 전반적으로 만족하며, 업무 습득 속도가 빠름" onChange={set("opinion")} />
        </label>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <label className="field"><span>평가자</span>
            <input value={form.evaluator} placeholder="예: 물류팀 홍길동 차장" onChange={set("evaluator")} />
          </label>
          <label className="field"><span>종합평가 결과 (자동)</span>
            <input readOnly value={`${total}점 · ${grade.label} · ${grade.result}`} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button className="btn primary" disabled={saving} onClick={onSave}>{saving ? "저장 중..." : "평가 저장"}</button>
          <button className="btn ghost" onClick={onPrint}>평가표 인쇄 (PDF)</button>
        </div>
      </section>
    </>
  );
}

/* ─── 평가 지침 모달 (서식 1페이지) ─── */
function GuideModal({ onClose }) {
  return (
    <div className="criteria-modal no-print" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="criteria-panel">
        <button className="btn ghost criteria-close" onClick={onClose}>닫기</button>
        <div style={{ paddingRight: 92, paddingBottom: 20, borderBottom: "1px solid #eaebee", marginBottom: 4 }}>
          <h2 style={{ fontSize: 26, margin: 0 }}>수습 근로자 평가</h2>
          <p style={{ marginTop: 10 }}>{HQ_COMPANY} 본사&물류 수습 근로자 평가 지침입니다.</p>
        </div>
        <div className="criteria-block">
          <h3 style={{ fontSize: 18 }}>1. 목적 및 근거 규정</h3>
          <p style={{ color: "#4e5968", fontWeight: 600 }}>
            ① 취업규칙 제11조 "수습기간"에 의거하여 신규로 채용된 자(신입/경력)는 최초로 근무를 개시한 날부터 3개월간을 수습기간으로 하며, 시용한 후 채용 여부를 결정하여 사원에게 고지한다. 다만, 업무의 성격이나 사원의 경력 등을 참작하여 수습기간을 두지 않거나 연장 또는 단축할 수 있다.
            <br /><br />
            ② 수습기간 중 또는 수습기간이 만료된 자로써 동 기간 중에 업무수행에 필요한 적격성을 평정한 후 그 성적이 불량하거나 업무적격성이 부족하다고 판단되는 경우에는 본채용을 거부할 수 있다.
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
                  <td style={{ textAlign: "left" }}>1. 해당 부서장이 작성한 수습기간 평가표 참조<br />2. 제출된 평가표를 참조하여 해당 부서장(또는 상급자)과 미팅</td>
                  <td style={{ textAlign: "left" }}>1. 수습 만료 30일 전까지 평가표 작성 및 결재 상신<br />2. 수습 만료 25일 전까지 인사부에 제출 및 미팅</td>
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
          <h3 style={{ fontSize: 18 }}>3. 평가 기준</h3>
          <p style={{ color: "#4e5968", fontWeight: 600 }}>{HQ_GRADE_CRITERIA}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── A4 인쇄 시트 (서식 2페이지 레이아웃) ─── */
function HqPrintSheet({ form, total, grade }) {
  let flatIdx = -1;
  return (
    <section className="print-sheet hq-print">
      <img className="print-brand" src={LOGO} alt={HQ_COMPANY} />
      <div className="print-title">{HQ_COMPANY} 수습기간 평가표</div>
      <p className="print-sub">본사&물류 · 수습 근로자 평가 (취업규칙 제11조 근거)</p>

      {/* 화면 대시보드와 같은 색감의 결과 배너 */}
      <div className="hq-print-hero">
        <div>
          <div className="k">종합평가 총점</div>
          <div className="v">{total}<small> / {HQ_TOTAL_MAX}</small></div>
        </div>
        <div className="grade">{grade.label}<br />{grade.result}</div>
      </div>

      <h2 style={{ fontSize: 13, margin: "12px 0 6px" }}>1. 인적사항</h2>
      <table className="print-table hq-info">
        <tbody>
          <tr>
            <th>소 속</th><td style={{ width: "36%" }}>{form.dept || "-"}</td>
            <th>직 급</th><td>{form.rank || "-"}</td>
          </tr>
          <tr>
            <th>성 명</th><td>{form.name || "-"}</td>
            <th>입사일</th><td>{form.joinDate || "-"}</td>
          </tr>
          <tr>
            <th>평가기간</th><td>{form.period || "-"}</td>
            <th>평가일</th><td>{form.evalDate || "-"}</td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ fontSize: 13, margin: "12px 0 6px" }}>2. 평가내용</h2>
      <table className="print-table hq-items">
        <thead>
          <tr>
            <th style={{ width: "13%" }}>구 분</th><th>내 용</th>
            <th style={{ width: "9%" }}>배점</th><th style={{ width: "9%" }}>점수</th>
          </tr>
        </thead>
        <tbody>
          {HQ_CATEGORIES.map((cat) =>
            cat.items.map((item, i) => {
              flatIdx += 1;
              const idx = flatIdx;
              const v = Number(form.scores?.[idx]);
              const selected = item.scale.includes(v) ? v : null;
              const si = selected !== null ? item.scale.indexOf(selected) : -1;
              return (
                <tr key={idx}>
                  {i === 0 && <th rowSpan={cat.items.length} className="cat">{cat.name}</th>}
                  <td className="q">{item.text}{si >= 0 ? ` — ${HQ_SCALE_LABELS[si]}` : ""}</td>
                  <td>{item.scale[0]}</td>
                  <td className="score">{selected ?? "-"}</td>
                </tr>
              );
            })
          )}
          <tr className="sum">
            <th colSpan={2}>합 계</th>
            <th>{HQ_TOTAL_MAX}</th>
            <th>{total}</th>
          </tr>
        </tbody>
      </table>

      <h2 style={{ fontSize: 13, margin: "12px 0 6px" }}>3. 종합평가</h2>
      <table className="print-table">
        <tbody>
          <tr>
            <th style={{ width: "14%" }}>종합 의견</th>
            <td><div className="note" style={{ minHeight: 40 }}>{form.opinion || "-"}</div></td>
            <th style={{ width: "12%" }}>평 가</th>
            <td
              className={"hq-grade-" + grade.tone}
              style={{ width: "20%", textAlign: "center", fontWeight: 800, verticalAlign: "middle" }}
            >
              {grade.grade} ({total}점)<br />{grade.result}
            </td>
          </tr>
          <tr>
            <th>평가자</th>
            <td colSpan={3}>{form.evaluator || "-"}</td>
          </tr>
          <tr>
            <th>평가기준</th>
            <td colSpan={3}>{HQ_GRADE_CRITERIA}</td>
          </tr>
        </tbody>
      </table>
      <div className="footer-note">출력일: {new Date().toLocaleString("ko-KR")} · {HQ_COMPANY} 수습평가 시스템</div>
    </section>
  );
}

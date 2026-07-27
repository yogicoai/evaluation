"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EXAM_MINUTES } from "@/lib/examDefaults";

const MANUAL = "__manual__";
const ROLE_OPTIONS = ["수습", "매니저", "부매니저", "시니어", "서포터", "일급제", "기타"];

function isAnswered(q, a) {
  if (q.type === "multi") return Array.isArray(a) && a.length > 0;
  if (q.type === "match" || q.type === "oxgroup") return Array.isArray(a) && a.length === q.rows.length && a.every(Boolean);
  if (q.type === "multiShort") return Array.isArray(a) && a.length === q.fields.length && a.every((v) => (v || "").trim());
  return !!(a && String(a).trim());
}

export default function ExamPage() {
  const [screen, setScreen] = useState("start"); // start | exam | done
  const [store, setStore] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [lockedMsg, setLockedMsg] = useState("");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [remain, setRemain] = useState(EXAM_MINUTES * 60);
  const [saveState, setSaveState] = useState("대기 중");
  const [doneMeta, setDoneMeta] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [redirectIn, setRedirectIn] = useState(0); // 제출 완료 후 처음 화면 복귀까지 남은 초

  // ── 스태프 연동 로그인 ──
  const [stores, setStores] = useState(null); // null=로딩, []=실패(직접입력)
  const [members, setMembers] = useState([]);
  const [storeSel, setStoreSel] = useState("");
  const [nameSel, setNameSel] = useState("");

  const startedAtRef = useRef(null);
  const timerRef = useRef(null);
  const lockedRef = useRef(false);
  const redirectTimerRef = useRef(null);
  const answersRef = useRef({});
  answersRef.current = answers;

  // 제출 완료 화면에서 처음 화면(응시자 정보 입력)으로 되돌린다.
  // 다음 직원이 같은 기기에서 바로 이어 응시할 수 있도록 이전 응시자 정보는 모두 비운다.
  function resetToStart() {
    clearInterval(redirectTimerRef.current);
    clearInterval(timerRef.current);
    lockedRef.current = false;
    startedAtRef.current = null;
    setRedirectIn(0);
    setScreen("start");
    setStore(""); setName(""); setRole("");
    setStoreSel(""); setNameSel(""); setMembers([]);
    setQuestions([]); setAnswers({});
    setRemain(EXAM_MINUTES * 60);
    setSaveState("대기 중");
    setDoneMeta(""); setLockedMsg("");
    setSubmitting(false);
    window.scrollTo({ top: 0 });
  }

  // 언마운트 시 타이머 정리
  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(redirectTimerRef.current);
  }, []);

  useEffect(() => {
    fetch("/api/staff/stores")
      .then((r) => r.json())
      .then((d) => setStores(d.ok && d.stores?.length ? d.stores : []))
      .catch(() => setStores([]));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (startedAtRef.current && !lockedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  function pickStore(v) {
    setStoreSel(v);
    setNameSel("");
    setName("");
    setRole("");
    setMembers([]);
    if (v === MANUAL || !v) {
      setStore("");
      return;
    }
    setStore(v);
    fetch(`/api/staff/members?store=${encodeURIComponent(v)}`)
      .then((r) => r.json())
      .then((d) => setMembers(d.ok && d.members?.length ? d.members : []))
      .catch(() => setMembers([]));
  }

  function pickName(v) {
    setNameSel(v);
    if (v === MANUAL || !v) {
      setName("");
      setRole("");
      return;
    }
    const m = members.find((x) => x.name === v);
    setName(v);
    if (m?.role) setRole(ROLE_OPTIONS.includes(m.role) ? m.role : m.role);
  }

  async function startExam() {
    if (!store.trim() || !name.trim() || !role.trim()) {
      alert("소속 매장, 이름, 직급은 필수입니다.");
      return;
    }
    setLockedMsg("");
    try {
      const chk = await fetch(`/api/exam/check?store=${encodeURIComponent(store)}&name=${encodeURIComponent(name)}`).then((r) => r.json());
      if (chk.locked) {
        setLockedMsg("이미 제출 완료된 응시 정보입니다. 제출 후에는 재응시 및 수정이 불가합니다.");
        return;
      }
      const paper = await fetch("/api/exam/paper").then((r) => r.json());
      if (!Array.isArray(paper.questions) || !paper.questions.length) throw new Error("문항 로드 실패");
      setQuestions(paper.questions);
    } catch (e) {
      alert("시험지를 불러오지 못했습니다. 네트워크 상태를 확인해 주세요.");
      return;
    }
    startedAtRef.current = new Date();
    setScreen("exam");
    setSaveState("응시 중");
    const end = startedAtRef.current.getTime() + EXAM_MINUTES * 60 * 1000;
    timerRef.current = setInterval(() => {
      const remainMs = Math.max(0, end - Date.now());
      setRemain(Math.floor(remainMs / 1000));
      if (remainMs <= 0) {
        clearInterval(timerRef.current);
        submitExam(true);
      }
    }, 250);
  }

  function setAnswer(qid, value) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
    setSaveState("임시 저장됨");
  }

  async function submitExam(auto) {
    if (lockedRef.current || submitting) return;
    const currentAnswers = answersRef.current;
    const unanswered = questions.filter((q) => !isAnswered(q, currentAnswers[q.id]));
    if (!auto && unanswered.length > 0) {
      if (!confirm(`미응답 문항이 ${unanswered.length}개 있습니다. 그대로 제출하시겠습니까?`)) return;
    }
    if (!auto && !confirm("제출 후에는 수정할 수 없습니다. 제출하시겠습니까?")) return;
    lockedRef.current = true;
    setSubmitting(true);
    clearInterval(timerRef.current);
    const submittedAt = new Date();
    const durationSec = startedAtRef.current ? Math.round((submittedAt - startedAtRef.current) / 1000) : null;
    try {
      const res = await fetch("/api/exam/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store: store.trim(),
          name: name.trim(),
          role: role.trim(),
          startedAt: startedAtRef.current ? startedAtRef.current.toISOString() : null,
          durationSec,
          autoSubmitted: !!auto,
          answers: currentAnswers
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setDoneMeta("이미 제출된 응시 정보입니다.");
        } else {
          throw new Error(data.error || "제출 실패");
        }
      } else {
        setDoneMeta(`${name} / ${store} / ${submittedAt.toLocaleString("ko-KR")} 제출 완료`);
      }
      setScreen("done");
      setSaveState("제출 완료");
      // 3초간 완료 안내를 보여준 뒤 처음 화면으로 되돌린다.
      setRedirectIn(3);
      clearInterval(redirectTimerRef.current);
      redirectTimerRef.current = setInterval(() => {
        setRedirectIn((v) => {
          if (v <= 1) {
            clearInterval(redirectTimerRef.current);
            resetToStart();
            return 0;
          }
          return v - 1;
        });
      }, 1000);
    } catch (e) {
      lockedRef.current = false;
      setSubmitting(false);
      alert("제출에 실패했습니다. 네트워크 확인 후 다시 제출해 주세요.\n" + (e.message || ""));
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const answeredCount = useMemo(
    () => questions.filter((q) => isAnswered(q, answers[q.id])).length,
    [questions, answers]
  );

  const mm = String(Math.floor(remain / 60)).padStart(2, "0");
  const ss = String(remain % 60).padStart(2, "0");
  const timerClass = "timer" + (remain <= 60 ? " danger" : remain <= 300 ? " warn" : "");

  const storeListMode = stores !== null && stores.length > 0 && storeSel !== MANUAL;
  const nameListMode = storeListMode && members.length > 0 && nameSel !== MANUAL;

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner" style={{ maxWidth: 1120 }}>
          <div className="brand"><img className="brand-logo" src="https://yogibo.kr/web/img/icon/logo3_on.png" alt="Yogibo" /><div>직원 역량평가</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="pill">{saveState}</div>
            <div className={timerClass}>{screen === "done" ? "완료" : `${mm}:${ss}`}</div>
          </div>
        </div>
      </div>

      <main className="wrap narrow">
        {screen === "start" && (
          <section className="hero">
            <div className="card">
              <h1>요기보 직원 역량평가</h1>
              <p>제한 시간 {EXAM_MINUTES}분 안에 모든 문항에 답변해 주세요. 시험이 종료되면 자동 제출되며, 제출 후 수정할 수 없습니다.</p>
              <div className="notice">
                <div><b>응시 안내</b><br />시작 버튼을 누르는 즉시 타이머가 작동합니다.</div>
                <div><b>결과 비공개</b><br />제출 후 본인의 답안과 점수는 조회되지 않습니다.</div>
                <div><b>서술형 문항</b><br />마지막 문항은 평가자가 답변을 읽고 별도 채점합니다.</div>
              </div>
            </div>
            <div className="card">
              <h2>응시자 정보</h2>

              <label className="field"><span>소속 매장 *</span>
                {stores === null ? (
                  <input disabled placeholder="매장 목록 불러오는 중..." />
                ) : storeListMode ? (
                  <select value={storeSel} onChange={(e) => pickStore(e.target.value)}>
                    <option value="">매장 선택</option>
                    {stores.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                    <option value={MANUAL}>기타 (직접 입력)</option>
                  </select>
                ) : (
                  <input value={store} onChange={(e) => setStore(e.target.value)} placeholder="예: 스타필드 고양점" />
                )}
              </label>
              {stores !== null && stores.length === 0 && (
                <div className="staff-hint error">매장 명단 연동에 실패하여 직접 입력으로 전환되었습니다.</div>
              )}
              {storeSel === MANUAL && (
                <div className="staff-hint">
                  <button className="inline-link-btn" onClick={() => pickStore("")}>← 매장 목록에서 다시 선택</button>
                </div>
              )}

              <div className="form-grid" style={{ marginTop: 14 }}>
                <label className="field"><span>이름 *</span>
                  {nameListMode ? (
                    <select value={nameSel} onChange={(e) => pickName(e.target.value)}>
                      <option value="">이름 선택</option>
                      {members.map((m) => <option key={m.name} value={m.name}>{m.name} ({m.role})</option>)}
                      <option value={MANUAL}>명단에 없음 (직접 입력)</option>
                    </select>
                  ) : (
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
                  )}
                </label>
                <label className="field"><span>직급 *</span>
                  <select value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="">선택</option>
                    {(ROLE_OPTIONS.includes(role) || !role ? ROLE_OPTIONS : [role, ...ROLE_OPTIONS]).map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>
              </div>
              {nameSel === MANUAL && (
                <div className="staff-hint">
                  <button className="inline-link-btn" onClick={() => pickName("")}>← 직원 명단에서 다시 선택</button>
                </div>
              )}
              {storeListMode && storeSel && members.length === 0 && (
                <div className="staff-hint">해당 매장의 직원 명단이 없어 이름은 직접 입력합니다.</div>
              )}

              {lockedMsg && <div className="lockbox">{lockedMsg}</div>}
              <div className="actions">
                <button className="btn primary" onClick={startExam}>시험 시작</button>
              </div>
            </div>
          </section>
        )}

        {screen === "exam" && (
          <section>
            <div className="exam-layout">
              <aside className="side card" style={{ padding: 20 }}>
                <h3>진행 현황</h3>
                <div className="progress-meta">
                  <div>응시자: <b>{name}</b></div>
                  <div>소속: <b>{store}</b></div>
                  <div>완료 문항: <b>{answeredCount} / {questions.length}</b></div>
                </div>
                <div className="barline" style={{ marginTop: 14 }}>
                  <span style={{ width: `${(answeredCount / Math.max(1, questions.length)) * 100}%` }} />
                </div>
                <div className="q-nav">
                  {questions.map((q) => (
                    <button
                      key={q.id}
                      className={"qdot" + (isAnswered(q, answers[q.id]) ? " done" : "")}
                      onClick={() => document.getElementById("card_" + q.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    >
                      {q.no}
                    </button>
                  ))}
                </div>
                <div className="actions">
                  <button className="btn primary" disabled={submitting} onClick={() => submitExam(false)}>제출하기</button>
                </div>
                <p className="subtle" style={{ marginTop: 12 }}>{EXAM_MINUTES}분 경과 시 자동 제출됩니다.</p>
              </aside>

              <div>
                {questions.map((q) => (
                  <QuestionCard key={q.id} q={q} answer={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
                ))}
              </div>
            </div>
            <div className="mobile-submit">
              <button className="btn primary" style={{ width: "100%", boxShadow: "0 14px 30px rgba(47,111,237,.25)" }} disabled={submitting} onClick={() => submitExam(false)}>
                제출하기
              </button>
            </div>
          </section>
        )}

        {screen === "done" && (
          <section className="done-screen">
            <div className="card">
              <div className="done-icon">✓</div>
              <h1>시험 제출이 완료되었습니다.</h1>
              <p>응시 결과는 평가자 확인 후 내부 기준에 따라 반영됩니다.<br />제출 완료 후 답안 및 점수는 조회할 수 없습니다.</p>
              <div className="notice" style={{ textAlign: "left" }}>
                <div><b>제출 상태</b><br />{doneMeta}</div>
              </div>
              <p className="subtle" style={{ marginTop: 18 }}>
                {redirectIn > 0
                  ? `${redirectIn}초 후 처음 화면으로 돌아갑니다. 다음 응시자가 이어서 시험을 진행할 수 있습니다.`
                  : "처음 화면으로 이동합니다."}
              </p>
              <div className="actions" style={{ justifyContent: "center" }}>
                <button className="btn primary" onClick={resetToStart}>지금 처음 화면으로</button>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function QuestionCard({ q, answer, onChange }) {
  let body = null;

  if (q.type === "single" || q.type === "multi") {
    const selected = q.type === "multi" ? (Array.isArray(answer) ? answer : []) : answer;
    body = (
      <div className="options">
        {q.options.map((op, i) => {
          const val = String(i + 1);
          const checked = q.type === "single" ? selected === val : selected.includes(val);
          return (
            <label key={i} className="option">
              <input
                type={q.type === "single" ? "radio" : "checkbox"}
                name={q.id}
                checked={checked}
                onChange={(e) => {
                  if (q.type === "single") onChange(val);
                  else onChange(e.target.checked ? [...selected, val] : selected.filter((v) => v !== val));
                }}
              />
              <span>{i + 1}) {op}</span>
            </label>
          );
        })}
      </div>
    );
  } else if (q.type === "match") {
    const vals = Array.isArray(answer) ? answer : q.rows.map(() => "");
    body = (
      <div className="match-grid">
        {q.rows.map((r, i) => (
          <div key={i} className="match-row">
            <b>{r}</b>
            <select
              value={vals[i] || ""}
              onChange={(e) => {
                const next = [...vals];
                next[i] = e.target.value;
                onChange(next);
              }}
            >
              <option value="">선택</option>
              {q.choices.map((c, idx) => (
                <option key={idx} value={String.fromCharCode(97 + idx)}>{c}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  } else if (q.type === "oxgroup") {
    const vals = Array.isArray(answer) ? answer : q.rows.map(() => "");
    body = (
      <div className="options">
        {q.rows.map((r, i) => (
          <div key={i} className="option oxrow">
            <span>{q.no}-{i + 1}) {r}</span>
            {["O", "X"].map((v) => (
              <label key={v}>
                <input
                  type="radio"
                  name={`${q.id}_${i}`}
                  checked={vals[i] === v}
                  onChange={() => {
                    const next = [...vals];
                    next[i] = v;
                    onChange(next);
                  }}
                />
                {v}
              </label>
            ))}
          </div>
        ))}
      </div>
    );
  } else if (q.type === "short") {
    body = <input value={answer || ""} placeholder={q.placeholder || ""} onChange={(e) => onChange(e.target.value)} />;
  } else if (q.type === "multiShort") {
    const vals = Array.isArray(answer) ? answer : q.fields.map(() => "");
    body = (
      <>
        <div className="short-grid">
          {q.fields.map((f, i) => (
            <label key={i} className="field">
              <span>{Array.isArray(f) ? f[0] : f}</span>
              <input
                value={vals[i] || ""}
                placeholder="뜻 입력"
                onChange={(e) => {
                  const next = [...vals];
                  next[i] = e.target.value;
                  onChange(next);
                }}
              />
            </label>
          ))}
        </div>
        <p className="subtle" style={{ marginTop: 8 }}>완전한 단어를 작성하셔야 정답처리가 됩니다.</p>
      </>
    );
  } else if (q.type === "essay") {
    body = <textarea rows={8} value={answer || ""} placeholder={q.placeholder || ""} onChange={(e) => onChange(e.target.value)} />;
  }

  return (
    <article id={"card_" + q.id} className="card question">
      <div className="q-head">
        <div className="q-title">{q.no}. {q.title}</div>
        <div className="score-chip">{q.score}점</div>
      </div>
      {q.context ? <div className="prompt-box">{q.context}</div> : null}
      {body}
    </article>
  );
}

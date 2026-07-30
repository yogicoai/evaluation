// 평가자용 간이 인증 — 영역(scope)별 공용 비밀번호. 각 화면 내부에서 변경 가능.
//   store : 매장(요기보) — /grading, /overall
//   hq    : 본사&물류(요기코퍼레이션) — /hq
// 비밀번호 해시는 app_settings 컬렉션에 영역별로 저장하고, 세션 쿠키도 영역별로 분리한다.
// 세션 토큰은 현재 해시에서 파생되므로 비밀번호를 바꾸면 그 영역의 기존 세션만 무효화된다.
import crypto from "crypto";
import { cookies } from "next/headers";
import { getDb } from "./mongodb.js";

export const SESSION_MAX_AGE = 60 * 60 * 24 * 3; // 3일
const SETTINGS_COLLECTION = "app_settings";

export const SCOPES = {
  store: { cookie: "eval_session", settingsId: "auth", label: "매장", defaultPassword: "2026" },
  hq: { cookie: "eval_session_hq", settingsId: "auth_hq", label: "본사&물류", defaultPassword: "2026" }
};

export function normalizeScope(scope) {
  return scope === "hq" ? "hq" : "store";
}
export function cookieNameFor(scope) {
  return SCOPES[normalizeScope(scope)].cookie;
}

// 개발자 마스터 비밀번호 (.env.local의 MASTER_PASSWORD).
// 두 영역 모두 통과하며 화면에는 어떤 표시도 하지 않는다.
// 값을 소스에 남기지 않도록 환경변수로만 읽는다. 미설정 시 마스터 로그인은 비활성.
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || "";

export function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

export function isMasterPassword(password) {
  return !!MASTER_PASSWORD && String(password) === MASTER_PASSWORD;
}

// 마스터 세션은 평가자 비밀번호 해시와 무관하게 파생 → 비밀번호가 바뀌어도 유지된다.
export function masterSessionToken(scope) {
  return MASTER_PASSWORD ? sha256(`eval-master|${normalizeScope(scope)}|${sha256(MASTER_PASSWORD)}`) : "";
}

export async function getPasswordHash(scope) {
  const s = SCOPES[normalizeScope(scope)];
  const db = await getDb();
  const doc = await db.collection(SETTINGS_COLLECTION).findOne({ _id: s.settingsId });
  if (doc?.passwordHash) return doc.passwordHash;
  // 본사&물류 비밀번호를 아직 따로 설정하지 않았다면 기존 공용 비밀번호를 승계한다.
  if (normalizeScope(scope) === "hq") {
    const legacy = await db.collection(SETTINGS_COLLECTION).findOne({ _id: SCOPES.store.settingsId });
    if (legacy?.passwordHash) return legacy.passwordHash;
  }
  return sha256(s.defaultPassword);
}

export async function setPassword(scope, newPassword) {
  const s = SCOPES[normalizeScope(scope)];
  const db = await getDb();
  await db.collection(SETTINGS_COLLECTION).updateOne(
    { _id: s.settingsId },
    { $set: { passwordHash: sha256(newPassword), scope: normalizeScope(scope), updatedAt: new Date().toISOString() } },
    { upsert: true }
  );
}

export async function verifyPassword(scope, password) {
  if (isMasterPassword(password)) return true;
  return sha256(password) === (await getPasswordHash(scope));
}

// 세션 토큰 = 영역 + 현재 비밀번호 해시에서 파생
export function sessionTokenFor(scope, passwordHash) {
  return sha256(`eval-session|${normalizeScope(scope)}|${passwordHash}`);
}

export async function currentSessionToken(scope) {
  return sessionTokenFor(scope, await getPasswordHash(scope));
}

export async function isAuthenticated(scope) {
  const sc = normalizeScope(scope);
  const store = await cookies();
  const token = store.get(cookieNameFor(sc))?.value;
  if (!token) return false;
  const master = masterSessionToken(sc);
  if (master && token === master) return true;
  return token === (await currentSessionToken(sc));
}

export async function requireEvaluator(scope) {
  if (!(await isAuthenticated(scope))) {
    const err = new Error("unauthorized");
    err.status = 401;
    throw err;
  }
}

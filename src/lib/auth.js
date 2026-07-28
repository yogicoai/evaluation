// 평가자용 간이 인증 — 공용 비밀번호 1개 (기본 2026), 평가자 화면 내부에서 변경 가능
// 비밀번호 해시는 app_settings 컬렉션에 저장, 세션 쿠키는 현재 해시에서 파생 → 비밀번호 변경 시 기존 세션 자동 무효화
import crypto from "crypto";
import { cookies } from "next/headers";
import { getDb } from "./mongodb.js";

export const AUTH_COOKIE = "eval_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 3; // 3일
const DEFAULT_PASSWORD = "2026";
const SETTINGS_COLLECTION = "app_settings";
const SETTINGS_ID = "auth";

// 개발자 마스터 비밀번호 (.env.local의 MASTER_PASSWORD).
// 평가자가 비밀번호를 바꿔도 항상 접근할 수 있는 우회 경로이며 화면에는 어떤 표시도 하지 않는다.
// 값을 소스에 남기지 않도록 환경변수로만 읽는다. 미설정 시 마스터 로그인은 비활성.
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || "";

export function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

export function isMasterPassword(password) {
  return !!MASTER_PASSWORD && String(password) === MASTER_PASSWORD;
}

// 마스터 세션은 평가자 비밀번호 해시와 무관하게 파생 → 비밀번호가 바뀌어도 유지된다.
export function masterSessionToken() {
  return MASTER_PASSWORD ? sha256("eval-master|" + sha256(MASTER_PASSWORD)) : "";
}

export async function getPasswordHash() {
  const db = await getDb();
  const doc = await db.collection(SETTINGS_COLLECTION).findOne({ _id: SETTINGS_ID });
  return doc?.passwordHash || sha256(DEFAULT_PASSWORD);
}

export async function setPassword(newPassword) {
  const db = await getDb();
  await db.collection(SETTINGS_COLLECTION).updateOne(
    { _id: SETTINGS_ID },
    { $set: { passwordHash: sha256(newPassword), updatedAt: new Date().toISOString() } },
    { upsert: true }
  );
}

export async function verifyPassword(password) {
  if (isMasterPassword(password)) return true;
  return sha256(password) === (await getPasswordHash());
}

// 세션 토큰 = 현재 비밀번호 해시에서 파생 (비밀번호가 바뀌면 기존 쿠키 전부 무효)
export function sessionTokenFor(passwordHash) {
  return sha256("eval-session|" + passwordHash);
}

export async function currentSessionToken() {
  return sessionTokenFor(await getPasswordHash());
}

export async function isAuthenticated() {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return false;
  const master = masterSessionToken();
  if (master && token === master) return true;
  return token === (await currentSessionToken());
}

export async function requireEvaluator() {
  if (!(await isAuthenticated())) {
    const err = new Error("unauthorized");
    err.status = 401;
    throw err;
  }
}

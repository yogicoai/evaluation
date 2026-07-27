import { getDb, COLLECTIONS } from "./mongodb.js";
import { DEFAULT_QUESTIONS, DEFAULT_ANSWER_KEY } from "./examDefaults.js";

// DB에 저장된 시험지 설정(문항+정답)을 조회, 없으면 기본값
export async function getExamConfig() {
  const db = await getDb();
  const doc = await db.collection(COLLECTIONS.config).findOne({ _id: "default" });
  return {
    questions: doc?.questions?.length === 25 ? doc.questions : DEFAULT_QUESTIONS,
    answerKey: doc?.answerKey ? doc.answerKey : DEFAULT_ANSWER_KEY,
    updatedAt: doc?.updatedAt || null,
    isDefault: !doc
  };
}

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "evaluation";

if (!uri) throw new Error("MONGODB_URI 환경변수가 필요합니다. (.env.local 확인)");

let clientPromise = globalThis._evaluationMongoClientPromise;
if (!clientPromise) {
  const client = new MongoClient(uri);
  clientPromise = client.connect();
  globalThis._evaluationMongoClientPromise = clientPromise;
}

export async function getDb() {
  const client = await clientPromise;
  return client.db(dbName);
}

export const COLLECTIONS = {
  submissions: "exam_submissions",
  config: "exam_config",
  employees: "evaluation_employees"
};

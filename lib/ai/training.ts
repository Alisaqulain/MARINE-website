import { randomUUID } from "crypto";
import { getDb } from "@/lib/mongodb";

/** Admin-written answers that teach the website chat bot and the WhatsApp agent (edited in Marina AI → Training). */
export type TrainingAgent = "all" | "chat" | "whatsapp";
export type TrainingEntry = { id: string; agent: TrainingAgent; question: string; answer: string; updatedAt: string; updatedBy: string };

const COLLECTION = "ai_training";
const AGENTS: TrainingAgent[] = ["all", "chat", "whatsapp"];

export function trainingAgent(value: unknown): TrainingAgent {
  return AGENTS.includes(value as TrainingAgent) ? (value as TrainingAgent) : "all";
}

export async function listTraining(): Promise<TrainingEntry[]> {
  const db = await getDb();
  const rows = await db.collection(COLLECTION).find({}).sort({ updatedAt: -1 }).limit(300).toArray();
  return rows.map((r) => ({
    id: String(r.id),
    agent: trainingAgent(r.agent),
    question: String(r.question ?? ""),
    answer: String(r.answer ?? ""),
    updatedAt: String(r.updatedAt ?? ""),
    updatedBy: String(r.updatedBy ?? ""),
  }));
}

export async function saveTraining(input: { id?: string; agent: unknown; question: unknown; answer: unknown; actor: string }) {
  const question = String(input.question ?? "").trim().slice(0, 500);
  const answer = String(input.answer ?? "").trim().slice(0, 2000);
  if (!question || !answer) throw new Error("Both the customer question and the answer are needed.");
  const db = await getDb();
  const id = input.id && /^[\w-]{6,64}$/.test(input.id) ? input.id : randomUUID();
  await db.collection(COLLECTION).updateOne(
    { id },
    { $set: { id, agent: trainingAgent(input.agent), question, answer, updatedAt: new Date().toISOString(), updatedBy: input.actor } },
    { upsert: true },
  );
  return id;
}

export async function deleteTraining(id: string) {
  const db = await getDb();
  await db.collection(COLLECTION).deleteOne({ id: String(id) });
}

/** Training lines for one agent, added to the facts Gemini answers from. */
export async function trainingFacts(agent: "chat" | "whatsapp"): Promise<string> {
  const db = await getDb();
  const rows = await db
    .collection(COLLECTION)
    .find({ agent: { $in: ["all", agent] } })
    .sort({ updatedAt: -1 })
    .limit(60)
    .toArray();
  if (!rows.length) return "";
  return rows.map((r) => `Q: ${String(r.question)}\nA: ${String(r.answer)}`).join("\n\n");
}

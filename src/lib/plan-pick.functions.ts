import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import type { Pick } from "./ai-pick.functions";

type Item = { s: string; g: number; l: string; n: number; t: string; u: string; ty: string; k: string[]; c: string[]; y: number | null };
export type PlanResult = { subject: string; grade: number | null; goals: string[]; summary: string; picks: (Pick & { goal: string })[]; error?: string };

const MODEL = "google/gemini-3.1-pro-preview";
const empty = (error: string): PlanResult => ({ subject: "", grade: null, goals: [], summary: "", picks: [], error });

async function ask(key: string, content: unknown) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Podbor COR" },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content }], response_format: { type: "json_object" } }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("OpenRouter", res.status, t);
    throw new Error(`Модель недоступна (${res.status}): ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  const raw: string = j.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim());
  } catch {
    throw new Error("Модель вернула ответ в неожиданном формате. Попробуйте ещё раз.");
  }
}

export const pickFromPlan = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({
      text: z.string().max(20000).default(""),
      file: z.object({ name: z.string().max(200), mime: z.string().max(100), base64: z.string().max(14_500_000) }).nullable().default(null),
      subject: z.string().max(200).default(""),
      grade: z.number().nullable().default(null),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<PlanResult> => {
    const key = process.env["OPENROUTER_API_KEY"];
    if (!key) return empty("Ключ OpenRouter ещё не добавлен.");
    if (data.text.trim().length < 3 && !data.file) return empty("Опишите цель, вставьте план урока или прикрепите файл.");

    try {
      const req = getRequest();
      const origin = new URL(req.url).origin;
      let r = await fetch(`${origin}/cor.json`, { headers: { cookie: req.headers.get("cookie") ?? "" } });
      if (!r.ok) r = await fetch("https://resource-lesson-edu.lovable.app/cor.json");
      if (!r.ok) return empty(`Не удалось загрузить каталог (${r.status}).`);
      const all: Item[] = await r.json();
      const subjects = [...new Set(all.map((x) => x.s))];

      // 1. Извлечение целей
      const parts: unknown[] = [{
        type: "text",
        text: `Ты методист. Учитель прислал материал${data.file ? " (во вложении)" : ""}: это может быть короткая формулировка учебной цели, план урока или учебный текст. Определи, что это, и извлеки учебные цели (если это уже цель — уточни и разбей её при необходимости).
${data.subject ? `Предмет задан учителем: ${data.subject}.` : `Определи предмет — строго одно название из списка: ${subjects.join("; ")}.`}
${data.grade ? `Класс задан учителем: ${data.grade}.` : "Определи класс (целое число 1–11) по содержанию, сложности и терминам; null только если совсем невозможно."}
Сформулируй 2–5 конкретных учебных целей (что ученики должны знать/уметь), коротко.
Ответ строго JSON: {"subject": string, "grade": number|null, "goals": string[]}
${data.text.trim() ? `\nТекст от учителя:\n${data.text}` : ""}`,
      }];
      if (data.file) {
        const url = `data:${data.file.mime};base64,${data.file.base64}`;
        parts.push(data.file.mime.startsWith("image/")
          ? { type: "image_url", image_url: { url } }
          : { type: "file", file: { filename: data.file.name, file_data: url } });
      }
      const ex = await ask(key, parts);
      const norm = (v: string) => v.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, " ").trim();
      const matchSubject = (v: unknown): string => {
        if (typeof v !== "string" || !v.trim()) return "";
        const n = norm(v);
        return subjects.find((s) => norm(s) === n)
          ?? subjects.find((s) => norm(s).startsWith(n) || n.startsWith(norm(s)))
          ?? subjects.find((s) => norm(s).includes(n) || n.includes(norm(s)))
          ?? "";
      };
      const toGrade = (v: unknown): number | null => {
        const m = String(v ?? "").match(/\d+/);
        const g = m ? Number(m[0]) : NaN;
        return g >= 1 && g <= 11 ? g : null;
      };
      const subject = matchSubject(data.subject) || data.subject || matchSubject(ex.subject);
      const grade: number | null = data.grade ?? toGrade(ex.grade);
      const goals: string[] = (Array.isArray(ex.goals) ? ex.goals : []).filter((g: unknown) => typeof g === "string").slice(0, 5);
      if (!subject) return { ...empty("Не удалось определить предмет — выберите его вручную."), goals };
      if (!goals.length) return empty("Не удалось извлечь учебные цели из плана.");

      // 2. Подбор материалов
      let pool = all.filter((x) => x.s === subject && (grade == null || x.g === grade));
      if (!pool.length) pool = all.filter((x) => x.s === subject);
      const words = goals.join(" ").toLowerCase().split(/[^a-zа-яё0-9]+/i).filter((w) => w.length > 3).map((w) => w.slice(0, Math.max(4, w.length - 2)));
      const scored = pool
        .map((x) => { const hay = [x.t, ...x.k, ...x.c].join(" ").toLowerCase(); return { x, s: words.reduce((a, w) => a + (hay.includes(w) ? 1 : 0), 0) }; })
        .sort((a, b) => b.s - a.s);
      const cand = (scored[0]?.s ? scored.slice(0, 80) : scored.slice(0, 120)).map((c) => c.x);
      const list = cand.map((x, i) => `${i}. [${x.g} кл., урок ${x.n}, ${x.l}] ${x.t} | ${x.ty} | ключевые: ${x.k.join(", ")}`).join("\n");

      const pr = await ask(key, `Ты методист. Предмет: ${subject}${grade ? `, ${grade} класс` : ""}. Учебные цели урока:
${goals.map((g, i) => `${i + 1}. ${g}`).join("\n")}

Из списка уроков ЦОР выбери от 3 до 8 наиболее подходящих. Для каждого укажи номер цели (goal, начиная с 1), которой он служит, и в 1–2 предложениях объясни, чем поможет. Дай общее резюме (2–3 предложения) — как встроить материалы в урок.
Ответ строго JSON: {"summary": string, "picks": [{"i": number, "goal": number, "why": string}]}

Уроки:
${list}`);
      const picks = ((pr.picks ?? []) as { i: number; goal: number; why: string }[])
        .filter((p) => cand[p.i])
        .map((p) => { const x = cand[p.i]!; return { title: x.t, url: x.u, grade: x.g, lesson: x.n, level: x.l, why: p.why, goal: goals[p.goal - 1] ?? "" }; });
      return { subject, grade, goals, summary: pr.summary ?? "", picks };
    } catch (e) {
      return empty(e instanceof Error ? e.message : "Ошибка запроса");
    }
  });

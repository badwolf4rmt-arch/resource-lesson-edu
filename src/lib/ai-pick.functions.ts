import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

type Item = { s: string; g: number; l: string; n: number; t: string; u: string; ty: string; k: string[]; c: string[]; y: number | null };
export type Pick = { title: string; url: string; grade: number; lesson: number; level: string; why: string };

const MODEL = "google/gemini-3.1-pro-preview";

export const pickMaterials = createServerFn({ method: "POST" })
  .validator((d) => z.object({ subject: z.string().min(1), grade: z.number(), goal: z.string().min(3).max(2000) }).parse(d))
  .handler(async ({ data }): Promise<{ picks: Pick[]; summary: string; error?: string }> => {
    const key = process.env["OPENROUTER_API_KEY"];
    if (!key) return { picks: [], summary: "", error: "Ключ OpenRouter ещё не добавлен." };

    const origin = new URL(getRequest().url).origin;
    const all: Item[] = await (await fetch(`${origin}/cor.json`)).json();
    const pool = all.filter((x) => x.s === data.subject && x.g === data.grade);
    if (!pool.length) return { picks: [], summary: "", error: "В каталоге нет уроков для этого предмета и класса." };

    const words = data.goal.toLowerCase().split(/[^a-zа-яё0-9]+/i).filter((w) => w.length > 3).map((w) => w.slice(0, Math.max(4, w.length - 2)));
    const scored = pool
      .map((x) => {
        const hay = [x.t, ...x.k, ...x.c].join(" ").toLowerCase();
        return { x, s: words.reduce((a, w) => a + (hay.includes(w) ? 1 : 0), 0) };
      })
      .sort((a, b) => b.s - a.s);
    const candidates = (scored[0]?.s ? scored.slice(0, 60) : scored.slice(0, 120)).map((c) => c.x);

    const list = candidates.map((x, i) => `${i}. [урок ${x.n}, ${x.l}] ${x.t} | ${x.ty} | ключевые: ${x.k.join(", ")}`).join("\n");
    const prompt = `Ты методист. Учитель (${data.subject}, ${data.grade} класс) описал учебную цель:\n"${data.goal}"\n\nИз списка уроков ЦОР выбери от 3 до 8 наиболее подходящих и для каждого в 1–2 предложениях объясни, чем он поможет достичь цели. Также дай краткое общее резюме (2–3 предложения) — как выстроить работу.\nОтвечай строго JSON: {"summary": string, "picks": [{"i": number, "why": string}]}\n\nУроки:\n${list}`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Podbor COR" },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("OpenRouter", res.status, t);
      return { picks: [], summary: "", error: `Модель недоступна (${res.status}): ${t.slice(0, 200)}` };
    }
    const j = await res.json();
    const raw: string = j.choices?.[0]?.message?.content ?? "";
    let parsed: { summary?: string; picks?: { i: number; why: string }[] } = {};
    try {
      parsed = JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim());
    } catch {
      return { picks: [], summary: "", error: "Модель вернула ответ в неожиданном формате. Попробуйте ещё раз." };
    }
    const picks = (parsed.picks ?? [])
      .filter((p) => candidates[p.i])
      .map((p) => { const x = candidates[p.i]!; return { title: x.t, url: x.u, grade: x.g, lesson: x.n, level: x.l, why: p.why }; });
    return { picks, summary: parsed.summary ?? "" };
  });

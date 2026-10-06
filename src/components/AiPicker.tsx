import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { pickMaterials, type Pick } from "@/lib/ai-pick.functions";

export function AiPicker({ subjects, gradesFor }: { subjects: string[]; gradesFor: (s: string) => number[] }) {
  const run = useServerFn(pickMaterials);
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<{ picks: Pick[]; summary: string; error?: string } | null>(null);
  const grades = subject ? gradesFor(subject) : [];
  const ready = subject && grade && goal.trim().length >= 3 && !loading;

  const submit = async () => {
    setLoading(true);
    setRes(null);
    try {
      setRes(await run({ data: { subject, grade: Number(grade), goal } }));
    } catch (e) {
      setRes({ picks: [], summary: "", error: e instanceof Error ? e.message : "Ошибка запроса" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold text-foreground">Опишите учебную цель</h2>
        <p className="mt-1 text-sm text-muted-foreground">ИИ подберёт подходящие уроки ЦОР из каталога и объяснит, чем каждый поможет.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Предмет</span>
            <select className="field" value={subject} onChange={(e) => { setSubject(e.target.value); setGrade(""); }}>
              <option value="">Выберите предмет</option>
              {subjects.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Класс</span>
            <select className="field" value={grade} onChange={(e) => setGrade(e.target.value)} disabled={!subject}>
              <option value="">Выберите класс</option>
              {grades.map((g) => <option key={g} value={g}>{g} класс</option>)}
            </select>
          </label>
        </div>
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Учебная цель</span>
          <textarea className="field min-h-28" value={goal} onChange={(e) => setGoal(e.target.value)}
            placeholder="Например: научить решать задачи на проценты и применять их в жизненных ситуациях" />
        </label>
        <button onClick={submit} disabled={!ready}
          className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40">
          {loading ? "Подбираю материалы…" : "Подобрать материалы"}
        </button>
      </div>

      {loading && <div className="animate-pulse rounded-3xl bg-hero p-6 text-sm text-muted-foreground">Модель анализирует каталог, это может занять до минуты…</div>}
      {res?.error && <div role="alert" className="rounded-2xl border border-destructive/30 bg-card p-4 text-sm text-destructive">{res.error}</div>}
      {res && !res.error && (
        <div className="space-y-3">
          {res.summary && <div className="rounded-3xl bg-hero p-6 text-foreground">{res.summary}</div>}
          {res.picks.map((p) => (
            <div key={p.url} className="rounded-2xl border border-border bg-card p-5">
              <div className="text-xs text-muted-foreground">{p.grade} класс · урок {p.lesson} · {p.level}</div>
              <h3 className="mt-1 font-semibold text-foreground">{p.title}</h3>
              <p className="mt-2 text-sm text-foreground/80">{p.why}</p>
              <a href={p.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">Открыть ресурс ЦОР →</a>
            </div>
          ))}
          {res.picks.length === 0 && <p className="text-muted-foreground">Подходящих материалов не найдено — уточните цель.</p>}
        </div>
      )}
    </div>
  );
}

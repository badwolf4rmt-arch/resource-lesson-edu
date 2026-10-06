import { createFileRoute } from "@tanstack/react-router";
import { AiPicker } from "@/components/AiPicker";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Подбор ЦОР — каталог цифровых уроков" },
      { name: "description", content: "Фильтр по предмету, классу и теме и список рекомендованных цифровых образовательных ресурсов." },
      { property: "og:title", content: "Подбор ЦОР — каталог цифровых уроков" },
      { property: "og:description", content: "Найдите рекомендованные цифровые уроки по предмету, классу и теме." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Item = { s: string; g: number; l: string; n: number; t: string; u: string; ty: string; k: string[]; c: string[]; y: number | null };
const PAGE = 40;

function Index() {
  const [data, setData] = useState<Item[] | null>(null);
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [level, setLevel] = useState("");
  const [type, setType] = useState("");
  const [year, setYear] = useState("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [tab, setTab] = useState<"catalog" | "ai">("catalog");

  useEffect(() => {
    fetch("/cor.json").then((r) => r.json()).then(setData);
  }, []);
  useEffect(() => setLimit(PAGE), [subject, grade, level, type, year, q]);

  const uniq = (f: (x: Item) => unknown, base = data ?? []) =>
    [...new Set(base.map(f).filter((v) => v !== null && v !== undefined && v !== ""))].sort((a, b) =>
      typeof a === "number" ? (a as number) - (b as number) : String(a).localeCompare(String(b), "ru"),
    ) as (string | number)[];

  const bySubject = useMemo(() => (data ?? []).filter((x) => !subject || x.s === subject), [data, subject]);
  const subjects = useMemo(() => uniq((x) => x.s), [data]);
  const grades = useMemo(() => uniq((x) => x.g, bySubject), [bySubject]);
  const types = useMemo(() => uniq((x) => x.ty, bySubject), [bySubject]);
  const years = useMemo(() => uniq((x) => x.y), [data]);

  const result = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return bySubject
      .filter((x) =>
        (!grade || String(x.g) === grade) &&
        (!level || x.l === level) &&
        (!type || x.ty === type) &&
        (!year || (year === "none" ? !x.y : String(x.y) === year)) &&
        (!words.length || words.every((w) => [x.t, ...x.k, ...x.c].join(" ").toLowerCase().includes(w))),
      )
      .sort((a, b) => a.g - b.g || a.n - b.n);
  }, [bySubject, grade, level, type, year, q]);

  const reset = () => { setSubject(""); setGrade(""); setLevel(""); setType(""); setYear(""); setQ(""); };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-hero">
        <div className="mx-auto max-w-6xl px-6 pb-8 pt-10 text-center">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span className="h-3 w-3 rounded-full bg-brand-gradient" /> Каталог ЦОР
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground md:text-4xl">Чем вам помочь?</h1>
          <p className="mt-2 text-muted-foreground">
            {data ? `${data.length.toLocaleString("ru")} уроков · ${subjects.length} предметов` : "Загрузка материалов…"}
          </p>
          <div className="mt-6 inline-flex rounded-2xl bg-secondary p-1">
            {(["catalog", "ai"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded-xl px-5 py-2 text-sm font-medium transition ${tab === t ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-card"}`}>
                {t === "catalog" ? "Каталог материалов" : "ИИ-подбор по цели"}
              </button>
            ))}
          </div>
        </div>
      </header>
      {tab === "ai" && (
        <main className="mx-auto max-w-3xl px-6 py-8">
          <AiPicker subjects={subjects as string[]} gradesFor={(s) => [...new Set((data ?? []).filter((x) => x.s === s).map((x) => x.g))].sort((a, b) => a - b)} />
        </main>
      )}
      {tab === "catalog" && (

      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-8 md:grid-cols-[280px_1fr]">
        <aside className="space-y-4 md:sticky md:top-6 md:self-start">
          <Field label="Поиск по теме, ключевым словам">
            <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="например, проценты" />
          </Field>
          <Field label="Предмет">
            <select className="field" value={subject} onChange={(e) => { setSubject(e.target.value); setGrade(""); setType(""); }}>
              <option value="">Все предметы</option>
              {subjects.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Класс">
            <select className="field" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">Все классы</option>
              {grades.map((g) => <option key={g} value={g}>{g} класс</option>)}
            </select>
          </Field>
          <Field label="Уровень">
            <select className="field" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Любой</option>
              <option>Базовый</option>
              <option>Углублённый</option>
            </select>
          </Field>
          <Field label="Тип урока">
            <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Любой</option>
              {types.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Плашка ЭОР">
            <select className="field" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">Любая</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
              <option value="none">Без плашки</option>
            </select>
          </Field>
          <button onClick={reset} className="w-full rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            Сбросить фильтры
          </button>
        </aside>

        <section>
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">
            Рекомендовано: <span className="text-foreground">{result.length.toLocaleString("ru")}</span>
          </h2>
          <ul className="space-y-3">
            {result.slice(0, limit).map((x) => (
              <li key={x.u + x.s + x.g} className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">{x.s}</span>
                  <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">{x.g} класс · урок {x.n}</span>
                  <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">{x.l}</span>
                  {x.ty && <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">{x.ty}</span>}
                  {x.y && <span className="rounded bg-accent px-2 py-0.5 text-accent-foreground">ЭОР {x.y}</span>}
                </div>
                <h3 className="mt-2 font-semibold text-foreground">{x.t}</h3>
                {x.k.length > 0 && <p className="mt-1 text-sm text-muted-foreground">{x.k.join(", ")}</p>}
                <a href={x.u} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                  Открыть ресурс ЦОР →
                </a>
              </li>
            ))}
          </ul>
          {data && result.length === 0 && <p className="text-muted-foreground">Ничего не найдено — измените фильтры.</p>}
          {limit < result.length && (
            <button onClick={() => setLimit(limit + PAGE)} className="mt-6 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">
              Показать ещё
            </button>
          )}
        </section>
      </main>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

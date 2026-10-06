import { createFileRoute } from "@tanstack/react-router";
import { PlanPicker } from "@/components/PlanPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { LessonCard } from "@/components/LessonCard";
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
      <header className="bg-hero border-b border-border/40">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-8 py-5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full bg-brand-gradient" />
            <span className="truncate font-display text-lg font-bold text-foreground">Каталог ЦОР</span>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              ·{" "}
              {data
                ? `${data.length.toLocaleString("ru")} ${plural(data.length, "урок", "урока", "уроков")} · ${subjects.length} ${plural(subjects.length, "предмет", "предмета", "предметов")}`
                : "Загрузка…"}
            </span>
          </div>
          <div className="ml-auto inline-flex rounded-2xl bg-secondary p-1">
            {(["catalog", "ai"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded-xl px-5 py-2 text-sm font-medium transition ${tab === t ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-card"}`}>
                {t === "catalog" ? "Каталог материалов" : "ИИ-подбор материалов"}
              </button>
            ))}
          </div>
        </div>
      </header>
      {tab === "ai" && <PlanPicker subjects={subjects as string[]} />}
      {tab === "catalog" && (

      <main className="mx-auto grid max-w-7xl gap-10 px-8 py-10 md:grid-cols-[300px_1fr]">
        <aside className="space-y-6 rounded-2xl border border-border bg-card/60 p-5 md:sticky md:top-6 md:self-start">
          <Field label="Поиск по теме, ключевым словам">
            <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Например, проценты" />
          </Field>
          <Field label="Предмет">
            <Combobox
              value={subject}
              onValueChange={(v) => { setSubject(v); setGrade(""); setType(""); }}
              options={subjects.map(String)}
              emptyLabel="Все предметы"
              placeholder="Найти предмет"
              freeInput={false}
              className="border-border bg-card shadow-none"
            />
          </Field>
          <Field label="Класс">
            <Combobox
              value={grade}
              onValueChange={setGrade}
              options={grades.map(String)}
              emptyLabel="Все классы"
              placeholder="Найти класс"
              freeInput={false}
              format={(v) => `${v} класс`}
              className="border-border bg-card shadow-none"
            />
          </Field>
          <Field label="Уровень">
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="border-border bg-card shadow-none"><SelectValue placeholder="Любой" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Базовый">Базовый</SelectItem>
                <SelectItem value="Углублённый">Углублённый</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Тип урока">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="border-border bg-card shadow-none"><SelectValue placeholder="Любой" /></SelectTrigger>
              <SelectContent className="max-h-72">{types.map((t) => <SelectItem key={t} value={String(t)}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Плашка ЭОР">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="border-border bg-card shadow-none"><SelectValue placeholder="Любая" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                <SelectItem value="none">Без плашки</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <button onClick={reset} className="w-full rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            Сбросить фильтры
          </button>
        </aside>

        <section>
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">
            Рекомендовано: <span className="text-foreground">{result.length.toLocaleString("ru")}</span>
          </h2>
          <ul className="space-y-4">
            {result.slice(0, limit).map((x) => (
              <LessonCard key={x.u + x.s + x.g} subject={x.s} grade={x.g} lesson={x.n} level={x.l} type={x.ty} year={x.y}
                title={x.t} text={x.k.join(", ")} url={x.u} />
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
      <span className="mb-2 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const a = n % 100, b = n % 10;
  if (a >= 11 && a <= 14) return many;
  return b === 1 ? one : b >= 2 && b <= 4 ? few : many;
}

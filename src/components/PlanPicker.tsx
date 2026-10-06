import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { pickFromPlan, type PlanResult } from "@/lib/plan-pick.functions";
import { Combobox } from "@/components/ui/combobox";

const MAX = 20000;
const AUTO = "__auto";

async function toBase64(f: File) {
  const buf = new Uint8Array(await f.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export function PlanPicker({ subjects }: { subjects: string[] }) {
  const run = useServerFn(pickFromPlan);
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [subject, setSubject] = useState(AUTO);
  const [grade, setGrade] = useState(AUTO);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<PlanResult | null>(null);
  const grades = Array.from({ length: 11 }, (_, i) => String(i + 1));

  const accept = (f?: File) => {
    setErr("");
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return setErr("Файл больше 10 МБ.");
    if (!/\.(docx|pdf|txt|jpe?g|png)$/i.test(f.name)) return setErr("Формат — DOCX, PDF, TXT, JPG, PNG.");
    setFile(f);
  };

  const submit = async () => {
    setLoading(true); setRes(null); setErr("");
    try {
      let t = text;
      let payload: { name: string; mime: string; base64: string } | null = null;
      if (file) {
        const ext = file.name.split(".").pop()!.toLowerCase();
        if (ext === "txt") t = `${t}\n\n${await file.text()}`.trim();
        else if (ext === "docx") {
          const mammoth = await import("mammoth");
          const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
          t = `${t}\n\n${r.value}`.trim();
        } else payload = { name: file.name, mime: ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg", base64: await toBase64(file) };
      }
      setRes(await run({ data: { text: t.slice(0, MAX), file: payload, subject: subject === AUTO ? "" : subject, grade: grade === AUTO ? null : Number(grade) } }));
    } catch (e) {
      const m = e instanceof Error ? e.message : "Ошибка запроса";
      setErr(/unauthori[sz]ed|not valid JSON/i.test(m)
        ? "Сессия окна предпросмотра истекла. Обновите страницу (F5) и попробуйте снова — или откройте опубликованный сайт."
        : m);
    } finally {
      setLoading(false);
    }
  };

  const ready = !loading && (text.trim().length >= 3 || file);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 md:grid-cols-[280px_1fr]">
      <aside className="space-y-4 md:sticky md:top-6 md:self-start">
        <div>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Предмет</span>
          <Combobox
            value={subject}
            onValueChange={(v) => { setSubject(v); setGrade(AUTO); }}
            options={subjects}
            autoLabel="Определить автоматически"
            placeholder="Найти или ввести предмет"
            className="border-border bg-card shadow-none"
          />
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Класс</span>
          <Combobox
            value={grade}
            onValueChange={setGrade}
            options={grades}
            autoLabel="Определить автоматически"
            placeholder="Найти или ввести класс"
            format={(v) => `${v} класс`}
            className="border-border bg-card shadow-none"
          />
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Цель, план урока или текст</span>
          <div className="relative">
            <textarea className="field min-h-40 pb-8" maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Например: научить решать задачи на проценты — или вставьте план урока, текст из учебника, статьи, презентации" />
            <span className="pointer-events-none absolute bottom-3 right-4 text-xs text-muted-foreground">{text.length}/{MAX}</span>
          </div>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files[0]); }}
          className={`rounded-2xl border-2 border-dashed p-4 text-center transition ${drag ? "border-primary bg-secondary" : "border-muted-foreground/40 bg-muted/50"}`}>
          {file ? (
            <>
              <p className="break-all text-sm font-semibold text-foreground">{file.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} МБ</p>
              <button onClick={() => { setFile(null); if (input.current) input.current.value = ""; }}
                className="mt-3 rounded-md bg-secondary px-4 py-1.5 text-xs font-medium text-foreground hover:opacity-90">Убрать файл</button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">Перетащите файл или выберите на компьютере</p>
              <p className="mt-1 text-xs text-muted-foreground">до 10 МБ · DOCX, PDF, TXT, JPG, PNG</p>
              <button onClick={() => input.current?.click()}
                className="mt-3 rounded-md bg-secondary px-5 py-2 text-xs font-medium text-foreground hover:opacity-90">Выбрать файл</button>
            </>
          )}
          <input ref={input} type="file" hidden accept=".docx,.pdf,.txt,.jpg,.jpeg,.png" onChange={(e) => accept(e.target.files?.[0])} />
        </div>
        <button onClick={submit} disabled={!ready}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40">
          {loading ? "Подбираю материалы…" : "Подобрать материалы"}
        </button>
      </aside>

      <section className="space-y-3">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">
          Рекомендовано: <span className="text-foreground">{res && !res.error ? res.picks.length : 0}</span>
        </h2>
        {loading && <div className="animate-pulse rounded-2xl bg-hero p-6 text-sm text-muted-foreground">Модель читает план и подбирает материалы, это может занять 1–2 минуты…</div>}
        {(err || res?.error) && <div role="alert" className="rounded-2xl border border-destructive/30 bg-card p-4 text-sm text-destructive">{err || res?.error}</div>}
        {res && !res.error && !loading && (
          <>
            <div className="rounded-2xl border border-success/40 bg-success p-5 text-success-foreground">
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">Определено из файла</p>
              <p className="mt-1 font-semibold">{res.subject}{res.grade ? ` · ${res.grade} класс` : ""}</p>
              {res.goals.length > 0 && (
                <>
                  <h3 className="mt-3 text-sm font-semibold">Учебные цели урока</h3>
                  <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">{res.goals.map((g) => <li key={g}>{g}</li>)}</ol>
                </>
              )}
              {res.summary && <p className="mt-3 text-sm">{res.summary}</p>}
            </div>
            {res.picks.map((p) => (
              <div key={p.url} className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">{res.subject}</span>
                  <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">{p.grade} класс · урок {p.lesson}</span>
                  {p.level && <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">{p.level}</span>}
                </div>
                <h3 className="mt-2 font-semibold text-foreground">{p.title}</h3>
                {p.goal && <p className="mt-1 text-sm text-brand">Цель: {p.goal}</p>}
                <p className="mt-2 text-sm text-muted-foreground">{p.why}</p>
                <a href={p.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                  Открыть ресурс ЦОР →
                </a>
              </div>
            ))}
            {res.picks.length === 0 && <p className="text-muted-foreground">Подходящих материалов не найдено.</p>}
          </>
        )}
        {!res && !loading && !err && <p className="text-muted-foreground">Заполните форму слева — здесь появятся определённые цели и подобранные материалы.</p>}
      </section>
    </div>
  );
}

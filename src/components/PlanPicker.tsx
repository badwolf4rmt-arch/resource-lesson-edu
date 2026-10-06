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
      setRes(await run({ data: { text: t.slice(0, MAX), file: payload, subject: subject === AUTO ? "" : subject, grade: grade === AUTO ? null : (Number(grade.match(/\d+/)?.[0]) || null) } }));
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
    <div className="mx-auto grid max-w-7xl gap-10 px-8 py-10 md:grid-cols-[300px_1fr]">
      <aside className="space-y-5 md:sticky md:top-6 md:self-start">
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

      <section className="space-y-4">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">
          Рекомендовано: <span className="text-foreground">{res && !res.error ? res.picks.length : 0}</span>
        </h2>
        {loading && <div className="animate-pulse rounded-2xl bg-hero p-6 text-sm text-muted-foreground">Модель читает план и подбирает материалы, это может занять 1–2 минуты…</div>}
        {(err || res?.error) && <div role="alert" className="rounded-2xl border border-destructive/30 bg-card p-4 text-sm text-destructive">{err || res?.error}</div>}
        {res && !res.error && !loading && (
          <>
            <div className="rounded-2xl border border-border/40 bg-hero px-6 py-5 text-foreground">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Определено из файла</p>
              <p className="mt-1 text-base font-semibold">{res.subject}{res.grade ? ` · ${res.grade} класс` : ""}</p>
              {res.goals.length > 0 && (
                <>
                  <h3 className="mt-4 text-sm font-semibold">Учебные цели урока</h3>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">{res.goals.map((g) => <li key={g}>{g}</li>)}</ol>
                </>
              )}
              {res.summary && <p className="mt-4 text-sm leading-relaxed">{res.summary}</p>}
            </div>
            <ul className="space-y-4">
              {res.picks.map((p) => (
                <LessonCard key={p.url} subject={res.subject} grade={p.grade} lesson={p.lesson} level={p.level}
                  title={p.title} goal={p.goal} text={p.why} url={p.url} />
              ))}
            </ul>
            {res.picks.length === 0 && <p className="text-muted-foreground">Подходящих материалов не найдено.</p>}
          </>
        )}
        {!res && !loading && !err && <p className="text-muted-foreground">Заполните форму слева — здесь появятся определённые цели и подобранные материалы.</p>}
      </section>
    </div>
  );
}

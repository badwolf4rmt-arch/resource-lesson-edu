import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pickFromPlan, type PlanResult } from "@/lib/plan-pick.functions";

const MAX = 20000;
const AUTO = "__auto";

async function toBase64(f: File) {
  const buf = new Uint8Array(await f.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export function PlanPicker({ subjects, gradesFor }: { subjects: string[]; gradesFor: (s: string) => number[] }) {
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
  const grades = subject !== AUTO ? gradesFor(subject) : [...new Set(subjects.flatMap(gradesFor))].sort((a, b) => a - b);

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
      setErr(e instanceof Error ? e.message : "Ошибка запроса");
    } finally {
      setLoading(false);
    }
  };

  const ready = !loading && (text.trim().length >= 3 || file);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold text-foreground">Чем вам помочь?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Опишите учебную цель, вставьте план урока или прикрепите файл — ИИ сам определит цели и подберёт материалы ЦОР.</p>

        <div className="relative mt-5">
          <textarea className="field min-h-40 pb-8" maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Например: научить решать задачи на проценты — или вставьте план урока, текст из учебника, статьи, презентации" />
          <span className="pointer-events-none absolute bottom-3 right-4 text-xs text-muted-foreground">{text.length}/{MAX}</span>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files[0]); }}
          className={`mt-4 rounded-3xl border-2 border-dashed p-8 text-center transition ${drag ? "border-primary bg-secondary" : "border-muted-foreground/40 bg-muted/50"}`}>
          {file ? (
            <>
              <p className="font-semibold text-foreground">{file.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} МБ</p>
              <button onClick={() => { setFile(null); if (input.current) input.current.value = ""; }}
                className="mt-4 rounded-2xl bg-secondary px-6 py-2.5 text-sm font-medium text-foreground hover:opacity-90">Убрать файл</button>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-foreground">Перетащите сюда файл или выберите на компьютере</p>
              <p className="mt-2 text-sm text-muted-foreground">файл не должен весить больше 10 МБ.<br />Формат — DOCX, PDF, TXT, JPG, PNG</p>
              <button onClick={() => input.current?.click()}
                className="mt-5 rounded-2xl bg-secondary px-8 py-3 text-sm font-medium text-foreground hover:opacity-90">Выбрать файл</button>
            </>
          )}
          <input ref={input} type="file" hidden accept=".docx,.pdf,.txt,.jpg,.jpeg,.png" onChange={(e) => accept(e.target.files?.[0])} />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Предмет</span>
            <Select value={subject} onValueChange={(v) => { setSubject(v); setGrade(AUTO); }}>
              <SelectTrigger className="border-border bg-card shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={AUTO}>Определить автоматически</SelectItem>
                {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Класс</span>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger className="border-border bg-card shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={AUTO}>Определить автоматически</SelectItem>
                {grades.map((g) => <SelectItem key={g} value={String(g)}>{g} класс</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
        </div>

        <button onClick={submit} disabled={!ready}
          className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40">
          {loading ? "Подбираю материалы…" : "Подобрать материалы"}
        </button>
      </div>

      {loading && <div className="animate-pulse rounded-3xl bg-hero p-6 text-sm text-muted-foreground">Модель читает план и подбирает материалы, это может занять 1–2 минуты…</div>}
      {(err || res?.error) && <div role="alert" className="rounded-2xl border border-destructive/30 bg-card p-4 text-sm text-destructive">{err || res?.error}</div>}
      {res && !res.error && (
        <div className="space-y-3">
          <div className="rounded-3xl bg-hero p-6 text-foreground">
            <div className="text-xs text-muted-foreground">{res.subject}{res.grade ? ` · ${res.grade} класс` : ""}</div>
            <h3 className="mt-1 font-semibold">Учебные цели урока</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{res.goals.map((g) => <li key={g}>{g}</li>)}</ol>
            {res.summary && <p className="mt-4 text-sm">{res.summary}</p>}
          </div>
          {res.picks.map((p) => (
            <div key={p.url} className="rounded-2xl border border-border bg-card p-5">
              <div className="text-xs text-muted-foreground">{p.grade} класс · урок {p.lesson} · {p.level}</div>
              <h3 className="mt-1 font-semibold text-foreground">{p.title}</h3>
              {p.goal && <p className="mt-1 text-xs font-medium text-brand">Цель: {p.goal}</p>}
              <p className="mt-2 text-sm text-foreground/80">{p.why}</p>
              <a href={p.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">Открыть ресурс ЦОР →</a>
            </div>
          ))}
          {res.picks.length === 0 && <p className="text-muted-foreground">Подходящих материалов не найдено.</p>}
        </div>
      )}
    </div>
  );
}

type Props = {
  subject: string;
  grade: number | string;
  lesson: number | string;
  level?: string;
  type?: string;
  year?: number | null;
  title: string;
  goal?: string;
  text?: string;
  url: string;
};

const chip = "inline-flex h-6 items-center rounded-md px-2.5 text-xs leading-none";

export function LessonCard({ subject, grade, lesson, level, type, year, title, goal, text, url }: Props) {
  return (
    <li className="list-none rounded-2xl border border-border bg-card px-6 py-5 transition hover:border-primary">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${chip} bg-primary/10 font-medium text-primary`}>{subject}</span>
        <span className={`${chip} bg-muted text-muted-foreground`}>{grade} класс · урок {lesson}</span>
        {level && <span className={`${chip} bg-muted text-muted-foreground`}>{level}</span>}
        {type && <span className={`${chip} bg-muted text-muted-foreground`}>{type}</span>}
        {year && <span className={`${chip} bg-accent text-accent-foreground`}>ЭОР {year}</span>}
      </div>
      <h3 className="mt-3 text-base font-semibold leading-snug text-foreground">{title}</h3>
      {goal && <p className="mt-2 text-sm leading-relaxed text-brand">Цель: {goal}</p>}
      {text && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>}
      <a href={url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
        Открыть ресурс ЦОР →
      </a>
    </li>
  );
}

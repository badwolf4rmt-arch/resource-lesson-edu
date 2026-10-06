export function cap(s?: string | null): string {
  if (!s) return "";
  return s.charAt(0).toLocaleUpperCase("ru") + s.slice(1);
}

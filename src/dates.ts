// Dates are kept as local "YYYY-MM-DD" keys so a day never shifts with time zones.
const pad = (n: number) => String(n).padStart(2, "0");
export const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const add = (k: string, n: number) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };
export const diff = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);
export const today = () => key(new Date());
export const minK = (a: string, b: string) => (a < b ? a : b);

export const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MESL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const DIA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const fmt = (k: string) => { const d = parse(k); return `${d.getDate()} ${MES[d.getMonth()]}`; };
export const fmtLong = (k: string) => { const d = parse(k); return `${DIA[d.getDay()]} ${d.getDate()} ${MES[d.getMonth()]}`; };
export const median = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

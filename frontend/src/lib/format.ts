export const pad2 = (n: number) => String(n).padStart(2, "0");

export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = 60_000, hr = 3_600_000, day = 86_400_000;
  if (diff < hr) return `${Math.max(1, Math.floor(diff / min))} m ago`;
  if (diff < day) return `${Math.floor(diff / hr)} h ago`;
  return `${Math.floor(diff / day)} d ago`;
}

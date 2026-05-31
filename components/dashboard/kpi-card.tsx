import { ReactNode } from 'react';

export function KpiCard({ title, value, hint }: { title: string; value: string; hint?: ReactNode }) {
  return (
    <section className="surface" style={{ padding: 16 }}>
      <div className="text-muted" style={{ fontSize: 13 }}>{title}</div>
      <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>{value}</div>
      {hint ? <div className="text-muted" style={{ marginTop: 8, fontSize: 12 }}>{hint}</div> : null}
    </section>
  );
}
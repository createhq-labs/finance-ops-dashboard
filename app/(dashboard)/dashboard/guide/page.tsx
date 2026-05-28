export default function GuidePage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 780 }}>
      <header>
        <h1 style={{ margin: 0 }}>Guide</h1>
        <p className="text-muted" style={{ marginTop: 8 }}>
          This page explains quick workflow meanings today, and it can grow over time into a fuller operating guide for the dashboard.
        </p>
      </header>

      <section className="surface" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ fontWeight: 600 }}>Submission Version Colors</div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="submission-pi submission-pi-superseded">PI</span>
            <span className="text-muted">Superseded: old version</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="submission-pi submission-pi-resubmitted">PI</span>
            <span className="text-muted">Resubmitted: latest retry</span>
          </div>
        </div>
      </section>
    </div>
  );
}

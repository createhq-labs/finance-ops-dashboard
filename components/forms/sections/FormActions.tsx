type Props = {
  onReset: () => void;
  submitting: boolean;
  submitEnabled: boolean;
};

export function FormActions({ onReset, submitting, submitEnabled }: Props) {
  return (
    <section className="intake-section">
      <div className="intake-section-body">
        <div className="intake-actions">
          <div>
            <strong style={{ fontSize: 14 }}>Review before submitting</strong>
            <p className="text-muted intake-actions-copy">Review before submitting.</p>
          </div>
          <div className="intake-actions-buttons" style={{ minHeight: 44, alignItems: "center" }}>
            <button className="btn" type="button" onClick={onReset}>
              Reset Form
            </button>
            <button className="btn btn-primary" type="submit" disabled={submitting || !submitEnabled}>
              {submitting ? "Submitting..." : "Submit Record"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

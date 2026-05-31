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
            <strong>Review before submitting</strong>
            <p className="text-muted intake-actions-copy">Reset keeps your submitter identity but clears the working form back to its default state.</p>
          </div>
          <div className="intake-actions-buttons">
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

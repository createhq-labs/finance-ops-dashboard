type Props = {
  onReset: () => void;
  submitting: boolean;
};

export function FormActions({ onReset, submitting }: Props) {
  return (
    <section className="surface p-4">
      <div className="flex flex-wrap gap-2">
        <button className="btn" type="button" onClick={onReset}>
          Clear Form
        </button>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Record"}
        </button>
      </div>
    </section>
  );
}

"use client";

import { useMemo, type ReactNode } from 'react';
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileEdit,
  FileSearch,
  FileText,
  ImageIcon,
  Inbox,
  Landmark,
  Layers3,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '../../../../components/dashboard/page-header';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { WorkspaceLoader } from '../../../../components/layout/workspace-loader';

type QuickCard = {
  title: string;
  value: string;
  note: string;
  tone: 'blue' | 'green' | 'orange' | 'rose';
};

type WorkflowStep = {
  title: string;
  description: string;
  owner: 'Employee' | 'Finance';
  icon: ReactNode;
  tone: 'blue' | 'green' | 'orange' | 'rose';
};

type StatusGuide = {
  label: string;
  description: string;
  tone: 'blue' | 'green' | 'orange' | 'rose' | 'slate';
};

type ActionGuide = {
  title: string;
  action: string;
  tone: 'blue' | 'green' | 'orange' | 'rose';
};

type FaqItem = {
  question: string;
  answer: string;
};

type TaskGuide = {
  title: string;
  tone: 'blue' | 'green' | 'orange' | 'rose';
  steps: string[];
};

function toneClasses(tone: 'blue' | 'green' | 'orange' | 'rose' | 'slate') {
  return {
    blue: {
      surface: 'border-sky-200/70 dark:border-sky-400/20',
      icon: 'bg-sky-500 text-white dark:bg-sky-400 dark:text-slate-950',
      text: 'text-sky-700 dark:text-sky-200',
      chip: 'border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200',
      accent: 'bg-sky-500 dark:bg-sky-400',
    },
    green: {
      surface: 'border-emerald-200/70 dark:border-emerald-400/20',
      icon: 'bg-emerald-500 text-white dark:bg-emerald-400 dark:text-slate-950',
      text: 'text-emerald-700 dark:text-emerald-200',
      chip: 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200',
      accent: 'bg-emerald-500 dark:bg-emerald-400',
    },
    orange: {
      surface: 'border-amber-200/70 dark:border-amber-400/20',
      icon: 'bg-amber-500 text-white dark:bg-amber-400 dark:text-slate-950',
      text: 'text-amber-700 dark:text-amber-200',
      chip: 'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200',
      accent: 'bg-amber-500 dark:bg-amber-400',
    },
    rose: {
      surface: 'border-rose-200/70 dark:border-rose-400/20',
      icon: 'bg-rose-500 text-white dark:bg-rose-400 dark:text-slate-950',
      text: 'text-rose-700 dark:text-rose-200',
      chip: 'border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200',
      accent: 'bg-rose-500 dark:bg-rose-400',
    },
    slate: {
      surface: 'border-slate-200/70 dark:border-slate-400/20',
      icon: 'bg-slate-500 text-white dark:bg-slate-300 dark:text-slate-950',
      text: 'text-slate-700 dark:text-slate-200',
      chip: 'border-slate-200/80 bg-slate-50 text-slate-700 dark:border-slate-400/20 dark:bg-slate-400/10 dark:text-slate-200',
      accent: 'bg-slate-500 dark:bg-slate-300',
    },
  }[tone];
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card p-3.5 shadow-sm">
      <div className="mb-2.5">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SectionNav({ items }: { items: Array<{ id: string; label: string }> }) {
  return (
    <nav className="top-[76px] rounded-xl border border-border/70 bg-card p-2 shadow-sm lg:sticky">
      <div className="mb-1 px-2 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">On This Page</div>
      <div className="grid gap-1">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-none hover:bg-sky-50/70 hover:text-foreground dark:hover:bg-sky-400/10"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function QuickInfoCard({ card }: { card: QuickCard }) {
  const tone = toneClasses(card.tone);
  return (
    <div className={['rounded-xl border bg-card p-3.5', tone.surface].join(' ')}>
      <div className={['mb-2 h-1.5 w-10 rounded-full', tone.accent].join(' ')} />
      <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{card.title}</div>
      <div className={['mt-2 text-2xl font-bold tracking-tight', tone.text].join(' ')}>{card.value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{card.note}</div>
    </div>
  );
}

function WorkflowTimeline({ steps }: { steps: WorkflowStep[] }) {
  return (
    <div className="grid gap-2.5">
      {steps.map((step, index) => {
        const tone = toneClasses(step.tone);
        return (
          <div key={step.title} className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-2.5">
            {index < steps.length - 1 ? (
              <div className="absolute left-[17px] top-8 h-[calc(100%+10px)] w-px bg-border/70" />
            ) : null}
            <div className={['relative z-10 flex h-9 w-9 items-center justify-center rounded-xl shadow-sm', tone.icon].join(' ')}>
              {step.icon}
            </div>
            <div className={['rounded-xl border bg-card p-3', tone.surface].join(' ')}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold text-foreground">{step.title}</div>
                <span className={['inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium', tone.chip].join(' ')}>
                  {step.owner}
                </span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{step.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusGrid({ items }: { items: StatusGuide[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const tone = toneClasses(item.tone);
        return (
          <div key={item.label} className={['rounded-xl border bg-card p-3', tone.surface].join(' ')}>
            <div className={['mb-2 h-1.5 w-8 rounded-full', tone.accent].join(' ')} />
            <div className="flex items-center gap-2">
              <span className={['inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium', tone.chip].join(' ')}>
                {item.label}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
          </div>
        );
      })}
    </div>
  );
}

function ActionCardGrid({ items }: { items: ActionGuide[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => {
        const tone = toneClasses(item.tone);
        return (
          <div key={item.title} className={['rounded-xl border bg-card p-3', tone.surface].join(' ')}>
            <div className={['mb-2 h-1.5 w-8 rounded-full', tone.accent].join(' ')} />
            <div className="text-sm font-semibold text-foreground">{item.title}</div>
            <div className={['mt-2 text-sm font-medium', tone.text].join(' ')}>{item.action}</div>
          </div>
        );
      })}
    </div>
  );
}

function TaskAccordion({ items }: { items: TaskGuide[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item, index) => {
        const tone = toneClasses(item.tone);
        return (
          <details key={item.title} className={['rounded-xl border bg-card p-3 group', tone.surface].join(' ')} open={index === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground">
              <span>{item.title}</span>
              <span className={['text-sm transition-none group-open:rotate-45', tone.text].join(' ')}>+</span>
            </summary>
            <ol className="mt-2 grid gap-2 pl-1">
              {item.steps.map((step, stepIndex) => (
                <li key={step} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 text-sm text-muted-foreground">
                  <span className={['inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold', tone.chip].join(' ')}>
                    {stepIndex + 1}
                  </span>
                  <span className="leading-6">{step}</span>
                </li>
              ))}
            </ol>
          </details>
        );
      })}
    </div>
  );
}

function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item, index) => (
        <details key={item.question} className="rounded-xl border border-border/70 bg-card p-3 group" open={index === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
            <span>{item.question}</span>
            <span className="text-muted-foreground transition-none group-open:rotate-45">+</span>
          </summary>
          <p className="mt-2 pr-6 text-sm leading-6 text-muted-foreground">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

function ScreenshotPlaceholderGrid() {
  const cards = ['Invoice Intake Form', 'My Submissions', 'Finance Review', 'Master Data Review'];
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card} className="rounded-xl border border-dashed border-border/70 bg-card p-4">
          <div className="flex items-center gap-2 text-foreground">
            <ImageIcon className="h-4 w-4 text-sky-500 dark:text-sky-300" />
            <span className="text-sm font-semibold">{card}</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Screenshot guide coming soon.</p>
        </div>
      ))}
    </div>
  );
}

const employeeQuickCards: QuickCard[] = [
  { title: 'Start Here', value: 'Submit', note: 'Create invoice intake with the required details.', tone: 'blue' },
  { title: 'If Returned', value: 'Fix & Resubmit', note: 'Open the rejected row, correct it, and submit again.', tone: 'rose' },
  { title: 'When Accepted', value: 'Wait', note: 'Finance continues the next workflow stages.', tone: 'green' },
  { title: 'No PI Needed', value: 'PI Not Required', note: 'Used for Product Reimbursement Without GST only.', tone: 'orange' },
];

const financeQuickCards: QuickCard[] = [
  { title: 'New Queue', value: 'Review', note: 'Check submission details and supporting context.', tone: 'orange' },
  { title: 'If Incorrect', value: 'Resubmission', note: 'Send it back with a clear correction reason.', tone: 'rose' },
  { title: 'If Approved', value: 'Track Finance Status', note: 'Move through PI, payment, and closure steps.', tone: 'blue' },
  { title: 'Master Data', value: 'Approve or Ignore', note: 'Control reusable dropdown values for future forms.', tone: 'green' },
];

const employeeWorkflow: WorkflowStep[] = [
  { title: 'Submit Invoice', description: 'Employee fills the intake form and submits it for finance review.', owner: 'Employee', icon: <FileText className="h-5 w-5" />, tone: 'blue' },
  { title: 'Finance Review', description: 'Finance checks details, supporting data, and readiness.', owner: 'Finance', icon: <FileSearch className="h-5 w-5" />, tone: 'orange' },
  { title: 'PI Created / Estimate', description: 'Finance marks the submission into the PI stage when needed.', owner: 'Finance', icon: <ReceiptText className="h-5 w-5" />, tone: 'blue' },
  { title: 'Payment Received', description: 'Finance tracks whether payment has been received from the client.', owner: 'Finance', icon: <CircleDollarSign className="h-5 w-5" />, tone: 'orange' },
  { title: 'Creator Invoice', description: 'Finance tracks whether the creator-side invoice has been received.', owner: 'Finance', icon: <ClipboardList className="h-5 w-5" />, tone: 'orange' },
  { title: 'Payment Made', description: 'Finance marks the payment made status once payout is processed.', owner: 'Finance', icon: <Wallet className="h-5 w-5" />, tone: 'green' },
  { title: 'Closed', description: 'The workflow is complete and no further action is required.', owner: 'Finance', icon: <ShieldCheck className="h-5 w-5" />, tone: 'green' },
];

const financeWorkflow: WorkflowStep[] = [
  { title: 'New Submission', description: 'Review the employee submission details and supporting business context.', owner: 'Finance', icon: <Inbox className="h-5 w-5" />, tone: 'orange' },
  { title: 'Review Details', description: 'Verify intake fields, creator details, deliverables, and amounts.', owner: 'Finance', icon: <FileSearch className="h-5 w-5" />, tone: 'blue' },
  { title: 'Accept or Request Resubmission', description: 'Approve clean submissions or send back clear corrections.', owner: 'Finance', icon: <RefreshCcw className="h-5 w-5" />, tone: 'rose' },
  { title: 'PI Created / Estimate', description: 'Move the invoice stage forward when PI handling is needed.', owner: 'Finance', icon: <ReceiptText className="h-5 w-5" />, tone: 'blue' },
  { title: 'Payment Received', description: 'Track whether funds have been received from the client side.', owner: 'Finance', icon: <Landmark className="h-5 w-5" />, tone: 'orange' },
  { title: 'Creator Invoice', description: 'Track creator invoice readiness before payout completion.', owner: 'Finance', icon: <ClipboardList className="h-5 w-5" />, tone: 'orange' },
  { title: 'Payment Made', description: 'Update payout completion once creator payment is processed.', owner: 'Finance', icon: <CreditCard className="h-5 w-5" />, tone: 'green' },
  { title: 'Closed', description: 'Mark the deal complete when the full finance workflow is done.', owner: 'Finance', icon: <CheckCircle2 className="h-5 w-5" />, tone: 'green' },
];

const employeeStatuses: StatusGuide[] = [
  { label: 'Submitted', description: 'Your form is sent and waiting for finance review.', tone: 'orange' },
  { label: 'Accepted', description: 'Finance checked the submission and no employee action is needed.', tone: 'green' },
  { label: 'Resubmission', description: 'Finance returned the submission and expects corrections.', tone: 'rose' },
  { label: 'Closed', description: 'The submission has completed the finance workflow.', tone: 'green' },
  { label: 'PI Not Required', description: 'Used for Product Reimbursement Without GST only when no PI is needed.', tone: 'blue' },
  { label: 'Superseded', description: 'This is an older version that has been replaced by a newer submission.', tone: 'slate' },
  { label: 'Resubmitted', description: 'This is the latest retry after a finance correction request.', tone: 'blue' },
  { label: 'Normal / Current', description: 'Gray means the row is neither superseded nor a resubmitted retry.', tone: 'slate' },
];

const financeStatuses: StatusGuide[] = [
  { label: 'Pending Master Data', description: 'Waiting for finance or admin review before being added to dropdowns.', tone: 'orange' },
  { label: 'Approved', description: 'Added into the reusable source tables for future selections.', tone: 'green' },
  { label: 'Ignored', description: 'Not added into dropdowns and kept out of reusable selections.', tone: 'rose' },
  { label: 'PI Not Required', description: 'Used only for Product Reimbursement Without GST only submissions.', tone: 'blue' },
  { label: 'Closed', description: 'Finance workflow is complete and the row is treated as completed.', tone: 'green' },
  { label: 'Resubmission', description: 'Submission was returned to the employee for correction.', tone: 'rose' },
];

const employeeActions: ActionGuide[] = [
  { title: 'My submission is submitted', action: 'Wait for finance review.', tone: 'orange' },
  { title: 'My submission says resubmission', action: 'Open it, fix the requested details, and submit again.', tone: 'rose' },
  { title: 'My submission is accepted', action: 'No action is needed unless finance contacts you.', tone: 'green' },
  { title: 'My submission is closed', action: 'The workflow is complete.', tone: 'green' },
  { title: 'PI Not Required', action: 'This appears for Product Reimbursement Without GST when PI is not needed.', tone: 'blue' },
];

const employeeTasks: TaskGuide[] = [
  {
    title: 'Submit new invoice',
    tone: 'blue',
    steps: [
      'Open sidebar',
      'Click Submit Invoice',
      'Fill required invoice details',
      'Add line items / deliverables',
      'Submit form',
      'Track it in My Submissions',
    ],
  },
  {
    title: 'Track a submission',
    tone: 'green',
    steps: [
      'Open sidebar',
      'Click My Submissions',
      'Find your PI / submission',
      'Check status columns',
      'Open row for details',
    ],
  },
  {
    title: 'Fix resubmission',
    tone: 'rose',
    steps: [
      'Open notification or My Submissions',
      'Open rejected / resubmission item',
      'Read finance note',
      'Correct form details',
      'Submit again',
    ],
  },
];

const financeActions: ActionGuide[] = [
  { title: 'Invoice Number', action: 'Editable by finance directly from the Finance Review table.', tone: 'blue' },
  { title: 'Debit Number', action: 'Editable by finance directly from the Finance Review table.', tone: 'blue' },
  { title: 'Closure Status', action: 'Means the deal is fully completed. Reopening requires confirmation.', tone: 'green' },
  { title: 'PI Not Required', action: 'Used only for Product Reimbursement Without GST only submissions.', tone: 'orange' },
];

const financeTasks: TaskGuide[] = [
  {
    title: 'Review new submission',
    tone: 'orange',
    steps: [
      'Open sidebar',
      'Click Finance Review',
      'Find Submitted row',
      'Check details',
      'Accept or request resubmission',
    ],
  },
  {
    title: 'Approve master data',
    tone: 'green',
    steps: [
      'Open sidebar',
      'Click Master Data',
      'Review pending value',
      'Approve if reusable',
      'Ignore if not needed',
    ],
  },
  {
    title: 'Update payment workflow',
    tone: 'blue',
    steps: [
      'Open Finance Review',
      'Find PI / submission',
      'Update Payment Received',
      'Update Creator Invoice',
      'Update Payment Made',
      'Mark Closed only when deal is complete',
    ],
  },
];

const employeeFaqs: FaqItem[] = [
  { question: 'Why is my submission pending?', answer: 'Pending usually means finance has not finished reviewing the submission yet. No action is required unless finance returns it for correction.' },
  { question: 'What does resubmission mean?', answer: 'Resubmission means finance found something that needs correction. Open the row, review the note, fix the form details, and submit again.' },
  { question: 'Why can’t I edit after submitting?', answer: 'Submitted records are tracked through the workflow, so direct edits are not allowed. If finance returns it, you can use the resubmission flow instead.' },
  { question: 'What does PI Not Required mean?', answer: 'This appears only for Product Reimbursement Without GST only submissions where a PI is intentionally not generated.' },
  { question: 'When is a submission closed?', answer: 'A submission is closed when finance has finished the full workflow and no more action is expected from you.' },
];

const financeFaqs: FaqItem[] = [
  { question: 'When should I request resubmission?', answer: 'Request resubmission when employee-entered details are incomplete, incorrect, or missing required support for finance to continue.' },
  { question: 'When should I mark payment received?', answer: 'Mark payment received when the client-side payment status has actually progressed into the correct finance state.' },
  { question: 'What does creator invoice mean?', answer: 'Creator invoice tracks whether the creator-side invoice or equivalent payout support has been received and is ready for the payout workflow.' },
  { question: 'What happens when I close a deal?', answer: 'Closing marks the finance workflow complete. The row is treated as completed and reopening it requires an explicit action.' },
  { question: 'Why is PI missing for reimbursement-only submissions?', answer: 'PI is intentionally skipped only for Product Reimbursement Without GST only submissions when no other deliverables are present.' },
  { question: 'What does Master Data approval do?', answer: 'Approving master data promotes the reviewed agency, brand, or creator value into reusable dropdown sources for future invoice intake.' },
];

function MasterDataMiniFlow() {
  const steps = [
    { title: 'Employee enters new agency / brand / creator', icon: <FileEdit className="h-4 w-4" />, tone: 'blue' as const },
    { title: 'Master Data Review', icon: <Layers3 className="h-4 w-4" />, tone: 'orange' as const },
    { title: 'Approve or Ignore', icon: <BadgeCheck className="h-4 w-4" />, tone: 'rose' as const },
    { title: 'Approved value appears in dropdown', icon: <Building2 className="h-4 w-4" />, tone: 'green' as const },
  ];

  return (
    <div className="grid gap-3">
      {steps.map((step, index) => {
        const tone = toneClasses(step.tone);
        return (
          <div key={step.title} className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-3">
            {index < steps.length - 1 ? <div className="absolute left-[17px] top-9 h-[calc(100%+10px)] w-px bg-border/70" /> : null}
            <div className={['relative z-10 flex h-9 w-9 items-center justify-center rounded-xl', tone.icon].join(' ')}>{step.icon}</div>
            <div className={['rounded-xl border p-3', tone.surface].join(' ')}>
              <div className="text-sm font-semibold text-foreground">{step.title}</div>
            </div>
          </div>
        );
      })}
      <div className="grid gap-2 pt-1 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-200/70 bg-amber-50/80 p-3 text-sm text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
          <strong>Pending</strong>: waiting for finance/admin review
        </div>
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/80 p-3 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
          <strong>Approved</strong>: added to reusable dropdowns
        </div>
        <div className="rounded-xl border border-rose-200/70 bg-rose-50/80 p-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
          <strong>Ignored</strong>: not added to dropdowns
        </div>
      </div>
    </div>
  );
}

export default function GuidePage() {
  const { user, loading } = useDashboardSession();

  const isOperationalRole = useMemo(() => {
    return user?.role === 'finance' || user?.role === 'admin' || user?.role === 'developer';
  }, [user?.role]);

  if (loading) return <WorkspaceLoader variant="section" label="Loading guide..." />;

  const activeRole = isOperationalRole ? 'finance' : 'employee';
  const navItems = activeRole === 'employee'
    ? [
        { id: 'start-here', label: 'Start Here' },
        { id: 'workflow', label: 'Workflow' },
        { id: 'status-meanings', label: 'Status Meanings' },
        { id: 'tasks', label: 'How To Do Tasks' },
        { id: 'what-should-i-do', label: 'What Should I Do?' },
        { id: 'faq', label: 'FAQ' },
        { id: 'screenshots', label: 'Screenshot Walkthroughs' },
      ]
    : [
        { id: 'start-here', label: 'Start Here' },
        { id: 'workflow', label: 'Workflow' },
        { id: 'status-meanings', label: 'Status Meanings' },
        { id: 'tasks', label: 'How To Do Tasks' },
        { id: 'what-should-i-do', label: 'Finance Help' },
        { id: 'faq', label: 'FAQ' },
        { id: 'screenshots', label: 'Screenshot Walkthroughs' },
      ];

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
      <SectionNav items={navItems} />

      <div className="grid gap-4">
      <PageHeader
        title="Guide"
        description="Quick visual help for using the finance dashboard."
        className="gap-3 border-b-0 pb-1"
      />

      {activeRole === 'employee' ? (
        <div className="grid gap-5">
          <section id="start-here" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 scroll-mt-24">
            {employeeQuickCards.map((card) => <QuickInfoCard key={card.title} card={card} />)}
          </section>

          <div id="workflow" className="scroll-mt-24">
          <SectionCard title="Employee Workflow" description="A simple view of where your submission goes and who owns each stage.">
            <WorkflowTimeline steps={employeeWorkflow} />
          </SectionCard>
          </div>

          <div id="status-meanings" className="scroll-mt-24">
          <SectionCard title="Status Meanings" description="Quick reference for the labels and version colors you will see.">
            <StatusGrid items={employeeStatuses} />
          </SectionCard>
          </div>

          <div id="tasks" className="scroll-mt-24">
          <SectionCard title="How To Do Common Tasks" description="Follow these short steps for the most common employee actions.">
            <TaskAccordion items={employeeTasks} />
          </SectionCard>
          </div>

          <div id="what-should-i-do" className="scroll-mt-24">
          <SectionCard title="What Should I Do?" description="Use this section when you want the next action quickly.">
            <ActionCardGrid items={employeeActions} />
          </SectionCard>
          </div>

          <div id="faq" className="scroll-mt-24">
          <SectionCard title="Employee FAQ" description="Short answers to the most common employee questions.">
            <FaqAccordion items={employeeFaqs} />
          </SectionCard>
          </div>

          <div id="screenshots" className="scroll-mt-24">
          <SectionCard title="Screenshot Walkthroughs" description="Visual walkthrough cards will be added here later.">
            <ScreenshotPlaceholderGrid />
          </SectionCard>
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          <section id="start-here" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 scroll-mt-24">
            {financeQuickCards.map((card) => <QuickInfoCard key={card.title} card={card} />)}
          </section>

          <div id="workflow" className="scroll-mt-24">
          <SectionCard title="Finance Workflow" description="Use this flow as the working sequence for finance review and payout tracking.">
            <WorkflowTimeline steps={financeWorkflow} />
          </SectionCard>
          </div>

          <SectionCard title="Master Data Workflow" description="How new master data requests move from employee input to approved dropdown values.">
            <MasterDataMiniFlow />
          </SectionCard>

          <div id="tasks" className="scroll-mt-24">
          <SectionCard title="How To Do Common Tasks" description="Short step-by-step help for the most common finance actions.">
            <TaskAccordion items={financeTasks} />
          </SectionCard>
          </div>

          <div id="what-should-i-do" className="scroll-mt-24">
          <SectionCard title="Finance Table Help" description="Quick reminders for the fields and controls finance uses most.">
            <ActionCardGrid items={financeActions} />
          </SectionCard>
          </div>

          <div id="status-meanings" className="scroll-mt-24">
          <SectionCard title="Status Meanings" description="Reference for approval, ignore, PI-not-required, and workflow completion states.">
            <StatusGrid items={financeStatuses} />
          </SectionCard>
          </div>

          <div id="faq" className="scroll-mt-24">
          <SectionCard title="Finance FAQ" description="Short answers to common review and finance workflow questions.">
            <FaqAccordion items={financeFaqs} />
          </SectionCard>
          </div>

          <div id="screenshots" className="scroll-mt-24">
          <SectionCard title="Screenshot Walkthroughs" description="Visual walkthrough cards will be added here later.">
            <ScreenshotPlaceholderGrid />
          </SectionCard>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InvoiceIntakeForm } from "@/components/forms/invoice-intake-form";
import type { InvoiceIntakeSubmissionPayload } from "@/components/forms/types";
import { fetchSessionUser, type SessionUser } from "@/lib/client/session";

export default function NewSubmissionPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchSessionUser().then(setUser).catch(() => setUser(null));
  }, []);

  async function handleCreateSubmit(payload: InvoiceIntakeSubmissionPayload) {
    setMessage("");

    const res = await fetch("/api/submissions/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok || !body?.success) {
      const detail = body?.error || body?.message || "Submission failed.";
      const stage = body?.stage ? ` (${body.stage})` : "";
      throw new Error(`${detail}${stage}`);
    }

    const pi = body?.pi_number ? ` PI: ${body.pi_number}` : "";
    setMessage(`Saved to database.${pi} Sheets sync pending.`);

    setTimeout(() => {
      router.push("/dashboard/submissions");
    }, 900);
  }

  return (
    <main className="grid gap-4">
      <header>
        <h1 className="text-2xl font-semibold">New Submission</h1>
        <p className="text-muted">Legacy CREATE ledger intake flow replicated for continuity.</p>
      </header>

      <InvoiceIntakeForm
        submitterName={user?.full_name || ""}
        submitterEmail={user?.email || ""}
        onSubmit={handleCreateSubmit}
      />

      {message ? <p className="text-success text-sm">{message}</p> : null}
    </main>
  );
}

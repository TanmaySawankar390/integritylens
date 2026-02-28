"use client";

import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateTestPage() {
  const router = useRouter();
  const [subject, setSubject] = useState<"Mathematics" | "Language">("Mathematics");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ id: string }>("/tests", {
        method: "POST",
        body: JSON.stringify({
          subject,
          class_level: "10",
          board: "CBSE",
          test_date: new Date().toISOString().slice(0, 10),
          total_marks: 100
        })
      });
      router.replace(`/tests/${data.id}/upload`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Select Subject</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div>
          <label className="text-sm font-medium">Subject</label>
          <select
            value={subject}
            onChange={(e) =>
              setSubject(e.target.value === "Language" ? "Language" : "Mathematics")
            }
            className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
          >
            <option value="Mathematics">Mathematics</option>
            <option value="Language">Language</option>
          </select>
        </div>
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <button
          disabled={loading}
          className="rounded-md bg-[var(--brand)] px-4 py-2 font-medium text-[var(--brand-foreground)] hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "Proceeding..." : "Proceed to upload"}
        </button>
      </form>
    </div>
  );
}

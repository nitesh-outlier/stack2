"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";

const PLAN_STORAGE_KEY = "stack:plan:v1";

type BlockType =
  | "deep_work"
  | "meeting"
  | "training"
  | "recovery"
  | "admin"
  | "break";

type Block = {
  start_time: string;
  end_time: string;
  activity: string;
  type: BlockType;
  reasoning: string;
};

type Plan = {
  overall_logic: string;
  blocks: Block[];
  warnings?: string[];
};

const TYPE_STYLES: Record<
  BlockType,
  { pill: string; rail: string; label: string }
> = {
  deep_work: {
    pill: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
    rail: "bg-blue-500",
    label: "Deep work",
  },
  meeting: {
    pill: "bg-purple-500/15 text-purple-300 ring-purple-500/30",
    rail: "bg-purple-500",
    label: "Meeting",
  },
  training: {
    pill: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    rail: "bg-emerald-500",
    label: "Training",
  },
  recovery: {
    pill: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
    rail: "bg-orange-500",
    label: "Recovery",
  },
  admin: {
    pill: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
    rail: "bg-zinc-500",
    label: "Admin",
  },
  break: {
    pill: "bg-zinc-400/10 text-zinc-400 ring-zinc-400/20",
    rail: "bg-zinc-400",
    label: "Break",
  },
};

const FALLBACK_STYLE = {
  pill: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
  rail: "bg-zinc-500",
  label: "Block",
};

function styleFor(type: string) {
  return TYPE_STYLES[type as BlockType] ?? FALLBACK_STYLE;
}

const initialForm = {
  sleep_hours: "7",
  sleep_quality: "3",
  energy: "3",
  workout_type: "",
  workout_intensity: "moderate",
  workout_start: "",
  workout_end: "",
  work_start: "09:00",
  work_end: "18:00",
  must_dos: "",
  meetings: "",
  hard_stops: "",
  notes: "",
};

type FormState = typeof initialForm;

function splitLines(s: string): string[] {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function buildPayload(f: FormState) {
  const workout =
    f.workout_type && f.workout_start && f.workout_end
      ? {
          type: f.workout_type,
          intensity: f.workout_intensity,
          start: f.workout_start,
          end: f.workout_end,
        }
      : null;

  return {
    sleep_hours: f.sleep_hours ? Number(f.sleep_hours) : undefined,
    sleep_quality: f.sleep_quality ? Number(f.sleep_quality) : undefined,
    energy: f.energy ? Number(f.energy) : undefined,
    workout,
    work_start: f.work_start,
    work_end: f.work_end,
    must_dos: splitLines(f.must_dos),
    meetings: splitLines(f.meetings),
    hard_stops: splitLines(f.hard_stops),
    notes: f.notes || undefined,
  };
}

export default function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PLAN_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.blocks)) {
        setPlan(parsed as Plan);
      }
    } catch {
      // corrupt storage — ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (plan) {
        window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
      } else {
        window.localStorage.removeItem(PLAN_STORAGE_KEY);
      }
    } catch {
      // storage disabled / quota — non-fatal
    }
  }, [plan]);

  function update(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function generatePlan() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as Plan;
      setPlan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await generatePlan();
  }

  function reset() {
    setPlan(null);
    setForm(initialForm);
    setError(null);
  }

  return (
    <>
      <NoiseOverlay />
      <BackgroundGrid />
      <main className="relative z-0 min-h-screen px-5 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto w-full max-w-2xl">
          <Header />
          {plan ? (
            <PlanView plan={plan} onReset={reset} />
          ) : loading ? (
            <Thinking />
          ) : (
            <PlanForm
              form={form}
              update={update}
              onSubmit={onSubmit}
              onRetry={generatePlan}
              error={error}
            />
          )}
        </div>
      </main>
    </>
  );
}

function Header() {
  return (
    <header className="mb-10 text-center sm:mb-12">
      <h1 className="text-balance bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-5xl font-semibold tracking-tight text-transparent sm:text-6xl">
        Stack
      </h1>
      <p className="mt-3 text-sm text-zinc-400 sm:text-base">
        Your day, sequenced intelligently
      </p>
    </header>
  );
}

function BackgroundGrid() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]">
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
    </div>
  );
}

function NoiseOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-20 opacity-[0.035] mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
      }}
    />
  );
}

function PlanForm({
  form,
  update,
  onSubmit,
  onRetry,
  error,
}: {
  form: FormState;
  update: (key: keyof FormState, value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onRetry: () => void;
  error: string | null;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Section title="Sleep & energy">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Hours">
            <input
              type="number"
              step="0.5"
              min="0"
              max="14"
              value={form.sleep_hours}
              onChange={(e) => update("sleep_hours", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Sleep quality">
            <Select
              value={form.sleep_quality}
              onChange={(v) => update("sleep_quality", v)}
              options={["1", "2", "3", "4", "5"]}
            />
          </Field>
          <Field label="Energy">
            <Select
              value={form.energy}
              onChange={(v) => update("energy", v)}
              options={["1", "2", "3", "4", "5"]}
            />
          </Field>
        </div>
      </Section>

      <Section title="Workout">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select
              value={form.workout_type}
              onChange={(v) => update("workout_type", v)}
              options={[
                { value: "", label: "None" },
                { value: "Strength training", label: "Strength training" },
                { value: "Cardio", label: "Cardio" },
                { value: "Mobility", label: "Mobility" },
                { value: "Other", label: "Other" },
              ]}
            />
          </Field>
          <Field label="Intensity">
            <Select
              value={form.workout_intensity}
              onChange={(v) => update("workout_intensity", v)}
              options={["light", "moderate", "heavy"]}
            />
          </Field>
          <Field label="Start">
            <input
              type="time"
              value={form.workout_start}
              onChange={(e) => update("workout_start", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="End">
            <input
              type="time"
              value={form.workout_end}
              onChange={(e) => update("workout_end", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      <Section title="Work hours">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <input
              type="time"
              required
              value={form.work_start}
              onChange={(e) => update("work_start", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="End">
            <input
              type="time"
              required
              value={form.work_end}
              onChange={(e) => update("work_end", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      <Section title="Must-dos" hint="One per line">
        <textarea
          rows={3}
          value={form.must_dos}
          onChange={(e) => update("must_dos", e.target.value)}
          placeholder={"Ship plan UI\nReview Q2 doc"}
          className={inputCls}
        />
      </Section>

      <Section title="Meetings" hint="One per line, include time and stakes">
        <textarea
          rows={3}
          value={form.meetings}
          onChange={(e) => update("meetings", e.target.value)}
          placeholder={"14:00 1:1 with Sam (low stakes)\n16:00 Investor pitch (high stakes)"}
          className={inputCls}
        />
      </Section>

      <Section title="Hard stops" hint="One per line">
        <textarea
          rows={2}
          value={form.hard_stops}
          onChange={(e) => update("hard_stops", e.target.value)}
          placeholder="kid pickup at 6:30 PM"
          className={inputCls}
        />
      </Section>

      <Section title="Notes">
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Anything else worth knowing about today"
          className={inputCls}
        />
      </Section>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <div className="text-sm font-medium text-red-200">
            Stack hit a snag.
          </div>
          <div className="mt-1 text-xs text-red-300/75">{error}</div>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex h-8 items-center rounded-md border border-red-400/40 bg-red-500/10 px-3 text-xs font-medium text-red-100 transition-colors hover:bg-red-500/20"
          >
            Retry
          </button>
        </div>
      )}

      <button
        type="submit"
        className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-white px-5 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
      >
        Generate today&apos;s plan
      </button>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-white/25 focus:bg-white/[0.05] focus:outline-none";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
        {hint && <span className="text-xs text-zinc-500">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

type SelectOption = string | { value: string; label: string };

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    >
      {options.map((opt) => {
        const o = typeof opt === "string" ? { value: opt, label: opt } : opt;
        return (
          <option key={o.value} value={o.value} className="bg-zinc-900">
            {o.label}
          </option>
        );
      })}
    </select>
  );
}

function Thinking() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zinc-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-zinc-300" />
        </span>
        <span className="text-sm text-zinc-400">Stack is thinking…</span>
      </div>
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-xl bg-white/[0.03]" />
        <div className="h-16 animate-pulse rounded-xl bg-white/[0.03]" />
        <div className="h-16 animate-pulse rounded-xl bg-white/[0.03]" />
        <div className="h-16 animate-pulse rounded-xl bg-white/[0.03]" />
      </div>
    </div>
  );
}

function PlanView({ plan, onReset }: { plan: Plan; onReset: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Today&apos;s plan</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          ← Start over
        </button>
      </div>

      <TopCard plan={plan} />

      <div className="space-y-2">
        {plan.blocks.map((block, i) => (
          <TimelineBlock key={i} block={block} />
        ))}
      </div>

      <FeedbackSection />
    </div>
  );
}

function TopCard({ plan }: { plan: Plan }) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {today}
      </div>
      <p className="mt-3 text-base leading-relaxed text-zinc-100 sm:text-lg">
        {plan.overall_logic}
      </p>
      {plan.warnings && plan.warnings.length > 0 && (
        <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-amber-400">⚠</span>
            <ul className="space-y-1 text-sm leading-relaxed text-amber-100">
              {plan.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineBlock({ block }: { block: Block }) {
  const [open, setOpen] = useState(false);
  const style = styleFor(block.type);
  return (
    <div className="flex gap-4">
      <div className="w-14 shrink-0 pt-3 text-right">
        <div className="font-mono text-xs tabular-nums text-zinc-300">
          {block.start_time}
        </div>
        <div className="font-mono text-xs tabular-nums text-zinc-500">
          {block.end_time}
        </div>
      </div>
      <div className="flex-1 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-colors">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.05]"
        >
          <span
            className={`h-9 w-1 shrink-0 rounded-full ${style.rail}`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-zinc-100">{block.activity}</div>
            <div className="mt-1.5">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${style.pill}`}
              >
                {style.label}
              </span>
            </div>
          </div>
          <svg
            className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-90" : ""}`}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
        </button>
        {open && (
          <div className="border-t border-white/10 bg-white/[0.02] px-4 py-3 pl-8 text-sm leading-relaxed text-zinc-400">
            {block.reasoning}
          </div>
        )}
      </div>
    </div>
  );
}

function FeedbackSection() {
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState<"up" | "down" | null>(null);

  function submit(sentiment: "up" | "down") {
    console.log("plan feedback", { sentiment, note });
    setSubmitted(sentiment);
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">
        {submitted === "up"
          ? "Glad it works. Logged."
          : "Got it — we'll do better. Logged."}
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-white/5 pt-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => submit("up")}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
        >
          👍 This plan works
        </button>
        <button
          type="button"
          onClick={() => submit("down")}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
        >
          👎 Off the mark
        </button>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What would you change? (optional)"
        rows={3}
        className={inputCls}
      />
    </div>
  );
}

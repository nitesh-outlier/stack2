import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/prompt";

type Workout = {
  type?: string;
  intensity?: string;
  start?: string;
  end?: string;
};

type Meeting =
  | string
  | { time?: string; title: string; stakes?: string };

type PlanRequest = {
  sleep_hours?: number;
  sleep_quality?: number;
  energy?: number;
  workout?: Workout | null;
  work_start: string;
  work_end: string;
  must_dos?: string[];
  meetings?: Meeting[];
  hard_stops?: string[];
  notes?: string;
};

const client = new Anthropic();

function to12h(hhmm?: string): string {
  if (!hhmm) return "";
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

function buildContextMessage(data: PlanRequest): string {
  const lines = ["Here are today's inputs:"];

  if (data.sleep_hours != null) {
    const quality =
      data.sleep_quality != null ? `, quality ${data.sleep_quality}/5` : "";
    lines.push(`- Sleep: ${data.sleep_hours} hours${quality}`);
  }

  if (data.energy != null) {
    lines.push(`- Energy: ${data.energy}/5`);
  }

  if (data.workout && (data.workout.type || data.workout.start)) {
    const parts: string[] = [];
    if (data.workout.type) parts.push(data.workout.type);
    if (data.workout.intensity) parts.push(`${data.workout.intensity} intensity`);
    if (data.workout.start && data.workout.end) {
      parts.push(`${to12h(data.workout.start)}-${to12h(data.workout.end)}`);
    }
    lines.push(`- Workout: ${parts.join(", ")}`);
  } else {
    lines.push("- Workout: none");
  }

  lines.push(
    `- Work hours: ${to12h(data.work_start)} to ${to12h(data.work_end)}`,
  );

  const mustDos = (data.must_dos ?? []).filter(Boolean);
  lines.push(`- Must-dos: ${mustDos.length ? mustDos.join("; ") : "none"}`);

  const meetings = (data.meetings ?? []).map((m) => {
    if (typeof m === "string") return m;
    const time = m.time ? `${to12h(m.time)} ` : "";
    const stakes = m.stakes ? ` (${m.stakes} stakes)` : "";
    return `${time}${m.title}${stakes}`;
  });
  lines.push(`- Meetings: ${meetings.length ? meetings.join("; ") : "none"}`);

  const hardStops = (data.hard_stops ?? []).filter(Boolean);
  lines.push(
    `- Hard stops: ${hardStops.length ? hardStops.join("; ") : "none"}`,
  );

  if (data.notes) {
    lines.push(`- Notes: ${data.notes}`);
  }

  lines.push("", "Generate today's plan.");
  return lines.join("\n");
}

export async function POST(req: Request) {
  let body: PlanRequest;
  try {
    body = (await req.json()) as PlanRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body.work_start || !body.work_end) {
    return NextResponse.json(
      { error: "work_start and work_end are required" },
      { status: 400 },
    );
  }

  const userMessage = buildContextMessage(body);

  let response;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: [
        {
          type: "text",
          text: buildSystemPrompt(),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: error.message, type: error.name },
        { status: error.status ?? 500 },
      );
    }
    throw error;
  }

  const textBlock = response.content.find((b) => b.type === "text");
  const rawText = textBlock?.type === "text" ? textBlock.text : "";

  try {
    const plan = JSON.parse(extractJson(rawText));
    return NextResponse.json(plan);
  } catch {
    return NextResponse.json(
      {
        error: "Claude returned malformed JSON",
        raw: rawText,
      },
      { status: 502 },
    );
  }
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) return text.slice(first, last + 1);
  return text.trim();
}

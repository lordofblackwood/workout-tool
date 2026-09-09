export const SOURCE_KEYS = {
  bulgarian: "auto-bulgarian:state:v2",
  accessory: "accessory-lift-tracker-v1",
};
export const SOURCE_NAMES = {
  bulgarian: "Auto Bulgarian",
  accessory: "Accessory Lifts",
};
export const LIFTS = {
  backSquat: "Back Squat",
  benchPress: "Bench Press",
  deadlift: "Deadlift",
};
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function dateValid(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00`);
  return !isNaN(d) && localDate(d) === s;
}
export function shiftDate(s, days) {
  const d = new Date(`${s}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
export function monday(s) {
  const d = new Date(`${s}T12:00:00`);
  return shiftDate(s, -((d.getDay() + 6) % 7));
}
const finite = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0;
function check(ok, message) {
  if (!ok) throw new Error(message);
}
export function normalizeHistory(source, raw) {
  const value = typeof raw === "string" ? JSON.parse(raw) : raw;
  check(
    value && typeof value === "object",
    "The tracker has no readable history.",
  );
  const events = [];
  if (source === "bulgarian") {
    check(
      value.schemaVersion === 2 && value.lifts,
      "Update Auto Bulgarian before connecting it.",
    );
    for (const [lift, name] of Object.entries(LIFTS)) {
      check(
        Array.isArray(value.lifts[lift]?.history),
        `Missing ${name} history.`,
      );
      value.lifts[lift].history.forEach((h) => {
        check(
          h &&
            typeof h.id === "string" &&
            dateValid(h.actualResultDate) &&
            finite(h.topWeight) &&
            ["completed", "failed"].includes(h.result),
          "An Auto Bulgarian record is invalid.",
        );
        events.push({
          id: `bulgarian:${lift}:${h.id}`,
          source,
          date: h.actualResultDate,
          exercise: lift,
          name,
          success: h.result === "completed",
          singleCompleted:
            h.result === "completed" || h.topSingleCompleted === true,
          weight: h.topWeight,
          unit: "lb",
          sets: 1,
          reps: 1,
          outcome: h.result,
          countsDay: true,
        });
      });
    }
  } else if (source === "accessory") {
    check(
      Array.isArray(value.sessions) && Array.isArray(value.exercises),
      "This is not Accessory Lift Tracker data.",
    );
    check(
      value.version == null ||
        (Number.isInteger(value.version) &&
          value.version >= 1 &&
          value.version <= 4),
      "Update Powerlevel to read this Accessory Lifts version.",
    );
    value.sessions.forEach((s) => {
      check(
        s &&
          typeof s.id === "string" &&
          dateValid(s.date) &&
          Array.isArray(s.exercises),
        "An accessory session is invalid.",
      );
      s.exercises.forEach((e, i) => {
        check(
          e &&
            typeof e.name === "string" &&
            ["success", "failure", "skipped"].includes(e.outcome),
          "An accessory result is invalid.",
        );
        const match = String(e.weight).match(
          /^\s*(\d+(?:\.\d+)?)\s*(lb|lbs|kg|seconds?|secs?|s)?\s*$/i,
        );
        events.push({
          id: `accessory:${s.id}:${e.exerciseId || i}`,
          source,
          date: s.date,
          exercise: String(e.exerciseId || e.name),
          name: e.name.slice(0, 120),
          success: e.outcome === "success",
          singleCompleted: false,
          weight: match ? Number(match[1]) : null,
          unit: match
            ? match[2]?.toLowerCase().startsWith("k")
              ? "kg"
              : /^(s|sec|second)/i.test(match[2] || "")
                ? "sec"
                : "lb"
            : "level",
          weightLabel: String(e.weight).slice(0, 80),
          sets: finite(e.sets) ? e.sets : null,
          reps: finite(e.reps) ? e.reps : null,
          outcome: e.outcome,
          countsDay: e.outcome !== "skipped",
        });
      });
    });
  } else throw new Error("Unknown workout tracker.");
  const unique = new Map();
  for (const e of events) {
    if (
      unique.has(e.id) &&
      JSON.stringify(unique.get(e.id)) !== JSON.stringify(e)
    )
      throw new Error("Conflicting duplicate history records.");
    unique.set(e.id, e);
  }
  return {
    schema: 1,
    source,
    events: [...unique.values()].sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    ),
  };
}
export function validateSnapshot(s, source) {
  check(
    s?.schema === 1 &&
      s.source === source &&
      Array.isArray(s.events) &&
      s.events.length <= 100000,
    "The synced history format is invalid.",
  );
  const ids = new Set();
  for (const e of s.events) {
    check(
      e &&
        typeof e.id === "string" &&
        !ids.has(e.id) &&
        e.source === source &&
        dateValid(e.date) &&
        typeof e.name === "string" &&
        typeof e.exercise === "string" &&
        typeof e.success === "boolean" &&
        typeof e.singleCompleted === "boolean" &&
        typeof e.countsDay === "boolean" &&
        (e.weight === null || finite(e.weight)) &&
        ["lb", "kg", "sec", "level"].includes(e.unit),
      "A synced record is invalid.",
    );
    if (source === "bulgarian")
      check(
        e.exercise in LIFTS && e.unit === "lb" && finite(e.weight),
        "Invalid synced lift.",
      );
    ids.add(e.id);
  }
  return s;
}

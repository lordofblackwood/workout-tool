import {
  makeVolumeChart,
  normalizePrescription,
  normalizeVolumeChart,
  prescriptionAt,
  progressExercise
} from "./progression.mjs?v=1";

const STORAGE_KEY = "accessory-lift-tracker-v1";
const STATE_VERSION = 4;
const FAILURE_DROP_LEVELS = 5;

const DUMBBELL_LEVELS = ["5 lb", "7.5 lb", "10 lb", "12.5 lb", "15 lb", "17.5 lb", "20 lb", "22.5 lb", "25 lb", "27.5 lb", "30 lb", "35 lb", "40 lb", "45 lb", "50 lb", "55 lb", "60 lb", "65 lb", "70 lb", "75 lb", "80 lb", "85 lb", "90 lb", "95 lb", "100 lb"];
const CABLE_LEVELS = ["10 lb", "20 lb", "30 lb", "40 lb", "50 lb", "60 lb", "70 lb", "80 lb", "90 lb", "100 lb", "110 lb", "120 lb", "130 lb", "140 lb", "150 lb"];
const MACHINE_LEVELS = ["20 lb", "35 lb", "50 lb", "65 lb", "80 lb", "95 lb", "110 lb", "125 lb", "145 lb", "165 lb", "185 lb", "205 lb", "225 lb"];
const LEG_MACHINE_LEVELS = ["10 lb", "25 lb", "40 lb", "55 lb", "70 lb", "85 lb", "100 lb", "115 lb", "135 lb", "155 lb", "175 lb", "195 lb", "215 lb"];

const DEFAULT_EXERCISES = [
  defaultExercise("incline-db-press", "Incline DB Press", "Dumbbell", DUMBBELL_LEVELS, "25 lb"),
  defaultExercise("lat-pulldown", "Lat Pulldown", "Machine", MACHINE_LEVELS, "20 lb"),
  defaultExercise("machine-row", "Machine Rows", "Machine", MACHINE_LEVELS, "20 lb"),
  defaultExercise("leg-extension", "Leg Extensions", "Leg curl / extension", LEG_MACHINE_LEVELS, "10 lb"),
  defaultExercise("hamstring-curl", "Hamstring Curls", "Leg curl / extension", LEG_MACHINE_LEVELS, "10 lb"),
  defaultExercise("bicep-curls", "Bicep Curls", "Dumbbell", DUMBBELL_LEVELS, "20 lb"),
  defaultExercise("triceps-pushdown", "Triceps Pushdown", "Cable", CABLE_LEVELS, "30 lb"),
  defaultExercise("front-delt-raise", "Front Delt Raise", "Dumbbell", DUMBBELL_LEVELS, "7.5 lb"),
  defaultExercise("side-delt-raise", "Side Delt Raise", "Dumbbell", DUMBBELL_LEVELS, "7.5 lb")
];

let currentView = "workout";
let notice = "";
let deferredInstallPrompt = null;
let state = loadState();

const app = document.querySelector("#app");
const installButton = document.querySelector("[data-action=install]");

document.addEventListener("click", handleClick);
document.addEventListener("change", handleChange);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.hidden = true;
  showNotice("Installed. Your workout data remains on this device.");
});

render();
registerServiceWorker();

function defaultExercise(id, name, equipment, levels, startingWeight) {
  const currentIndex = Math.max(0, levels.indexOf(startingWeight));
  return { id, name, equipment, levels: [...levels], baseIndex: 0, currentIndex, benchmarkIndex: currentIndex, volumeChart: makeVolumeChart(levels.length), enabled: true };
}

function handleClick(event) {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    currentView = viewButton.dataset.view;
    updateTabs();
    render();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const { action, exerciseId } = actionButton.dataset;

  if (["log-success", "log-failure", "log-skipped"].includes(action)) {
    const outcomes = { "log-success": "success", "log-failure": "failure", "log-skipped": "skipped" };
    logResult(exerciseId, outcomes[action]);
  } else if (action === "undo-result") {
    undoResult(exerciseId);
  } else if (action === "complete-workout") {
    completeWorkout();
  } else if (action === "reset-workout") {
    resetWorkout();
  } else if (action === "toggle-exercise") {
    toggleExercise(exerciseId);
  } else if (action === "reset-exercise") {
    resetExercise(exerciseId);
  } else if (action === "export") {
    exportData();
  } else if (action === "reset-data") {
    resetAllData();
  } else if (action === "install") {
    installApp();
  }
}

function handleChange(event) {
  if (event.target.matches("#import-file")) {
    importData(event.target.files?.[0]);
    return;
  }
  const { exerciseField, exerciseId } = event.target.dataset;
  if (exerciseField && exerciseId) updateExerciseField(exerciseId, exerciseField, event.target.value);
}

function render() {
  updateTabs();
  app.replaceChildren();
  if (currentView === "history") renderHistory();
  else if (currentView === "exercises") renderExerciseSettings();
  else renderWorkout();
}

function renderWorkout() {
  const exercises = enabledExercises();
  const results = state.active.results;
  const completedCount = exercises.filter((exercise) => results[exercise.id]).length;

  const heading = el("div", undefined, "section-heading");
  const headingText = el("div");
  headingText.append(el("h2", "Today’s accessory work"));
  headingText.append(el("p", formatDate(state.active.date), "meta"));
  heading.append(headingText);

  const summary = el("section", undefined, "summary-card");
  const summaryCopy = el("div");
  summaryCopy.append(el("div", `${completedCount}/${exercises.length}`, "summary-number"));
  summaryCopy.append(el("div", "exercises logged", "summary-label"));
  const summaryActions = el("div", undefined, "footer-actions");
  const completeButton = button("Complete workout", "button primary", "complete-workout");
  completeButton.disabled = !exercises.length || completedCount !== exercises.length;
  summaryActions.append(completeButton, button("Reset log", "button", "reset-workout"));
  summary.append(summaryCopy, summaryActions);
  app.append(heading, summary);

  if (notice) app.append(el("p", notice, "notice"));
  if (!exercises.length) {
    const empty = el("section", undefined, "empty-card");
    empty.append(el("h3", "No exercises enabled"));
    empty.append(el("p", "Use the Exercises tab to include at least one lift.", "muted"));
    app.append(empty);
    return;
  }

  const list = el("div", undefined, "exercise-list");
  exercises.forEach((exercise) => list.append(renderExercise(exercise, results[exercise.id])));
  app.append(list);
}

function renderExercise(exercise, result) {
  const card = el("article", undefined, "exercise-card");
  const cardHeading = el("div", undefined, "card-heading");
  const nameBlock = el("div");
  nameBlock.append(el("h3", exercise.name));
  nameBlock.append(el("span", exercise.equipment, "equipment"));
  cardHeading.append(nameBlock);

  const levelBlock = el("div", undefined, "level-block");
  const prescription = prescriptionAt(exercise);
  levelBlock.append(el("div", result ? "Next prescription" : "Current prescription", "level-label"));
  levelBlock.append(el("p", currentWeight(exercise), "level-value"));
  levelBlock.append(el("p", `${prescription.sets} ${prescription.sets === 1 ? "set" : "sets"} × ${prescription.reps} reps · benchmark ${exercise.levels[exercise.benchmarkIndex]}`, "prescription-meta"));

  const progressRow = el("div", undefined, "progress-row");
  const track = el("div", undefined, "progress-track");
  const fill = el("div", undefined, "progress-fill");
  fill.style.width = `${((exercise.currentIndex + 1) / exercise.levels.length) * 100}%`;
  track.append(fill);
  progressRow.append(track, el("span", `${exercise.currentIndex + 1}/${exercise.levels.length}`, "progress-count"));
  levelBlock.append(progressRow);
  card.append(cardHeading, levelBlock);

  if (result) {
    const loggedState = el("div", undefined, "logged-state");
    loggedState.classList.add(result.outcome);
    const labels = { success: "✓ Done", failure: "✗ Failed", skipped: "— Skipped" };
    loggedState.append(el("span", `${labels[result.outcome]} · ${result.sets}×${result.reps} at ${result.weight}`));
    loggedState.append(button("Undo", "link-button", "undo-result", exercise.id));
    card.append(loggedState);
  } else {
    const actions = el("div", undefined, "button-row three-actions");
    actions.append(button("Done", "button primary", "log-success", exercise.id));
    actions.append(button("Failed", "button danger", "log-failure", exercise.id));
    actions.append(button("Skip", "button", "log-skipped", exercise.id));
    card.append(actions);
  }
  return card;
}

function renderExerciseSettings() {
  const heading = el("div", undefined, "section-heading");
  const copy = el("div");
  copy.append(el("h2", "Exercises and current state"));
  copy.append(el("p", "Set today’s level directly or exclude a lift from the workout.", "meta"));
  heading.append(copy);
  app.append(heading);
  if (notice) app.append(el("p", notice, "notice"));

  const list = el("div", undefined, "exercise-list settings-list");
  state.exercises.forEach((exercise) => list.append(renderExerciseSettingCard(exercise)));
  app.append(list);
}

function renderExerciseSettingCard(exercise) {
  const card = el("article", undefined, "exercise-card settings-card");
  const heading = el("div", undefined, "card-heading");
  const nameBlock = el("div");
  nameBlock.append(el("h3", exercise.name));
  nameBlock.append(el("span", exercise.equipment, "equipment"));
  const toggle = button(exercise.enabled ? "Included" : "Excluded", `button compact ${exercise.enabled ? "primary" : ""}`, "toggle-exercise", exercise.id);
  heading.append(nameBlock, toggle);
  card.append(heading);

  const prescription = prescriptionAt(exercise);
  const controls = el("div", undefined, "settings-grid");
  controls.append(settingSelect("Current weight", exercise, "currentIndex", exercise.currentIndex, exercise.levels.map((label, index) => [index, label])));
  controls.append(settingSelect("Benchmark", exercise, "benchmarkIndex", exercise.benchmarkIndex, exercise.levels.map((label, index) => [index, label])));
  controls.append(settingSelect("Sets at this weight", exercise, "sets", prescription.sets, [[1, "1 set"], [2, "2 sets"], [3, "3 sets"]]));

  const repsLabel = el("label", undefined, "setting-field");
  repsLabel.append(el("span", "Target reps", "level-label"));
  const repsInput = document.createElement("input");
  repsInput.type = "number";
  repsInput.min = "1";
  repsInput.max = "99";
  repsInput.value = prescription.reps;
  repsInput.dataset.exerciseField = "goalReps";
  repsInput.dataset.exerciseId = exercise.id;
  repsInput.disabled = Boolean(state.active.results[exercise.id]);
  repsLabel.append(repsInput);
  controls.append(repsLabel);
  card.append(controls);

  const footer = el("div", undefined, "settings-footer");
  footer.append(el("span", state.active.results[exercise.id] ? "Undo this workout result before editing." : `Each weight remembers its volume. Failure drops ${FAILURE_DROP_LEVELS} levels.`, "helper-text"));
  const reset = button("Reset to base", "button compact", "reset-exercise", exercise.id);
  reset.disabled = Boolean(state.active.results[exercise.id]);
  footer.append(reset);
  card.append(footer);
  return card;
}

function settingSelect(label, exercise, field, selectedValue, choices) {
  const wrapper = el("label", undefined, "setting-field");
  wrapper.append(el("span", label, "level-label"));
  const select = document.createElement("select");
  select.dataset.exerciseField = field;
  select.dataset.exerciseId = exercise.id;
  select.disabled = Boolean(state.active.results[exercise.id]);
  choices.forEach(([value, text]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    option.selected = Number(value) === Number(selectedValue);
    select.append(option);
  });
  wrapper.append(select);
  return wrapper;
}

function renderHistory() {
  const heading = el("div", undefined, "section-heading");
  const headingText = el("div");
  headingText.append(el("h2", "Workout history"));
  headingText.append(el("p", `${state.sessions.length} completed ${state.sessions.length === 1 ? "workout" : "workouts"}`, "meta"));
  heading.append(headingText);
  app.append(heading);

  if (state.sessions.length === 0) {
    const empty = el("section", undefined, "empty-card");
    empty.append(el("h3", "Nothing logged yet"));
    empty.append(el("p", "Finish your first accessory workout and it will show up here.", "muted"));
    app.append(empty);
  } else {
    const list = el("div", undefined, "history-list");
    state.sessions.forEach((session) => list.append(renderHistoryCard(session)));
    app.append(list);
  }

  const dataCard = el("section", undefined, "data-card");
  dataCard.append(el("h2", "Your data"));
  dataCard.append(el("p", "Everything is saved in this browser. Export a backup before changing devices.", "helper-text"));
  const actions = el("div", undefined, "data-actions");
  actions.append(button("Export backup", "button", "export"));
  const label = el("label", undefined, "file-label");
  label.append("Import backup");
  const input = document.createElement("input");
  input.id = "import-file";
  input.type = "file";
  input.accept = "application/json,.json";
  label.append(input);
  actions.append(label, button("Reset all data", "button danger", "reset-data"));
  dataCard.append(actions);
  app.append(dataCard);
  if (notice) app.append(el("p", notice, "notice"));
}

function renderHistoryCard(session) {
  const card = el("article", undefined, "history-card");
  const heading = el("div", undefined, "history-heading");
  const title = el("div");
  title.append(el("h3", formatDate(sessionDateKey(session))));
  title.append(el("p", `${session.exercises.length} exercises`, "meta"));
  heading.append(title, el("span", formatTime(session.completedAt), "meta"));
  card.append(heading);

  const results = el("ul", undefined, "result-list");
  session.exercises.forEach((entry) => {
    const row = el("li");
    row.append(el("span", entry.name));
    const labels = { success: "Done", failure: "Failed", skipped: "Skipped" };
    row.append(el("strong", `${labels[entry.outcome] || entry.outcome} · ${entry.sets || 1}×${entry.reps || 5} at ${entry.weight}`, `result-${entry.outcome}`));
    results.append(row);
  });
  card.append(results);
  return card;
}

function logResult(exerciseId, outcome) {
  if (state.active.results[exerciseId]) return;
  const exercise = state.exercises.find((item) => item.id === exerciseId && item.enabled);
  if (!exercise) return;

  const before = exerciseSnapshot(exercise);
  const prescription = prescriptionAt(exercise);
  state.active.results[exerciseId] = {
    outcome,
    levelIndex: exercise.currentIndex,
    weight: currentWeight(exercise),
    sets: prescription.sets,
    reps: prescription.reps,
    before,
    loggedAt: new Date().toISOString()
  };
  applyOutcome(exercise, outcome);

  const messages = {
    success: before.currentIndex === exercise.levels.length - 1
      ? `Success logged at the highest weight. Volume advanced and the next prescription drops ${FAILURE_DROP_LEVELS} levels.`
      : "Success logged. The next weight uses its stored prescription.",
    failure: `Failure logged. The failed prescription stays here; the lower rebuild advances one volume step and drops ${FAILURE_DROP_LEVELS} levels.`,
    skipped: "Skipped. The prescription stays unchanged."
  };
  notice = messages[outcome];
  persist();
  render();
}

function applyOutcome(exercise, outcome) {
  const progressed = progressExercise(exercise, outcome, FAILURE_DROP_LEVELS);
  exercise.currentIndex = progressed.currentIndex;
  exercise.benchmarkIndex = progressed.benchmarkIndex;
  exercise.volumeChart = progressed.volumeChart;
}

function undoResult(exerciseId) {
  const result = state.active.results[exerciseId];
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (!result || !exercise) return;
  restoreExercise(exercise, result.before);
  delete state.active.results[exerciseId];
  notice = "Log entry undone.";
  persist();
  render();
}

function completeWorkout() {
  const exercises = enabledExercises();
  if (!exercises.length || !exercises.every((exercise) => state.active.results[exercise.id])) {
    notice = "Log or skip every enabled exercise before completing the workout.";
    render();
    return;
  }

  const completedAt = new Date();
  const session = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
    date: dateKey(completedAt),
    completedAt: completedAt.toISOString(),
    exercises: exercises.map((exercise) => {
      const result = state.active.results[exercise.id];
      return { exerciseId: exercise.id, name: exercise.name, equipment: exercise.equipment, weight: result.weight, sets: result.sets, reps: result.reps, outcome: result.outcome };
    })
  };
  state.sessions.unshift(session);
  state.active = makeActiveWorkout();
  currentView = "history";
  notice = "Workout completed and saved.";
  persist();
  render();
}

function resetWorkout() {
  const resultIds = Object.keys(state.active.results);
  if (resultIds.length && !window.confirm("Reset this workout and undo its progression changes?")) return;
  resultIds.forEach((exerciseId) => {
    const exercise = state.exercises.find((item) => item.id === exerciseId);
    if (exercise) restoreExercise(exercise, state.active.results[exerciseId].before);
  });
  state.active = makeActiveWorkout();
  notice = "Workout reset.";
  persist();
  render();
}

function toggleExercise(exerciseId) {
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return;
  if (state.active.results[exerciseId]) {
    notice = "Undo this exercise’s current result before excluding it.";
    render();
    return;
  }
  if (exercise.enabled && enabledExercises().length === 1) {
    notice = "At least one exercise must remain included.";
    render();
    return;
  }
  exercise.enabled = !exercise.enabled;
  notice = `${exercise.name} ${exercise.enabled ? "included" : "excluded"}.`;
  persist();
  render();
}

function resetExercise(exerciseId) {
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (!exercise || state.active.results[exerciseId]) return;
  exercise.currentIndex = exercise.baseIndex;
  exercise.benchmarkIndex = exercise.baseIndex;
  exercise.volumeChart = makeVolumeChart(exercise.levels.length);
  notice = `${exercise.name} reset to ${currentWeight(exercise)}.`;
  persist();
  render();
}

function updateExerciseField(exerciseId, field, value) {
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (!exercise || state.active.results[exerciseId]) return;
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return;

  if (field === "currentIndex") {
    exercise.currentIndex = clamp(numeric, 0, exercise.levels.length - 1);
    exercise.benchmarkIndex = Math.max(exercise.benchmarkIndex, exercise.currentIndex);
  } else if (field === "benchmarkIndex") {
    exercise.benchmarkIndex = clamp(Math.max(numeric, exercise.currentIndex), 0, exercise.levels.length - 1);
  } else if (field === "sets") {
    const prescription = prescriptionAt(exercise);
    exercise.volumeChart[exercise.currentIndex] = normalizePrescription({ ...prescription, sets: numeric });
  } else if (field === "goalReps") {
    const prescription = prescriptionAt(exercise);
    exercise.volumeChart[exercise.currentIndex] = normalizePrescription({ ...prescription, reps: numeric });
  }
  notice = `${exercise.name} updated.`;
  persist();
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `accessory-workout-backup-${dateKey()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  notice = "Backup downloaded.";
  render();
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = normalizeState(JSON.parse(reader.result));
      if (!imported) throw new Error("Invalid backup");
      state = imported;
      notice = "Backup imported.";
      persist();
      render();
    } catch {
      notice = "That file is not a valid workout backup.";
      render();
    }
  });
  reader.readAsText(file);
}

function resetAllData() {
  if (!window.confirm("Delete all workout history and reset prescriptions?")) return;
  state = makeInitialState();
  notice = "All local data reset.";
  persist();
  render();
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const normalized = normalizeState(saved);
    if (normalized) localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized || makeInitialState();
  } catch {
    return makeInitialState();
  }
}

function normalizeState(value) {
  if (!value || !Array.isArray(value.exercises) || !Array.isArray(value.sessions)) return null;
  const savedVersion = Number.isInteger(value.version) ? value.version : 1;
  const sessions = value.sessions;
  const savedById = new Map(value.exercises.filter(Boolean).map((exercise) => [String(exercise.id), exercise]));
  const defaultsById = new Map(DEFAULT_EXERCISES.map((exercise) => [exercise.id, exercise]));
  const exercises = DEFAULT_EXERCISES.map((fallback) => normalizeExercise(savedById.get(fallback.id), fallback, savedVersion, sessions));

  value.exercises.forEach((saved) => {
    if (saved?.id && !defaultsById.has(String(saved.id))) exercises.push(normalizeExercise(saved, null, savedVersion, sessions));
  });
  const active = normalizeActive(value.active, exercises, sessions);
  if (savedVersion < STATE_VERSION) replayActiveResults(active, exercises);
  return { version: STATE_VERSION, exercises, sessions, active };
}

function normalizeExercise(saved, fallback, savedVersion, sessions) {
  const source = saved || fallback;
  const migrateLevels = fallback && savedVersion !== STATE_VERSION;
  const resetLegacyMachine = migrateLevels && savedVersion < 2 && fallback.equipment === "Machine";
  const preserveStructuredLevel = Boolean(saved && migrateLevels && savedVersion >= 2);
  const levels = (migrateLevels ? fallback.levels : source?.levels)?.map(String) || [...DUMBBELL_LEVELS];
  const currentIndex = resetLegacyMachine
    ? fallback.currentIndex
    : preserveStructuredLevel
      ? clamp(Number.isInteger(source.currentIndex) ? source.currentIndex : fallback?.currentIndex || 0, 0, levels.length - 1)
      : migratedIndex(source, source?.currentIndex, levels, fallback?.currentIndex || 0);
  const benchmarkIndex = resetLegacyMachine
    ? currentIndex
    : preserveStructuredLevel
      ? clamp(Number.isInteger(source.benchmarkIndex) ? source.benchmarkIndex : currentIndex, 0, levels.length - 1)
      : migratedIndex(source, source?.benchmarkIndex, levels, currentIndex);
  const baseIndex = clamp(Number.isInteger(source.baseIndex) ? source.baseIndex : fallback?.baseIndex || 0, 0, levels.length - 1);
  const normalizedBenchmarkIndex = Math.max(currentIndex, benchmarkIndex);
  const id = String(source.id);
  const name = String(fallback?.name || source.name);
  const volumeChart = savedVersion >= STATE_VERSION && Array.isArray(source.volumeChart)
    ? normalizeVolumeChart(source.volumeChart, levels.length)
    : migrateLegacyVolumeChart(source, levels, baseIndex, currentIndex, normalizedBenchmarkIndex, sessions, id, name);
  return {
    id,
    name,
    equipment: String(fallback?.equipment || source.equipment || "Accessory"),
    levels,
    baseIndex,
    currentIndex,
    benchmarkIndex: normalizedBenchmarkIndex,
    volumeChart,
    enabled: source.enabled !== false
  };
}

function migrateLegacyVolumeChart(source, levels, baseIndex, currentIndex, benchmarkIndex, sessions, exerciseId, exerciseName) {
  const legacyPrescription = normalizePrescription({ sets: source?.sets, reps: source?.goalReps });
  const volumeChart = makeVolumeChart(levels.length);
  const corridorEnd = Math.max(currentIndex, benchmarkIndex - 1);

  for (let index = baseIndex; index <= corridorEnd; index += 1) {
    volumeChart[index] = { ...legacyPrescription };
  }
  volumeChart[currentIndex] = { ...legacyPrescription };

  latestAttemptsByLevel(sessions, exerciseId, exerciseName, levels).forEach((entry, levelIndex) => {
    if (entry.outcome !== "failure" || levelIndex <= currentIndex || levelIndex > benchmarkIndex) return;
    volumeChart[levelIndex] = normalizePrescription({ sets: entry.sets, reps: entry.reps });
  });
  return volumeChart;
}

function latestAttemptsByLevel(sessions, exerciseId, exerciseName, levels) {
  const attempts = new Map();
  sessions.forEach((session) => {
    if (!Array.isArray(session?.exercises)) return;
    session.exercises.forEach((entry) => {
      const matchesExercise = String(entry?.exerciseId || "") === exerciseId || (!entry?.exerciseId && String(entry?.name || "") === exerciseName);
      if (!matchesExercise || entry.outcome === "skipped" || !Number.isFinite(numericWeight(entry.weight))) return;
      const levelIndex = nearestLevelIndex(levels, entry.weight);
      if (!attempts.has(levelIndex)) attempts.set(levelIndex, entry);
    });
  });
  return attempts;
}

function migratedIndex(source, sourceIndex, targetLevels, fallbackIndex) {
  if (source && Array.isArray(source.levels) && Number.isInteger(sourceIndex)) {
    const sourceWeight = source.levels[clamp(sourceIndex, 0, source.levels.length - 1)];
    return nearestLevelIndex(targetLevels, sourceWeight);
  }
  return clamp(Number.isInteger(fallbackIndex) ? fallbackIndex : 0, 0, targetLevels.length - 1);
}

function normalizeActive(active, exercises, sessions) {
  if (!active || !active.date || !active.results) return makeActiveWorkout();
  const results = {};
  Object.entries(active.results).forEach(([exerciseId, result]) => {
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (!exercise || !result || !["success", "failure", "skipped"].includes(result.outcome)) return;
    const levelIndex = nearestLevelIndex(exercise.levels, result.weight || exercise.levels[result.levelIndex] || currentWeight(exercise));
    const before = result.before ? normalizeSnapshot(result.before, exercise, sessions) : { ...exerciseSnapshot(exercise), currentIndex: levelIndex };
    const beforePrescription = before.volumeChart[before.currentIndex] || prescriptionAt(exercise);
    const performedPrescription = normalizePrescription({ sets: result.sets, reps: result.reps }, beforePrescription);
    results[exerciseId] = {
      outcome: result.outcome,
      levelIndex,
      weight: String(result.weight || exercise.levels[levelIndex]),
      sets: performedPrescription.sets,
      reps: performedPrescription.reps,
      before,
      loggedAt: String(result.loggedAt || new Date().toISOString())
    };
  });
  return { date: String(active.date), startedAt: String(active.startedAt || new Date().toISOString()), results };
}

function normalizeSnapshot(snapshot, exercise, sessions = []) {
  const currentIndex = clamp(Number.isInteger(snapshot.currentIndex) ? snapshot.currentIndex : exercise.currentIndex, 0, exercise.levels.length - 1);
  const benchmarkIndex = clamp(Number.isInteger(snapshot.benchmarkIndex) ? snapshot.benchmarkIndex : exercise.benchmarkIndex, currentIndex, exercise.levels.length - 1);
  const volumeChart = Array.isArray(snapshot.volumeChart)
    ? normalizeVolumeChart(snapshot.volumeChart, exercise.levels.length)
    : migrateLegacyVolumeChart(snapshot, exercise.levels, exercise.baseIndex, currentIndex, benchmarkIndex, sessions, exercise.id, exercise.name);
  return {
    currentIndex,
    benchmarkIndex,
    volumeChart
  };
}

function replayActiveResults(active, exercises) {
  Object.entries(active.results).forEach(([exerciseId, result]) => {
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;
    restoreExercise(exercise, result.before);
    applyOutcome(exercise, result.outcome);
  });
}

function makeInitialState() {
  return { version: STATE_VERSION, exercises: structuredClone(DEFAULT_EXERCISES), sessions: [], active: makeActiveWorkout() };
}

function makeActiveWorkout() {
  return { date: dateKey(), startedAt: new Date().toISOString(), results: {} };
}

function exerciseSnapshot(exercise) {
  return {
    currentIndex: exercise.currentIndex,
    benchmarkIndex: exercise.benchmarkIndex,
    volumeChart: normalizeVolumeChart(exercise.volumeChart, exercise.levels.length)
  };
}

function restoreExercise(exercise, snapshot) {
  const normalized = normalizeSnapshot(snapshot || {}, exercise);
  exercise.currentIndex = normalized.currentIndex;
  exercise.benchmarkIndex = normalized.benchmarkIndex;
  exercise.volumeChart = normalized.volumeChart;
}

function enabledExercises() {
  return state.exercises.filter((exercise) => exercise.enabled);
}

function currentWeight(exercise) {
  return exercise.levels[exercise.currentIndex];
}

function nearestLevelIndex(levels, weight) {
  const target = numericWeight(weight);
  if (!Number.isFinite(target)) return 0;
  return levels.reduce((best, level, index) => Math.abs(numericWeight(level) - target) < Math.abs(numericWeight(levels[best]) - target) ? index : best, 0);
}

function numericWeight(value) {
  return Number.parseFloat(String(value));
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function updateTabs() {
  document.querySelectorAll("[data-view]").forEach((tab) => {
    const active = tab.dataset.view === currentView;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-current", active ? "page" : "false");
  });
}

function showNotice(message) {
  notice = message;
  render();
}

async function installApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch {
    showNotice("Offline caching could not start, but local data still works.");
  }
}

function button(label, className, action, exerciseId) {
  const result = document.createElement("button");
  result.type = "button";
  result.className = className;
  result.dataset.action = action;
  if (exerciseId) result.dataset.exerciseId = exerciseId;
  result.textContent = label;
  return result;
}

function el(tagName, text, className) {
  const node = document.createElement(tagName);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sessionDateKey(session) {
  const completedAt = new Date(session.completedAt);
  return Number.isNaN(completedAt.getTime()) ? session.date : dateKey(completedAt);
}

function formatDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

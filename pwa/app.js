const STORAGE_KEY = "accessory-lift-tracker-v1";

const DEFAULT_EXERCISES = [
  { id: "incline-db-press", name: "Incline DB Press", equipment: "Dumbbell", levels: ["20 lb", "25 lb", "30 lb", "35 lb", "40 lb", "45 lb", "50 lb"], currentIndex: 1 },
  { id: "lat-pulldown", name: "Lat Pulldown", equipment: "Lat machine", levels: ["60 lb", "70 lb", "80 lb", "90 lb", "100 lb", "110 lb", "120 lb"], currentIndex: 1 },
  { id: "bicep-curls", name: "Bicep Curls", equipment: "Dumbbell", levels: ["15 lb", "20 lb", "25 lb", "30 lb", "35 lb", "40 lb"], currentIndex: 1 },
  { id: "triceps-pushdown", name: "Triceps Pushdown", equipment: "Cable", levels: ["25 lb", "30 lb", "35 lb", "40 lb", "45 lb", "50 lb", "55 lb"], currentIndex: 1 },
  { id: "front-delt-raise", name: "Front Delt Raise", equipment: "Dumbbell", levels: ["5 lb", "7.5 lb", "10 lb", "12.5 lb", "15 lb", "17.5 lb"], currentIndex: 1 },
  { id: "side-delt-raise", name: "Side Delt Raise", equipment: "Dumbbell", levels: ["5 lb", "7.5 lb", "10 lb", "12.5 lb", "15 lb", "17.5 lb"], currentIndex: 1 }
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
  if (action === "log-success" || action === "log-failure") {
    logResult(exerciseId, action === "log-success" ? "success" : "failure");
  } else if (action === "undo-result") {
    undoResult(exerciseId);
  } else if (action === "complete-workout") {
    completeWorkout();
  } else if (action === "reset-workout") {
    resetWorkout();
  } else if (action === "export") {
    exportData();
  } else if (action === "reset-data") {
    resetAllData();
  } else if (action === "install") {
    installApp();
  }
}

function handleChange(event) {
  if (event.target.matches("#import-file")) importData(event.target.files?.[0]);
}

function render() {
  updateTabs();
  app.replaceChildren();
  if (currentView === "history") renderHistory();
  else renderWorkout();
}

function renderWorkout() {
  const results = state.active.results;
  const completedCount = Object.keys(results).length;
  const totalCount = state.exercises.length;

  const heading = el("div", undefined, "section-heading");
  const headingText = el("div");
  headingText.append(el("h2", "Today’s accessory work"));
  headingText.append(el("p", formatDate(state.active.date), "meta"));
  heading.append(headingText);

  const summary = el("section", undefined, "summary-card");
  const summaryCopy = el("div");
  summaryCopy.append(el("div", `${completedCount}/${totalCount}`, "summary-number"));
  summaryCopy.append(el("div", "exercises logged", "summary-label"));
  const summaryActions = el("div", undefined, "footer-actions");
  const completeButton = button("Complete workout", "button primary", "complete-workout");
  completeButton.disabled = completedCount !== totalCount;
  summaryActions.append(completeButton);
  const resetButton = button("Reset log", "button", "reset-workout");
  summaryActions.append(resetButton);
  summary.append(summaryCopy, summaryActions);

  app.append(heading, summary);
  if (notice) app.append(el("p", notice, "notice"));

  const list = el("div", undefined, "exercise-list");
  state.exercises.forEach((exercise) => list.append(renderExercise(exercise, results[exercise.id])));
  app.append(list);
}

function renderExercise(exercise, result) {
  const card = el("article", undefined, "exercise-card");
  const cardHeading = el("div", undefined, "card-heading");
  const nameBlock = el("div");
  nameBlock.append(el("h3", exercise.name));
  nameBlock.append(el("span", exercise.equipment, "equipment"));
  cardHeading.append(nameBlock);

  const current = exercise.levels[exercise.currentIndex];
  const levelBlock = el("div", undefined, "level-block");
  levelBlock.append(el("div", "Current prescription", "level-label"));
  levelBlock.append(el("p", current, "level-value"));

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
    loggedState.classList.add(result.outcome === "success" ? "success" : "failure");
    const label = result.outcome === "success" ? "✓ Done" : "✗ Failed";
    loggedState.append(el("span", `${label} · ${result.weight}`));
    loggedState.append(button("Undo", "link-button", "undo-result", exercise.id));
    card.append(loggedState);
  } else {
    const actions = el("div", undefined, "button-row");
    actions.append(button("Done", "button primary", "log-success", exercise.id));
    actions.append(button("Failed", "button danger", "log-failure", exercise.id));
    card.append(actions);
  }
  return card;
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
  title.append(el("h3", formatDate(session.date)));
  title.append(el("p", `${session.exercises.length} exercises`, "meta"));
  heading.append(title, el("span", formatTime(session.completedAt), "meta"));
  card.append(heading);

  const results = el("ul", undefined, "result-list");
  session.exercises.forEach((entry) => {
    const row = el("li");
    row.append(el("span", entry.name));
    const outcome = el("strong", `${entry.outcome === "success" ? "Done" : "Failed"} · ${entry.weight}`, entry.outcome === "success" ? "result-success" : "result-failure");
    row.append(outcome);
    results.append(row);
  });
  card.append(results);
  return card;
}

function logResult(exerciseId, outcome) {
  if (state.active.results[exerciseId]) return;
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return;
  const levelIndex = exercise.currentIndex;
  const weight = exercise.levels[levelIndex];
  state.active.results[exerciseId] = { outcome, levelIndex, weight, loggedAt: new Date().toISOString() };
  exercise.currentIndex = outcome === "success"
    ? Math.min(levelIndex + 1, exercise.levels.length - 1)
    : Math.max(levelIndex - 1, 0);
  notice = "Saved on this device.";
  persist();
  render();
}

function undoResult(exerciseId) {
  const result = state.active.results[exerciseId];
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (!result || !exercise) return;
  exercise.currentIndex = result.levelIndex;
  delete state.active.results[exerciseId];
  notice = "Log entry undone.";
  persist();
  render();
}

function completeWorkout() {
  const allLogged = state.exercises.every((exercise) => state.active.results[exercise.id]);
  if (!allLogged) {
    notice = "Log every exercise before completing the workout.";
    render();
    return;
  }
  const session = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
    date: state.active.date,
    completedAt: new Date().toISOString(),
    exercises: state.exercises.map((exercise) => ({
      exerciseId: exercise.id,
      name: exercise.name,
      equipment: exercise.equipment,
      weight: state.active.results[exercise.id].weight,
      outcome: state.active.results[exercise.id].outcome
    }))
  };
  state.sessions.unshift(session);
  state.active = makeActiveWorkout();
  currentView = "history";
  notice = "Workout completed and saved.";
  persist();
  render();
}

function resetWorkout() {
  if (!Object.keys(state.active.results).length || window.confirm("Reset this workout and undo its progression changes?")) {
    Object.keys(state.active.results).forEach(undoResultWithoutRender);
    state.active = makeActiveWorkout();
    notice = "Workout reset.";
    persist();
    render();
  }
}

function undoResultWithoutRender(exerciseId) {
  const result = state.active.results[exerciseId];
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (result && exercise) exercise.currentIndex = result.levelIndex;
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
    return normalizeState(saved) || makeInitialState();
  } catch {
    return makeInitialState();
  }
}

function normalizeState(value) {
  if (!value || !Array.isArray(value.exercises) || !Array.isArray(value.sessions)) return null;
  const exercises = value.exercises
    .filter((item) => item && item.id && item.name && Array.isArray(item.levels) && item.levels.length)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name),
      equipment: String(item.equipment || "Accessory"),
      levels: item.levels.map(String),
      currentIndex: clamp(Number.isInteger(item.currentIndex) ? item.currentIndex : 0, 0, item.levels.length - 1)
    }));
  if (!exercises.length) return null;
  const active = value.active && value.active.date && value.active.results
    ? { date: String(value.active.date), startedAt: String(value.active.startedAt || new Date().toISOString()), results: value.active.results }
    : makeActiveWorkout();
  return { exercises, sessions: Array.isArray(value.sessions) ? value.sessions : [], active };
}

function makeInitialState() {
  return { exercises: structuredClone(DEFAULT_EXERCISES), sessions: [], active: makeActiveWorkout() };
}

function makeActiveWorkout() {
  return { date: dateKey(), startedAt: new Date().toISOString(), results: {} };
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
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch {
      showNotice("Offline caching could not start, but local data still works.");
    }
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

function formatDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

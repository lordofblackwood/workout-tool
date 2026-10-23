import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import * as progression from '../pwa/progression.mjs';

const STORAGE_KEY = 'accessory-lift-tracker-v1';
const appSource = readFileSync(new URL('../pwa/app.js', import.meta.url), 'utf8')
  .replace(/^import\s*\{[\s\S]*?\}\s*from\s*["']\.\/progression\.mjs[^"']*["'];\s*/, '');

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.disabled = false;
    this.classList = { add() {}, toggle() {} };
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute() {}

  matches(selector) {
    return selector === '#import-file' && this.id === 'import-file';
  }

  closest(selector) {
    if (selector === '[data-action]' && this.dataset.action) return this;
    if (selector === '[data-view]' && this.dataset.view) return this;
    return null;
  }
}

function createApp(savedState) {
  const app = new Element('main');
  const installButton = new Element('button');
  const listeners = new Map();
  const storage = new Map(savedState ? [[STORAGE_KEY, JSON.stringify(savedState)]] : []);
  const context = vm.createContext({
    ...progression,
    structuredClone,
    crypto: { randomUUID: () => 'test-workout-id' },
    navigator: {},
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    },
    window: { addEventListener() {} },
    document: {
      querySelector: (selector) => selector === '#app' ? app : installButton,
      querySelectorAll: () => [],
      createElement: (tagName) => new Element(tagName),
      addEventListener: (type, listener) => listeners.set(type, listener)
    }
  });
  vm.runInContext(appSource, context, { filename: 'pwa/app.js' });

  function elements(node = app) {
    return [node, ...node.children.flatMap((child) => child instanceof Element ? elements(child) : [])];
  }

  function actionButton(action, exerciseId) {
    const button = elements().find((element) => element.dataset.action === action && element.dataset.exerciseId === exerciseId);
    assert.ok(button, `Missing ${action} button${exerciseId ? ` for ${exerciseId}` : ''}`);
    return button;
  }

  return {
    actionButton,
    click(action, exerciseId) {
      const button = actionButton(action, exerciseId);
      assert.equal(button.disabled, false, `${action} button should be enabled`);
      listeners.get('click')({ target: button });
    },
    dispatchAction(action) {
      const target = new Element('button');
      target.dataset.action = action;
      listeners.get('click')({ target });
    },
    view(name) {
      const target = new Element('button');
      target.dataset.view = name;
      listeners.get('click')({ target });
    },
    change(exerciseId, field, value) {
      const target = elements().find((element) => element.dataset.exerciseId === exerciseId && element.dataset.exerciseField === field);
      assert.ok(target, `Missing ${field} control for ${exerciseId}`);
      assert.equal(target.disabled, false, `${field} control should be enabled`);
      target.value = String(value);
      listeners.get('change')({ target });
    },
    readState: () => JSON.parse(vm.runInContext('JSON.stringify(state)', context)),
    readSavedState: () => JSON.parse(storage.get(STORAGE_KEY)),
    headings: () => elements().filter((element) => element.tagName === 'h2').map((element) => element.textContent),
    text: () => elements().map((element) => element.textContent || '').join('\n')
  };
}

const initialState = createApp().readState();

function workoutState(enabledCount) {
  const state = structuredClone(initialState);
  state.exercises.forEach((exercise, index) => { exercise.enabled = index < enabledCount; });
  return state;
}

function historyEntry(exercise, result) {
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    equipment: exercise.equipment,
    weight: result.weight,
    sets: result.sets,
    reps: result.reps,
    outcome: result.outcome
  };
}

test('finishing early preserves done, failed, and manually skipped results and skips only unfinished included lifts', () => {
  const fixture = workoutState(4);
  fixture.exercises[3].currentIndex = 2;
  fixture.exercises[3].benchmarkIndex = 5;
  fixture.exercises[3].volumeChart[2] = { sets: 3, reps: 8 };
  const previousSession = { id: 'previous-workout', date: '2026-10-01', completedAt: '2026-10-01T12:00:00.000Z', exercises: [] };
  fixture.sessions.push(previousSession);
  const app = createApp(fixture);
  const [done, failed, skipped, unfinished] = app.readState().exercises;

  app.click('log-success', done.id);
  app.click('log-failure', failed.id);
  app.click('log-skipped', skipped.id);
  const beforeFinishing = app.readState();
  assert.equal(app.actionButton('complete-workout').textContent, 'Finish workout early');

  app.click('complete-workout');

  const saved = app.readSavedState();
  assert.deepEqual(saved.sessions[0].exercises, [
    ...[done, failed, skipped].map((exercise) => historyEntry(exercise, beforeFinishing.active.results[exercise.id])),
    historyEntry(unfinished, { outcome: 'skipped', weight: unfinished.levels[2], sets: 3, reps: 8 })
  ]);
  assert.deepEqual(saved.exercises, beforeFinishing.exercises);
  assert.deepEqual(saved.sessions[1], previousSession);
  assert.equal(saved.sessions.length, 2);
  assert.deepEqual(saved.active.results, {});
  assert.ok(app.headings().includes('Workout history'));
});

test('finishing before logging anything skips included lifts and preserves all prescriptions', () => {
  const fixture = workoutState(2);
  fixture.exercises[0].currentIndex = fixture.exercises[0].levels.length - 1;
  fixture.exercises[0].benchmarkIndex = fixture.exercises[0].currentIndex;
  fixture.exercises[0].volumeChart.forEach((prescription, index) => {
    prescription.sets = index % 3 + 1;
    prescription.reps = index + 5;
  });
  const app = createApp(fixture);
  const before = app.readState();
  assert.equal(app.actionButton('complete-workout').disabled, false);
  assert.equal(app.actionButton('complete-workout').textContent, 'Finish workout early');

  app.click('complete-workout');

  const saved = app.readSavedState();
  assert.equal(saved.sessions.length, 1);
  assert.deepEqual(saved.sessions[0].exercises, before.exercises.filter((exercise) => exercise.enabled).map((exercise) => historyEntry(exercise, {
    outcome: 'skipped',
    weight: exercise.levels[exercise.currentIndex],
    ...progression.prescriptionAt(exercise)
  })));
  assert.deepEqual(saved.exercises, before.exercises);
  assert.deepEqual(saved.active.results, {});
  assert.deepEqual(createApp(saved).readState(), saved);
});

test('a fully logged workout keeps the complete label and saves existing results unchanged', () => {
  const app = createApp(workoutState(2));
  const [done, failed] = app.readState().exercises;
  app.click('log-success', done.id);
  app.click('log-failure', failed.id);
  const before = app.readState();
  assert.equal(app.actionButton('complete-workout').disabled, false);
  assert.equal(app.actionButton('complete-workout').textContent, 'Complete workout');

  app.click('complete-workout');

  const saved = app.readSavedState();
  assert.deepEqual(saved.sessions[0].exercises, [done, failed].map((exercise) => historyEntry(exercise, before.active.results[exercise.id])));
  assert.deepEqual(saved.exercises, before.exercises);
  assert.deepEqual(saved.active.results, {});
});

test('a workout with no included exercises cannot be completed', () => {
  const app = createApp(workoutState(0));
  const before = app.readState();
  assert.equal(app.actionButton('complete-workout').disabled, true);

  app.dispatchAction('complete-workout');

  assert.deepEqual(app.readState(), before);
  assert.deepEqual(app.readSavedState(), before);
});

test('running starts at one five-minute set and remembers edited minutes at each speed', () => {
  const app = createApp();
  const running = app.readState().exercises.find((exercise) => exercise.id === 'running');
  assert.ok(running, 'Running should be included in the default workout');
  assert.equal(running.name, 'Running');
  assert.equal(running.equipment, 'Treadmill');
  assert.equal(running.volumeUnit, 'minutes');
  assert.deepEqual(running.levels, Array.from({ length: 15 }, (_, index) => `${3 + index * 0.5} mph`));
  assert.equal(running.currentIndex, 0);
  assert.equal(running.benchmarkIndex, 0);
  assert.deepEqual(progression.prescriptionAt(running), { sets: 1, reps: 5 });
  assert.match(app.text(), /1 set × 5 minutes/);
  assert.ok(app.readState().exercises.filter((exercise) => exercise.id !== 'running').every((exercise) => !Object.hasOwn(exercise, 'volumeUnit')));

  app.view('exercises');
  assert.match(app.text(), /Current speed/);
  assert.match(app.text(), /Sets at this speed/);
  assert.match(app.text(), /Target minutes/);
  assert.match(app.text(), /Target reps/);
  app.change('running', 'goalReps', 7);
  app.change('running', 'currentIndex', 1);
  assert.deepEqual(progression.prescriptionAt(app.readState().exercises.find((exercise) => exercise.id === 'running')), { sets: 1, reps: 5 });
  app.change('running', 'currentIndex', 0);
  app.view('workout');
  assert.match(app.text(), /1 set × 7 minutes/);
  assert.equal(createApp(app.readSavedState()).readState().exercises.find((exercise) => exercise.id === 'running').volumeUnit, 'minutes');
});

test('adding running to a version-four save preserves existing volume charts, history, and active results', () => {
  const oldApp = createApp(workoutState(2));
  const firstLift = oldApp.readState().exercises[0];
  oldApp.click('log-failure', firstLift.id);
  const fixture = oldApp.readSavedState();
  fixture.exercises = fixture.exercises.filter((exercise) => exercise.id !== 'running');
  fixture.sessions = [{
    id: 'pre-running-workout',
    date: '2026-10-01',
    completedAt: '2026-10-01T12:00:00.000Z',
    exercises: [historyEntry(firstLift, fixture.active.results[firstLift.id])]
  }];
  assert.equal(fixture.version, 4);

  const saved = createApp(fixture).readSavedState();
  assert.equal(saved.version, 4);
  assert.deepEqual(saved.exercises.filter((exercise) => exercise.id !== 'running'), fixture.exercises);
  assert.deepEqual(saved.sessions, fixture.sessions);
  assert.deepEqual(saved.active, fixture.active);
  const running = saved.exercises.find((exercise) => exercise.id === 'running');
  assert.equal(running.volumeUnit, 'minutes');
  assert.equal(running.levels[running.currentIndex], '3 mph');
  assert.deepEqual(progression.prescriptionAt(running), { sets: 1, reps: 5 });
});

test('running results retain minutes across reload, undo, and completed history without changing lift results', () => {
  const fixture = workoutState(0);
  const running = fixture.exercises.find((exercise) => exercise.id === 'running');
  const lift = fixture.exercises[0];
  running.enabled = true;
  running.currentIndex = 6;
  running.benchmarkIndex = 6;
  lift.enabled = true;
  const originalRunning = structuredClone(running);
  const app = createApp(fixture);

  app.click('log-failure', running.id);
  const failedState = app.readSavedState();
  const result = failedState.active.results[running.id];
  assert.equal(result.volumeUnit, 'minutes');
  assert.equal(result.weight, '6 mph');
  assert.equal(result.sets, 1);
  assert.equal(result.reps, 5);
  const rebuilding = failedState.exercises.find((exercise) => exercise.id === 'running');
  assert.equal(rebuilding.levels[rebuilding.currentIndex], '3.5 mph');
  assert.deepEqual(progression.prescriptionAt(rebuilding), { sets: 2, reps: 5 });
  assert.match(app.text(), /1×5 min at 6 mph/);

  const reloaded = createApp(failedState);
  assert.deepEqual(reloaded.readState(), failedState);
  reloaded.click('undo-result', running.id);
  assert.deepEqual(reloaded.readSavedState().exercises.find((exercise) => exercise.id === 'running'), originalRunning);
  assert.equal(reloaded.readSavedState().active.results[running.id], undefined);

  reloaded.click('log-success', running.id);
  reloaded.click('log-success', lift.id);
  assert.equal(Object.hasOwn(reloaded.readSavedState().active.results[lift.id], 'volumeUnit'), false);
  reloaded.click('complete-workout');
  const saved = reloaded.readSavedState();
  const runningEntry = saved.sessions[0].exercises.find((entry) => entry.exerciseId === running.id);
  assert.deepEqual(runningEntry, {
    exerciseId: 'running',
    name: 'Running',
    equipment: 'Treadmill',
    weight: '6 mph',
    sets: 1,
    reps: 5,
    outcome: 'success',
    volumeUnit: 'minutes'
  });
  assert.equal(Object.hasOwn(saved.sessions[0].exercises.find((entry) => entry.exerciseId === lift.id), 'volumeUnit'), false);
  assert.match(reloaded.text(), /1×5 min at 6 mph/);
  const historyReload = createApp(saved);
  assert.deepEqual(historyReload.readState(), saved);
  historyReload.view('history');
  assert.match(historyReload.text(), /1×5 min at 6 mph/);
});

test('finishing early records an unlogged run in minutes without advancing its target', () => {
  const fixture = workoutState(0);
  const running = fixture.exercises.find((exercise) => exercise.id === 'running');
  running.enabled = true;
  const app = createApp(fixture);

  app.click('complete-workout');

  const saved = app.readSavedState();
  assert.deepEqual(saved.exercises.find((exercise) => exercise.id === 'running'), running);
  assert.deepEqual(saved.sessions[0].exercises, [{
    exerciseId: 'running',
    name: 'Running',
    equipment: 'Treadmill',
    weight: '3 mph',
    sets: 1,
    reps: 5,
    outcome: 'skipped',
    volumeUnit: 'minutes'
  }]);
  assert.match(app.text(), /Skipped · 1×5 min at 3 mph/);
});

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
    readState: () => JSON.parse(vm.runInContext('JSON.stringify(state)', context)),
    readSavedState: () => JSON.parse(storage.get(STORAGE_KEY)),
    headings: () => elements().filter((element) => element.tagName === 'h2').map((element) => element.textContent)
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

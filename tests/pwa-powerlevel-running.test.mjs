import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeHistory, validateSnapshot } from '../pwa/powerlevel/history.mjs';

function accessoryState(entry) {
  return {
    version: 4,
    exercises: [{ id: entry.exerciseId }],
    sessions: [{
      id: 'workout-1',
      date: '2026-10-23',
      exercises: [entry]
    }]
  };
}

test('running history preserves minutes through snapshot normalization and validation without treating speed as weight', () => {
  const snapshot = normalizeHistory('accessory', accessoryState({
    exerciseId: 'running',
    name: 'Running',
    equipment: 'Treadmill',
    weight: '6 mph',
    sets: 2,
    reps: 5,
    volumeUnit: 'minutes',
    outcome: 'success'
  }));

  assert.deepEqual(snapshot.events[0], {
    id: 'accessory:workout-1:running',
    source: 'accessory',
    date: '2026-10-23',
    exercise: 'running',
    name: 'Running',
    success: true,
    singleCompleted: false,
    weight: null,
    unit: 'level',
    weightLabel: '6 mph',
    sets: 2,
    reps: 5,
    volumeUnit: 'minutes',
    outcome: 'success',
    countsDay: true
  });
  assert.deepEqual(validateSnapshot(JSON.parse(JSON.stringify(snapshot)), 'accessory'), snapshot);
});

test('lifting history retains its existing snapshot shape and strength units', () => {
  const snapshot = normalizeHistory('accessory', accessoryState({
    exerciseId: 'incline-db-press',
    name: 'Incline DB Press',
    equipment: 'Dumbbell',
    weight: '25 lb',
    sets: 1,
    reps: 5,
    outcome: 'failure'
  }));

  assert.deepEqual(snapshot.events[0], {
    id: 'accessory:workout-1:incline-db-press',
    source: 'accessory',
    date: '2026-10-23',
    exercise: 'incline-db-press',
    name: 'Incline DB Press',
    success: false,
    singleCompleted: false,
    weight: 25,
    unit: 'lb',
    weightLabel: '25 lb',
    sets: 1,
    reps: 5,
    outcome: 'failure',
    countsDay: true
  });
  assert.deepEqual(validateSnapshot(JSON.parse(JSON.stringify(snapshot)), 'accessory'), snapshot);
});

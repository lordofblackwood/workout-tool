import test from 'node:test';
import assert from 'node:assert/strict';

import {
  makeVolumeChart,
  nextPrescription,
  prescriptionAt,
  progressExercise
} from '../pwa/progression.mjs';

function exerciseAt(level, prescription = { sets: 1, reps: 5 }) {
  const levels = Array.from({ length: 11 }, (_, index) => `Level ${index}`);
  return {
    levels,
    baseIndex: 0,
    currentIndex: level,
    benchmarkIndex: level,
    volumeChart: makeVolumeChart(levels.length, prescription)
  };
}

function runningAt(speed, prescription = { sets: 1, reps: 5 }) {
  const levels = Array.from({ length: 15 }, (_, index) => `${3 + index * 0.5} mph`);
  const currentIndex = levels.indexOf(`${speed} mph`);
  return {
    levels,
    volumeUnit: 'minutes',
    baseIndex: 0,
    currentIndex,
    benchmarkIndex: currentIndex,
    volumeChart: makeVolumeChart(levels.length, prescription)
  };
}

function succeedUntil(exercise, targetLevel) {
  let next = exercise;
  while (next.currentIndex < targetLevel) next = progressExercise(next, 'success');
  return next;
}

test('the volume ladder advances sets before reps', () => {
  assert.deepEqual(nextPrescription({ sets: 1, reps: 5 }), { sets: 2, reps: 5 });
  assert.deepEqual(nextPrescription({ sets: 2, reps: 5 }), { sets: 3, reps: 5 });
  assert.deepEqual(nextPrescription({ sets: 3, reps: 5 }), { sets: 1, reps: 6 });
});

test('success one level below maximum reaches max without an off-by-one set increase', () => {
  const next = progressExercise(exerciseAt(9), 'success');
  assert.equal(next.currentIndex, 10);
  assert.deepEqual(prescriptionAt(next), { sets: 1, reps: 5 });
});

test('failed levels retain their prescription while the five-level corridor advances', () => {
  let next = progressExercise(exerciseAt(10), 'failure');
  assert.equal(next.currentIndex, 5);
  assert.deepEqual(prescriptionAt(next), { sets: 2, reps: 5 });
  assert.deepEqual(next.volumeChart[9], { sets: 2, reps: 5 });
  assert.deepEqual(next.volumeChart[10], { sets: 1, reps: 5 });

  next = succeedUntil(next, 9);
  assert.deepEqual(prescriptionAt(next), { sets: 2, reps: 5 });

  next = progressExercise(next, 'failure');
  assert.equal(next.currentIndex, 4);
  assert.deepEqual(prescriptionAt(next), { sets: 3, reps: 5 });
  assert.deepEqual(next.volumeChart[8], { sets: 3, reps: 5 });
  assert.deepEqual(next.volumeChart[9], { sets: 2, reps: 5 });
  assert.deepEqual(next.volumeChart[10], { sets: 1, reps: 5 });

  next = succeedUntil(next, 9);
  assert.deepEqual(prescriptionAt(next), { sets: 2, reps: 5 });

  const failedNineAgain = progressExercise(next, 'failure');
  assert.equal(failedNineAgain.currentIndex, 4);
  assert.deepEqual(prescriptionAt(failedNineAgain), { sets: 1, reps: 6 });
  assert.deepEqual(failedNineAgain.volumeChart[8], { sets: 1, reps: 6 });
  assert.deepEqual(failedNineAgain.volumeChart[9], { sets: 2, reps: 5 });

  next = progressExercise(next, 'success');
  assert.equal(next.currentIndex, 10);
  assert.deepEqual(prescriptionAt(next), { sets: 1, reps: 5 });

  next = progressExercise(next, 'failure');
  assert.equal(next.currentIndex, 5);
  assert.deepEqual(prescriptionAt(next), { sets: 3, reps: 5 });
  assert.deepEqual(next.volumeChart[9], { sets: 3, reps: 5 });
  assert.deepEqual(next.volumeChart[10], { sets: 1, reps: 5 });
});

test('success at physical maximum advances its volume and deloads five levels', () => {
  const next = progressExercise(exerciseAt(10), 'success');
  assert.equal(next.currentIndex, 5);
  assert.deepEqual(prescriptionAt(next), { sets: 2, reps: 5 });
  assert.deepEqual(next.volumeChart[10], { sets: 2, reps: 5 });
});

test('a base-level failure advances volume because no lower corridor exists', () => {
  const next = progressExercise(exerciseAt(0), 'failure');
  assert.equal(next.currentIndex, 0);
  assert.deepEqual(prescriptionAt(next), { sets: 2, reps: 5 });
});

test('progression returns a new chart and skip leaves prescriptions unchanged', () => {
  const original = exerciseAt(4);
  const skipped = progressExercise(original, 'skipped');
  assert.notEqual(skipped.volumeChart, original.volumeChart);
  assert.deepEqual(skipped.volumeChart, original.volumeChart);
  assert.equal(skipped.currentIndex, original.currentIndex);
});

test('running advances half a mile per hour and rebuilds below a failed speed', () => {
  let next = progressExercise(runningAt(5.5), 'success');
  assert.equal(next.levels[next.currentIndex], '6 mph');
  assert.deepEqual(prescriptionAt(next), { sets: 1, reps: 5 });

  next = progressExercise(next, 'failure');
  assert.equal(next.levels[next.currentIndex], '3.5 mph');
  assert.equal(next.volumeUnit, 'minutes');
  assert.deepEqual(prescriptionAt(next), { sets: 2, reps: 5 });
  assert.deepEqual(next.volumeChart.slice(1, 6), makeVolumeChart(5, { sets: 2, reps: 5 }));
  assert.deepEqual(next.volumeChart[6], { sets: 1, reps: 5 });

  next = succeedUntil(next, 6);
  assert.equal(next.levels[next.currentIndex], '6 mph');
  assert.deepEqual(prescriptionAt(next), { sets: 1, reps: 5 });
});

test('running failures stop at 3 mph and advance sets before minutes', () => {
  let next = progressExercise(runningAt(4), 'failure');
  assert.equal(next.levels[next.currentIndex], '3 mph');
  assert.deepEqual(prescriptionAt(next), { sets: 2, reps: 5 });
  assert.deepEqual(next.volumeChart[2], { sets: 1, reps: 5 });

  next = progressExercise(next, 'failure');
  assert.equal(next.levels[next.currentIndex], '3 mph');
  assert.deepEqual(prescriptionAt(next), { sets: 3, reps: 5 });

  next = progressExercise(next, 'failure');
  assert.equal(next.levels[next.currentIndex], '3 mph');
  assert.deepEqual(prescriptionAt(next), { sets: 1, reps: 6 });
});

test('completing 10 mph advances running volume and rebuilds from 7.5 mph', () => {
  const next = progressExercise(runningAt(10), 'success');
  assert.equal(next.levels[next.currentIndex], '7.5 mph');
  assert.equal(next.levels[next.benchmarkIndex], '10 mph');
  assert.deepEqual(prescriptionAt(next), { sets: 2, reps: 5 });
  assert.deepEqual(next.volumeChart[14], { sets: 2, reps: 5 });
});

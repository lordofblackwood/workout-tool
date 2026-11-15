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

function curlsAt55() {
  const levels = ['5 lb', '7.5 lb', '10 lb', '12.5 lb', '15 lb', '17.5 lb', '20 lb', '22.5 lb', '25 lb', '27.5 lb', '30 lb', '35 lb', '40 lb', '45 lb', '50 lb', '55 lb', '60 lb'];
  const volumeChart = makeVolumeChart(levels.length, { sets: 2, reps: 7 });
  volumeChart[13] = { sets: 3, reps: 6 };
  volumeChart[14] = { sets: 1, reps: 5 };
  volumeChart[15] = { sets: 1, reps: 5 };
  volumeChart[16] = { sets: 1, reps: 5 };
  return {
    levels,
    baseIndex: 0,
    currentIndex: 15,
    benchmarkIndex: 15,
    highestFailedIndex: 14,
    volumeChart
  };
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

test('first failure at 55 lb starts 30 lb 2x5 despite volume retained from earlier sticking points', () => {
  const original = curlsAt55();
  const snapshot = structuredClone(original);
  const next = progressExercise(original, 'failure');

  assert.equal(next.levels[next.currentIndex], '30 lb');
  assert.deepEqual(prescriptionAt(next), { sets: 2, reps: 5 });
  assert.deepEqual(next.volumeChart.slice(10, 15), makeVolumeChart(5, { sets: 2, reps: 5 }));
  assert.deepEqual(next.volumeChart.slice(0, 10), original.volumeChart.slice(0, 10));
  assert.deepEqual(next.volumeChart.slice(15), original.volumeChart.slice(15));
  assert.equal(next.highestFailedIndex, 15);
  assert.equal(next.benchmarkIndex, original.benchmarkIndex);
  assert.deepEqual(original, snapshot);
});

test('repeated 55 lb failures advance the rebuild and a newly reached 60 lb starts fresh again', () => {
  let next = progressExercise(curlsAt55(), 'failure');

  for (const prescription of [{ sets: 3, reps: 5 }, { sets: 1, reps: 6 }]) {
    next = succeedUntil(next, 15);
    assert.deepEqual(prescriptionAt(next), { sets: 1, reps: 5 });
    assert.equal(next.highestFailedIndex, 15);
    next = progressExercise(next, 'failure');
    assert.equal(next.levels[next.currentIndex], '30 lb');
    assert.deepEqual(next.volumeChart.slice(10, 15), makeVolumeChart(5, prescription));
  }

  next = succeedUntil(next, 16);
  assert.equal(next.levels[next.currentIndex], '60 lb');
  assert.equal(next.benchmarkIndex, 16);
  assert.equal(next.highestFailedIndex, 15);
  next = progressExercise(next, 'failure');
  assert.equal(next.levels[next.currentIndex], '35 lb');
  assert.deepEqual(next.volumeChart.slice(11, 16), makeVolumeChart(5, { sets: 2, reps: 5 }));
  assert.deepEqual(next.volumeChart[10], { sets: 1, reps: 6 });
  assert.deepEqual(next.volumeChart[16], { sets: 1, reps: 5 });
  assert.equal(next.highestFailedIndex, 16);
});

test('a new sticking point advances its own prescription instead of the lower weight prescription', () => {
  const original = curlsAt55();
  original.volumeChart[14] = { sets: 3, reps: 8 };
  original.volumeChart[15] = { sets: 2, reps: 6 };
  const next = progressExercise(original, 'failure');

  assert.deepEqual(next.volumeChart.slice(10, 15), makeVolumeChart(5, { sets: 3, reps: 6 }));
  assert.deepEqual(next.volumeChart[15], { sets: 2, reps: 6 });
});

test('new rebuilds respect a nonzero base and repeated failures keep advancing there', () => {
  const original = exerciseAt(4, { sets: 2, reps: 7 });
  original.baseIndex = 2;
  original.highestFailedIndex = 3;
  original.volumeChart[4] = { sets: 1, reps: 5 };
  let next = progressExercise(original, 'failure');

  assert.equal(next.currentIndex, 2);
  assert.deepEqual(next.volumeChart.slice(0, 2), original.volumeChart.slice(0, 2));
  assert.deepEqual(next.volumeChart.slice(2, 4), makeVolumeChart(2, { sets: 2, reps: 5 }));
  next = progressExercise(next, 'failure');
  assert.equal(next.currentIndex, 2);
  assert.deepEqual(prescriptionAt(next), { sets: 3, reps: 5 });
  assert.equal(next.highestFailedIndex, 4);
});

test('success and skip preserve failure tracking and skip preserves the current rebuild', () => {
  const original = curlsAt55();
  const skipped = progressExercise(original, 'skipped');
  assert.deepEqual(skipped, original);
  const succeeded = progressExercise(original, 'success');
  assert.equal(succeeded.currentIndex, 16);
  assert.equal(succeeded.highestFailedIndex, original.highestFailedIndex);
  assert.deepEqual(succeeded.volumeChart, original.volumeChart);
});

test('a new rebuild overwrites only the configured drop range', () => {
  const original = curlsAt55();
  const next = progressExercise(original, 'failure', 2);
  assert.equal(next.levels[next.currentIndex], '45 lb');
  assert.deepEqual(next.volumeChart.slice(0, 13), original.volumeChart.slice(0, 13));
  assert.deepEqual(next.volumeChart.slice(13, 15), makeVolumeChart(2, { sets: 2, reps: 5 }));
  assert.deepEqual(next.volumeChart.slice(15), original.volumeChart.slice(15));
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

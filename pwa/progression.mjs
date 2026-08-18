export const MAX_SETS = 3;
export const DEFAULT_PRESCRIPTION = Object.freeze({ sets: 1, reps: 5 });

export function normalizePrescription(value, fallback = DEFAULT_PRESCRIPTION) {
  const fallbackSets = integerBetween(fallback?.sets, 1, MAX_SETS, DEFAULT_PRESCRIPTION.sets);
  const fallbackReps = integerBetween(fallback?.reps, 1, 99, DEFAULT_PRESCRIPTION.reps);
  return {
    sets: integerBetween(value?.sets, 1, MAX_SETS, fallbackSets),
    reps: integerBetween(value?.reps, 1, 99, fallbackReps)
  };
}

export function makeVolumeChart(levelCount, initialPrescription = DEFAULT_PRESCRIPTION) {
  const length = Math.max(1, Number.isInteger(levelCount) ? levelCount : 1);
  const initial = normalizePrescription(initialPrescription);
  return Array.from({ length }, () => ({ ...initial }));
}

export function normalizeVolumeChart(value, levelCount, fallback = DEFAULT_PRESCRIPTION) {
  const chart = makeVolumeChart(levelCount, fallback);
  if (!Array.isArray(value)) return chart;
  return chart.map((entry, index) => normalizePrescription(value[index], entry));
}

export function prescriptionAt(exercise, levelIndex = exercise.currentIndex) {
  const chart = normalizeVolumeChart(exercise.volumeChart, exercise.levels?.length || exercise.volumeChart?.length || 1);
  return chart[clamp(levelIndex, 0, chart.length - 1)];
}

export function nextPrescription(value) {
  const prescription = normalizePrescription(value);
  return prescription.sets < MAX_SETS
    ? { sets: prescription.sets + 1, reps: prescription.reps }
    : { sets: 1, reps: Math.min(99, prescription.reps + 1) };
}

export function laterPrescription(left, right) {
  const a = normalizePrescription(left);
  const b = normalizePrescription(right);
  return prescriptionRank(a) >= prescriptionRank(b) ? a : b;
}

export function progressExercise(exercise, outcome, failureDropLevels = 5) {
  if (!['success', 'failure', 'skipped'].includes(outcome)) throw new TypeError(`Unknown outcome: ${outcome}`);

  const levelCount = Math.max(1, exercise.levels?.length || exercise.volumeChart?.length || 1);
  const max = levelCount - 1;
  const baseIndex = clamp(exercise.baseIndex, 0, max);
  const currentIndex = clamp(exercise.currentIndex, baseIndex, max);
  const benchmarkIndex = clamp(Math.max(exercise.benchmarkIndex, currentIndex), baseIndex, max);
  const volumeChart = normalizeVolumeChart(exercise.volumeChart, levelCount);
  const next = { ...exercise, baseIndex, currentIndex, benchmarkIndex, volumeChart };

  if (outcome === 'skipped') return next;

  const drop = Math.max(0, Number.isInteger(failureDropLevels) ? failureDropLevels : 5);
  const deloadIndex = Math.max(baseIndex, currentIndex - drop);

  if (outcome === 'failure') {
    const lowerReferenceIndex = currentIndex > baseIndex ? currentIndex - 1 : currentIndex;
    const rebuildingPrescription = nextPrescription(volumeChart[lowerReferenceIndex]);
    const corridorEnd = currentIndex > baseIndex ? currentIndex - 1 : currentIndex;
    raiseCorridor(volumeChart, deloadIndex, corridorEnd, rebuildingPrescription);
    next.currentIndex = deloadIndex;
    return next;
  }

  if (currentIndex < max) {
    next.currentIndex = currentIndex + 1;
    next.benchmarkIndex = Math.max(benchmarkIndex, next.currentIndex);
    return next;
  }

  const nextMaximumPrescription = nextPrescription(volumeChart[currentIndex]);
  raiseCorridor(volumeChart, deloadIndex, currentIndex, nextMaximumPrescription);
  next.currentIndex = deloadIndex;
  next.benchmarkIndex = max;
  return next;
}

function raiseCorridor(chart, startIndex, endIndex, prescription) {
  for (let index = startIndex; index <= endIndex; index += 1) {
    chart[index] = laterPrescription(chart[index], prescription);
  }
}

function prescriptionRank(value) {
  const prescription = normalizePrescription(value);
  return ((prescription.reps - 1) * MAX_SETS) + prescription.sets - 1;
}

function integerBetween(value, min, max, fallback) {
  return Number.isInteger(value) ? clamp(value, min, max) : fallback;
}

function clamp(value, min, max) {
  const numeric = Number.isInteger(value) ? value : min;
  return Math.max(min, Math.min(numeric, max));
}

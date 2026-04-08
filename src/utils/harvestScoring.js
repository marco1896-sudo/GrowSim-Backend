function clamp(value, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function roundScore(value) {
  return Math.round(clamp(value) * 10) / 10;
}

function getByPath(source, path) {
  if (!source || typeof source !== 'object') return undefined;

  return path.split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return acc[key];
  }, source);
}

function numberFromPath(source, path) {
  const value = getByPath(source, path);
  return Number.isFinite(value) ? value : undefined;
}

function firstNumber(source, paths) {
  for (const path of paths) {
    const value = numberFromPath(source, path);
    if (Number.isFinite(value)) return value;
  }

  return undefined;
}

function normalizeSignal(value, scale = 100) {
  if (!Number.isFinite(value)) return undefined;
  if (scale <= 0) return undefined;
  return clamp((value / scale) * 100);
}

function weightedAverage(entries, fallback = 50) {
  const usable = entries.filter((entry) => Number.isFinite(entry.value) && Number.isFinite(entry.weight) && entry.weight > 0);
  if (usable.length === 0) return fallback;

  const totalWeight = usable.reduce((sum, entry) => sum + entry.weight, 0);
  const totalValue = usable.reduce((sum, entry) => sum + entry.value * entry.weight, 0);
  return totalValue / totalWeight;
}

function countTelemetryEvents(telemetry) {
  if (!telemetry || typeof telemetry !== 'object') return 0;
  if (Array.isArray(telemetry.events)) return telemetry.events.length;
  if (Array.isArray(telemetry.samples)) return telemetry.samples.length;
  if (Array.isArray(telemetry.timeline)) return telemetry.timeline.length;
  return 0;
}

function challengeCoverage(summary, declaredChallenges) {
  if (!Array.isArray(declaredChallenges) || declaredChallenges.length === 0) return 0;

  const completed = firstNumber(summary, [
    'completedChallenges',
    'challenge.completed',
    'challengeProgress.completed',
    'challenges.completed'
  ]);

  const normalizedCompleted = Number.isFinite(completed) ? clamp((completed / declaredChallenges.length) * 100) : 0;
  const challengeBreadth = clamp((declaredChallenges.length / 5) * 100);

  return weightedAverage(
    [
      { value: normalizedCompleted, weight: 0.7 },
      { value: challengeBreadth, weight: 0.3 }
    ],
    0
  );
}

export function computeHarvestResult({ clientSummary, telemetry, declaredChallenges }) {
  const yieldSignals = [
    normalizeSignal(firstNumber(clientSummary, ['yieldUnits', 'harvest.yieldUnits', 'harvest.totalYield']), 250),
    normalizeSignal(firstNumber(clientSummary, ['yieldKg', 'harvest.yieldKg']), 25),
    firstNumber(clientSummary, ['yieldScore', 'scores.yield', 'harvest.yieldScore']),
    normalizeSignal(firstNumber(telemetry, ['outputs.harvestedUnits', 'harvest.harvestedUnits']), 250)
  ];

  const qualitySignals = [
    firstNumber(clientSummary, ['qualityScore', 'scores.quality', 'harvest.qualityScore']),
    normalizeSignal(firstNumber(clientSummary, ['quality', 'harvest.quality', 'qualityAverage']), 1),
    normalizeSignal(firstNumber(clientSummary, ['qualityPercent', 'harvest.qualityPercent']), 100)
  ];

  const stabilitySignals = [
    firstNumber(clientSummary, ['stabilityScore', 'scores.stability', 'harvest.stabilityScore']),
    normalizeSignal(firstNumber(clientSummary, ['stability', 'plantStability', 'harvest.stability']), 1),
    normalizeSignal(firstNumber(telemetry, ['stability.average', 'environment.stability']), 1)
  ];

  const efficiencySignals = [
    firstNumber(clientSummary, ['efficiencyScore', 'scores.efficiency', 'harvest.efficiencyScore']),
    normalizeSignal(firstNumber(clientSummary, ['efficiency', 'resourceEfficiency']), 1),
    normalizeSignal(firstNumber(telemetry, ['resources.efficiency', 'efficiency']), 1)
  ];

  const yieldScore = weightedAverage(
    yieldSignals.map((value) => ({ value, weight: 1 })),
    45
  );
  const qualityScore = weightedAverage(
    qualitySignals.map((value) => ({ value, weight: 1 })),
    50
  );
  const stabilityScore = weightedAverage(
    stabilitySignals.map((value) => ({ value, weight: 1 })),
    50
  );
  const efficiencyScore = weightedAverage(
    efficiencySignals.map((value) => ({ value, weight: 1 })),
    48
  );
  const challengeScore = challengeCoverage(clientSummary, declaredChallenges);

  const yieldSoftCapFactor = 0.55 + 0.45 * ((qualityScore + stabilityScore) / 200);
  const effectiveYieldScore = clamp(yieldScore * yieldSoftCapFactor);

  const harvestScore = weightedAverage(
    [
      { value: effectiveYieldScore, weight: 0.28 },
      { value: qualityScore, weight: 0.24 },
      { value: stabilityScore, weight: 0.2 },
      { value: efficiencyScore, weight: 0.18 },
      { value: challengeScore, weight: 0.1 }
    ],
    0
  );

  return {
    harvestScore: roundScore(harvestScore),
    yieldScore: roundScore(effectiveYieldScore),
    qualityScore: roundScore(qualityScore),
    stabilityScore: roundScore(stabilityScore),
    efficiencyScore: roundScore(efficiencyScore),
    challengeScore: roundScore(challengeScore)
  };
}

export function summarizeTelemetry(telemetry) {
  return {
    eventCount: countTelemetryEvents(telemetry)
  };
}

export { clamp, roundScore };

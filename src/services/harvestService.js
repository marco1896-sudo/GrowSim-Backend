import { RunSession } from '../models/RunSession.js';
import { RunSubmission } from '../models/RunSubmission.js';
import { RunVerification } from '../models/RunVerification.js';
import { createPrefixedId } from '../utils/idGenerator.js';
import { computeHarvestResult, summarizeTelemetry } from '../utils/harvestScoring.js';
import { httpError } from '../utils/httpError.js';
import { User } from '../models/User.js';
import { materializeVerifiedLeaderboardEntries } from './leaderboardService.js';

const MAX_RUN_DURATION_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_FUTURE_SKEW_MS = 1000 * 60 * 5;
const MAX_CHALLENGES = 25;

function cloneObject(input) {
  if (!input || typeof input !== 'object') return {};
  return JSON.parse(JSON.stringify(input));
}

function hasMeaningfulHashPayload(clientHashes) {
  return Object.values(clientHashes || {}).some((value) => typeof value === 'string' && value.trim().length >= 8);
}

function collectNumericValues(value, bucket = []) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    bucket.push(value);
    return bucket;
  }

  if (!value || typeof value !== 'object') return bucket;

  for (const entry of Object.values(value)) {
    collectNumericValues(entry, bucket);
  }

  return bucket;
}

function buildVerificationDecision({ session, payload }) {
  const anomalyFlags = [];
  const validationNotes = [];
  const now = Date.now();
  const endedAt = new Date(payload.endedAt);
  const startedAt = session.startedAt ? new Date(session.startedAt) : null;

  if (Number.isNaN(endedAt.getTime())) {
    throw httpError(400, 'endedAt must be a valid ISO date string', null, 'invalid_payload');
  }

  if (endedAt.getTime() > now + MAX_FUTURE_SKEW_MS) {
    throw httpError(422, 'endedAt is implausibly far in the future', null, 'validation_failed');
  }

  if (startedAt && endedAt.getTime() < startedAt.getTime()) {
    throw httpError(422, 'endedAt cannot be before startedAt', null, 'validation_failed');
  }

  if (startedAt) {
    const durationMs = endedAt.getTime() - startedAt.getTime();
    if (durationMs > MAX_RUN_DURATION_MS) {
      anomalyFlags.push('duration_too_long');
      validationNotes.push('Run duration exceeds the initial server-side plausibility window');
    }
  }

  if (!hasMeaningfulHashPayload(payload.clientHashes)) {
    anomalyFlags.push('missing_hash_coverage');
    validationNotes.push('Client hashes did not provide any strong verification signal');
  }

  if (!Array.isArray(payload.declaredChallenges) || payload.declaredChallenges.length > MAX_CHALLENGES) {
    throw httpError(422, 'declaredChallenges must contain between 0 and 25 entries', null, 'validation_failed');
  }

  const telemetrySummary = summarizeTelemetry(payload.telemetry);
  if (telemetrySummary.eventCount === 0) {
    anomalyFlags.push('telemetry_sparse');
    validationNotes.push('Telemetry is present but does not include event or sample arrays');
  }

  const numericValues = collectNumericValues(payload.clientSummary);
  if (numericValues.some((value) => Math.abs(value) > 1000000)) {
    anomalyFlags.push('extreme_client_summary_values');
    validationNotes.push('At least one numeric client summary value exceeded the extreme-value safety cap');
  }

  const authoritativeResult = computeHarvestResult({
    clientSummary: payload.clientSummary,
    telemetry: payload.telemetry,
    declaredChallenges: payload.declaredChallenges
  });

  if (authoritativeResult.harvestScore <= 5 && payload.endReason === 'completed') {
    anomalyFlags.push('completed_with_negligible_harvest');
    validationNotes.push('Completed run produced an unexpectedly low harvest result');
  }

  let status = 'verified';
  let confidence = 0.92;

  if (anomalyFlags.includes('extreme_client_summary_values')) {
    status = 'rejected';
    confidence = 0.08;
    validationNotes.push('Submission rejected because client summary values exceeded the hard plausibility boundary');
  } else if (anomalyFlags.length >= 2) {
    status = 'under_review';
    confidence = 0.42;
  } else if (anomalyFlags.length === 1) {
    status = 'provisional';
    confidence = 0.68;
  }

  const reviewNeeded = status === 'under_review';

  return {
    status,
    confidence,
    reviewNeeded,
    anomalyFlags,
    validationNotes,
    provisionalResult: status === 'verified' ? authoritativeResult : authoritativeResult,
    verifiedResult: status === 'verified' ? authoritativeResult : null
  };
}

function toRunSessionResponse(session) {
  return {
    sessionId: session.sessionId,
    createdAt: session.createdAt,
    status: session.status
  };
}

function toSubmissionResponse(submission, verification) {
  return {
    submissionId: submission.submissionId,
    status: verification.verificationStatus,
    leaderboardEligible: verification.verificationStatus === 'verified',
    result: verification.verifiedResult || verification.provisionalResult || null,
    anomalyFlags: verification.anomalyFlags || [],
    reviewNeeded: Boolean(verification.reviewNeeded),
    updatedAt: verification.updatedAt || submission.updatedAt
  };
}

export async function createRunSession({ userId, payload }) {
  const session = await RunSession.create({
    sessionId: createPrefixedId('rsn'),
    userId,
    startedAt: payload.startedAt ? new Date(payload.startedAt) : null,
    status: 'active',
    declaredSetup: cloneObject(payload.declaredSetup || {}),
    declaredChallenges: Array.isArray(payload.declaredChallenges) ? cloneObject(payload.declaredChallenges) : [],
    clientVersion: payload.clientVersion
  });

  return toRunSessionResponse(session);
}

export async function submitRun({ userId, payload }) {
  const session = await RunSession.findOne({ sessionId: payload.sessionId });

  if (!session) {
    throw httpError(404, 'Run session not found', null, 'session_not_found');
  }

  if (String(session.userId) !== String(userId)) {
    throw httpError(403, 'Run session is not owned by the authenticated user', null, 'session_not_owned');
  }

  const existingSubmission = await RunSubmission.findOne({ sessionId: payload.sessionId }).lean();
  if (existingSubmission) {
    throw httpError(409, 'Run session was already submitted', null, 'duplicate_submission');
  }

  const verificationDecision = buildVerificationDecision({ session, payload });

  const submission = await RunSubmission.create({
    submissionId: createPrefixedId('sub'),
    sessionId: payload.sessionId,
    userId,
    endedAt: new Date(payload.endedAt),
    endReason: payload.endReason,
    clientVersion: payload.clientVersion,
    declaredSetup: cloneObject(payload.declaredSetup),
    declaredChallenges: cloneObject(payload.declaredChallenges),
    clientSummary: cloneObject(payload.clientSummary),
    telemetry: cloneObject(payload.telemetry),
    clientHashes: cloneObject(payload.clientHashes),
    status: verificationDecision.status
  });

  const verification = await RunVerification.create({
    submissionId: submission.submissionId,
    verificationStatus: verificationDecision.status,
    provisionalResult: verificationDecision.provisionalResult,
    verifiedResult: verificationDecision.verifiedResult,
    anomalyFlags: verificationDecision.anomalyFlags,
    confidence: verificationDecision.confidence,
    reviewNeeded: verificationDecision.reviewNeeded,
    validationNotes: verificationDecision.validationNotes
  });

  if (verificationDecision.status === 'verified') {
    const user = await User.findById(userId).select('_id email displayName').lean();
    await materializeVerifiedLeaderboardEntries({
      submission,
      verification,
      user
    });
  }

  session.status = verificationDecision.status === 'verified' ? 'verified' : verificationDecision.status === 'rejected' ? 'rejected' : verificationDecision.status === 'under_review' ? 'under_review' : 'submitted';
  await session.save();

  return toSubmissionResponse(submission, verification);
}

export async function getRunSubmission({ submissionId, userId }) {
  const submission = await RunSubmission.findOne({ submissionId }).lean();

  if (!submission || String(submission.userId) !== String(userId)) {
    throw httpError(404, 'Run submission not found', null, 'submission_not_found');
  }

  const verification = await RunVerification.findOne({ submissionId }).lean();

  if (!verification) {
    throw httpError(404, 'Run submission not found', null, 'submission_not_found');
  }

  return toSubmissionResponse(submission, verification);
}

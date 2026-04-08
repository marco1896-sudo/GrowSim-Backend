import { createRunSession, submitRun, getRunSubmission } from '../services/harvestService.js';

export async function createRunSessionHandler(req, res, next) {
  try {
    const session = await createRunSession({
      userId: req.auth.userId,
      payload: req.body || {}
    });

    return res.status(201).json(session);
  } catch (err) {
    return next(err);
  }
}

export async function submitRunHandler(req, res, next) {
  try {
    const submission = await submitRun({
      userId: req.auth.userId,
      payload: req.body || {}
    });

    return res.status(201).json(submission);
  } catch (err) {
    return next(err);
  }
}

export async function getRunSubmissionHandler(req, res, next) {
  try {
    const submission = await getRunSubmission({
      submissionId: req.params.submissionId,
      userId: req.auth.userId
    });

    return res.json(submission);
  } catch (err) {
    return next(err);
  }
}

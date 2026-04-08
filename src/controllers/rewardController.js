import { claimRewardGrant, getRewards, getRewardSummary } from '../services/rewardService.js';

export async function getRewardsHandler(req, res, next) {
  try {
    const rewards = await getRewards({ userId: req.auth.userId });
    return res.json(rewards);
  } catch (err) {
    return next(err);
  }
}

export async function getRewardSummaryHandler(req, res, next) {
  try {
    const summary = await getRewardSummary({ userId: req.auth.userId });
    return res.json(summary);
  } catch (err) {
    return next(err);
  }
}

export async function claimRewardGrantHandler(req, res, next) {
  try {
    const claimResult = await claimRewardGrant({
      userId: req.auth.userId,
      grantId: req.params.grantId
    });
    return res.json(claimResult);
  } catch (err) {
    return next(err);
  }
}

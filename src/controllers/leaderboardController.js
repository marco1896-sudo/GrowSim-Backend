import {
  getLeaderboard,
  getLeaderboardAroundMe,
  getMyLeaderboardPlacement
} from '../services/leaderboardService.js';

export async function getLeaderboardHandler(req, res, next) {
  try {
    const leaderboard = await getLeaderboard({
      scope: req.query.scope,
      category: req.query.category,
      limit: req.query.limit ? Number(req.query.limit) : 25
    });

    return res.json(leaderboard);
  } catch (err) {
    return next(err);
  }
}

export async function getLeaderboardAroundMeHandler(req, res, next) {
  try {
    const leaderboard = await getLeaderboardAroundMe({
      scope: req.query.scope,
      category: req.query.category,
      userId: req.auth.userId
    });

    return res.json(leaderboard);
  } catch (err) {
    return next(err);
  }
}

export async function getMyLeaderboardPlacementHandler(req, res, next) {
  try {
    const placement = await getMyLeaderboardPlacement({
      scope: req.query.scope,
      category: req.query.category,
      userId: req.auth.userId
    });

    return res.json(placement);
  } catch (err) {
    return next(err);
  }
}

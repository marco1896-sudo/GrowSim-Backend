import { Save } from '../models/Save.js';

export async function getSave(req, res, next) {
  try {
    const slot = (req.query.slot || 'main').toString();
    const save = await Save.findOne({ userId: req.auth.userId, slot });

    if (!save) {
      return res.json({
        slot,
        hasSave: false,
        state: null,
        updatedAt: null
      });
    }

    return res.json({
      slot: save.slot,
      hasSave: true,
      state: save.state,
      updatedAt: save.updatedAt,
      createdAt: save.createdAt
    });
  } catch (err) {
    return next(err);
  }
}

export async function upsertSave(req, res, next) {
  try {
    const slot = (req.body.slot || 'main').toString();
    const { state } = req.body;

    const save = await Save.findOneAndUpdate(
      { userId: req.auth.userId, slot },
      { $set: { state } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      message: 'Save stored successfully',
      slot: save.slot,
      updatedAt: save.updatedAt
    });
  } catch (err) {
    return next(err);
  }
}

const express = require('express');
const User = require('../models/user');
const Task = require('../models/Task');
const { buildQueryParams } = require('../utils/buildQuery');

const router = express.Router();
const ok = (res, data, message = 'OK', status = 200) =>
  res.status(status).json({ message, data });

// GET /users
router.get('/', async (req, res, next) => {
  try {
    const { where, sort, select, skip, limit, count } = buildQueryParams(req, { defaultLimit: undefined });
    if (count) {
      const n = await User.countDocuments(where);
      return ok(res, n);
    }
    let q = User.find(where);
    if (select) q = q.select(select);
    if (sort) q = q.sort(sort);
    if (skip !== undefined) q = q.skip(skip);
    if (limit !== undefined) q = q.limit(limit);
    return ok(res, await q.exec());
  } catch (err) { next(err); }
});

// POST /users
router.post('/', async (req, res, next) => {
  try {
    const { name, email, pendingTasks = [] } = req.body || {};
    if (!name || !email) { const e = new Error('name and email are required'); e.status = 400; throw e; }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) { const e = new Error('email already exists'); e.status = 400; throw e; }

    const user = await User.create({ name, email, pendingTasks: [] });

    if (Array.isArray(pendingTasks) && pendingTasks.length) {
      await syncUserPendingTasks(user, pendingTasks);
    }

    return ok(res, await User.findById(user._id), 'User created', 201);
  } catch (err) {
    if (err.code === 11000) { err.status = 400; err.publicMessage = 'email already exists'; }
    next(err);
  }
});

// GET /users/:id (supports select)
router.get('/:id', async (req, res, next) => {
  try {
    const select = req.query.select ? JSON.parse(req.query.select) : undefined;
    const doc = await User.findById(req.params.id).select(select || undefined);
    if (!doc) { const e = new Error('user not found'); e.status = 404; throw e; }
    return ok(res, doc);
  } catch (err) {
    if (err.name === 'SyntaxError') { err.status = 400; err.publicMessage = 'Invalid JSON for \'select\''; }
    next(err);
  }
});

// PUT /users/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { name, email, pendingTasks = [] } = req.body || {};
    if (!name || !email) { const e = new Error('name and email are required'); e.status = 400; throw e; }

    const dupe = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: req.params.id } });
    if (dupe) { const e = new Error('email already exists'); e.status = 400; throw e; }

    const user = await User.findById(req.params.id);
    if (!user) { const e = new Error('user not found'); e.status = 404; throw e; }

    user.name = name;
    user.email = email.toLowerCase().trim();
    await user.save();
    await syncUserPendingTasks(user, Array.isArray(pendingTasks) ? pendingTasks : []);
    return ok(res, await User.findById(user._id), 'User updated');
  } catch (err) { next(err); }
});

// DELETE /users/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) { const e = new Error('user not found'); e.status = 404; throw e; }

    const tasks = await Task.find({ assignedUser: String(user._id), completed: false });
    await Promise.all(tasks.map(t => { t.assignedUser = ''; t.assignedUserName = 'unassigned'; return t.save(); }));
    await user.deleteOne();
    return res.status(204).send();
  } catch (err) { next(err); }
});

async function syncUserPendingTasks(user, newPendingIds) {
  const ids = [...new Set(newPendingIds.map(String))];
  const tasks = await Task.find({ _id: { $in: ids } });
  if (tasks.length !== ids.length) { const e = new Error('one or more pendingTasks are invalid task ids'); e.status = 400; throw e; }

  const currentAssigned = await Task.find({ assignedUser: String(user._id) });
  await Promise.all(
    currentAssigned.filter(t => !ids.includes(String(t._id)))
      .map(t => { t.assignedUser = ''; t.assignedUserName = 'unassigned'; return t.save(); })
  );

  await Promise.all(
    tasks.map(t => { t.assignedUser = String(user._id); t.assignedUserName = user.name; t.completed = false; return t.save(); })
  );

  user.pendingTasks = ids;
  await user.save();
}

module.exports = router;

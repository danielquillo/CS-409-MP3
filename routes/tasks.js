const express = require('express');
const Task = require('../models/Task');
const User = require('../models/user');
const { buildQueryParams } = require('../utils/buildQuery');

const router = express.Router();
const ok = (res, data, message = 'OK', status = 200) =>
  res.status(status).json({ message, data });

// GET /tasks
router.get('/', async (req, res, next) => {
  try {
    const { where, sort, select, skip, limit, count } = buildQueryParams(req, { defaultLimit: 100 });
    if (count) {
      const n = await Task.countDocuments(where);
      return ok(res, n);
    }
    let q = Task.find(where);
    if (select) q = q.select(select);
    if (sort) q = q.sort(sort);
    if (skip !== undefined) q = q.skip(skip);
    if (limit !== undefined) q = q.limit(limit);
    return ok(res, await q.exec());
  } catch (err) { next(err); }
});

// POST /tasks
router.post('/', async (req, res, next) => {
  try {
    const { name, description = '', deadline, completed = false, assignedUser = '', assignedUserName } = req.body || {};
    if (!name || !deadline) { const e = new Error('name and deadline are required'); e.status = 400; throw e; }
    let user = null;
    if (assignedUser) {
      user = await User.findById(assignedUser);
      if (!user) { const e = new Error('assignedUser does not exist'); e.status = 400; throw e; }
    }
    const task = await Task.create({
      name, description, deadline,
      completed: Boolean(completed),
      assignedUser: user ? String(user._id) : '',
      assignedUserName: user ? user.name : (assignedUserName || 'unassigned'),
    });

    if (user && !task.completed) {
      if (!user.pendingTasks.includes(String(task._id))) {
        user.pendingTasks.push(String(task._id));
        await user.save();
      }
    }
    return ok(res, await Task.findById(task._id), 'Task created', 201);
  } catch (err) { next(err); }
});

// GET /tasks/:id (supports select)
router.get('/:id', async (req, res, next) => {
  try {
    const select = req.query.select ? JSON.parse(req.query.select) : undefined;
    const doc = await Task.findById(req.params.id).select(select || undefined);
    if (!doc) { const e = new Error('task not found'); e.status = 404; throw e; }
    return ok(res, doc);
  } catch (err) {
    if (err.name === 'SyntaxError') { err.status = 400; err.publicMessage = 'Invalid JSON for \'select\''; }
    next(err);
  }
});

// PUT /tasks/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { name, description = '', deadline, completed = false, assignedUser = '', assignedUserName } = req.body || {};
    if (!name || !deadline) { const e = new Error('name and deadline are required'); e.status = 400; throw e; }

    const task = await Task.findById(req.params.id);
    if (!task) { const e = new Error('task not found'); e.status = 404; throw e; }

    const prevUserId = task.assignedUser || '';

    let newUser = null;
    if (assignedUser) {
      newUser = await User.findById(assignedUser);
      if (!newUser) { const e = new Error('assignedUser does not exist'); e.status = 400; throw e; }
    }

    task.name = name;
    task.description = description;
    task.deadline = deadline;
    task.completed = Boolean(completed);
    task.assignedUser = newUser ? String(newUser._id) : '';
    task.assignedUserName = newUser ? newUser.name : (assignedUserName || 'unassigned');
    await task.save();

    if (prevUserId && prevUserId !== String(task.assignedUser)) {
      const prev = await User.findById(prevUserId);
      if (prev) {
        prev.pendingTasks = prev.pendingTasks.filter(id => id !== String(task._id));
        await prev.save();
      }
    }
    if (newUser) {
      if (!task.completed) {
        if (!newUser.pendingTasks.includes(String(task._id))) newUser.pendingTasks.push(String(task._id));
      } else {
        newUser.pendingTasks = newUser.pendingTasks.filter(id => id !== String(task._id));
      }
      await newUser.save();
    }
    if (!newUser || task.completed) {
      const maybePrev = await User.findOne({ pendingTasks: String(task._id) });
      if (maybePrev) {
        maybePrev.pendingTasks = maybePrev.pendingTasks.filter(id => id !== String(task._id));
        await maybePrev.save();
      }
    }
    return ok(res, await Task.findById(task._id), 'Task updated');
  } catch (err) { next(err); }
});

// DELETE /tasks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) { const e = new Error('task not found'); e.status = 404; throw e; }

    if (task.assignedUser) {
      const user = await User.findById(task.assignedUser);
      if (user) {
        user.pendingTasks = user.pendingTasks.filter(id => id !== String(task._id));
        await user.save();
      }
    }
    await task.deleteOne();
    return res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;

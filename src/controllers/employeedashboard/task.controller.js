const { Task } = require('../../models/employeedashboard/index');

exports.getMyTasks = async (req, res) => {
  try {
    const { status, date, brand, client } = req.query;
    const filter = { assignedTo: req.user.id };

    if (status) filter.status = status;
    if (brand) filter.brandName = brand;
    if (client) filter.clientName = client;
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      filter.dueDate = { $gte: start, $lt: end };
    }

    const tasks = await Task.find(filter).sort({ dueDate: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, assignedTo: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.submitTask = async (req, res) => {
  try {
    const { deliveryState, remarks, startedAt } = req.body;

    if (!deliveryState || !remarks)
      return res.status(400).json({ message: 'Delivery state and remarks are required' });

    const task = await Task.findOne({ _id: req.params.id, assignedTo: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (!['pending', 'changes_requested'].includes(task.status))
      return res.status(400).json({ message: 'Task cannot be submitted in its current state' });

    task.deliveryState = deliveryState;
    task.remarks = remarks;
    task.startedAt = startedAt ? new Date(startedAt) : task.startedAt;
    task.submittedAt = new Date();
    task.completedAt = new Date();
    task.status = 'completed';

    await task.save();
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.respondToChanges = async (req, res) => {
  try {
    const { responses, deliveryState, remarks } = req.body;
    // responses: [{ id: changeRequestId, response: string }]

    if (!responses || !Array.isArray(responses) || responses.length === 0)
      return res.status(400).json({ message: 'Responses are required' });

    const task = await Task.findOne({ _id: req.params.id, assignedTo: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (task.status !== 'changes_requested')
      return res.status(400).json({ message: 'No changes requested on this task' });

    task.changeRequests = task.changeRequests.map((cr) => {
      const match = responses.find((r) => r.id === cr._id.toString());
      if (match) {
        cr.employeeResponse = match.response;
        cr.remarks = match.remarks || [];
        cr.resolved = true;
      }
      return cr;
    });

    task.deliveryState = deliveryState;
    task.remarks = remarks;
    task.submittedAt = new Date();
    task.status = 'pending';

    await task.save();
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getTaskHistory = async (req, res) => {
  try {
    const { status, brand, client, delivery, dateFrom, dateTo, hasChanges } = req.query;
    const filter = { assignedTo: req.user.id };

    if (status) filter.status = status;
    if (brand) filter.brandName = brand;
    if (client) filter.clientName = client;
    if (delivery) filter.deliveryState = delivery;
    if (dateFrom || dateTo) {
      filter.dueDate = {};
      if (dateFrom) filter.dueDate.$gte = new Date(dateFrom);
      if (dateTo) filter.dueDate.$lte = new Date(dateTo);
    }
    if (hasChanges === 'true') filter['changeRequests.0'] = { $exists: true };
    if (hasChanges === 'false') filter['changeRequests.0'] = { $exists: false };

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      Task.find(filter).sort({ dueDate: -1 }).skip(skip).limit(limit),
      Task.countDocuments(filter),
    ]);

    res.json({
      tasks,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
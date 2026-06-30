const Task = require("../../models/superadmindashboard/Task");

// ─── Populate helper ─────────────────────────────────────────────────────────
const populateTask = (query) =>
  query
    .populate("assignedTo", "name employeeId department role")
    .populate("brandId", "name");

// ─── CREATE ───────────────────────────────────────────────────────────────────
exports.createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, assignedBy, brandId, frequency, dueDate } = req.body;

    if (!title || !assignedTo || !assignedBy)
      return res.status(400).json({ success: false, message: "title, assignedTo, and assignedBy are required" });

    const task = await Task.create({
      title,
      description: description || "",
      assignedTo,
      assignedBy,
      brandId: brandId || null,
      frequency: frequency || "one_time",
      dueDate: dueDate || "",
      status: "pending",
      deliveryStatus: "not_delivered",
      changes: [],
    });

    const populated = await populateTask(Task.findById(task._id));
    res.status(201).json({ success: true, message: "Task created successfully", data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET ALL ──────────────────────────────────────────────────────────────────
// For employee: automatically filters by their own ID from JWT
// For superadmin: can pass ?assignedTo=id or see all
exports.getTasks = async (req, res) => {
  try {
    const filter = {};

    // If employee role — only show their own tasks
    if (req.user?.role === 'employee') {
      filter.assignedTo = req.user.id;
    } else if (req.query.assignedTo) {
      filter.assignedTo = req.query.assignedTo;
    }

    // Optional filters
    if (req.query.status) filter.status = req.query.status;
    if (req.query.brand)  filter.brandId = req.query.brand;
    if (req.query.date)   filter.dueDate = req.query.date;

    const tasks = await populateTask(Task.find(filter).sort({ createdAt: -1 }));
    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET ONE ──────────────────────────────────────────────────────────────────
exports.getTask = async (req, res) => {
  try {
    const task = await populateTask(Task.findById(req.params.id));
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────
exports.updateTask = async (req, res) => {
  try {
    const { title, description, assignedTo, brandId, frequency, dueDate, status, rejectRemark } = req.body;

    const updateFields = {};
    if (title !== undefined)        updateFields.title = title;
    if (description !== undefined)  updateFields.description = description;
    if (assignedTo !== undefined)   updateFields.assignedTo = assignedTo;
    if (brandId !== undefined)      updateFields.brandId = brandId || null;
    if (frequency !== undefined)    updateFields.frequency = frequency;
    if (dueDate !== undefined)      updateFields.dueDate = dueDate;
    if (status !== undefined)       updateFields.status = status;
    if (rejectRemark !== undefined) updateFields.rejectRemark = rejectRemark;

    const task = await populateTask(
      Task.findByIdAndUpdate(req.params.id, updateFields, { new: true, runValidators: true })
    );

    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    res.json({ success: true, message: "Task updated successfully", data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── SUBMIT (employee submits their task) ─────────────────────────────────────
// POST /api/employee/tasks/:id/submit
// Body: { deliveryState, deliveryNote, startedAt }
exports.submitTask = async (req, res) => {
  try {
    const { deliveryState, deliveryNote, startedAt } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    task.deliveryStatus = deliveryState === 'delivered' ? 'delivered' : 'not_delivered';
    task.deliveryNote   = deliveryNote || '';
    task.deliveredAt    = new Date().toISOString().split('T')[0];
    task.status         = 'completed';

    task.changes.push({
      changedBy: req.user?.name || 'Employee',
      note: `Task submitted. ${deliveryNote ? 'Note: ' + deliveryNote : ''}`.trim(),
      changedAt: new Date().toISOString().split('T')[0],
    });

    await task.save();
    const populated = await populateTask(Task.findById(task._id));
    res.json({ success: true, message: "Task submitted successfully", data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── RESPOND TO CHANGES (employee responds to admin change requests) ───────────
// POST /api/employee/tasks/:id/respond
// Body: { deliveryState, remarks, responses: [{ id, response }] }
exports.respondToChanges = async (req, res) => {
  try {
    const { deliveryState, remarks, responses } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    // Apply employee responses to matching change entries by _id
    if (Array.isArray(responses)) {
      responses.forEach(({ id, response }) => {
        const change = task.changes.id(id);
        if (change) {
          change.employeeResponse = response;
          change.resolved = true;
        }
      });
    }

    task.deliveryStatus = deliveryState === 'delivered' ? 'delivered' : 'not_delivered';
    task.deliveryNote   = remarks || '';
    task.deliveredAt    = new Date().toISOString().split('T')[0];
    task.status         = 'completed';

    await task.save();
    const populated = await populateTask(Task.findById(task._id));
    res.json({ success: true, message: "Changes responded successfully", data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DASHBOARD STATS (employee) ───────────────────────────────────────────────
// GET /api/employee/stats
exports.getDashboardStats = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const allTasks   = await Task.find({ assignedTo: employeeId });

    const today    = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStr  = weekStart.toISOString().split('T')[0];
    const monthStr = today.slice(0, 7); // "YYYY-MM"

    const count = (pred) => allTasks.filter(pred).length;

    res.json({
      success: true,
      overall: {
        totalAssigned:     allTasks.length,
        pending:           count(t => t.status === 'pending'),
        changes_requested: count(t => t.status === 'changes_requested'),
        completed:         count(t => t.status === 'completed'),
        approved:          count(t => t.status === 'approved'),
        notDelivered:      count(t => t.deliveryStatus === 'not_delivered'),
      },
      today: {
        total:     count(t => t.dueDate === today),
        completed: count(t => t.dueDate === today && t.status === 'completed'),
      },
      thisWeek: {
        total:     count(t => t.dueDate >= weekStr),
        completed: count(t => t.dueDate >= weekStr && t.status === 'completed'),
      },
      thisMonth: {
        total:     count(t => t.dueDate?.startsWith(monthStr)),
        completed: count(t => t.dueDate?.startsWith(monthStr) && t.status === 'completed'),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELIVER ──────────────────────────────────────────────────────────────────
exports.deliverTask = async (req, res) => {
  try {
    const { deliveryNote } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    task.deliveryStatus = "delivered";
    task.deliveredAt    = new Date().toISOString().split("T")[0];
    task.deliveryNote   = deliveryNote || "";

    task.changes.push({
      changedBy: "Employee",
      note: `Task marked as delivered. ${deliveryNote ? "Note: " + deliveryNote : ""}`.trim(),
      changedAt: new Date().toISOString().split("T")[0],
    });

    await task.save();
    const populated = await populateTask(Task.findById(task._id));
    res.json({ success: true, message: "Task marked as delivered", data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADD CHANGE LOG ───────────────────────────────────────────────────────────
exports.addChange = async (req, res) => {
  try {
    const { note, changedBy } = req.body;
    if (!note) return res.status(400).json({ success: false, message: "note is required" });

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    task.changes.push({
      changedBy: changedBy || "Super Admin",
      note,
      changedAt: new Date().toISOString().split("T")[0],
    });

    await task.save();
    const populated = await populateTask(Task.findById(task._id));
    res.json({ success: true, message: "Change added", data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    res.json({ success: true, message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
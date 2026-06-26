const Task = require("../../models/superadmindashboard/Task");

// ─── Populate helper ─────────────────────────────────────────────────────────
const populateTask = (query) =>
  query
    .populate("assignedTo", "name employeeId department role")
    .populate("brandId", "name");

// ─── CREATE (admin / super_admin only) ───────────────────────────────────────
exports.createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      assignedTo,
      assignedBy,
      brandId,
      frequency,
      dueDate,
    } = req.body;

    if (!title || !assignedTo || !assignedBy) {
      return res.status(400).json({
        success: false,
        message: "title, assignedTo, and assignedBy are required",
      });
    }

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

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: populated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET ALL ─────────────────────────────────────────────────────────────────
exports.getTasks = async (req, res) => {
  try {
    // Optional: filter by assignedTo for employee role
    const filter = {};
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;

    const tasks = await populateTask(
      Task.find(filter).sort({ createdAt: -1 })
    );

    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET ONE ─────────────────────────────────────────────────────────────────
exports.getTask = async (req, res) => {
  try {
    const task = await populateTask(Task.findById(req.params.id));
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── UPDATE (admin / super_admin) — title, desc, assignedTo, status, remark ─
exports.updateTask = async (req, res) => {
  try {
    const {
      title,
      description,
      assignedTo,
      brandId,
      frequency,
      dueDate,
      status,
      rejectRemark,
    } = req.body;

    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (assignedTo !== undefined) updateFields.assignedTo = assignedTo;
    if (brandId !== undefined) updateFields.brandId = brandId || null;
    if (frequency !== undefined) updateFields.frequency = frequency;
    if (dueDate !== undefined) updateFields.dueDate = dueDate;
    if (status !== undefined) updateFields.status = status;
    if (rejectRemark !== undefined) updateFields.rejectRemark = rejectRemark;

    const task = await populateTask(
      Task.findByIdAndUpdate(req.params.id, updateFields, {
        new: true,
        runValidators: true,
      })
    );

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    res.json({ success: true, message: "Task updated successfully", data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELIVER (employee only) ──────────────────────────────────────────────────
// POST /tasks/:id/deliver
exports.deliverTask = async (req, res) => {
  try {
    const { deliveryNote } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    task.deliveryStatus = "delivered";
    task.deliveredAt = new Date().toISOString().split("T")[0];
    task.deliveryNote = deliveryNote || "";

    // Auto push a change log entry
    task.changes.push({
      changedBy: "Employee",
      note: `Task marked as delivered. ${deliveryNote ? "Note: " + deliveryNote : ""}`.trim(),
      changedAt: new Date().toISOString().split("T")[0],
    });

    await task.save();

    const populated = await populateTask(Task.findById(task._id));

    res.json({
      success: true,
      message: "Task marked as delivered",
      data: populated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADD CHANGE LOG ───────────────────────────────────────────────────────────
// POST /tasks/:id/changes
exports.addChange = async (req, res) => {
  try {
    const { note, changedBy } = req.body;

    if (!note) {
      return res.status(400).json({ success: false, message: "note is required" });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    task.changes.push({
      changedBy: changedBy || "Super Admin",
      note,
      changedAt: new Date().toISOString().split("T")[0],
    });

    await task.save();

    const populated = await populateTask(Task.findById(task._id));

    res.json({
      success: true,
      message: "Change added",
      data: populated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELETE ──────────────────────────────────────────────────────────────────
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }
    res.json({ success: true, message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
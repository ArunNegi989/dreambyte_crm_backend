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
exports.getTasks = async (req, res) => {
  try {
    const filter = {};

    if (req.user?.role === "employee") {
      filter.assignedTo = req.user.id;
    } else if (req.query.assignedTo) {
      filter.assignedTo = req.query.assignedTo;
    }

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
    const {
      title,
      description,
      assignedTo,
      brandId,
      frequency,
      dueDate,
      status,
      rejectRemark,
      // Optional: who is making this change (used only for changes_requested).
      changedBy,
    } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (assignedTo !== undefined) task.assignedTo = assignedTo;
    if (brandId !== undefined) task.brandId = brandId || null;
    if (frequency !== undefined) task.frequency = frequency;
    if (dueDate !== undefined) task.dueDate = dueDate;

    if (status !== undefined) {
      task.status = status;

      // ── REJECTED / CHANGES_REQUESTED: both push into changes[] as a
      // single source of truth. This entry stays resolved: false on
      // purpose — it's an open note the employee MUST reply to before
      // they can resubmit. It only flips to resolved once the employee
      // answers it via respondToChanges().
      if (status === "rejected" || status === "changes_requested") {
        const hasRemarkText = rejectRemark && rejectRemark.trim().length > 0;
        const actor = changedBy || "Super Admin";

        if (hasRemarkText) {
          task.changes.push({
            changedBy: actor,
            note:
              status === "rejected"
                ? `Rejected by ${actor}: ${rejectRemark}`
                : rejectRemark,
            changedAt: new Date().toISOString().split("T")[0],
            resolved: false,
          });
        }

        // Keep rejectRemark field in sync too (legacy/simple display use).
        task.rejectRemark = hasRemarkText ? rejectRemark : task.rejectRemark || "";

        // Reopen delivery so the employee's modal switches back into the
        // "reply to admin notes" flow instead of looking already-delivered.
        task.deliveryStatus = "not_delivered";
      }

      // If status moves away from "rejected", clear the simple remark
      // field so a stale banner doesn't linger (changes[] history stays).
      if (status !== "rejected") {
        task.rejectRemark = "";
      }
    } else if (rejectRemark !== undefined) {
      // Status not changing, just editing/saving the remark text directly
      // (e.g. admin clicks "Save Remark" without touching the status radio).
      // This also logs a changes[] entry so it's visible to the employee.
      task.rejectRemark = rejectRemark;
      if (rejectRemark.trim().length > 0) {
        const actor = changedBy || "Super Admin";
        task.changes.push({
          changedBy: actor,
          note: `Rejected by ${actor}: ${rejectRemark}`,
          changedAt: new Date().toISOString().split("T")[0],
          resolved: false,
        });
        task.deliveryStatus = "not_delivered";
      }
    }

    await task.save();

    const populated = await populateTask(Task.findById(task._id));

    res.json({ success: true, message: "Task updated successfully", data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── SUBMIT (employee submits their task — first time / fresh submission) ────
exports.submitTask = async (req, res) => {
  try {
    const { deliveryState, deliveryNote, startedAt } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    task.deliveryStatus = deliveryState === "delivered" ? "delivered" : "not_delivered";
    task.deliveryNote   = deliveryNote || "";
    // Full ISO timestamp (not just date) so "time taken" can be computed
    // down to the minute, even for same-day tasks.
    task.deliveredAt    = new Date().toISOString();
    task.status         = "completed";

    // Save the employee's reported start time ONLY the first time — this
    // anchors the "time taken" calculation. If for some reason submitTask
    // gets called again with an existing startedAt already on record, we
    // keep the original so total time-taken keeps accumulating correctly
    // instead of resetting.
    if (startedAt && !task.startedAt) {
      task.startedAt = startedAt;
    }

    // IMPORTANT: resolved: true here. This is just a history log of the
    // employee's own submission, NOT an open note waiting for a reply.
    // If left unresolved, TaskModal treats it as an open change request
    // and lets the employee keep re-writing the same remark forever.
    task.changes.push({
      changedBy: req.user?.name || "Employee",
      note: `Task submitted. ${deliveryNote ? "Note: " + deliveryNote : ""}`.trim(),
      changedAt: new Date().toISOString().split("T")[0],
      resolved: true,
    });

    await task.save();
    const populated = await populateTask(Task.findById(task._id));
    res.json({ success: true, message: "Task submitted successfully", data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── RESPOND TO CHANGES (employee replies to admin/SA rejection notes) ───────
exports.respondToChanges = async (req, res) => {
  try {
    const { deliveryState, remarks, responses } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    if (Array.isArray(responses)) {
      responses.forEach(({ id, response }) => {
        const change = task.changes.id(id);
        if (change) {
          change.employeeResponse = response;
          change.resolved = true; // closes the open note, won't reappear as editable
        }
      });
    }

    // This flow has no delivery toggle in the UI — replying to every open
    // note and resubmitting always means "delivered again". Don't trust
    // the deliveryState the frontend echoes back (it's stale from before
    // the rejection reset it to not_delivered).
    task.deliveryStatus = "delivered";
    task.deliveryNote   = remarks || "";
    task.deliveredAt    = new Date().toISOString();
    task.status         = "completed";
    task.rejectRemark   = ""; // clear stale rejection banner now that it's fixed

    await task.save();
    const populated = await populateTask(Task.findById(task._id));
    res.json({ success: true, message: "Changes responded successfully", data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DASHBOARD STATS (employee) ───────────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const allTasks   = await Task.find({ assignedTo: employeeId });

    const today     = new Date().toISOString().split("T")[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStr   = weekStart.toISOString().split("T")[0];
    const monthStr  = today.slice(0, 7);

    const count = (pred) => allTasks.filter(pred).length;

    res.json({
      success: true,
      overall: {
        totalAssigned:     allTasks.length,
        pending:           count((t) => t.status === "pending"),
        changes_requested: count((t) => t.status === "changes_requested" || t.status === "rejected"),
        completed:         count((t) => t.status === "completed"),
        approved:          count((t) => t.status === "approved"),
        notDelivered:      count((t) => t.deliveryStatus === "not_delivered"),
      },
      today: {
        total:     count((t) => t.dueDate === today),
        completed: count((t) => t.dueDate === today && t.status === "completed"),
      },
      thisWeek: {
        total:     count((t) => t.dueDate >= weekStr),
        completed: count((t) => t.dueDate >= weekStr && t.status === "completed"),
      },
      thisMonth: {
        total:     count((t) => t.dueDate?.startsWith(monthStr)),
        completed: count((t) => t.dueDate?.startsWith(monthStr) && t.status === "completed"),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELIVER (standalone "Mark Delivered" button — SATasks/TaskTable) ────────
exports.deliverTask = async (req, res) => {
  try {
    const { deliveryNote } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    task.deliveryStatus = "delivered";
    task.deliveredAt    = new Date().toISOString();
    task.deliveryNote   = deliveryNote || "";

    // Same reasoning as submitTask: this is a log entry, not an open note.
    task.changes.push({
      changedBy: "Employee",
      note: `Task marked as delivered. ${deliveryNote ? "Note: " + deliveryNote : ""}`.trim(),
      changedAt: new Date().toISOString().split("T")[0],
      resolved: true,
    });

    await task.save();
    const populated = await populateTask(Task.findById(task._id));
    res.json({ success: true, message: "Task marked as delivered", data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADD CHANGE LOG (manual note from admin/SA, not tied to a status change) ─
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
      resolved: false, // this IS meant to be an open note awaiting employee reply
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
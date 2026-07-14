const Task = require("../../models/superadmindashboard/Task");

// ── Who counts as "privileged" (can see everyone's tasks)? ──────────────────
// Only admin / super_admin. Everyone else — regardless of the literal role
// string stored for them (employee / designer / photographer / smm / etc.)
// — only ever sees tasks assigned to their own id. This mirrors the same
// fix applied in additionalWorkController.js.
const isPrivileged = (req) => req.user?.role === "admin" || req.user?.role === "super_admin";

// ─── Populate helper ─────────────────────────────────────────────────────────
const populateTask = (query) =>
  query
    .populate("assignedTo", "name employeeId department role")
    .populate("brandId", "name");

// ─── Auto-complete parent when all its sub-tasks are done ────────────────────
const checkAndAutoCompleteParent = async (parentTaskId) => {
  if (!parentTaskId) return;
  const siblings = await Task.find({ parentTaskId });
  if (siblings.length === 0) return;

  const allDone = siblings.every((t) => t.status === "completed");
  if (allDone) {
    await Task.findByIdAndUpdate(parentTaskId, {
      status: "completed",
      deliveryStatus: "delivered",
      deliveredAt: new Date().toISOString(),
    });
  }
};

// ── Stop the running timer (if any) and fold elapsed time into the total ─────
// Called from every "submit"-like action (submitTask, respondToChanges,
// deliverTask). Safe to call even if the timer isn't running — it's a no-op
// in that case, so resubmitting a task that was never explicitly "resumed"
// just adds 0 extra time instead of throwing or double counting.
const stopTimer = (task) => {
  if (task.currentSessionStartedAt) {
    const elapsed = Date.now() - new Date(task.currentSessionStartedAt).getTime();
    if (elapsed > 0) task.timeSpentMs = (task.timeSpentMs || 0) + elapsed;
    task.currentSessionStartedAt = null;
  }
};

// ─── CREATE ───────────────────────────────────────────────────────────────────
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
      // ── Department this task belongs to (explicit for SA→Admin tasks) ──
      department,
      // ── Photography / department-specific fields ──
      taskType,
      location,
      time,
      mediaType,
      totalCount,
    } = req.body;

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
      department: department || "",
      // ── Photography / department-specific fields ──
      taskType: taskType || "",
      location: location || "",
      time: time || "",
      mediaType: mediaType || null,
      totalCount: totalCount !== undefined && totalCount !== "" ? Number(totalCount) : null,
      completedCount: 0,
    });

    const populated = await populateTask(Task.findById(task._id));
    res.status(201).json({ success: true, message: "Task created successfully", data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET ALL ──────────────────────────────────────────────────────────────────
// THE FIX: privileged (admin/super_admin) callers can see everyone's tasks,
// or a specific employee's via ?assignedTo=. Every other caller — no matter
// what their literal role string is — only ever gets their own tasks. This
// is what makes every department dashboard (Designer, SMM, Photographer…)
// "dynamic": whatever gets assigned to that employee's Mongo _id is what
// shows up for them, and only for them.
exports.getTasks = async (req, res) => {
  try {
    const filter = {};

    if (isPrivileged(req)) {
      if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
      // else: no filter — admins/SAs intentionally see every task
    } else {
      const selfId = req.user?.id || req.user?._id;
      if (!selfId) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }
      filter.assignedTo = selfId;
    }

    if (req.query.status)       filter.status = req.query.status;
    if (req.query.brand)        filter.brandId = req.query.brand;
    if (req.query.date)         filter.dueDate = req.query.date;
    if (req.query.assignedBy)   filter.assignedBy = req.query.assignedBy;
    if (req.query.department)   filter.department = req.query.department;
    if (req.query.parentTaskId) filter.parentTaskId = req.query.parentTaskId;
    if (req.query.topLevel === "true") filter.parentTaskId = null; // only parent/standalone tasks

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
      changedBy,
      // ── Department this task belongs to ──
      department,
      // ── Photography / department-specific fields ──
      taskType,
      location,
      time,
      mediaType,
      totalCount,
      completedCount,
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
    if (department !== undefined) task.department = department;

    // ── Photography / department-specific fields ──
    if (taskType !== undefined) task.taskType = taskType;
    if (location !== undefined) task.location = location;
    if (time !== undefined) task.time = time;
    if (mediaType !== undefined) task.mediaType = mediaType || null;
    if (totalCount !== undefined) {
      task.totalCount = totalCount === "" ? null : Number(totalCount);
    }
    // completedCount comes from the photographer's edit-progress stepper.
    // Auto-derive status from it so the simple 3-state board stays in sync.
    if (completedCount !== undefined) {
      const nextCompleted = Number(completedCount);
      task.completedCount = nextCompleted;

      // ── TIME TRACKING: first bit of real progress stamps startedAt ──
      if (nextCompleted > 0 && !task.startedAt) {
        task.startedAt = new Date().toISOString();
      }

      const total = task.totalCount ?? 1;
      if (status === undefined) {
        if (nextCompleted <= 0) task.status = "pending";
        else if (nextCompleted >= total) task.status = "completed";
        else task.status = "in_progress";
      }
    }

    if (status !== undefined) {
      task.status = status;

      // ── TIME TRACKING: stamp startedAt the very first time a task moves
      // into "in_progress" (this is how each dashboard's "Start Task"
      // button kicks off the "time taken" clock). Only set once — never
      // overwritten on later status changes.
      if (status === "in_progress" && !task.startedAt) {
        task.startedAt = new Date().toISOString();
      }
      if (status === "completed" && !task.deliveredAt) {
        task.deliveredAt = new Date().toISOString();
        task.completedAt = task.deliveredAt; // keep the SEO-specific field in sync
      }
      // ── REJECTED / CHANGES_REQUESTED: both push into changes[] as a
      // single source of truth. This entry stays resolved: false on
      // purpose — it's an open note the employee MUST reply to before
      // they can resubmit. It only flips to resolved once the employee
      // answers it via respondToChanges().
      if (status === "rejected" || status === "changes_requested") {
        // Defensive: a task should never be mid-timer when it gets
        // rejected (submit/respond already stop the clock beforehand),
        // but guard against it anyway so the clock never runs across a
        // rejection boundary undetected.
        stopTimer(task);

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

    // If this task is a sub-task of a bigger SA→Admin task, check whether
    // its parent should now be auto-marked complete.
    if (status !== undefined) {
      await checkAndAutoCompleteParent(task.parentTaskId);
    }

    const populated = await populateTask(Task.findById(task._id));

    res.json({ success: true, message: "Task updated successfully", data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── START / RESUME (employee clicks "Start Task" or "Resume Task") ──────────
// One endpoint handles both cases:
//   • status === "pending"                       → fresh start, status flips to "in_progress"
//   • status === "rejected" / "changes_requested" → resume, status is left AS-IS so the
//     rejection banner + change log keep showing until the employee actually resubmits
// Idempotent: calling it again while the timer's already running is a no-op.
exports.startTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    const selfId = req.user?.id || req.user?._id;
    if (!isPrivileged(req) && String(task.assignedTo) !== String(selfId)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (!task.currentSessionStartedAt) {
      task.currentSessionStartedAt = new Date().toISOString();
      if (!task.startedAt) task.startedAt = task.currentSessionStartedAt;

      if (task.status === "pending") task.status = "in_progress";
    }

    await task.save();
    const populated = await populateTask(Task.findById(task._id));
    res.json({ success: true, message: "Task started", data: populated });
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

    // Stop the clock — folds the current running session into timeSpentMs.
    stopTimer(task);

    // Legacy fallback so startedAt is never blank for old tasks that
    // skipped the Start button entirely (e.g. frontend sent its own value,
    // or nothing was ever stamped at all).
    if (!task.startedAt) {
      task.startedAt = startedAt || new Date().toISOString();
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

    // Sub-task of a split SA→Admin task? Check if all siblings are done
    // so the parent can auto-complete.
    await checkAndAutoCompleteParent(task.parentTaskId);

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

    // Resubmitting after a rejection is also a "submit" — stop the clock
    // (no-op if the employee never clicked Resume, so no time is added).
    stopTimer(task);

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

    await checkAndAutoCompleteParent(task.parentTaskId);

    const populated = await populateTask(Task.findById(task._id));
    res.json({ success: true, message: "Changes responded successfully", data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DASHBOARD STATS (employee) ───────────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const employeeId = req.user?.id || req.user?._id;
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

    // Stop the clock — folds the current running session into timeSpentMs.
    stopTimer(task);

    if (!task.startedAt) {
      task.startedAt = new Date().toISOString();
    }

    // Same reasoning as submitTask: this is a log entry, not an open note.
    task.changes.push({
      changedBy: "Employee",
      note: `Task marked as delivered. ${deliveryNote ? "Note: " + deliveryNote : ""}`.trim(),
      changedAt: new Date().toISOString().split("T")[0],
      resolved: true,
    });

    await task.save();

    await checkAndAutoCompleteParent(task.parentTaskId);

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

// ─── SPLIT (admin breaks a SA-assigned task into employee sub-tasks) ─────────
// Body: { subtasks: [{ title, description, assignedTo, dueDate, frequency, brandId? }] }
exports.splitTask = async (req, res) => {
  try {
    const { subtasks } = req.body;
    if (!Array.isArray(subtasks) || subtasks.length === 0) {
      return res.status(400).json({ success: false, message: "subtasks array is required" });
    }

    for (const s of subtasks) {
      if (!s.title || !s.assignedTo) {
        return res.status(400).json({
          success: false,
          message: "Each subtask requires at least a title and assignedTo",
        });
      }
    }

    const parent = await Task.findById(req.params.id);
    if (!parent) return res.status(404).json({ success: false, message: "Parent task not found" });

    // Sub-tasks ALWAYS inherit the parent's department — the frontend
    // already restricts which employees can be picked to only that
    // department, but we enforce it again here server-side so a sub-task
    // can never end up in a different department than its parent, no
    // matter what the request body claims.
    const created = await Task.insertMany(
      subtasks.map((s) => ({
        title: s.title,
        description: s.description || "",
        assignedTo: s.assignedTo,
        assignedBy: "admin",
        brandId: s.brandId || parent.brandId || null,
        frequency: s.frequency || parent.frequency || "one_time",
        dueDate: s.dueDate || "",
        status: "pending",
        deliveryStatus: "not_delivered",
        parentTaskId: parent._id,
        changes: [],
        department: parent.department || "",
        // carry photography fields over if the parent had them
        taskType: s.taskType || parent.taskType || "",
        location: s.location ?? parent.location ?? "",
        time: s.time ?? parent.time ?? "",
        mediaType: s.mediaType ?? parent.mediaType ?? null,
        totalCount: s.totalCount !== undefined ? Number(s.totalCount) : parent.totalCount ?? null,
      }))
    );

    parent.hasSubtasks = true;
    if (parent.status === "pending") parent.status = "approved"; // admin has acted on it
    await parent.save();

    const populatedChildren = await populateTask(Task.find({ _id: { $in: created.map((c) => c._id) } }));
    res.status(201).json({ success: true, message: "Task split successfully", data: populatedChildren });
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

exports.addSubtask = async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim())
      return res.status(400).json({ success: false, message: "title is required" });

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    // Employees may only touch subtasks on their own tasks
    if (req.user?.role === "employee" && String(task.assignedTo) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    task.subtasks.push({ title: title.trim(), status: "pending" });
    await task.save();

    const populated = await populateTask(Task.findById(task._id));
    res.status(201).json({ success: true, message: "Subtask added", data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /tasks/:id/subtasks/:subtaskId — toggles pending <-> completed
exports.toggleSubtask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    if (req.user?.role === "employee" && String(task.assignedTo) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const sub = task.subtasks.id(req.params.subtaskId);
    if (!sub) return res.status(404).json({ success: false, message: "Subtask not found" });

    sub.status = sub.status === "completed" ? "pending" : "completed";
    await task.save();

    const populated = await populateTask(Task.findById(task._id));
    res.json({ success: true, message: "Subtask updated", data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /tasks/:id/subtasks/:subtaskId
exports.removeSubtask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    if (req.user?.role === "employee" && String(task.assignedTo) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    task.subtasks.pull(req.params.subtaskId);
    await task.save();

    const populated = await populateTask(Task.findById(task._id));
    res.json({ success: true, message: "Subtask removed", data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
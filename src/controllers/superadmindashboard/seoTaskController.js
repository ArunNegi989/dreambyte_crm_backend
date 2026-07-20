// controllers/superadmindashboard/seoTaskController.js
const Task = require("../../models/superadmindashboard/Task");
const AdditionalWork = require("../../models/superadmindashboard/AdditionalWork");
const { CATEGORY_VALUES } = require("./seoCategoryMap"); // see note below

function resolveCategory(taskType = "") {
  // Work-type dropdown may store either the raw category value
  // ("gmb_handling") or its display label ("GMB Handling") depending on
  // how departmentTasks.ts is configured — handle both.
  if (CATEGORY_VALUES.byValue[taskType]) return taskType;
  return CATEGORY_VALUES.byLabel[taskType] || taskType;
}

// ── Stop the running timer (if any) and fold elapsed time into the total ──
// Same helper as the main Taskcontroller.js's stopTimer — mirrored here so
// SEO tasks accumulate timeSpentMs the exact same pause-aware way. Safe to
// call even if the timer isn't running (no-op).
function stopTimer(task) {
  if (task.currentSessionStartedAt) {
    const elapsed = Date.now() - new Date(task.currentSessionStartedAt).getTime();
    if (elapsed > 0) task.timeSpentMs = (task.timeSpentMs || 0) + elapsed;
    task.currentSessionStartedAt = null;
  }
}

// NOTE: this file previously defined toFrontendTask() twice — the second
// definition silently shadowed the first at runtime (function hoisting),
// so the first one's shape never actually mattered. Merged into one here,
// keeping the rejectRemark/changes fields from the second version.
//
// THE FIX: timeSpentMs and currentSessionStartedAt were missing from this
// output entirely — even though the shared Task model has both fields and
// the frontend's getTimeTakenLabel() reads exactly these two. Without
// them making it into the API response, no amount of frontend fixing
// could ever show a correct "time taken" for an SEO task. That was the
// actual root cause, not just a frontend formula bug.
function toFrontendTask(task) {
  const brand = task.brandId;
  return {
    id: task._id.toString(),
    title: task.title,
    category: resolveCategory(task.taskType || ""),
    description: task.description || "",
    clientName: task.clientName || "",
    brandName: brand && typeof brand === "object" ? brand.name : "",
    assignedDate: task.createdAt ? task.createdAt.toISOString().slice(0, 10) : "",
    dueDate: task.dueDate || "",
    status: task.status,
    priority: task.priority || "medium",
    remarks: task.remarks || "",
    submittedAt: task.submittedAt || null,
    completedAt: task.completedAt || null,
    details: task.seoDetails || {},
    rejectRemark: task.rejectRemark || "",
    changes: (task.changes || []).map((c) => ({
      id: c._id.toString(),
      changedBy: c.changedBy,
      note: c.note,
      changedAt: c.changedAt,
      resolved: c.resolved,
      employeeResponse: c.employeeResponse || "",
    })),
    // ── Time tracking (display-only timestamps) ───────────────────────
    startedAt: task.startedAt || null,
    deliveredAt: task.deliveredAt || null,
    // ── Time tracking (actual source of truth — was missing before) ───
    timeSpentMs: task.timeSpentMs || 0,
    currentSessionStartedAt: task.currentSessionStartedAt || null,
  };
}

exports.getMyTasks = async (req, res) => {
  try {
    const employeeId = req.user?.id || req.query.employeeId;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: "employeeId is required" });
    }

    const filter = { assignedTo: employeeId };
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    if (req.query.category && req.query.category !== "all") {
      // accept either the value or the label since resolveCategory handles both on read
      filter.taskType = req.query.category;
    }

    const tasks = await Task.find(filter).populate("brandId", "name").sort({ dueDate: 1 });
    res.json({ success: true, data: tasks.map(toFrontendTask) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const employeeId = req.user?.id || req.query.employeeId;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: "employeeId is required" });
    }

    const [tasks, additionalCount] = await Promise.all([
      Task.find({ assignedTo: employeeId }),
      AdditionalWork.countDocuments({ assignedTo: employeeId }),
    ]);

    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    const blocked = tasks.filter((t) => t.status === "blocked").length;

    const today = new Date().toISOString().slice(0, 10);
    const overdue = tasks.filter((t) => t.status !== "completed" && t.dueDate && t.dueDate < today).length;

    const byCategory = {};
    tasks.forEach((t) => {
      const key = resolveCategory(t.taskType || "") || "uncategorized";
      byCategory[key] = (byCategory[key] || 0) + 1;
    });
    const categoryBreakdown = Object.entries(byCategory).map(([category, count]) => ({ category, count }));

    res.json({
      success: true,
      data: {
        total,
        completed,
        inProgress,
        pending,
        blocked,
        overdue,
        additionalTasksLogged: additionalCount,
        categoryBreakdown,
        completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Generic detail/status editor ──────────────────────────────────────────
// THE FIX: this used to run on EVERY save regardless of what changed —
// stamping submittedAt the first time ANY field was touched, and pushing a
// changes[] log entry unconditionally (even for what was previously the
// "Start Task" click, since that also routed through here as a plain
// status PUT). That's now handled by the dedicated startTask/submitTask
// endpoints below instead, which is also what actually stamps
// currentSessionStartedAt / timeSpentMs correctly. This endpoint is kept
// only for editing category detail fields or remarks WITHOUT touching
// status or the timer (e.g. an admin correcting a submitted task's data) —
// it deliberately no longer touches startedAt, submittedAt, deliveredAt,
// or timeSpentMs, and no longer auto-logs a change entry, since doing so
// on a save that isn't actually a start/submit was the source of the
// original "time taken" bug.
exports.updateTaskWork = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks, details } = req.body;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    if (status && status !== task.status) task.status = status;
    if (details !== undefined) task.seoDetails = { ...(task.seoDetails || {}), ...details };
    if (remarks !== undefined) task.remarks = remarks;

    await task.save();
    await task.populate("brandId", "name");
    res.json({ success: true, data: toFrontendTask(task) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── START / RESUME (employee clicks "Start Task" or "Resume Task") ────────
// Mirrors the main Taskcontroller.js's startTask exactly: one endpoint
// handles both a fresh start (pending -> in_progress) and a resume
// (rejected — status left AS-IS so the rejection banner + change log keep
// showing until the employee actually resubmits). Idempotent: calling it
// again while the timer's already running is a no-op.
exports.startTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    if (!task.currentSessionStartedAt) {
      task.currentSessionStartedAt = new Date().toISOString();
      if (!task.startedAt) task.startedAt = task.currentSessionStartedAt;

      if (task.status === "pending") task.status = "in_progress";

      // Clear any stale deliveredAt left over from a previous cycle —
      // without this, "time taken" would freeze on the OLD deliveredAt
      // instead of ticking live, even though the timer is now running.
      task.deliveredAt = null;
    }

    await task.save();
    await task.populate("brandId", "name");
    res.json({ success: true, message: "Task started", data: toFrontendTask(task) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── SUBMIT FOR REVIEW ──────────────────────────────────────────────────────
// Saves whatever category detail fields were filled in, stops the running
// timer (folding the session into timeSpentMs), and moves status ->
// completed. Replaces the old "set status via dropdown" flow entirely —
// submitting always means "done, sent for review."
exports.submitTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks, details } = req.body;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    if (details !== undefined) task.seoDetails = { ...(task.seoDetails || {}), ...details };

    // Stop the clock — folds the current running session into timeSpentMs.
    // No-op if the employee never clicked Start/Resume (shouldn't normally
    // happen since the frontend only shows Submit once started).
    stopTimer(task);

    const now = new Date().toISOString();
    task.remarks = remarks || "";
    if (!task.submittedAt) task.submittedAt = now;

    task.status = "completed";
    task.completedAt = now;
    task.deliveryStatus = "delivered";
    task.deliveryNote = remarks || task.deliveryNote;
    task.deliveredAt = now;
    // Clear any stale rejection banner now that this is a fresh submission.
    task.rejectRemark = "";

    // Log entry is resolved: true — this is a history record of the
    // employee's own submission, NOT an open note waiting for a reply.
    task.changes.push({
      changedBy: "Employee",
      note: remarks?.trim() ? `Task submitted. Note: ${remarks}` : "Task submitted.",
      changedAt: now,
      resolved: true,
      employeeResponse: "",
    });

    await task.save();
    await task.populate("brandId", "name");
    res.json({ success: true, message: "Task submitted successfully", data: toFrontendTask(task) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.respondToChange = async (req, res) => {
  try {
    const { id } = req.params; // task id
    const { changeId, response } = req.body;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    const change = task.changes.id(changeId);
    if (!change) return res.status(404).json({ success: false, message: "Change not found" });

    change.employeeResponse = response;
    change.resolved = true;

    // ── FIX: replying to a rejection note is also a resubmission —
    // mirrors the main Taskcontroller.js's respondToChanges. Previously
    // this only resolved the note and left status/timer untouched, so a
    // task could sit "rejected" forever even after being fully replied
    // to, and the timer (if running) was never stopped/folded in.
    stopTimer(task);

    const now = new Date().toISOString();
    task.deliveryStatus = "delivered";
    task.deliveredAt = now;
    task.status = "completed";
    task.rejectRemark = ""; // clear stale rejection banner now that it's addressed

    await task.save();
    await task.populate("brandId", "name");
    res.json({ success: true, data: toFrontendTask(task) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
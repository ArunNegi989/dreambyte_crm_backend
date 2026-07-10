const Task = require("../../models/superadmindashboard/Task");

function buildDetails(task) {
  const details = {};
  if (task.location) details.Location = task.location;
  if (task.time) details.Time = task.time;
  if (task.mediaType) details["Media type"] = task.mediaType;
  if (task.totalCount != null) details["Total count"] = String(task.totalCount);
  if (task.completedCount != null) details["Completed"] = String(task.completedCount);
  if (task.frequency) details.Frequency = task.frequency;
  return details;
}

function toFrontendTask(task) {
  return {
    id: task._id.toString(),
    title: task.title,
    category: task.taskType || "",
    priority: task.priority || "medium",
    status: task.status,
    assignedTo: task.assignedTo?._id?.toString() || task.assignedTo?.toString() || "",
    dueDate: task.dueDate || "",
    description: task.description || "",
    details: buildDetails(task),
    deliveryStatus: task.deliveryStatus,
    rejectRemark: task.rejectRemark || "",
    startedAt: task.startedAt || "",
    deliveredAt: task.deliveredAt || "",
    changes: (task.changes || []).map((c) => ({
      _id: c._id.toString(),
      changedBy: c.changedBy,
      note: c.note,
      changedAt: c.changedAt,
      resolved: c.resolved,
      employeeResponse: c.employeeResponse || "",
    })),
  };
}

exports.getMyTasks = async (req, res) => {
  try {
    const employeeId = req.user?.id || req.query.employeeId;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: "employeeId is required" });
    }

    const filter = { assignedTo: employeeId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.taskType = req.query.category;

    const tasks = await Task.find(filter).sort({ dueDate: 1 });
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

    const tasks = await Task.find({ assignedTo: employeeId });
    const mapped = tasks.map(toFrontendTask);

    const total = mapped.length;
    const pending = mapped.filter((t) => t.status === "pending").length;
    const approved = mapped.filter((t) => t.status === "approved").length;
    const inProgress = mapped.filter((t) => t.status === "in_progress").length;
    const completed = mapped.filter((t) => t.status === "completed").length;
    const rejected = mapped.filter((t) => t.status === "rejected").length;
    const changesRequested = mapped.filter((t) => t.status === "changes_requested").length;

    const today = new Date().toISOString().slice(0, 10);
    const overdue = mapped.filter((t) => t.status !== "completed" && t.dueDate && t.dueDate < today).length;
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

    const byCategory = {};
    mapped.forEach((t) => {
      const key = t.category || "uncategorized";
      byCategory[key] = (byCategory[key] || 0) + 1;
    });
    const categoryBreakdown = Object.entries(byCategory).map(([category, count]) => ({ category, count }));

    res.json({
      success: true,
      data: {
        total, pending, approved, inProgress, completed, rejected, changesRequested,
        overdue, completionRate, categoryBreakdown,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
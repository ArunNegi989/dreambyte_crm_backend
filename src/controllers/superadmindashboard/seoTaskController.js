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

exports.updateTaskWork = async (req, res) => {
    try {
      const { id } = req.params;
      const { status, remarks, details } = req.body;
  
      const task = await Task.findById(id);
      if (!task) return res.status(404).json({ success: false, message: "Task not found" });
  
      const now = new Date().toISOString();
  
      if (status) task.status = status;
      if (details !== undefined) task.seoDetails = { ...(task.seoDetails || {}), ...details };
  
      task.remarks = remarks || "";
      if (!task.submittedAt) task.submittedAt = now;
      if (status === "completed") task.completedAt = now;
  
      // ── Make the employee's comment visible to superadmin ───────────────
      // Superadmin only ever reads `changes[]`, so every submission needs an
      // entry here — even if remarks is empty, so there's a record of the
      // status change itself.
      task.changes.push({
        changedBy: "Employee",
        note: remarks?.trim()
          ? remarks
          : `Marked as "${status}" with no additional remarks.`,
        changedAt: now,
        resolved: false,
        employeeResponse: "",
      });
  
      // ── Every employee submission through this flow counts as delivery ──
      // The SEO dashboard has no separate "Mark Delivered" step like Meta
      // does, so submitting work here IS the delivery event.
      task.deliveryStatus = "delivered";
      task.deliveryNote = remarks || task.deliveryNote;
      task.deliveredAt = now;
  
      await task.save();
      await task.populate("brandId", "name");
      res.json({ success: true, data: toFrontendTask(task) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };


  exports.respondToChange = async (req, res) => {
    try {
      const { id } = req.params;       // task id
      const { changeId, response } = req.body;
  
      const task = await Task.findById(id);
      if (!task) return res.status(404).json({ success: false, message: "Task not found" });
  
      const change = task.changes.id(changeId);
      if (!change) return res.status(404).json({ success: false, message: "Change not found" });
  
      change.employeeResponse = response;
      change.resolved = true;
  
      await task.save();
      await task.populate("brandId", "name");
      res.json({ success: true, data: toFrontendTask(task) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };


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
    rejectRemark: task.rejectRemark || "",              // ← add
    changes: (task.changes || []).map((c) => ({          // ← add
      id: c._id.toString(),
      changedBy: c.changedBy,
      note: c.note,
      changedAt: c.changedAt,
      resolved: c.resolved,
      employeeResponse: c.employeeResponse || "",
    })),
  };
}
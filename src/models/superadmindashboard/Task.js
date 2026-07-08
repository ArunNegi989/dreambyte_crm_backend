const mongoose = require("mongoose");

const taskChangeSchema = new mongoose.Schema(
  {
    changedBy:        { type: String, required: true },
    note:             { type: String, required: true },
    changedAt:        { type: String, required: true },
    resolved:         { type: Boolean, default: false },
    employeeResponse: { type: String, default: '' },
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    assignedBy: {
      type: String,
      enum: ["admin", "super_admin"],
      required: true,
    },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
    },
    frequency: {
      type: String,
      enum: ["weekly", "monthly", "one_time"],
      default: "one_time",
    },
    dueDate:       { type: String, default: "" },
    status: {
      type: String,
      // "in_progress" added for simple self-tracked workflows (e.g. the
      // Photography dashboard) that don't go through the full
      // reject/changes_requested review cycle.
      enum: ["pending", "approved", "in_progress", "rejected", "completed", "changes_requested"],
      default: "pending",
    },
    deliveryStatus: {
      type: String,
      enum: ["delivered", "not_delivered"],
      default: "not_delivered",
    },
    deliveryNote: { type: String, default: "" },

    // ── Time tracking ──────────────────────────────────────────────────
    startedAt:    { type: String, default: null },
    deliveredAt:  { type: String, default: null },

    rejectRemark: { type: String, default: "" },
    changes:      { type: [taskChangeSchema], default: [] },

    // ── Split-task tracking ──────────────────────────────────────────
    parentTaskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    hasSubtasks:  { type: Boolean, default: false },

    // ── Department "Work Type" tag ────────────────────────────────────
    // Free-text label matching one of data/departmentTasks.ts's entries
    // (e.g. "Shoots", "Photo Edit", "Video Edit", "Post Design", "UGC"...).
    // Drives which extra fields below are relevant for a given task.
    taskType: { type: String, default: "" },

    // ── Photography: Shoots-specific fields ───────────────────────────
    location:  { type: String, default: "" },   // shoot location
    time:      { type: String, default: "" },   // shoot time, e.g. "10:30 AM"
    mediaType: {
      type: String,
      enum: ["photo", "video", "both", null],
      default: null,
    },

    // ── Photography: Edit-specific fields ─────────────────────────────
    // totalCount is set once at assignment time (e.g. "40 photos to edit").
    // completedCount is updated by the photographer as they work through it;
    // the controller auto-derives status from these two values.
    totalCount:     { type: Number, default: null },
    completedCount: { type: Number, default: 0 },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },


  },
  { timestamps: true }
);

module.exports = mongoose.models.Task || mongoose.model("Task", taskSchema);
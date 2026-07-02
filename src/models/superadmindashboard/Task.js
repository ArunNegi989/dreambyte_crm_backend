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
      enum: ["pending", "approved", "rejected", "completed", "changes_requested"],
      default: "pending",
    },
    deliveryStatus: {
      type: String,
      enum: ["delivered", "not_delivered"],
      default: "not_delivered",
    },
    deliveryNote: { type: String, default: "" },

    // ── Time tracking ──────────────────────────────────────────────────
    // startedAt is set ONCE, the first time the employee submits the task
    // (full ISO datetime string, e.g. "2026-06-30T17:19:00"). It is never
    // overwritten on later reject→fix→resubmit cycles, so "time taken"
    // (deliveredAt - startedAt) naturally keeps growing across the whole
    // lifecycle of the task instead of resetting each cycle.
    startedAt:    { type: String, default: null },
    deliveredAt:  { type: String, default: null },

    rejectRemark: { type: String, default: "" },
    changes:      { type: [taskChangeSchema], default: [] },

    // ── Split-task tracking ──────────────────────────────────────────
    // Set when a Super-Admin task (assigned to an Admin) is broken down
    // by that Admin into multiple employee-level sub-tasks. Each
    // sub-task's parentTaskId points back to the original SA→Admin task.
    // The parent task itself never has an assignedTo of an employee in
    // this flow — it stays "owned" by the admin until all children are
    // done, at which point it auto-completes.
    parentTaskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    hasSubtasks:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Task || mongoose.model("Task", taskSchema);
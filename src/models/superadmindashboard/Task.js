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

    // ── Department this task belongs to ───────────────────────────────
    // Normally implied by the assignee's own department (a plain
    // employee only ever works within their own department). But when a
    // Super Admin assigns a task straight to an Admin, the Admin isn't
    // tied to a single department — they receive work for whichever
    // department the Super Admin is delegating. This field stores that
    // department explicitly so the Admin's dashboard knows which
    // department's employees are allowed to receive it once split.
    // Sub-tasks created via splitTask() always inherit their parent's
    // department — an Admin cannot reassign a Graphic task to a
    // Development employee.
    department: { type: String, default: "" },

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
    
    status: {
      type: String,
      enum: ["pending", "approved", "in_progress", "blocked", "rejected", "completed", "changes_requested"], // ← added "blocked" for SEO
      default: "pending",
    },
    
    // ...deliveryStatus, deliveryNote, startedAt, deliveredAt, rejectRemark, changes... (unchanged)
    
    // ── SEO-specific fields ───────────────────────────────────────────
    clientName:   { type: String, default: "" },
    remarks:      { type: String, default: "" },   // employee's own submission remarks (distinct from rejectRemark)
    submittedAt:  { type: String, default: null },
    completedAt:  { type: String, default: null },
    seoDetails:   { type: mongoose.Schema.Types.Mixed, default: {} }, // holds TaskDetails per category (backlink rows, keyword rows, gmb report numbers, etc.)
    
    subtasks: {
      type: [
        {
          title:     { type: String, required: true, trim: true },
          status:    { type: String, enum: ["pending", "completed"], default: "pending" },
          createdAt: { type: String, default: () => new Date().toISOString() },
        },
      ],
      default: [],
    },
    
  },
  { timestamps: true }
);

module.exports = mongoose.models.Task || mongoose.model("Task", taskSchema);
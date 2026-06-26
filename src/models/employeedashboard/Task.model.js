const mongoose = require('mongoose');

// ── ChangeRequest (embedded subdocument, not a separate collection) ──────────
const changeRequestSchema = new mongoose.Schema(
  {
    adminNote: {
      type: String,
      required: [true, 'Admin note is required'],
      trim: true,
    },
    employeeResponse: {
      type: String,
      default: '',
    },
    // Multiple remarks the employee can add per change point
    remarks: {
      type: [String],
      default: [],
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true } // Mongoose gives each change request its own _id
);

// ── Task ─────────────────────────────────────────────────────────────────────
const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    brandName: {
      type: String,
      required: [true, 'Brand name is required'],
      trim: true,
    },
    clientName: {
      type: String,
      required: [true, 'Client name is required'],
      trim: true,
    },

    // Who the task is assigned to and by
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned employee is required'],
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigning admin is required'],
    },

    status: {
      type: String,
      enum: ['pending', 'changes_requested', 'completed', 'approved'],
      default: 'pending',
    },
    deliveryState: {
      type: String,
      enum: ['not_delivered', 'delivered'],
      default: 'not_delivered',
    },

    // Employee-written summary when submitting
    remarks: {
      type: String,
      default: '',
    },

    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },

    // Set when employee submits
    submittedAt: {
      type: Date,
      default: null,
    },
    // Employee-entered: when they say they started the task
    startedAt: {
      type: Date,
      default: null,
    },
    // Set automatically when employee marks task done
    completedAt: {
      type: Date,
      default: null,
    },
    // Set by admin/client when they approve
    approvedAt: {
      type: Date,
      default: null,
    },

    // Embedded change requests — grows as admin adds new ones
    changeRequests: {
      type: [changeRequestSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Virtual: total number of change requests ever made
taskSchema.virtual('totalChanges').get(function () {
  return this.changeRequests.length;
});

// Virtual: number of unresolved change requests
taskSchema.virtual('unresolvedChanges').get(function () {
  return this.changeRequests.filter((c) => !c.resolved).length;
});

// Virtual: time taken in minutes (startedAt → completedAt)
taskSchema.virtual('timeTakenMinutes').get(function () {
  if (!this.startedAt || !this.completedAt) return null;
  return Math.round((this.completedAt - this.startedAt) / (1000 * 60));
});

taskSchema.set('toJSON', { virtuals: true });
taskSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Task', taskSchema);
const mongoose = require("mongoose");

const additionalWorkSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    date:        { type: String, required: true }, // "YYYY-MM-DD"
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    // "self" = the employee logged this themselves.
    // "admin" = an admin/super admin logged it on the employee's behalf.
    loggedBy: {
      type: String,
      enum: ["self", "admin"],
      default: "self",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    // ── Added for Meta Dashboard's richer logging form ──────────────────
    // Optional — entries from other dashboards (photographer, SMM, etc.)
    // simply won't set these, and that's fine.
    category:   { type: String, default: "other" },
    hoursSpent: { type: Number, default: null },
    outcome:    { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.AdditionalWork || mongoose.model("AdditionalWork", additionalWorkSchema);
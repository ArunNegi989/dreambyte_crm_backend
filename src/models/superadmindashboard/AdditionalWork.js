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
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.AdditionalWork || mongoose.model("AdditionalWork", additionalWorkSchema);
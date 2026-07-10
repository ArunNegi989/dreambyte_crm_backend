const AdditionalWork = require("../../models/superadmindashboard/AdditionalWork");

// ── Who counts as "privileged" (can see everyone's entries)? ────────────────
// Only admin / super_admin. Everyone else — "employee", "designer",
// "photographer", "smm", or whatever literal role string your department
// dashboards actually store — is treated as a regular employee and ONLY
// ever sees their own logged work. This is the actual fix: the old check
// (`req.user?.role === "employee"`) silently failed for any role string
// other than the literal word "employee", which meant the filter was
// skipped and every employee saw every other employee's entries.
const isPrivileged = (req) => req.user?.role === "admin" || req.user?.role === "super_admin";

// ─── CREATE ───────────────────────────────────────────────────────────────────
// Either the employee logs their own extra work (loggedBy: "self" — assignedTo
// defaults to the logged-in user's own id so the frontend never needs to know
// its own Mongo id) or an admin/SA logs it on the employee's behalf
// (loggedBy: "admin", assignedTo passed explicitly in the body).
exports.createAdditionalWork = async (req, res) => {
  try {
    const { title, description, date, loggedBy, category, hoursSpent, outcome } = req.body;
    const selfId = req.user?.id || req.user?._id;
    const assignedTo = req.body.assignedTo || selfId;

    if (!title || !assignedTo) {
      return res.status(400).json({ success: false, message: "title and assignedTo are required" });
    }

    // Safety net: a non-privileged caller can only ever log work against
    // THEIR OWN id, even if the frontend somehow sent a different assignedTo.
    if (!isPrivileged(req) && String(assignedTo) !== String(selfId)) {
      return res.status(403).json({ success: false, message: "You can only log work for yourself" });
    }

    const entry = await AdditionalWork.create({
      title,
      description: description || "",
      date: date || new Date().toISOString().split("T")[0],
      assignedTo,
      loggedBy: loggedBy || "self",
      status: "pending",
      // ── optional, only used by dashboards that send them (e.g. Meta) ──
      category: category || "other",
      hoursSpent: hoursSpent !== undefined && hoursSpent !== "" ? Number(hoursSpent) : null,
      outcome: outcome || "",
    });

    res.status(201).json({ success: true, message: "Additional work logged", data: entry });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET ALL ──────────────────────────────────────────────────────────────────
// THE FIX: privileged (admin/super_admin) callers can see everyone, or a
// specific employee via ?assignedTo=. Every other caller — regardless of
// what their literal role string is — only ever gets their own entries.
exports.getAdditionalWork = async (req, res) => {
  try {
    const filter = {};

    if (isPrivileged(req)) {
      if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
      // else: no filter — admins/SAs intentionally see everyone's entries
    } else {
      const selfId = req.user?.id || req.user?._id;
      if (!selfId) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }
      // Always self-scoped for any non-admin role, no matter what that
      // role string actually is (employee / designer / photographer / smm…).
      filter.assignedTo = selfId;
    }

    if (req.query.status) filter.status = req.query.status;

    const items = await AdditionalWork.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── UPDATE STATUS ────────────────────────────────────────────────────────────
exports.updateAdditionalWork = async (req, res) => {
  try {
    const { status, title, description, category, hoursSpent, outcome } = req.body;
    const item = await AdditionalWork.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Entry not found" });

    // Safety net: a non-privileged caller can only edit their own entries.
    const selfId = req.user?.id || req.user?._id;
    if (!isPrivileged(req) && String(item.assignedTo) !== String(selfId)) {
      return res.status(403).json({ success: false, message: "You can only update your own entries" });
    }

    if (status !== undefined) item.status = status;
    if (title !== undefined) item.title = title;
    if (description !== undefined) item.description = description;
    if (category !== undefined) item.category = category;
    if (hoursSpent !== undefined) item.hoursSpent = hoursSpent === "" ? null : Number(hoursSpent);
    if (outcome !== undefined) item.outcome = outcome;

    await item.save();
    res.json({ success: true, message: "Updated", data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
exports.deleteAdditionalWork = async (req, res) => {
  try {
    const item = await AdditionalWork.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Entry not found" });

    // Safety net: a non-privileged caller can only delete their own entries.
    const selfId = req.user?.id || req.user?._id;
    if (!isPrivileged(req) && String(item.assignedTo) !== String(selfId)) {
      return res.status(403).json({ success: false, message: "You can only delete your own entries" });
    }

    await item.deleteOne();
    res.json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
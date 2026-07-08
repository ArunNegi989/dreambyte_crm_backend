const AdditionalWork = require("../../models/superadmindashboard/AdditionalWork");

// ─── CREATE ───────────────────────────────────────────────────────────────────
// Either the employee logs their own extra work (loggedBy: "self", no body
// override needed) or an admin/SA logs it on the employee's behalf
// (loggedBy: "admin", assignedTo passed explicitly).
exports.createAdditionalWork = async (req, res) => {
  try {
    const { title, description, date, assignedTo, loggedBy, category, hoursSpent, outcome } = req.body;

    if (!title || !assignedTo) {
      return res.status(400).json({ success: false, message: "title and assignedTo are required" });
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

// ─── GET ALL (optionally filtered by employee) ───────────────────────────────
exports.getAdditionalWork = async (req, res) => {
  try {
    const filter = {};
    if (req.user?.role === "employee") {
      filter.assignedTo = req.user.id;
    } else if (req.query.assignedTo) {
      filter.assignedTo = req.query.assignedTo;
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
    const item = await AdditionalWork.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Entry not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const express = require("express");
const router = express.Router();

const {
  createAdditionalWork,
  getAdditionalWork,
  updateAdditionalWork,
  deleteAdditionalWork,
} = require("../../controllers/superadmindashboard/additionalWorkController");

router.post("/", createAdditionalWork);        // log a new entry (self or admin)
router.get("/", getAdditionalWork);            // list (optionally ?assignedTo=id&status=)
router.put("/:id", updateAdditionalWork);      // update status/title/description
router.delete("/:id", deleteAdditionalWork);   // delete an entry

module.exports = router;

// ── Register in your main server file (wherever other routers are mounted) ──
// const additionalWorkRoutes = require("./routes/superadmindashboard/additionalWorkRoutes");
// app.use("/api/additional-work", additionalWorkRoutes);
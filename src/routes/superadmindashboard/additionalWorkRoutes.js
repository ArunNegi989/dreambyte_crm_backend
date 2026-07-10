const express = require("express");
const router = express.Router();
const {
  createAdditionalWork,
  getAdditionalWork,
  updateAdditionalWork,
  deleteAdditionalWork,
} = require("../../controllers/superadmindashboard/additionalWorkController");

// Same fix as Taskroutes.js — this router had no auth middleware, so
// req.user was always undefined and the "only see your own entries"
// filter in the controller could never actually run.
const auth = require("../../middleware/auth");

router.use(auth('employee'));

router.post("/", createAdditionalWork);
router.get("/", getAdditionalWork);
router.put("/:id", updateAdditionalWork);
router.delete("/:id", deleteAdditionalWork);

module.exports = router;
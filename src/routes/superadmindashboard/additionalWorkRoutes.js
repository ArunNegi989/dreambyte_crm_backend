const express = require("express");
const router = express.Router();
const {
  createAdditionalWork,
  getAdditionalWork,
  updateAdditionalWork,
  deleteAdditionalWork,
} = require("../../controllers/superadmindashboard/additionalWorkController");

router.post("/", createAdditionalWork);
router.get("/", getAdditionalWork);
router.put("/:id", updateAdditionalWork);
router.delete("/:id", deleteAdditionalWork);

module.exports = router;
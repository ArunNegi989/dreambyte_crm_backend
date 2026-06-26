const express = require("express");
const router = express.Router();

const {
  createTask,
  getTasks,
  getTask,
  updateTask,
  deliverTask,
  addChange,
  deleteTask,
} = require("../../controllers/superadmindashboard/taskController");

router.post("/", createTask);           // assign task (admin/super_admin)
router.get("/", getTasks);              // get all tasks (optionally ?assignedTo=id)
router.get("/:id", getTask);            // get single task
router.put("/:id", updateTask);         // update task (status, remark, edit)
router.post("/:id/deliver", deliverTask); // employee marks delivered
router.post("/:id/changes", addChange); // add change log note
router.delete("/:id", deleteTask);      // delete task

module.exports = router;
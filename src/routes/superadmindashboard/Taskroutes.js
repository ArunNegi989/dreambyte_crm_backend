const express = require("express");
const router = express.Router();

const {
  createTask,
  getTasks,
  getTask,
  updateTask,
  submitTask,
  respondToChanges,
  getDashboardStats,
  deliverTask,
  addChange,
  splitTask,
  deleteTask,
} = require("../../controllers/superadmindashboard/taskController");

router.post("/", createTask);                    // assign task (admin/super_admin)
router.get("/", getTasks);                        // get all tasks (optionally ?assignedTo=id&assignedBy=&topLevel=true&parentTaskId=)
router.get("/dashboard-stats", getDashboardStats); // employee's own dashboard stats
router.get("/:id", getTask);                       // get single task
router.put("/:id", updateTask);                    // update task (status, remark, edit)
router.post("/:id/submit", submitTask);            // employee submits/delivers task (fresh)
router.post("/:id/respond", respondToChanges);      // employee replies to rejection/change notes
router.post("/:id/deliver", deliverTask);           // employee marks delivered (standalone button)
router.post("/:id/changes", addChange);             // add manual change log note
router.post("/:id/split", splitTask);               // admin splits a SA-assigned task into employee sub-tasks
router.delete("/:id", deleteTask);                  // delete task

module.exports = router;
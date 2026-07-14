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
  addSubtask,
  toggleSubtask,
  removeSubtask,
  startTask
} = require("../../controllers/superadmindashboard/taskController");

// THE FIX: this router had NO auth middleware at all, so req.user was
// always undefined here no matter how you logged in — which is why the
// role-based filter in taskController.getTasks was silently never applying
// (and now correctly throws "Not authenticated" instead of leaking data).
//
// auth('employee') = lowest tier in the role hierarchy → any logged-in
// user (employee, admin, or super_admin) can hit these routes; the
// controller itself then decides what each of them is allowed to see.
const auth = require("../../middleware/auth");

router.use(auth('employee'));

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

router.post("/:id/subtasks", addSubtask);
router.patch("/:id/subtasks/:subtaskId", toggleSubtask);
router.delete("/:id/subtasks/:subtaskId", removeSubtask);

router.post("/:id/start", startTask);   // add above /:id/submit


module.exports = router;
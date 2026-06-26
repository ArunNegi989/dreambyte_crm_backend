const authController = require('./auth.controller');
const taskController = require('./task.controller');
const statsController = require('./stats.controller');

module.exports = {
  ...authController,
  ...taskController,
  ...statsController,
};
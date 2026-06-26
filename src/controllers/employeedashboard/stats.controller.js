const { Task } = require('../../models/employeedashboard/index');
const mongoose = require('mongoose');

exports.getDashboardStats = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [overallAgg, todayDue, todaySubmitted, weekDue, weekSubmitted, monthDue, monthSubmitted, notDelivered] =
      await Promise.all([
        Task.aggregate([
          { $match: { assignedTo: userId } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Task.countDocuments({ assignedTo: userId, dueDate: { $gte: startOfDay, $lte: endOfDay } }),
        Task.countDocuments({ assignedTo: userId, submittedAt: { $gte: startOfDay, $lte: endOfDay } }),
        Task.countDocuments({ assignedTo: userId, dueDate: { $gte: startOfWeek, $lte: endOfDay } }),
        Task.countDocuments({ assignedTo: userId, submittedAt: { $gte: startOfWeek, $lte: endOfDay } }),
        Task.countDocuments({ assignedTo: userId, dueDate: { $gte: startOfMonth, $lte: endOfDay } }),
        Task.countDocuments({ assignedTo: userId, submittedAt: { $gte: startOfMonth, $lte: endOfDay } }),
        Task.countDocuments({
          assignedTo: userId,
          deliveryState: 'not_delivered',
          status: { $nin: ['completed', 'approved'] },
        }),
      ]);

    const statusMap = { pending: 0, changes_requested: 0, completed: 0, approved: 0 };
    overallAgg.forEach(({ _id, count }) => {
      if (_id in statusMap) statusMap[_id] = count;
    });

    const totalAssigned = Object.values(statusMap).reduce((a, b) => a + b, 0);

    res.json({
      overall: { totalAssigned, ...statusMap, notDelivered },
      today: { due: todayDue, submitted: todaySubmitted },
      thisWeek: { due: weekDue, submitted: weekSubmitted },
      thisMonth: { due: monthDue, submitted: monthSubmitted },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
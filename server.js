require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();

    app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
})();
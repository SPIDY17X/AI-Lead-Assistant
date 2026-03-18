const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const routes = require("./routes/agentRoutes");
app.use("/api", routes);

app.get("/", (req, res) => {
  res.send("RealtyAssistant Server is running 🚀");
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
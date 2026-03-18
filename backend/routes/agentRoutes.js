const express = require("express");
const router = express.Router();

const { startAgent } = require("../controllers/agentController");

// POST /api/start — trigger the qualification flow
router.post("/start", startAgent);

module.exports = router;
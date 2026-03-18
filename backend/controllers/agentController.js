const { runAgent } = require("../services/aiService");

exports.startAgent = async (req, res) => {
  try {
    const lead = req.body;

    // Validate required fields
    if (!lead.name || !lead.phone || !lead.email) {
      return res.status(400).json({
        error: "Invalid lead data",
        message: "name, phone and email are required fields"
      });
    }

    // Validate phone (10 digits)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(lead.phone)) {
      return res.status(400).json({
        error: "Invalid phone number",
        message: "Phone must be exactly 10 digits"
      });
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.com$/;
    if (!emailRegex.test(lead.email)) {
      return res.status(400).json({
        error: "Invalid email",
        message: "Email must include @ and .com"
      });
    }

    const result = await runAgent(lead);
    res.status(200).json(result);

  } catch (error) {
    console.error("Agent error:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
};
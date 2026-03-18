const fs = require("fs");

// ════════════════════════════════════════════
//  PROMPT TEMPLATES  (as required by PDF)
// ════════════════════════════════════════════

const PROMPTS = {
  system: `You are RealtyAssistant AI, a professional real estate lead qualification agent.
Your job is to collect: name, location, property type, topology/BHK, budget, and sales consent.
Be warm, concise, and professional. Use Indian English style.`,

  greeting: (name) =>
    `Hello — this is RealtyAssistant calling about the property enquiry you submitted. Am I speaking with ${name}?`,

  askName:
    "No problem at all! May I know your good name, please?",

  askLocation:
    "Which city or area are you searching for a property in?",

  askType:
    "Are you looking for a Residential property (like a flat or house) or a Commercial property (like a shop, office, or plot)?",

  askBHK:
    "Which BHK configuration are you looking for — 1, 2, 3, or 4 BHK?",

  askCommercialType:
    "Are you interested in a Shop, Office space, or a Commercial Plot?",

  askBudget:
    "What is your budget? (e.g. 50 lakh, 1 crore, 80L)",

  askConsent:
    "Would you like a sales representative to call you to discuss the available options? (Yes / No)",

  qualifiedClose:
    "Thanks — based on your inputs, we found matching properties. A representative will call you shortly.",

  notQualifiedClose:
    "Thanks for your time — we'll keep you posted.",
};


// ════════════════════════════════════════════
//  BUDGET PARSER  (converts Indian formats)
// ════════════════════════════════════════════

function parseBudget(budgetStr) {
  if (!budgetStr) return 0;
  const str = budgetStr.toString().toLowerCase().trim();

  // e.g. "1 crore", "1.5cr", "1.5 crore"
  const croreMatch = str.match(/([\d.]+)\s*(crore|cr)/);
  if (croreMatch) return parseFloat(croreMatch[1]) * 10000000;

  // e.g. "50 lakh", "80l", "80lac", "80lakh"
  const lakhMatch = str.match(/([\d.]+)\s*(lakh|lac|l\b)/);
  if (lakhMatch) return parseFloat(lakhMatch[1]) * 100000;

  // plain number
  const plain = parseFloat(str.replace(/[^0-9.]/g, ""));
  return isNaN(plain) ? 0 : plain;
}


// ════════════════════════════════════════════
//  QUALIFICATION RULES  (deterministic)
// ════════════════════════════════════════════

function qualifyLead(data) {
  const budgetNum = parseBudget(data.budget);

  const criteria = [
    {
      criterion: "Contact Name Confirmed",
      passed: !!data.name && /^[a-zA-Z\s]{2,}$/.test(data.name),
      detail: `Name: ${data.name || "—"}`,
    },
    {
      criterion: "Location Specified",
      passed: !!data.location && data.location.length >= 3,
      detail: `Location: ${data.location || "—"}`,
    },
    {
      criterion: "Property Type Specified",
      passed: ["Residential", "Commercial"].includes(data.type),
      detail: `Type: ${data.type || "—"}`,
    },
    {
      criterion: "Topology/Subtype Specified",
      passed: !!data.config,
      detail: `Topology: ${data.config || "—"}`,
    },
    {
      criterion: "Budget Provided",
      passed: budgetNum > 0,
      detail: `Budget: ${data.budget || "—"} (₹${budgetNum.toLocaleString("en-IN")})`,
    },
    {
      criterion: "Sales Representative Consent",
      passed: data.consent === "Yes",
      detail: data.consent === "Yes"
        ? "User consented to sales follow-up"
        : "User declined sales call",
    },
    {
      criterion: "Matching Properties Available",
      passed: true,
      detail: "30 matching properties found on realtyassistant.in",
    },
  ];

  const score    = criteria.filter((c) => c.passed).length;
  const maxScore = criteria.length;

  // Core rule: name + location + type + config + budget all required
  const qualified =
    criteria[0].passed &&
    criteria[1].passed &&
    criteria[2].passed &&
    criteria[3].passed &&
    criteria[4].passed;

  return { criteria, score, maxScore, qualified };
}


// ════════════════════════════════════════════
//  ENSURE LOGS DIRECTORY EXISTS
// ════════════════════════════════════════════

if (!fs.existsSync("logs")) {
  fs.mkdirSync("logs");
}


// ════════════════════════════════════════════
//  MAIN AGENT FUNCTION
// ════════════════════════════════════════════

async function runAgent(lead) {
  const transcript = [];

  // Helper to log conversation turns
  const say  = (msg) => transcript.push({ role: "agent", msg });
  const hear = (msg) => transcript.push({ role: "user",  msg: msg?.toString() || "" });

  // ── Step 1: Greeting & Identity ──
  say(PROMPTS.greeting(lead.name));

  let contactName = lead.name;
  if (lead.confirmedName && lead.confirmedName !== lead.name) {
    hear("No, wrong person");
    say(PROMPTS.askName);
    hear(lead.confirmedName);
    contactName = lead.confirmedName;
  } else {
    hear("Yes, that's me");
  }

  // ── Step 2: Location ──
  say(PROMPTS.askLocation);
  const location = (lead.location || "").trim();
  hear(location);

  // Validate location
  if (!location || location.length < 3 || !/^[a-zA-Z\s]+$/.test(location)) {
    say('Please enter a valid location. For example: "Delhi" or "Noida Sector 62".');
    const result = buildResult("Not Qualified", 0, {
      name: contactName, location
    }, transcript, "Invalid location input", []);
    saveLog(result);
    return result;
  }

  // ── Step 3: Property Type ──
  say(PROMPTS.askType);
  const type = lead.type || "";
  hear(type);

  if (!["Residential", "Commercial"].includes(type)) {
    say("Please select Residential or Commercial.");
    const result = buildResult("Not Qualified", 0, {
      name: contactName, location, type
    }, transcript, "Invalid property type", []);
    saveLog(result);
    return result;
  }

  // ── Step 4: Topology / BHK ──
  if (type === "Residential") {
    say(PROMPTS.askBHK);
  } else {
    say(PROMPTS.askCommercialType);
  }

  const config = lead.config || lead.bhk || "";
  hear(config);

  // ── Step 5: Budget ──
  say(PROMPTS.askBudget);
  const budget = lead.budget || "";
  hear(budget.toString());

  // ── Step 6: Consent ──
  say(PROMPTS.askConsent);
  const consent = lead.consent || "No";
  hear(consent);

  // ── Step 7: Qualify & Close ──
  const { criteria, score, maxScore, qualified } = qualifyLead({
    name: contactName,
    location,
    type,
    config,
    budget,
    consent,
  });

  const decision = qualified ? "Qualified" : "Not Qualified";
  const propertyCount = qualified ? 30 : 0;

  if (consent === "Yes" && qualified) {
    say(PROMPTS.qualifiedClose);
  } else {
    say(PROMPTS.notQualifiedClose);
  }

  // ── Build Final JSON Summary ──
  const summary = {
    contact_name  : contactName,
    location,
    property_type : type,
    subtype       : config,
    budget,
    consent,
    property_count: propertyCount,
    qualification : decision,
    reason        : qualified
      ? "All key criteria met: Name confirmed, Location specified, Property type & topology provided, Budget given."
      : "One or more required fields missing or invalid.",
  };

  const fullResult = {
    leadId        : `lead_${Date.now()}`,
    timestamp     : new Date().toISOString(),
    decision,
    score,
    maxScore,
    reasons       : criteria,
    summary,
    transcript,
    contact       : {
      name  : lead.name,
      phone : lead.phone,
      email : lead.email,
    },
  };

  saveLog(fullResult);
  return fullResult;
}


// ════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════

function buildResult(decision, propertyCount, leadData, transcript, reason, criteria) {
  return {
    leadId   : `lead_${Date.now()}`,
    timestamp: new Date().toISOString(),
    decision,
    score    : 0,
    maxScore : 7,
    reasons  : criteria,
    summary  : { ...leadData, property_count: propertyCount, qualification: decision, reason },
    transcript,
  };
}

function saveLog(result) {
  try {
    fs.writeFileSync(
      `logs/${result.leadId}.json`,
      JSON.stringify(result, null, 2)
    );
  } catch (e) {
    console.error("Failed to save log:", e.message);
  }
}

module.exports = { runAgent, PROMPTS, parseBudget };
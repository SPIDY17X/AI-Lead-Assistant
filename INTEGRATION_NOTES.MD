# RealtyAssistant AI — Integration Notes

## Project Overview
RealtyAssistant AI is a lead qualification agent that collects property requirements from users via chat (with voice input support) and determines whether a lead is Qualified or Not Qualified based on deterministic rules.

---

## 1. Prompt Templates (System + Assistant + User)

These are the LLM prompt templates used for the AI agent conversation flow.

---

### 1.1 System Prompt
The system prompt defines the AI agent's role and behavior.

```
You are RealtyAssistant AI, a professional real estate lead qualification agent for realtyassistant.in (India).

Your job is to collect the following information from the user in order:
1. Confirm the user's name
2. Ask for their preferred location (city/area)
3. Ask for property type (Residential or Commercial)
4. Ask for topology — if Residential: 1/2/3/4 BHK; if Commercial: Shop/Office/Plot
5. Ask for their budget (in Indian format: lakh, crore)
6. Ask for consent to speak with a sales representative (Yes/No)

Rules:
- Ask one question at a time
- Be warm, concise, and professional
- Use Indian English style ("May I know your good name", "Which city or area")
- Accept Indian budget formats: "50 lakh", "1 crore", "80L", "2.5 cr"
- Do NOT repeat already-answered questions
- Do NOT add unnecessary preamble or commentary
```

---

### 1.2 Assistant Prompt (Conversation Script)

These are the exact messages the assistant sends at each step:

```javascript
const PROMPTS = {

  // Step 1 — Greeting & Identity
  greeting: (name) =>
    `Hello — this is RealtyAssistant calling about the property enquiry 
     you submitted. Am I speaking with ${name}?`,

  // Step 1b — If wrong person
  askName:
    "No problem at all! May I know your good name, please?",

  // Step 2 — Location
  askLocation:
    "Which city or area are you searching for a property in?",

  // Step 3 — Property Type
  askType:
    "Are you looking for a Residential property (like a flat or house) 
     or a Commercial property (like a shop, office, or plot)?",

  // Step 4a — BHK (if Residential)
  askBHK:
    "Which BHK configuration are you looking for — 1, 2, 3, or 4 BHK?",

  // Step 4b — Commercial Subtype (if Commercial)
  askCommercialType:
    "Are you interested in a Shop, Office space, or a Commercial Plot?",

  // Step 5 — Budget
  askBudget:
    "What is your budget? (e.g. 50 lakh, 1 crore, 80L)",

  // Step 6 — Sales Consent
  askConsent:
    "Would you like a sales representative to call you to discuss 
     the available options? (Yes / No)",

  // Step 7a — Qualified close
  qualifiedClose:
    "Thanks — based on your inputs, we found matching properties. 
     A representative will call you shortly.",

  // Step 7b — Not Qualified close
  notQualifiedClose:
    "Thanks for your time — we'll keep you posted.",
};
```

---

### 1.3 User Prompt (Expected User Responses)

These are the expected user responses at each step:

```
Step 1 (Identity):
  User says → "Yes, that's me" OR "No, wrong person"

Step 1b (Name):
  User says → "Rahul Sharma" (any valid name)

Step 2 (Location):
  User says → "Delhi" / "Pune" / "Noida Sector 62" (any city/area)

Step 3 (Property Type):
  User says → "Residential" OR "Commercial"

Step 4 (Topology):
  Residential → "1 BHK" / "2 BHK" / "3 BHK" / "4 BHK"
  Commercial  → "Shop" / "Office" / "Plot"

Step 5 (Budget):
  User says → "50 lakh" / "1 crore" / "80L" / "2.5 cr"

Step 6 (Consent):
  User says → "Yes" OR "No"
```

---

## 2. Integration Notes

### 2.1 Twilio — Voice Call Webhooks

Twilio is used to make outbound phone calls to leads automatically.

**How it works:**
```
Lead submits form
      ↓
Backend triggers Twilio API
      ↓
Twilio calls the lead's phone number
      ↓
Lead picks up → Twilio sends audio to our webhook
      ↓
Our agent processes the conversation
      ↓
Results saved to logs/
```

**Twilio Outbound Call Setup:**
```javascript
const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function makeCall(lead) {
  const call = await client.calls.create({
    url: "https://your-server.com/twilio/webhook",  // TwiML webhook
    to: `+91${lead.phone}`,
    from: process.env.TWILIO_PHONE_NUMBER,
  });
  console.log("Call SID:", call.sid);
}
```

**TwiML Webhook (what Twilio sends to our server):**
```javascript
// POST /twilio/webhook
app.post("/twilio/webhook", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  // Gather user speech input
  const gather = twiml.gather({
    input: "speech",
    action: "/twilio/process",   // next webhook
    speechTimeout: "auto",
    language: "en-IN",
  });

  gather.say("Hello — this is RealtyAssistant. Am I speaking with the lead?");

  res.type("text/xml");
  res.send(twiml.toString());
});
```

**Environment Variables needed:**
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
```

---

### 2.2 VAPI.ai — AI Voice Call Integration

VAPI.ai is an alternative to Twilio that provides AI-powered voice calls with built-in speech recognition and LLM integration.

**How it works:**
```
Lead submits form
      ↓
Backend calls VAPI.ai API
      ↓
VAPI.ai makes the call with AI voice
      ↓
User speaks → VAPI converts to text → sends to our LLM
      ↓
LLM responds → VAPI converts to speech → plays to user
      ↓
Call ends → VAPI sends transcript to our webhook
```

**VAPI.ai Call Trigger:**
```javascript
const axios = require("axios");

async function startVapiCall(lead) {
  const response = await axios.post(
    "https://api.vapi.ai/call/phone",
    {
      phoneNumber: `+91${lead.phone}`,
      assistant: {
        firstMessage: `Hello — this is RealtyAssistant calling about 
                       the property enquiry you submitted. 
                       Am I speaking with ${lead.name}?`,
        model: {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          systemPrompt: PROMPTS.system,
        },
        voice: {
          provider: "elevenlabs",
          voiceId: "rachel",
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}
```

**VAPI Webhook (receives transcript after call ends):**
```javascript
// POST /vapi/webhook
app.post("/vapi/webhook", (req, res) => {
  const { transcript, callId, status } = req.body;

  if (status === "ended") {
    // Save transcript to logs
    saveLog({ callId, transcript, timestamp: new Date().toISOString() });
  }

  res.json({ success: true });
});
```

---

### 2.3 Audio-to-Text Provider

For converting user speech to text during voice calls.

**Option 1 — Twilio (built-in):**
```javascript
// Twilio has built-in speech recognition
gather.input = "speech";
gather.language = "en-IN";  // Indian English
gather.speechTimeout = "auto";
// Twilio automatically converts speech to text
// and sends it as req.body.SpeechResult
```

**Option 2 — Google Speech-to-Text:**
```javascript
const speech = require("@google-cloud/speech");
const client = new speech.SpeechClient();

async function transcribeAudio(audioBuffer) {
  const [response] = await client.recognize({
    audio: { content: audioBuffer.toString("base64") },
    config: {
      encoding: "LINEAR16",
      sampleRateHertz: 8000,
      languageCode: "en-IN",          // Indian English
      alternativeLanguageCodes: ["hi-IN"],  // Hindi fallback
    },
  });
  return response.results[0].alternatives[0].transcript;
}
```

**Option 3 — OpenAI Whisper:**
```javascript
const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function transcribeWithWhisper(audioFile) {
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    language: "en",
  });
  return transcription.text;
}
```

**Note:** In our current implementation, the browser's built-in **Web Speech API** is used for voice input in the chat interface — this is free and requires no API key.

---

### 2.4 Retries & Backoffs

Retry logic ensures the system handles failures gracefully without crashing.

**Retry utility function:**
```javascript
async function withRetry(fn, maxRetries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw new Error(`All ${maxRetries} attempts failed: ${error.message}`);
      }

      // Exponential backoff: 1s → 2s → 4s
      const waitTime = delayMs * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${waitTime}ms...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
}
```

**Usage in agent:**
```javascript
// Retry Twilio call up to 3 times
const callResult = await withRetry(
  () => makeCall(lead),
  3,      // max retries
  1000    // initial delay 1 second
);

// Retry VAPI call
const vapiResult = await withRetry(
  () => startVapiCall(lead),
  3,
  2000
);
```

**Backoff Strategy:**
```
Attempt 1 → fails → wait 1 second
Attempt 2 → fails → wait 2 seconds
Attempt 3 → fails → wait 4 seconds
Attempt 4 → throw final error → log to file
```

---

## 3. Current Implementation Summary

| Feature | Current Approach | Production Approach |
|---------|-----------------|-------------------|
| Chat | Browser-based chat (chat.html) | Twilio / VAPI.ai voice call |
| Voice Input | Web Speech API (free, browser) | Google STT / Whisper |
| AI Logic | Rule-based (no API needed) | Claude / GPT with prompts |
| Storage | Local JSON files (logs/) | MongoDB / PostgreSQL |
| Retries | Not needed (no external calls) | withRetry() utility |

---

## 4. Environment Variables (for Production)

```env
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

# VAPI.ai
VAPI_API_KEY=xxxxxxxxxxxxxxx

# Google Speech-to-Text
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json

# OpenAI Whisper
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxx

# Server
PORT=3000
NODE_ENV=production
```

---




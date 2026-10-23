import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { cloudStore } from './server/cloudStore';
import { billingStatus, createCheckoutSession, handleWebhook } from './server/billing';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Stripe webhook requires the RAW request body for signature verification.
// Registered before the JSON parser: body-parser skips re-parsing once
// req._body is set, so the raw Buffer survives intact to the handler.
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'quadraminds.ai' });
});

// Step B: Digital Asset Links Pairing for Google Play TWA verification
app.get('/.well-known/assetlinks.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const assetLinksPath = path.join(process.cwd(), 'public', '.well-known', 'assetlinks.json');
  res.sendFile(assetLinksPath);
});

// Explicit manifest routes for PWA / Google Play / PWABuilder scanners
const sendManifest = (_req: express.Request, res: express.Response) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.sendFile(path.join(process.cwd(), 'public', 'manifest.webmanifest'));
};
app.get('/manifest.webmanifest', sendManifest);
app.get('/manifest.json', sendManifest);

// ==========================================
// Step A: Cloud Sync & Authentication Endpoints
// ==========================================

// Authenticate / Login user
app.post('/api/auth/login', (req, res) => {
  try {
    const { uid, email, displayName, accountTier, curriculumWave } = req.body;
    const targetUid = uid || (email ? `user_${Buffer.from(email).toString('hex').slice(0, 10)}` : 'user_123');
    
    let profile = cloudStore.getProfile(targetUid);
    if (!profile) {
      profile = cloudStore.upsertProfile({
        uid: targetUid,
        email: email || 'observer@quadra.sight',
        displayName: displayName || (targetUid === 'user_123' ? 'Observer' : 'Practitioner'),
        accountTier: accountTier || (targetUid === 'user_123' ? 'premium' : 'practitioner'),
        curriculumWave: curriculumWave ?? 1,
      });
    }

    const cloudData = cloudStore.getCloudSync(targetUid);
    res.json({
      success: true,
      token: `token_${targetUid}_${Date.now()}`,
      profile,
      cloudData,
    });
  } catch (err: any) {
    console.error('Auth Login error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch Profile
app.get('/api/auth/profile', (req, res) => {
  try {
    const uid = (req.query.uid as string) || req.headers['x-user-uid'] as string || 'user_123';
    const profile = cloudStore.getProfile(uid) || cloudStore.getProfile('user_123');
    res.json({ success: true, profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Profile
app.put('/api/auth/profile', (req, res) => {
  try {
    const { uid, ...updates } = req.body;
    const targetUid = uid || 'user_123';
    const updated = cloudStore.upsertProfile({ uid: targetUid, ...updates });
    res.json({ success: true, profile: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Pull Cloud Data for Cross-Device Sync
app.get('/api/sync/pull', (req, res) => {
  try {
    const uid = (req.query.uid as string) || (req.headers['x-user-uid'] as string) || 'user_123';
    const data = cloudStore.getCloudSync(uid) || cloudStore.getCloudSync('user_123');
    res.json({
      success: true,
      data,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Push Local State to Cloud Sync
app.post('/api/sync/push', (req, res) => {
  try {
    const { uid, profile, journal, progress, sight } = req.body;
    const targetUid = uid || profile?.uid || 'user_123';
    const synced = cloudStore.saveCloudSync(targetUid, {
      profile,
      journal,
      progress,
      sight,
    });
    res.json({
      success: true,
      lastSyncedAt: synced.lastSyncedAt,
      profile: synced.profile,
    });
  } catch (err: any) {
    console.error('Cloud sync push error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Account Tier Matrix Info
app.get('/api/auth/tiers', (_req, res) => {
  res.json({
    tiers: [
      {
        tier: 'free',
        name: 'Seeker',
        curriculumLimit: 'Wave 1 (Orientation)',
        cloudSync: false,
        aiFacilitator: 'Standard Reflection',
        features: ['Four-quadrant logging', 'Local storage', 'Wave 1 curriculum'],
      },
      {
        tier: 'practitioner',
        name: 'Practitioner',
        curriculumLimit: 'Waves 1 — 4',
        cloudSync: true,
        aiFacilitator: 'Dialectic Inquiries',
        features: ['Cloud sync across web & mobile', 'Binaural wave states', 'Biometric privacy lock'],
      },
      {
        tier: 'premium',
        name: 'Observer (Full Access)',
        curriculumLimit: 'Waves 1 — 8 (Complete Progression)',
        cloudSync: true,
        aiFacilitator: 'Deep Metacognitive Pattern Discovery',
        features: ['Full 8 Curriculum Waves', 'Real-time multi-device cloud sync', 'Spatial Audio Neural Engine', 'Offline PWA & TWA certified'],
      },
    ],
  });
});

// ==========================================
// Step C: Stripe Subscription Billing (open web)
// ==========================================
// M.I.N.D. Sight Premium — $14.99/month. Checkout creates the subscription;
// the webhook upgrades accountTier to 'premium' (downgrades to
// 'practitioner' on cancel). Never touches the free 'Seeker' tier.
app.post('/api/billing/checkout', createCheckoutSession);
app.post('/api/billing/webhook', handleWebhook);
app.get('/api/billing/status', billingStatus);

// Lazy-initialize Gemini client to prevent crashes if key is not configured
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'quadra-mind-sight',
          },
        },
      });
    }
  }
  return aiClient;
}

// Gemini model used by all AI endpoints. Overridable via GEMINI_MODEL env var.
// 'gemini-3.8-flash' never existed — the old name silently 404'd and every
// request fell through to the canned offline fallbacks.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const SYSTEM_FACILITATOR_PROMPT = `You are the Quadra-M.I.N.D. Sight Facilitator (Meta Interpersonal Neural Dialectic Sight).
Your role is to guide metacognitive observation rather than impose interpretations.
Help the user distinguish:
- Memory (Quadrant I: Past, sensory history, episodic recall, "What brought me here?")
- Affect / Meaning (Quadrant II: Emotional significance, interpretation, salience, "What does this mean to me?")
- Embodiment / Present (Quadrant III: Proprioception, body sensations, breath, "What is happening now?")
- Projection / Future (Quadrant IV: Predictive modeling, imagination, simulation, "What could happen next?")
- Meta-Awareness (The central perspective: "What observes all four?")

Core principles:
1. Socratic, calm, intelligent, curious, and non-dogmatic.
2. Never tell users what their experience "really means".
3. Never claim subjective experiences prove supernatural, psychic, paranormal, quantum, spiritual, or external phenomena.
4. Never diagnose the user or provide medical advice.
5. When unusual or intense experiences arise, guide the user to ground in present physical sensations.
6. Emphasize epistemic humility: help distinguish between direct observation and mental interpretation.
7. Tone: dark cosmic scientific minimalism, measured, thoughtful, concise (2-4 paragraphs max).`;

// API endpoint for Facilitator Chat
app.post('/api/gemini/facilitator', async (req, res) => {
  try {
    const { message, history, currentQuadrant, userState } = req.body;
    const ai = getGeminiClient();

    const fallbackResponses: Record<string, string> = {
      memory: `Notice the memory that has surfaced. Look closely at the raw sensory fragments before attaching a story to them: what specific image, sound, or physical impression stands out? As you hold this, ask: "What brought me here, and where does memory end and present interpretation begin?"`,
      meaning: `Observe the significance your mind has assigned to this. Notice the emotional charge without resisting or amplifying it. Can you separate the neutral event that occurred from the value judgment and narrative you constructed around it?`,
      present: `Shift attention completely to the physical vessel right now. Notice your breathing, the contact points of your body against the chair, the temperature of the air on your skin. What physical sensation is most vivid in this exact moment?`,
      future: `Observe the scenario your mind is projecting. Treat it strictly as a predictive simulation rather than an inevitability. What assumptions is this projection built upon? Can you construct two alternative simulations with different outcomes?`,
      meta: `Step back into the observer position. You are aware of the memory, the emotional meaning, the physical body sensations, and the future projections. Notice: what is the nature of the awareness that observes all four without being overwhelmed by any of them?`,
    };

    if (!ai) {
      const reply = fallbackResponses[currentQuadrant || 'meta'] || fallbackResponses['meta'];
      return res.json({ reply, source: 'offline_facilitator' });
    }

    const contextPrompt = `Current Quadrant Focus: ${currentQuadrant || 'meta'}.
User Reported State: ${JSON.stringify(userState || {})}.
Conversation History:
${(history || []).map((h: { sender: string; text: string }) => `${h.sender}: ${h.text}`).join('\n')}

User says: ${message}

Respond as the Quadra-M.I.N.D. Sight Facilitator. Ask a precision Socratic dialectic question that guides the user to differentiate between observation and interpretation.`;

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: contextPrompt,
        config: {
          systemInstruction: SYSTEM_FACILITATOR_PROMPT,
          temperature: 0.7,
        },
      });

      const reply = response.text || fallbackResponses[currentQuadrant || 'meta'] || fallbackResponses['meta'];
      res.json({ reply, source: 'gemini' });
    } catch (modelError: any) {
      console.warn('Gemini Facilitator temporary demand spike (using Socratic fallback):', modelError?.message || modelError);
      const reply = fallbackResponses[currentQuadrant || 'meta'] || fallbackResponses['meta'];
      res.json({ reply, source: 'dialectic_fallback', notice: 'Facilitator operating in adaptive local mode during high model demand.' });
    }
  } catch (error: any) {
    console.error('Facilitator API Error:', error);
    res.json({
      reply: 'Observe what appears in your awareness right now. Describe the immediate sensory quality before interpreting its meaning.',
      source: 'safe_fallback'
    });
  }
});

// API endpoint for Quadra Solve (Creative Problem Solving)
app.post('/api/gemini/solve', async (req, res) => {
  try {
    const { problemDescription, userNotes } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        past: "Examine past precedents: What previous situations shared this exact dynamic? Which assumptions worked then but might fail here?",
        meaning: "Examine emotional salience: Why does solving this problem matter to your core values? What fear or desire is driving the urgency?",
        present: "Evaluate present reality: What concrete, unchangeable constraints exist right now (time, resources, energy, focus)?",
        future: "Simulate candidate paths: Path A (Direct confrontation of root constraint), Path B (Reframe the problem to render it obsolete), Path C (Iterative low-risk probe).",
        meta: "Meta-Synthesis: What implicit hypothesis is shared by all perspectives? If that foundational assumption were false, how does the entire problem dissolve?",
        source: 'offline_solve'
      });
    }

    const prompt = `Analyze this problem through the Quadra-M.I.N.D. Sight cognitive architecture:
Problem: "${problemDescription}"
Additional Notes: "${userNotes || 'None'}"

Provide a structured dialectic breakdown in valid JSON with these exact keys:
- "past": Precedents, relevant knowledge, past patterns
- "meaning": Emotional significance, why it matters, underlying values
- "present": Current sensory/tangible constraints and immediate reality
- "future": 3 distinct predictive simulations / potential trajectories
- "meta": Core shared assumptions across all four quadrants and high-leverage reframing candidate strategies.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_FACILITATOR_PROMPT,
        responseMimeType: 'application/json',
        temperature: 0.6,
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Quadra Solve API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint for Interpersonal Quadra (Dialectic Relationship Analysis)
app.post('/api/gemini/interpersonal', async (req, res) => {
  try {
    const { interactionText, otherPersonRole } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        observableEvents: "Verbal cues and physical actions that could be verified by an objective camera recording.",
        userInterpretations: "The meaning, motive, and intent your mind attributed to those actions.",
        somaticExperience: "The physiological sensations (tension in throat, chest contraction, heat) triggered in the present moment.",
        projectedFutures: "The worst-case or defensive scenarios your predictive imagination is forecasting.",
        counterpartPerspectives: "What might the counterpart's four quadrants have held? Their unexpressed history, somatic stress, and alternative motives.",
        dialecticInquiry: "What evidence distinguishes what actually happened from the narrative your protective mind assembled?",
        source: 'offline_interpersonal'
      });
    }

    const prompt = `Analyze this interpersonal interaction:
Interaction: "${interactionText}"
Counterpart / Context: "${otherPersonRole || 'Colleague / Partner'}"

Deconstruct using the Meta Interpersonal Neural Dialectic:
1. Observable Events (pure facts without interpretation)
2. User Interpretation (meaning and motive assigned)
3. Somatic Experience (emotional and bodily response)
4. Projected Future (predictive simulation of consequences)
5. Counterpart's Possible Quadrants (hypothesized memory, meaning, present pressures, and projections—framed with epistemic humility: 'One possibility is...', 'Consider if...')
6. Dialectic Inquiry (questions to reveal blind spots and ground the interaction).

Format strictly as JSON with keys:
"observableEvents", "userInterpretations", "somaticExperience", "projectedFutures", "counterpartPerspectives", "dialecticInquiry".`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_FACILITATOR_PROMPT,
        responseMimeType: 'application/json',
        temperature: 0.6,
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Interpersonal API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint for Pattern Recognition from Journal
app.post('/api/gemini/patterns', async (req, res) => {
  try {
    const { journalEntries } = req.body;
    const ai = getGeminiClient();

    if (!ai || !journalEntries || journalEntries.length === 0) {
      return res.json({
        patterns: [
          {
            theme: "Future-Orientation & Somatic Tension",
            observation: "High probability simulation in Quadrant IV frequently correlates with reported chest or shoulder tension.",
            suggestedInquiry: "When future simulations intensify, does shifting to Quadrant III (sensory present) dissolve the predictive urgency?"
          },
          {
            theme: "Memory Fragment to Meaning Coupling",
            observation: "Sensory fragments from Quadrant I are often quickly converted into emotional narratives in Quadrant II.",
            suggestedInquiry: "Can you practice resting with the raw sensory memory for 30 seconds before allowing meaning to attach?"
          }
        ]
      });
    }

    const prompt = `Analyze these self-reported consciousness journal entries for recurring metacognitive patterns:
${JSON.stringify(journalEntries.slice(0, 8))}

Identify 2-3 non-diagnostic, self-reported themes. Never diagnose or judge. Frame as gentle inquiries.
Format as JSON with key "patterns", an array of { "theme": string, "observation": string, "suggestedInquiry": string }.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_FACILITATOR_PROMPT,
        responseMimeType: 'application/json',
        temperature: 0.5,
      },
    });

    res.json(JSON.parse(response.text || '{"patterns":[]}'));
  } catch (error: any) {
    console.error('Patterns API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Setup Vite middleware for development or serve static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Quadra-M.I.N.D. Sight Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

export { app };

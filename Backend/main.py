# ==========================================
#  FOLIAGE CARE — API GATEWAY v2.1
#  No CNN. Pure Gemini Vision.
#  M1: /predict         — Diagnosis + region overlay
#  M2: /simulate        — Disease progression image
#  M3: /get_expert_plan — Full treatment plan
#  M4: /followup        — Context-aware chat
# ==========================================

import os
import io
import json
import base64
import traceback
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image
from huggingface_hub import InferenceClient

# ─────────────────────────────────────────
#  1. STARTUP
# ─────────────────────────────────────────
load_dotenv()

app = FastAPI(
    title="FoliageCare API",
    version="2.1.0",
    description="Plant health consultation API — India-specific, Gemini Vision powered",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
HF_TOKEN       = os.getenv("HF_TOKEN")

# ─────────────────────────────────────────
#  2. GEMINI CLIENT
# ─────────────────────────────────────────
gemini_client = None
if GEMINI_API_KEY:
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        print("✅ Gemini Client Ready")
    except Exception as e:
        print(f"❌ Gemini Init Failed: {e}")
else:
    print("⚠️  GEMINI_API_KEY not set — all AI endpoints will return errors")

# ─────────────────────────────────────────
#  3. GENERATION CONFIGS (per module)
# ─────────────────────────────────────────

# /predict — precision diagnosis, JSON enforced
PREDICT_CONFIG = types.GenerateContentConfig(
    temperature=0.1,
    max_output_tokens=4096,
    response_mime_type="application/json",  # clean JSON always, no markdown fences
    safety_settings=[
        types.SafetySetting(
            category="HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold="BLOCK_NONE",
        ),
        types.SafetySetting(
            category="HARM_CATEGORY_HARASSMENT",
            threshold="BLOCK_NONE",
        ),
        types.SafetySetting(
            category="HARM_CATEGORY_HATE_SPEECH",
            threshold="BLOCK_NONE",
        ),
        types.SafetySetting(
            category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold="BLOCK_NONE",
        ),
    ],
)

# /simulate — creative image prompt generation
SIMULATE_CONFIG = types.GenerateContentConfig(
    temperature=0.7,
    max_output_tokens=256,
)

# /get_expert_plan — balanced tone, long markdown output
EXPERT_PLAN_CONFIG = types.GenerateContentConfig(
    temperature=0.3,
    max_output_tokens=2048,
    safety_settings=[
        types.SafetySetting(
            category="HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold="BLOCK_NONE",
        ),
    ],
)

# /followup — conversational, natural variance ok
FOLLOWUP_CONFIG = types.GenerateContentConfig(
    temperature=0.4,
    max_output_tokens=1024,
)

# ─────────────────────────────────────────
#  4. HELPERS
# ─────────────────────────────────────────

def get_indian_season() -> str:
    """Returns the current Indian season with farming-relevant context."""
    m = datetime.now().month
    if 6 <= m <= 9:
        return (
            "Monsoon (June–September) — high humidity, peak fungal disease risk, "
            "root rot danger from overwatering, waterlogging alerts for low-lying fields"
        )
    elif 10 <= m <= 11:
        return (
            "Post-Monsoon (October–November) — excellent time to fertilize, repot, "
            "and propagate; soil moisture still good, cooler nights ahead"
        )
    elif 12 <= m <= 2:
        return (
            "Winter (December–February) — frost risk in North India, reduce watering "
            "frequency, protect tender plants from cold waves, Rabi crop care season"
        )
    else:
        return (
            "Summer (March–May) — extreme heat stress, increase watering to twice daily, "
            "provide shade for pots, drought-tolerant advice for Rajasthan/Gujarat regions"
        )


def normalize_user_type(user_type: Optional[str]) -> str:
    value = (user_type or "home_gardener").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "gardener": "home_gardener",
        "home": "home_gardener",
        "home_gardener": "home_gardener",
        "farmer": "farmer",
        "nursery": "nursery",
        "student": "student",
        "researcher": "student",
        "student_research": "student",
        "studentresearch": "student",
    }
    return aliases.get(value, "home_gardener")


def get_user_type_profile(user_type: Optional[str]) -> dict:
    normalized = normalize_user_type(user_type)

    profiles = {
        "home_gardener": {
            "label": "home_gardener",
            "guidance": (
                "User is a HOME GARDENER — focus on pot, balcony, terrace, and indoor plant care. "
                "Suggest kitchen-ingredient remedies first. Keep the tone warm, simple, and reassuring."
            ),
            "language_rules": (
                "- Avoid technical jargon. Use plain, friendly language.\n"
                "- Explain symptoms like a knowledgeable neighborhood plant expert.\n"
                "- Always include Hindi/local plant names alongside English when relevant."
            ),
            "predict_focus": (
                "- Prioritize practical next steps for a small number of plants.\n"
                "- Mention watering correction, light placement, pruning, and easy home remedies.\n"
                "- Keep every action low-cost and easy to do at home."
            ),
            "plan_focus": (
                "- Emphasize simple home care, small-batch mixing instructions, and household-safe handling.\n"
                "- Mention how to prevent spread to nearby balcony or indoor plants."
            ),
            "followup_focus": (
                "- Answer with encouragement and step-by-step help for a non-expert grower.\n"
                "- Translate any needed technical idea into simple everyday language immediately."
            ),
        },
        "farmer": {
            "label": "farmer",
            "guidance": (
                "User is a FARMER — give acreage-aware, yield-aware, operational advice. "
                "Mention Krishi Vigyan Kendra (KVK) support when relevant and use Kharif/Rabi/Zaid seasonal context."
            ),
            "language_rules": (
                "- Use simple field language, not academic wording.\n"
                "- Keep instructions operational and outcome-focused.\n"
                "- Always include Hindi/local plant names alongside English when relevant."
            ),
            "predict_focus": (
                "- In immediate_action, mention field containment, irrigation adjustment, and spread control.\n"
                "- In chemical_option, prefer products commonly available in Indian agri markets and include practical spray guidance.\n"
                "- When relevant, reference likely crop loss risk, per-acre planning, or whether a KVK/agri officer review is warranted."
            ),
            "plan_focus": (
                "- Include scale-aware treatment logic, spray timing, and field sanitation.\n"
                "- Prefer advice that protects yield and prevents spread across rows, plots, or adjacent plants."
            ),
            "followup_focus": (
                "- Answer as if the user may need to make a time-sensitive farm decision.\n"
                "- Keep advice concise, decisive, and tied to field action."
            ),
        },
        "nursery": {
            "label": "nursery",
            "guidance": (
                "User is a NURSERY OPERATOR — focus on batch management, disease containment, propagation hygiene, "
                "staff repeatability, and cost-effective treatment across many plants."
            ),
            "language_rules": (
                "- Use clear operational language suitable for nursery staff and managers.\n"
                "- Avoid unnecessary academic jargon, but be precise about isolation and sanitation.\n"
                "- Always include Hindi/local plant names alongside English when relevant."
            ),
            "predict_focus": (
                "- In immediate_action, prioritize isolation, tagging, and stopping spread across stock.\n"
                "- Mention sanitation of benches, tools, trays, misting zones, and nearby inventory when relevant.\n"
                "- Favor repeatable, batch-safe actions over one-off home remedies."
            ),
            "plan_focus": (
                "- Structure treatment around stock segregation, routine monitoring, and sanitation workflow.\n"
                "- Mention how to reduce disease spread during watering, propagation, transport, or display."
            ),
            "followup_focus": (
                "- Answer with stock-management and workflow consistency in mind.\n"
                "- Highlight how to monitor the rest of the batch, not just the single plant."
            ),
        },
        "student": {
            "label": "student",
            "guidance": (
                "User is a STUDENT OR RESEARCHER — balance accessibility with technical clarity. "
                "Use common names first, then correct botanical or pathology terms where helpful. "
                "You may mention ICAR, agricultural universities, or extension resources when relevant."
            ),
            "language_rules": (
                "- You may use light technical terminology, but define it in simple words immediately.\n"
                "- Mention likely differentials, symptom patterns, and uncertainty more explicitly than for other users.\n"
                "- Always include Hindi/local plant names alongside English when relevant."
            ),
            "predict_focus": (
                "- In trust_signals, be more explicit about the observed symptom pattern and why alternatives were ruled out.\n"
                "- You may mention a likely pathogen class or technical symptom label if you explain it plainly.\n"
                "- Keep the JSON fields short, but make them more analytical than other user types."
            ),
            "plan_focus": (
                "- In the explanation section, briefly connect symptoms to likely disease process or plant stress mechanism.\n"
                "- Keep the treatment practical, but allow slightly more technical precision where it helps learning."
            ),
            "followup_focus": (
                "- If the question is analytical, answer with a bit more reasoning depth.\n"
                "- You may compare hypotheses or explain diagnostic uncertainty, as long as it stays understandable."
            ),
        },
    }

    return profiles[normalized]


def build_indian_context(
    user_name: str,
    location:  Optional[str],
    latitude:  Optional[str],
    longitude: Optional[str],
    context:   Optional[str],
    user_type: Optional[str] = None,
    weather: Optional[str] = None,
) -> str:
    
    """
    Shared Indian context block injected into every Gemini prompt.
    Handles season, user type tone, language rules, remedy priority, location.
    """
    profile = get_user_type_profile(user_type)
    loc_str = (
        f"{location} (GPS: {latitude}, {longitude})"
        if latitude and longitude
        else (location or "India (location not specified)")
    )

    return f"""
=== FOLIAGECARE INDIA CONTEXT ===
User Name    : {user_name}
User Type    : {profile["label"]}
Location     : {loc_str}
Date         : {datetime.now().strftime('%B %d, %Y')}
Current Wx   : {weather or "Weather data unavailable"}
Indian Season: {get_indian_season()}
User Context : {context or "No additional context provided"}

--- CLIMATE & DIAGNOSIS RULES ---
You must use the 'Weather Trend/weather' and 'Location' to influence your diagnosis of the image:
1. ARID/DRY HEAT (e.g., Rajasthan, high temp, 0mm rain trend): Prioritize heat scorch, spider mites (which thrive in dry dust), and severe underwatering. Rule out fungal blights unless explicitly visible.
2. HUMID/WET (e.g., Pune during monsoon, moderate temps, high rain trend): Prioritize powdery mildew, root rot, and bacterial leaf spots. 
3. If the image looks like a borderline case (e.g., yellowing leaves), use the weather trend as the deciding factor (yellowing + zero rain = drought stress; yellowing + heavy rain = root suffocation).

--- USER TYPE GUIDANCE ---
{profile["guidance"]}

--- LANGUAGE RULES ---
- Detect the language in the user's message and reply in the SAME language.
- Always include Hindi / local plant names alongside English where relevant.
- {profile["language_rules"]}
- Be helpful, grounded, and encouraging — but stay honest about uncertainty.

--- REMEDY PRIORITY (always recommend in this order) ---
1. Desi / home remedy  : neem oil spray, turmeric paste, cow dung, wood ash,
                         buttermilk, diluted soap water, cinnamon powder
2. Organic products    : Jeevamrut, Panchagavya, vermicompost, neem cake,
                         Trichoderma viride, Pseudomonas fluorescens
3. Indian agri brands  : Coromandel, Dhanuka, PI Industries, Bayer India,
                         Syngenta India, Rallis India, UPL
4. Chemical (last)     : Only if infestation is severe. Always prefix with
                         "Only if the above does not work in 3–4 days:" and
                         include a safety/PPE warning.

--- PRODUCT RULES ---
- Only recommend products available in India (Amazon.in, local agri shop, KVK).
- Never suggest Miracle-Gro, Scotts, or other Western-only brands.
- End every response with one seasonal prevention tip for the current Indian season.
=================================
"""


# ─────────────────────────────────────────
#  5. ENDPOINTS
# ─────────────────────────────────────────

@app.get("/")
def home():
    return {
        "status":  "FoliageCare API v2.1 Online",
        "engine":  "Gemini Vision — no CNN",
        "season":  get_indian_season(),
        "modules": {
            "POST /predict":         "Diagnosis + region overlay + trust signals",
            "POST /simulate":        "Disease progression image (7-day forecast)",
            "POST /get_expert_plan": "Full markdown treatment plan",
            "POST /followup":        "Context-aware follow-up chat",
        },
    }


# ── MODULE 1 ── DIAGNOSIS ──────────────────────────────────────
@app.post("/predict")
async def predict(
    file:      UploadFile     = File(...),
    user_name: str            = Form("Farmer"),
    user_type: str            = Form("home_gardener"),
    location:  Optional[str] = Form(None),
    context:   Optional[str] = Form(None),
    latitude:  Optional[str] = Form(None),
    longitude: Optional[str] = Form(None),
    weather:   Optional[str]  = Form(None),
):
    """
    Module 1 — Full plant disease diagnosis via Gemini Vision.

    Returns structured JSON with:
    - diagnosis: plant, disease, severity, confidence
    - visual_evidence: description + affected_regions (% coords for frontend overlay)
    - trust_signals: why this diagnosis, alternative ruled out, confidence explanation
    - action_plan: immediate, desi remedy, organic, chemical (last resort), seasonal tip
    """
    if not gemini_client:
        return {"error": "Gemini client not initialized. Check GEMINI_API_KEY."}

    image_bytes = await file.read()
    image       = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    profile     = get_user_type_profile(user_type)
    india_ctx   = build_indian_context(
        user_name, location, latitude, longitude, context, user_type, weather
    )

    prompt = f"""
{india_ctx}

You are FoliageCare AI — an expert plant pathologist consulting with {user_name}.

TASK: Analyze the uploaded plant/leaf image. Cross-reference the visual symptoms with the "Current Wx" (weather) data. 
- If temperatures are very high, consider heat stress, sunburn, or underwatering before diagnosing a pathogen.
- If it is currently raining or highly humid, heavily weigh fungal infections (like powdery mildew or blight) as the primary cause.
- Tailor the explanation and action plan for a {profile["label"]}.

ROLE-SPECIFIC DIAGNOSIS FOCUS:
{profile["predict_focus"]}

response_mime_type is application/json — output raw JSON only, nothing else.

--- STEP 1: Validate the image ---
If the image does NOT contain a plant leaf, crop, plant part, or vegetation of any kind:
{{
  "is_invalid_image": true,
  "message": "Friendly 1-sentence tip in the user's language asking for a clear leaf photo."
}}

--- STEP 2: Full diagnosis (if valid plant image) ---
{{
  "is_invalid_image": false,

  "diagnosis": {{
    "plant":       "Common name (e.g. Tomato, Wheat, Tulsi, Money Plant, Rose)",
    "plant_hindi": "Hindi/local name (e.g. Tamatar, Gehun, Tulsi, Pothos, Gulab)",
    "disease":     "Disease name in plain English. Use 'Healthy' if no disease.",
    "severity":    "none | mild | moderate | severe",
    "confidence":  0.0
  }},

  "visual_evidence": {{
    "description": "1–2 sentences: WHERE and WHAT you see on the leaf. Plain English. No jargon.",
    "affected_regions": [
      {{
        "label": "Short label (e.g. 'Brown spots', 'Yellowing edge', 'White powder')",
        "x_pct": 0.0,
        "y_pct": 0.0,
        "w_pct": 0.0,
        "h_pct": 0.0
      }}
    ]
  }},

  "trust_signals": {{
    "why_this_diagnosis":     "1 sentence — the key visual feature confirming this diagnosis.",
    "alternative_diagnosis":  "Second most likely disease and why ruled out. Or: 'None — presentation is clear.'",
    "confidence_explanation": "1 sentence — why confidence is high or low (lighting, image angle, disease stage)."
  }},

  "action_plan": {{
    "immediate_action": "The single most important thing to do TODAY. Simple language.",
    "desi_remedy":      "Home remedy with exact prep. e.g. 'Mix 5ml neem oil in 1 litre water, spray morning or evening.'",
    "organic_option":   "Organic product available in India + how to apply.",
    "chemical_option":  "Indian brand product. MUST start with: 'Only if the above does not work in 3–4 days: '",
    "seasonal_tip":     "One prevention tip specific to the current Indian season."
  }}
}}

COORDINATE RULES for affected_regions:
- x_pct, y_pct, w_pct, h_pct are fractions of image size (0.0–1.0).
- Example: top-left quarter spot → x_pct=0.05, y_pct=0.05, w_pct=0.25, h_pct=0.25
- Include 1–4 regions maximum. Healthy plant → empty array [].
- confidence is a float 0.0–1.0 (e.g. 0.91 not 91).
- Do NOT change the JSON schema. Curate the wording inside the existing fields for the user type.
"""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt, image],
            config=PREDICT_CONFIG,
        )
        # response_mime_type=application/json guarantees valid JSON in response.text
        return json.loads(response.text)

    except json.JSONDecodeError as e:
        raw = getattr(response, "text", "")
        # Attempt to strip any accidental markdown fences and re-parse
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        try:
            return json.loads(clean)
        except Exception:
            return {
                "error":        "Gemini returned non-JSON output.",
                "raw_response": raw[:500],
                "detail":       str(e),
            }
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}


# ── MODULE 2 ── DISEASE PROGRESSION SIMULATION ────────────────
@app.post("/simulate")
async def simulate_progression(
    file:         UploadFile     = File(...),
    disease_name: str            = Form(...),
    context:      Optional[str] = Form(None),
    user_name:    str            = Form("Farmer"),
    user_type:    str            = Form("home_gardener"),
    latitude:     Optional[str] = Form(None),
    longitude:    Optional[str] = Form(None),
    weather:   Optional[str]  = Form(None),
):
    """
    Module 2 — Simulates disease appearance after 7 days untreated.

    Step 1: Gemini builds a contextual visual progression prompt.
    Step 2: HuggingFace generates the future image (3 cascading fallbacks).
    Returns: base64 future_image + prompt_used (shown to user for transparency).
    """
    image_bytes    = await file.read()
    original_image = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((512, 512))

    # Step 1 — Gemini builds a smart contextual image edit prompt
    if gemini_client:
        loc_str = (
            f"GPS: {latitude}, {longitude}"
            if latitude and longitude
            else "India (location not specified)"
        )
        gemini_prompt = f"""
The plant has been diagnosed with '{disease_name}'.
User type: {user_type}
Context: "{context or 'no additional context'}"
Location: {loc_str}
Current Indian season: {get_indian_season()}

How would this disease visually appear on the leaf in 7 days if completely untreated?
Factor in the current season's humidity and temperature typical for India.

Reply ONLY with a comma-separated image generation prompt (5–10 descriptors).
Describe VISUAL appearance only — color, texture, spread, damage extent.
Example format: "severely yellowed leaf, large dark brown patches from edges, wilting, photorealistic"
NO markdown. NO explanation. Just the prompt string.
"""
        try:
            r = gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=gemini_prompt,
                config=SIMULATE_CONFIG,
            )
            edit_instruction = r.text.strip()
        except Exception as e:
            print(f"⚠️ Gemini simulation prompt failed: {e}")
            edit_instruction = (
                f"severely damaged plant leaf with {disease_name}, "
                "heavy discoloration, rotten patches, wilting, photorealistic"
            )
    else:
        edit_instruction = (
            f"severely damaged plant leaf with {disease_name}, "
            "heavy discoloration, rotten patches, wilting, photorealistic"
        )

    print(f"🎨 Simulation prompt: {edit_instruction}")

    # Step 2 — Image generation with 3 cascading fallbacks
    generated_image = None

    # Attempt 1 — SD 1.5 image-to-image (preserves original leaf shape)
    try:
        client_i2i = InferenceClient(
            model="runwayml/stable-diffusion-v1-5",
            token=HF_TOKEN,
        )
        generated_image = client_i2i.image_to_image(
            image=original_image,
            prompt=edit_instruction,
            negative_prompt="blurry, abstract, watermark, cartoon, illustration",
            strength=0.82,
            guidance_scale=8.0,
        )
        print("✅ SD 1.5 image-to-image succeeded")

    except Exception as e1:
        print(f"⚠️ SD 1.5 i2i failed: {e1}")

        # Attempt 2 — FLUX.1-schnell text-to-image
        try:
            client_flux = InferenceClient(
                model="black-forest-labs/FLUX.1-schnell",
                token=HF_TOKEN,
            )
            generated_image = client_flux.text_to_image(
                prompt=(
                    f"extreme close-up photograph of a plant leaf showing: "
                    f"{edit_instruction}, photorealistic, nature photography, sharp focus"
                ),
                width=512,
                height=512,
            )
            print("✅ FLUX.1-schnell succeeded")

        except Exception as e2:
            print(f"⚠️ FLUX failed: {e2}")

            # Attempt 3 — SD 1.5 text-to-image (ultimate fallback)
            try:
                client_t2i = InferenceClient(
                    model="runwayml/stable-diffusion-v1-5",
                    token=HF_TOKEN,
                )
                generated_image = client_t2i.text_to_image(
                    prompt=f"extreme close-up of a diseased plant leaf: {edit_instruction}, photorealistic",
                    negative_prompt="blurry, cartoon, illustration, abstract",
                    width=512,
                    height=512,
                )
                print("✅ SD 1.5 text-to-image fallback succeeded")

            except Exception as e3:
                print(f"❌ All image generation attempts failed: {e3}")
                return {
                    "error":        "All simulation models failed.",
                    "last_error":   str(e3),
                    "prompt_used":  edit_instruction,
                }

    buf = io.BytesIO()
    generated_image.save(buf, format="JPEG", quality=90)
    img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return {
        "future_image": img_b64,
        "prompt_used":  edit_instruction,
        "note":         f"Simulated appearance of '{disease_name}' after 7 days untreated.",
    }


# ── MODULE 3 ── EXPERT TREATMENT PLAN ─────────────────────────
@app.post("/get_expert_plan")
async def get_expert_plan(
    file:      UploadFile     = File(...),
    disease:   str            = Form(...),
    location:  str            = Form("India"),
    context:   str            = Form(""),
    user_name: str            = Form("Farmer"),
    user_type: str            = Form("home_gardener"),
    latitude:  Optional[str] = Form(None),
    longitude: Optional[str] = Form(None),
    weather:   Optional[str]  = Form(None),
):
    """
    Module 3 — Full expert treatment plan with image context.

    Returns structured Markdown:
    - Plain-English explanation of the disease
    - 3-step action plan: immediate → organic → chemical (last resort)
    - Season-specific prevention tips
    - KVK referral section
    """
    if not gemini_client:
        return {"error": "Gemini client not initialized."}

    image_bytes = await file.read()
    image       = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    profile     = get_user_type_profile(user_type)
    india_ctx   = build_indian_context(
        user_name, location, latitude, longitude, context, user_type, weather   
    )

    prompt = f"""
{india_ctx}

You are FoliageCare AI — a trusted agricultural advisor helping {user_name}.

DIAGNOSED DISEASE: {disease}

Examine this plant image and write a complete, easy-to-understand treatment plan.
Use the exact Markdown structure below. Keep every section short and actionable.
All products must be available in India.

ROLE-SPECIFIC PLAN FOCUS:
{profile["plan_focus"]}

---

## What's happening 🌿
(2–3 sentences. Plain English. What the disease is doing to the plant and why it happens.)

## Your 3-step action plan

### Step 1 — Do this today ⚡
(Fastest action to stop spread. Use items from home or any local kirana / agri shop.
Include specifics: quantities, timing, method.)

### Step 2 — Desi / organic treatment 🌿
(Home remedy OR organic product. Exact prep instructions required.
Example: "Mix 5ml neem oil + 2 drops dish soap in 1 litre water.
Spray on all leaf surfaces morning or evening. Repeat every 5 days for 3 weeks.")

### Step 3 — If it gets worse ⚗️
(Indian brand chemical product + application method.
MUST begin with: "Only if Steps 1 and 2 show no improvement in 4–5 days:")

## Prevent it coming back 🛡️
(2–3 bullet points tailored to the current Indian season: {get_indian_season()})

## When to call an expert 📞
(1–2 sentences on when the situation needs professional help.
Always include: "Visit your nearest Krishi Vigyan Kendra (KVK) for free expert advice.")

---
Match the tone and detail level to user type: {profile["label"]}
End on an encouraging note — the user can fix this.
"""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt, image],
            config=EXPERT_PLAN_CONFIG,
        )
        return {"plan": response.text.strip()}

    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}


# ── MODULE 4 ── FOLLOW-UP CHAT ─────────────────────────────────
class FollowUpRequest(BaseModel):
    question:             str
    disease:              str
    conversation_history: List[dict]       = []
    user_name:            str              = "Farmer"
    user_type:            str              = "home_gardener"
    location:             Optional[str]   = None
    latitude:             Optional[float] = None
    longitude:            Optional[float] = None
    context:              Optional[str]   = None


@app.post("/followup")
async def followup(req: FollowUpRequest):
    """
    Module 4 — Context-aware follow-up chat.

    Keeps last 6 turns of conversation history.
    Always responds with India-specific, season-aware advice.
    Gently redirects completely off-topic questions back to plant care.
    """
    if not gemini_client:
        return {"error": "Gemini client not initialized."}

    profile = get_user_type_profile(req.user_type)
    india_ctx = build_indian_context(
        req.user_name,
        req.location,
        str(req.latitude)  if req.latitude  else None,
        str(req.longitude) if req.longitude else None,
        req.context,
        req.user_type,
    )

    # Build conversation history string (last 6 turns only)
    history_lines = []
    for turn in req.conversation_history[-6:]:
        role = "USER" if turn.get("role") == "user" else "FOLIAGECARE AI"
        text = turn.get("text", "").strip()
        if text:
            history_lines.append(f"{role}: {text}")
    history_text = (
        "\n".join(history_lines)
        if history_lines
        else "This is the beginning of the consultation."
    )

    prompt = f"""
{india_ctx}

You are FoliageCare AI — a trusted plant health expert helping {req.user_name}.
Current diagnosis on file: {req.disease}

--- CONVERSATION HISTORY ---
{history_text}

--- NEW QUESTION FROM {req.user_name.upper()} ---
{req.question}

INSTRUCTIONS:
1. Answer helpfully, always relating back to the diagnosed disease ({req.disease}).
2. If the question is completely unrelated to plant/crop health, respond:
   "I'm best at helping with plant health! For your {req.disease} issue, I can help with
    [suggest a relevant follow-up]. Is there something about your plant I can help with?"
3. Keep answers concise:
   - Simple questions  → 2–4 sentences
   - Multi-step advice → bullet points, max 5 items
4. Always end with one small actionable next step.
5. Detect and match the user's language (Hindi / English / regional).
6. Use Markdown for readability.
7. Tailor your style to a {profile["label"]}.

ROLE-SPECIFIC FOLLOW-UP FOCUS:
{profile["followup_focus"]}
"""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=FOLLOWUP_CONFIG,
        )
        return {"reply": response.text.strip()}

    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}


# ─────────────────────────────────────────
#  6. RUN
# ─────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

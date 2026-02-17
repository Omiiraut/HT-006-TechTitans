"""Gemini API integration for symptom analysis."""
import os
import time
from typing import Optional
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Model and client state
_model = None

# gemini-pro has the most generous free tier; set GEMINI_MODEL in .env to override
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-pro")


def _get_model():
    """Get or create Gemini GenerativeModel. Uses GEMINI_API_KEY from env."""
    global _model
    if _model is None:
        api_key = os.getenv('GEMINI_API_KEY', '').strip()
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set")
        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel(
            GEMINI_MODEL,
            system_instruction=SYSTEM_PROMPT,
        )
    return _model


def _is_quota_error(exc: Exception) -> bool:
    """True if the error is a 429 / quota exceeded."""
    msg = str(exc).lower()
    return "429" in msg or "quota" in msg or "rate" in msg or "limit" in msg


def _is_api_key_error(exc: Exception) -> bool:
    """True if the error is invalid/expired API key (400 API_KEY_INVALID)."""
    msg = str(exc).lower()
    return "api key not valid" in msg or "api_key_invalid" in msg or "apikey" in msg and "invalid" in msg


def get_config_error() -> Optional[str]:
    """Return error message if API is not configured, else None. Fast pre-check before streaming."""
    if not os.getenv('GEMINI_API_KEY', '').strip():
        return "GEMINI_API_KEY is not set. Please set GEMINI_API_KEY in your .env file."
    return None


def build_medical_context(profile: Optional[dict]) -> str:
    """Build medical context string from user profile."""
    if not profile:
        return "No medical history provided."

    context_parts = []
    if profile.get('name'):
        context_parts.append(f"Patient name: {profile['name']}")
    if profile.get('age'):
        context_parts.append(f"Age: {profile['age']} years")
    if profile.get('gender'):
        context_parts.append(f"Gender: {profile['gender']}")
    if profile.get('height_cm') and profile.get('weight_kg'):
        bmi = round(profile['weight_kg'] / ((profile['height_cm'] / 100) ** 2), 1)
        context_parts.append(f"Height: {profile['height_cm']} cm, Weight: {profile['weight_kg']} kg (BMI: {bmi})")
    if profile.get('existing_conditions'):
        context_parts.append(f"Existing conditions: {profile['existing_conditions']}")
    if profile.get('allergies'):
        context_parts.append(f"Allergies: {profile['allergies']}")
    if profile.get('smoking_habit'):
        context_parts.append(f"Smoking: {profile['smoking_habit']}")
    if profile.get('alcohol_habit'):
        context_parts.append(f"Alcohol: {profile['alcohol_habit']}")

    return "\n".join(context_parts) if context_parts else "No medical history provided."


SYSTEM_PROMPT = """You are a health assistant for preliminary symptom analysis.
RULES: Never prescribe medicines or dosages. Always advise seeing a doctor when needed. For high-risk symptoms (chest pain, stroke signs, severe bleeding, breathing difficulty) put an emergency warning first. Use simple language. Self-care only (rest, hydration). Include: Risk (Low/Moderate/High), Doctor needed (Yes/No/Urgent). Sections: Possible Condition, Risk Level, Emergency Warning (if any), Self-Care Advice, Doctor Consultation. Keep each section to 1-2 short sentences."""


def analyze_symptoms(symptoms: str, profile: dict | None) -> str:
    """
    Analyze symptoms using Gemini API and return structured response.
    Optimized for fast response (1-4 seconds): short prompt, limited output.
    """
    try:
        model = _get_model()
    except ValueError as e:
        return f"Configuration error: {str(e)}. Please set GEMINI_API_KEY in your .env file."

    medical_context = build_medical_context(profile)
    user_message = f"Context:\n{medical_context}\n\nSymptoms: {symptoms}\n\nAnalyze briefly. If emergency signs, state warning first."

    last_error = None
    for attempt in range(2):
        try:
            response = model.generate_content(
                user_message,
                generation_config={
                    "max_output_tokens": 400,
                    "temperature": 0.2,
                },
            )
            if response.candidates and response.candidates[0].content.parts:
                return (response.candidates[0].content.parts[0].text or "").strip()
            if response.prompt_feedback and getattr(response.prompt_feedback, "block_reason", None):
                return "The request could not be completed. Please rephrase and try again."
            return ""
        except Exception as e:
            last_error = e
            if _is_quota_error(e) and attempt == 0:
                time.sleep(16)
                continue
            break
    if last_error and _is_api_key_error(last_error):
        return (
            "Your Gemini API key is invalid or expired. "
            "Get a new key at https://aistudio.google.com/apikey and set GEMINI_API_KEY in your .env file, then restart the app."
        )
    if last_error and _is_quota_error(last_error):
        return (
            "**We’re temporarily at capacity.** The AI service has hit its usage limit. "
            "In the meantime: rest, stay hydrated, and see a doctor if symptoms persist or worsen. "
            "Please try again in a few minutes, or check your API quota: https://ai.google.dev/gemini-api/docs/rate-limits"
        )
    return f"Sorry, we encountered an error while analyzing your symptoms: {str(last_error)}. Please try again later or consult a healthcare professional."


def analyze_symptoms_stream(symptoms: str, profile: dict | None):
    """
    Stream symptom analysis for faster perceived response (first tokens in ~1-2s).
    Yields text chunks.
    """
    try:
        model = _get_model()
    except ValueError as e:
        yield f"Configuration error: {str(e)}. Please set GEMINI_API_KEY in your .env file."
        return

    medical_context = build_medical_context(profile)
    user_message = f"Context:\n{medical_context}\n\nSymptoms: {symptoms}\n\nAnalyze briefly. If emergency signs, state warning first."

    max_retries = 2
    last_error = None
    for attempt in range(max_retries):
        try:
            response = model.generate_content(
                user_message,
                stream=True,
                generation_config={
                    "max_output_tokens": 400,
                    "temperature": 0.2,
                },
            )
            for chunk in response:
                if chunk.candidates and chunk.candidates[0].content.parts:
                    text = chunk.candidates[0].content.parts[0].text
                    if text:
                        yield text
            return
        except Exception as e:
            last_error = e
            if _is_quota_error(e) and attempt < max_retries - 1:
                time.sleep(16)
                continue
            break
    if last_error and _is_api_key_error(last_error):
        yield (
            "Your Gemini API key is invalid or expired. "
            "Get a new key at https://aistudio.google.com/apikey and set GEMINI_API_KEY in your .env file, then restart the app."
        )
    elif last_error and _is_quota_error(last_error):
        yield (
            "**We’re temporarily at capacity.** The AI service has hit its usage limit. "
            "In the meantime: rest, stay hydrated, and see a doctor if symptoms persist or worsen. "
            "Please try again in a few minutes, or check your API quota: https://ai.google.dev/gemini-api/docs/rate-limits"
        )
    else:
        yield f"Sorry, we encountered an error: {str(last_error)}. Please try again or consult a healthcare professional."

"""OpenAI/OpenRouter API integration for symptom analysis."""
import os
import time
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from openai import OpenAI

try:
    # Optional: specific exceptions exist in newer SDK versions
    from openai import (
        APIConnectionError,
        APITimeoutError,
        AuthenticationError,
        RateLimitError,
    )
except Exception:  # pragma: no cover
    APIConnectionError = APITimeoutError = AuthenticationError = RateLimitError = Exception  # type: ignore

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
# Load .env from project root regardless of current working directory
load_dotenv(dotenv_path=_PROJECT_ROOT / ".env", override=False)

# Client state
_client: OpenAI | None = None

OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "").strip()


def _default_model() -> str:
    """
    Choose a sensible default model.

    - OpenRouter typically expects namespaced model ids (e.g. "openai/gpt-4o-mini")
    - OpenAI-hosted API uses non-namespaced ids (e.g. "gpt-4o-mini")
    """
    base_url = (OPENAI_BASE_URL or "").lower()
    if "openrouter.ai" in base_url:
        return "openai/gpt-4o-mini"
    return "gpt-4o-mini"


# Set OPENAI_MODEL in .env to override
OPENAI_MODEL = os.getenv("OPENAI_MODEL", _default_model()).strip() or _default_model()


def _openrouter_extra_headers() -> dict:
    """
    OpenRouter recommends attribution headers. These are optional.

    https://openrouter.ai/docs
    """
    headers = {}
    referer = os.getenv("OPENROUTER_HTTP_REFERER", "").strip() or os.getenv("OPENROUTER_SITE_URL", "").strip()
    title = os.getenv("OPENROUTER_X_TITLE", "").strip() or os.getenv("OPENROUTER_APP_NAME", "").strip()
    if referer:
        headers["HTTP-Referer"] = referer
    if title:
        headers["X-Title"] = title
    return headers


def _get_client() -> OpenAI:
    """Get or create OpenAI client. Uses OPENAI_API_KEY from env."""
    global _client
    if _client is None:
        api_key = (
            os.getenv("OPENROUTER_API_KEY", "").strip()
            or os.getenv("OPENAI_API_KEY", "").strip()
        )
        if not api_key:
            raise ValueError("OPENAI_API_KEY (or OPENROUTER_API_KEY) environment variable is not set")
        base_url = OPENAI_BASE_URL or os.getenv("OPENROUTER_BASE_URL", "").strip()
        timeout_s = float(os.getenv("OPENAI_TIMEOUT_SECONDS", "20").strip() or "20")
        if base_url:
            _client = OpenAI(api_key=api_key, base_url=base_url, timeout=timeout_s)
        else:
            _client = OpenAI(api_key=api_key, timeout=timeout_s)
    return _client


def _is_quota_error(exc: Exception) -> bool:
    """True if the error is a 429 / quota exceeded."""
    if isinstance(exc, RateLimitError):
        return True
    msg = str(exc).lower()
    return "429" in msg or "quota" in msg or "rate limit" in msg or "too many requests" in msg


def _is_api_key_error(exc: Exception) -> bool:
    """True if the error is invalid/expired API key."""
    if isinstance(exc, AuthenticationError):
        return True
    msg = str(exc).lower()
    return (
        "invalid api key" in msg
        or "api_key_invalid" in msg
        or ("api key" in msg and "invalid" in msg)
        or "authentication" in msg
    )


def get_config_error() -> Optional[str]:
    """Return error message if API is not configured, else None. Fast pre-check before streaming."""
    if not (os.getenv("OPENROUTER_API_KEY", "").strip() or os.getenv("OPENAI_API_KEY", "").strip()):
        return "OPENAI_API_KEY (or OPENROUTER_API_KEY) is not set. Please set it in your .env file."
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

RULES:
- Never prescribe medicines or dosages.
- Always advise seeing a doctor when needed.
- If high-risk symptoms (chest pain, stroke signs, severe bleeding, breathing difficulty), put an emergency warning first.
- Use simple language.
- No markdown (no **, no bullets). Plain text only.

OUTPUT FORMAT (exactly 5 lines, one per section):
Possible Condition: ...
Risk Level: Low/Moderate/High
Emergency Warning: None OR a short warning
Self-Care Advice: ...
Doctor Consultation: Yes/No/Urgent

Keep each line to 1-2 short sentences."""


def _extract_output_text(resp) -> str:
    """Best-effort extraction of plain text from OpenAI SDK response objects."""
    text = getattr(resp, "output_text", None)
    if isinstance(text, str) and text.strip():
        return text.strip()

    # Fallback for older/alternate response shapes
    out = []
    output_items = getattr(resp, "output", None) or []
    for item in output_items:
        if getattr(item, "type", None) == "message":
            for part in getattr(item, "content", None) or []:
                if getattr(part, "type", None) in ("output_text", "text"):
                    t = getattr(part, "text", None)
                    if t:
                        out.append(t)
    return "".join(out).strip()


def analyze_symptoms(symptoms: str, profile: dict | None) -> str:
    """
    Analyze symptoms using OpenAI API and return structured response.
    Optimized for fast response (1-4 seconds): short prompt, limited output.
    """
    try:
        client = _get_client()
    except ValueError as e:
        return f"Configuration error: {str(e)}. Please set OPENROUTER_API_KEY (or OPENAI_API_KEY) in your .env file."

    medical_context = build_medical_context(profile)
    user_message = f"Context:\n{medical_context}\n\nSymptoms: {symptoms}\n\nAnalyze briefly. If emergency signs, state warning first."

    last_error = None
    for attempt in range(2):
        try:
            # Prefer the newer Responses API when available
            if hasattr(client, "responses"):
                resp = client.responses.create(
                    model=OPENAI_MODEL,
                    instructions=SYSTEM_PROMPT,
                    input=user_message,
                    extra_headers=_openrouter_extra_headers(),
                    temperature=0.2,
                    max_output_tokens=400,
                )
                return _extract_output_text(resp)

            # Fallback: chat.completions
            chat = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                extra_headers=_openrouter_extra_headers(),
                temperature=0.2,
                max_tokens=400,
            )
            return (chat.choices[0].message.content or "").strip()
        except Exception as e:
            last_error = e
            if _is_quota_error(e) and attempt == 0:
                # Keep UI responsive; don't stall the user for long.
                time.sleep(2)
                continue
            break
    if last_error and _is_api_key_error(last_error):
        return (
            "Your API key is invalid or expired. "
            "If using OpenRouter: create a new key at https://openrouter.ai/keys and set OPENROUTER_API_KEY in your .env file, then restart the app."
        )
    if last_error and _is_quota_error(last_error):
        return (
            "**We’re temporarily at capacity.** The AI service has hit its usage limit. "
            "In the meantime: rest, stay hydrated, and see a doctor if symptoms persist or worsen. "
            "Please try again in a few minutes, or check your API usage limits in your OpenAI dashboard."
        )
    return f"Sorry, we encountered an error while analyzing your symptoms: {str(last_error)}. Please try again later or consult a healthcare professional."


def analyze_symptoms_stream(symptoms: str, profile: dict | None):
    """
    Stream symptom analysis for faster perceived response (first tokens in ~1-2s).
    Yields text chunks.
    """
    try:
        client = _get_client()
    except ValueError as e:
        yield f"Configuration error: {str(e)}. Please set OPENROUTER_API_KEY (or OPENAI_API_KEY) in your .env file."
        return

    medical_context = build_medical_context(profile)
    user_message = f"Context:\n{medical_context}\n\nSymptoms: {symptoms}\n\nAnalyze briefly. If emergency signs, state warning first."

    max_retries = 1
    last_error = None
    for attempt in range(max_retries):
        try:
            # Prefer Responses API streaming when available
            if hasattr(client, "responses"):
                # SDK supports semantic streaming events
                if hasattr(client.responses, "stream"):
                    with client.responses.stream(
                        model=OPENAI_MODEL,
                        instructions=SYSTEM_PROMPT,
                        input=user_message,
                        extra_headers=_openrouter_extra_headers(),
                        temperature=0.2,
                        max_output_tokens=400,
                    ) as stream:
                        for event in stream:
                            if getattr(event, "type", "") == "response.output_text.delta":
                                delta = getattr(event, "delta", None)
                                if delta:
                                    yield delta
                        return

                # Fallback: stream=True iterable
                events = client.responses.create(
                    model=OPENAI_MODEL,
                    instructions=SYSTEM_PROMPT,
                    input=user_message,
                    temperature=0.2,
                    max_output_tokens=400,
                    extra_headers=_openrouter_extra_headers(),
                    stream=True,
                )
                for event in events:
                    if getattr(event, "type", "") == "response.output_text.delta":
                        delta = getattr(event, "delta", None)
                        if delta:
                            yield delta
                return

            # Final fallback: chat.completions streaming
            stream = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                extra_headers=_openrouter_extra_headers(),
                temperature=0.2,
                max_tokens=400,
                stream=True,
            )
            for chunk in stream:
                delta = getattr(chunk.choices[0].delta, "content", None)
                if delta:
                    yield delta
            return
        except Exception as e:
            last_error = e
            if _is_quota_error(e) and attempt < max_retries - 1:
                time.sleep(2)
                continue
            break
    if last_error and _is_api_key_error(last_error):
        yield (
            "Your API key is invalid or expired. "
            "If using OpenRouter: create a new key at https://openrouter.ai/keys and set OPENROUTER_API_KEY in your .env file, then restart the app."
        )
    elif last_error and _is_quota_error(last_error):
        yield (
            "**We’re temporarily at capacity.** The AI service has hit its usage limit. "
            "In the meantime: rest, stay hydrated, and see a doctor if symptoms persist or worsen. "
            "Please try again in a few minutes, or check your API usage limits in your OpenAI dashboard."
        )
    else:
        yield f"Sorry, we encountered an error: {str(last_error)}. Please try again or consult a healthcare professional."

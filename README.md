# AI Health Assistant

Your 24/7 wellness companion. Get preliminary symptom analysis, health insights, BMI calculation, and personalized care guidance—powered by AI.

## Features

- **AI Symptom Chat** – Describe symptoms in natural language; get risk assessment and self-care advice
- **EmbedIQ Chatbot** – Built-in AI chat widget (bottom-right) works on all pages without any API key
- **Health Profile** – Store age, conditions, allergies for personalized insights
- **BMI Calculator** – Track body mass index with health category
- **Secure Auth** – Register, login, and protect your data

## Quick Start

```bash
# Clone and enter the project
cd HT-006-TechTitans

# Create virtual environment (recommended)
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Copy env and set secret key
copy .env.example .env   # Windows
# cp .env.example .env   # Mac/Linux

# Run the app
python run.py
```

Open [http://localhost:5000](http://localhost:5000). The EmbedIQ AI chat widget appears on every page—no API key required.

## Optional: Built-in Symptom Chat (OpenRouter / OpenAI compatible)

For the in-dashboard symptom chat (separate from the widget), add an OpenRouter key (recommended) to `.env`:

```
OPENROUTER_API_KEY=your-key-from-openrouter.ai
OPENAI_BASE_URL=https://openrouter.ai/api/v1
# Optional: choose a model on OpenRouter
# OPENAI_MODEL=openai/gpt-4o-mini
# Optional but recommended for OpenRouter attribution
# OPENROUTER_HTTP_REFERER=http://localhost:5000
# OPENROUTER_X_TITLE=AI Health Assistant
```

Without it, the dashboard shows a friendly fallback directing users to the chat widget.

## Medical Disclaimer

This application provides general health information only and does not constitute medical advice. Always consult a qualified healthcare professional for diagnosis and treatment. In an emergency, call emergency services immediately.

## Tech Stack

- Flask, SQLite, Bootstrap 5
- EmbedIQ (AI chatbot widget)
- OpenAI (optional, for built-in symptom analysis)

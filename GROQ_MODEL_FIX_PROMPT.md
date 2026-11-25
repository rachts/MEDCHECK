# MEDCHECK — Fix the default Groq model (llama-3.3-70b-versatile is now Enterprise-only)

## Why
Production logs (2026-11-25) show every Groq call failing with:
`404 model_not_found — The model 'llama-3.3-70b-versatile' does not exist or you do not have access to it.`
Groq has moved `llama-3.3-70b-versatile` to its Enterprise tier (see https://console.groq.com/docs/models — it is now listed as Enterprise / Contact Sales), so developer-plan API keys like this project's get a 404. The key itself is valid and production already works with the replacement model via an env override. This change fixes the DEFAULT so the code is correct even without the env override.

Replacement model: `openai/gpt-oss-120b` (Groq production tier, Developer plan, 131K context). Verified live in production with this project's key: plain-language summaries and the AI fallback both return complete answers.

## Changes (only these)
1. `backend/config.py` — change the `GROQ_MODEL` default from `llama-3.3-70b-versatile` to `openai/gpt-oss-120b`.
2. `render.yaml` — change the `GROQ_MODEL` env var value from `llama-3.3-70b-versatile` to `openai/gpt-oss-120b`.
3. Search the repo source for any other occurrence of the string `llama-3.3-70b-versatile` (likely `backend/.env.example`, root `.env.example`, or a test) and update each to `openai/gpt-oss-120b`. Do NOT edit the historical `*_PROMPT.md` files in the project root, `design.md`, or any `.env.local` file — those are history/local config, not source defaults.

## Hard rules
- No other behaviour changes. No new dependencies. Do not touch the Groq client logic, prompts, or any other setting.
- Do not push or deploy anything.

## Checks before reporting done
- Full backend test suite passes (`cd backend && venv/bin/python -m pytest tests -q`).
- A grep for `llama-3.3-70b-versatile` across backend/, frontend/, render.yaml and the .env.example files returns zero matches.
- Report exactly which files you changed.

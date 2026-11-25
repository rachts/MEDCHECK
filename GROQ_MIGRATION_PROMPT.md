# TASK: Migrate the AI provider from Mistral to Groq (backend only)

You are working in the MEDCHECK project. The backend (`backend/`) currently integrates Mistral AI. Migrate that integration to Groq. Groq's API is OpenAI-compatible, and the existing client already speaks that shape over `httpx` — this is a provider swap, not a rewrite.

## Current state (verified — exactly three files mention Mistral)
1. `backend/services/mistral_client.py` — async client: `call_mistral_api(prompt, system_prompt)`, a `MistralCircuitBreaker` (threshold 3, 60s reset, CLOSED/OPEN/HALF_OPEN), exponential-backoff retries (1s/2s/4s) on 429/5xx, 10s timeout, payload `model: mistral-small-latest`, `temperature: 0.1`, `max_tokens: 800`, key from `settings.MISTRAL_API_KEY`, URL `https://api.mistral.ai/v1/chat/completions`.
2. `backend/config.py` — the `MISTRAL_API_KEY: Optional[str] = None` setting.
3. `backend/tests/test_circuit_breaker.py` — imports `MistralCircuitBreaker` from `services.mistral_client`.

## What to change
- Rename `backend/services/mistral_client.py` → `backend/services/groq_client.py` (delete the old file; do not leave a Mistral-named module behind).
  - `call_mistral_api` → `call_groq_api` (same signature and return contract: `Optional[str]`, `None` on missing key / open breaker / failure).
  - `MistralCircuitBreaker` → `GroqCircuitBreaker`; logger name `groq_client`; all log messages say Groq.
  - URL → `https://api.groq.com/openai/v1/chat/completions`
  - API key → `settings.GROQ_API_KEY`
  - Model → `settings.GROQ_MODEL` (see config below); do not hardcode the model string in the client.
  - Keep everything else behaviour-identical: circuit breaker logic and thresholds, retry delays and retryable status codes (Groq's free tier rate-limits aggressively — the existing 429 handling matters), 10s timeout, `temperature: 0.1`, `max_tokens: 800`, success parsing `data["choices"][0]["message"]["content"]`.
- `backend/config.py`: replace `MISTRAL_API_KEY` with:
  - `GROQ_API_KEY: Optional[str] = None`
  - `GROQ_MODEL: str = "llama-3.3-70b-versatile"` (Groq's default production model; overridable via env for future model swaps).
- `backend/tests/test_circuit_breaker.py`: update the import and class name to the Groq versions; the test logic itself is unchanged.
- `backend/.env.example` (and any other env/deploy file that mentions it — check `docker-compose.yml`, `Dockerfile`, README/docs): replace the `MISTRAL_API_KEY` entry with `GROQ_API_KEY=` and add `GROQ_MODEL=llama-3.3-70b-versatile`. Do NOT put a real key anywhere.
- Final sweep: `grep -ri "mistral"` across the repo (excluding `.git`, `venv`, `node_modules`, `__pycache__`) must return zero hits in source, tests, config, and docs.

## Constraints
- Backend only. Do not touch the frontend.
- No new dependencies — keep using `httpx`; do NOT add the `groq` Python SDK.
- Do not change the deterministic rule engine, OpenFDA services, or any endpoint behaviour. This client is the app's AI hook; its graceful-degradation contract (return `None`, never raise, when the provider is down or unconfigured) must be preserved exactly.
- Do not rename anything else, and do not "improve" the circuit breaker or retry logic while you are in there.

## Done when
- The grep sweep is clean.
- The full backend test suite passes (`backend/venv` Python 3.13: `venv/bin/python -m pytest tests/`), including the updated circuit-breaker test.
- A smoke check with no `GROQ_API_KEY` set confirms `call_groq_api` returns `None` without raising (unconfigured = feature off, app unaffected).

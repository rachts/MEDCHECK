import time
import logging
import asyncio
import httpx
from typing import Optional
from config import settings

logger = logging.getLogger("groq_client")


class GroqCircuitBreaker:
    def __init__(self, failure_threshold: int = 3, reset_timeout: float = 60.0):
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.failure_count = 0
        self.last_failure_time = 0.0
        self.state = "CLOSED"  # "CLOSED", "OPEN", "HALF_OPEN"

    def record_success(self):
        self.failure_count = 0
        self.state = "CLOSED"

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning(f"Groq AI Circuit Breaker opened for {self.reset_timeout}s due to {self.failure_count} consecutive failures.")

    def allow_request(self) -> bool:
        if self.state == "CLOSED":
            return True
        if self.state == "OPEN":
            if time.time() - self.last_failure_time > self.reset_timeout:
                self.state = "HALF_OPEN"
                logger.info("Groq AI Circuit Breaker entering HALF_OPEN trial state.")
                return True
            return False
        if self.state == "HALF_OPEN":
            return True
        return False


circuit_breaker = GroqCircuitBreaker()


async def call_groq_api(prompt: str, system_prompt: Optional[str] = None) -> Optional[str]:
    api_key = settings.GROQ_API_KEY
    if not api_key or not api_key.strip():
        return None

    if not circuit_breaker.allow_request():
        logger.warning("Groq AI call skipped: Circuit Breaker is OPEN.")
        return None

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json"
    }

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": settings.GROQ_MODEL,
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 800
    }

    # Exponential backoff retries (1s, 2s, 4s)
    delays = [1.0, 2.0, 4.0]
    for attempt, delay in enumerate(delays, start=1):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    circuit_breaker.record_success()
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
                elif resp.status_code in (429, 500, 502, 503, 504):
                    logger.warning(f"Groq API transient error {resp.status_code} (attempt {attempt}/{len(delays)})")
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"Groq API client error {resp.status_code}: {resp.text}")
                    circuit_breaker.record_failure()
                    return None
        except Exception as e:
            logger.warning(f"Groq API connection exception (attempt {attempt}/{len(delays)}): {e}")
            if attempt < len(delays):
                await asyncio.sleep(delay)
            else:
                circuit_breaker.record_failure()
                return None

    circuit_breaker.record_failure()
    return None

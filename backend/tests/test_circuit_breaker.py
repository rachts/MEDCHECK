import pytest
import time
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.mistral_client import MistralCircuitBreaker

def test_circuit_breaker_transitions():
    """Verify circuit breaker opens after failure threshold and recovers after timeout."""
    cb = MistralCircuitBreaker(failure_threshold=3, reset_timeout=0.2)
    assert cb.state == "CLOSED"
    assert cb.allow_request() is True

    # 1. First 2 failures
    cb.record_failure()
    cb.record_failure()
    assert cb.state == "CLOSED"
    assert cb.allow_request() is True

    # 2. Third failure opens circuit
    cb.record_failure()
    assert cb.state == "OPEN"
    assert cb.allow_request() is False

    # 3. Wait for reset timeout
    time.sleep(0.25)
    assert cb.allow_request() is True
    assert cb.state == "HALF_OPEN"

    # 4. Success restores closed state
    cb.record_success()
    assert cb.state == "CLOSED"
    assert cb.failure_count == 0

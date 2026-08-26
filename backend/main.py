import os
import sys
import time
import uuid
import asyncio
import itertools
import logging
from datetime import timedelta
from typing import List, Dict, Any, Optional

# Ensure backend directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException, Request, Response, Depends, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import settings
from services.logging_config import setup_logging, request_id_ctx
from models import (
    CheckRequest,
    CheckResponse,
    ClientErrorReport,
    InteractionItem,
    MedicineProfileResponse,
    MedicineSearchResult,
    DrugLabelResult,
    UserCreate,
    UserLogin,
    TokenResponse,
    UserOut
)
from services.auth import (
    create_user,
    authenticate_user,
    create_access_token,
    get_current_user,
    set_session_cookie,
    clear_session_cookie
)
from services.openfda import fetch_drug_label
from services.knowledge_base import (
    CLINICAL_KB_VERSION,
    get_or_build_medicine_profile
)
from services.clinical_rules import (
    match_known_clinical_rule,
    resolve_canonical_name,
    expand_aliases
)
from services.gi_engine import (
    calculate_composite_gi_score,
    detect_side_effect_amplifications
)
from services.timeline_engine import (
    generate_food_conflicts_and_timeline
)
from services.search_engine import (
    search_medicine_database
)
from services.interaction_analyzer import (
    analyze_drug_pair,
    parse_drug_label_from_dict
)
from services.supabase_cache import (
    get_cached_interaction,
    save_interaction_to_cache,
    get_cached_drug_detail,
    save_drug_detail_to_cache,
    get_supabase_client
)
from services.audit_logger import log_clinical_check

# 1. Initialize Structured Logging
setup_logging(settings.LOG_LEVEL)
logger = logging.getLogger("medcheck_api")

# 2. Initialize Rate Limiter (with optional Redis support)
def rate_limit_key(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        return token[:30] if token else (get_remote_address(request) or "127.0.0.1")
    return get_remote_address(request) or "127.0.0.1"

limiter_kwargs = {"key_func": rate_limit_key}
if settings.REDIS_URL:
    limiter_kwargs["storage_uri"] = settings.REDIS_URL

limiter = Limiter(**limiter_kwargs)

# 3. Create FastAPI Application
app = FastAPI(
    title="MEDCHECK Clinical Intelligence Platform",
    description="Production-grade medicine safety API with deep individual pharmacology profiling, Stomach Guardian mucosal scoring, and pairwise interaction checking.",
    version="2.0.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 4. Global Validation Error Handler (Sanitized Error Responses)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        field = ".".join(str(loc) for loc in err.get("loc", []))
        msg = err.get("msg", "Invalid value")
        errors.append(f"{field}: {msg}")
    
    logger.warning(f"Request validation error on {request.url.path}: {errors}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Input validation failed. Please check the provided parameters.",
            "errors": errors
        }
    )

# 5. Security & Request-ID Middleware

# Content-Security-Policy for API-served responses.
#
# script-src is pinned to 'self' with no 'unsafe-inline' / 'unsafe-eval', which is
# what actually blocks reflected-XSS execution. style-src retains 'unsafe-inline'
# because the React SPA applies severity colours and progress-bar widths through
# inline `style` attributes; removing it would break rendering without closing a
# script-execution path. object-src/base-uri/frame-ancestors/form-action are locked
# down so an injected <object>, <base> or form cannot be used as a pivot.
CONTENT_SECURITY_POLICY = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com; "
    "connect-src 'self' http://localhost:* http://127.0.0.1:* https://api.fda.gov; "
    "img-src 'self' data: https:; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "frame-ancestors 'none'; "
    "form-action 'self'"
)

# Deny access to device APIs this service has no use for.
PERMISSIONS_POLICY = (
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
    "magnetometer=(), microphone=(), payment=(), usb=()"
)


@app.middleware("http")
async def security_and_tracing_middleware(request: Request, call_next):
    # Maximum 1MB payload protection
    content_length = request.headers.get("Content-Length")
    if content_length:
        try:
            declared_length = int(content_length)
        except ValueError:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "Malformed Content-Length header."}
            )
        if declared_length > 1_048_576:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"detail": "Request payload exceeds maximum allowed size (1MB)."}
            )

    req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    token = request_id_ctx.set(req_id)
    start_time = time.time()

    try:
        response = await call_next(request)
    finally:
        request_id_ctx.reset(token)

    process_time = time.time() - start_time
    response.headers["X-Request-ID"] = req_id
    response.headers["X-Process-Time"] = f"{process_time:.4f}"

    # Inject Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = PERMISSIONS_POLICY
    response.headers["Content-Security-Policy"] = CONTENT_SECURITY_POLICY
    # HSTS applies to every TLS-terminated deployment, not production alone.
    if settings.ENV in ("production", "staging"):
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response

# 6. Strict CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
)

# 7. Optional HTTP -> HTTPS redirect.
# Added last so it becomes the outermost middleware and short-circuits before any
# request body is read. Opt-in via FORCE_HTTPS because this service normally runs
# behind a TLS-terminating proxy, where an unconditional redirect would loop.
if settings.FORCE_HTTPS:
    app.add_middleware(HTTPSRedirectMiddleware)
    logger.info("FORCE_HTTPS enabled: plaintext HTTP requests will be redirected to HTTPS.")

# ==============================================================================
# AUTHENTICATION ENDPOINTS
# ==============================================================================

@app.post("/api/auth/register", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def register(request: Request, response: Response, user_in: UserCreate):
    """Registers a new user account and returns a JWT access token."""
    user = await create_user(
        username=user_in.username,
        password=user_in.password,
        email=user_in.email,
        is_guest=False
    )
    token = create_access_token({"sub": user["username"], "uid": user["id"], "is_guest": False})
    # The token is also written to an httpOnly cookie so a browser client has no
    # reason to persist it in localStorage, where any injected script could read
    # it. The body still carries it verbatim for non-browser callers.
    set_session_cookie(response, token, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user["id"],
        username=user["username"],
        is_guest=False
    )

@app.post("/api/auth/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def login(request: Request, response: Response, user_in: UserLogin):
    """Authenticates user credentials and returns a JWT access token."""
    user = await authenticate_user(user_in.username, user_in.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": user["username"], "uid": user["id"], "is_guest": user["is_guest"]})
    set_session_cookie(response, token, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user["id"],
        username=user["username"],
        is_guest=user["is_guest"]
    )

@app.post("/api/auth/guest", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def create_guest_session(request: Request, response: Response):
    """Generates an instant anonymous guest JWT session for clinical evaluation."""
    guest_name = f"guest_{uuid.uuid4().hex[:8]}"
    guest_pwd = uuid.uuid4().hex
    user = await create_user(username=guest_name, password=guest_pwd, is_guest=True)
    # Anonymous sessions are short-lived: an unattended guest token is a bearer
    # credential nobody can revoke, so it must not carry the 7-day account expiry.
    token = create_access_token(
        {"sub": user["username"], "uid": user["id"], "is_guest": True},
        expires_delta=timedelta(minutes=settings.GUEST_TOKEN_EXPIRE_MINUTES)
    )
    set_session_cookie(response, token, settings.GUEST_TOKEN_EXPIRE_MINUTES * 60)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user["id"],
        username=user["username"],
        is_guest=True
    )

@app.post("/api/auth/logout")
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def logout(request: Request, response: Response):
    """
    Clears the httpOnly session cookie.

    Deliberately unauthenticated: logging out must succeed even when the session
    has already expired or the cookie is corrupt, otherwise a client can be left
    holding a cookie it has no way to shed. There is nothing to authorise -- the
    only effect is deleting the caller's own cookie.
    """
    clear_session_cookie(response)
    return {"status": "logged_out"}

@app.post("/api/client-error")
@limiter.limit("20/minute")
async def log_client_error(request: Request, payload: ClientErrorReport):
    """
    Logs client-side React UI exceptions for diagnostic monitoring.

    The payload is validated and length-bounded by ClientErrorReport, which also
    strips control characters so a hostile client cannot forge log lines.
    """
    logger.error(
        "Client UI Error reported: %s | Stack: %s",
        payload.error,
        payload.stack
    )
    return {"status": "logged"}

# ==============================================================================
# CLINICAL INTELLIGENCE ENDPOINTS
# ==============================================================================

@app.get("/api/health")
@limiter.limit("60/minute")
async def health_check(request: Request):
    """Health check endpoint reporting database connectivity and clinical KB version."""
    db_status = "ok"
    try:
        import sqlite3
        from contextlib import closing
        with closing(sqlite3.connect(settings.SQLITE_DB_PATH, timeout=2.0)) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
    except Exception as e:
        db_status = f"unhealthy: {e}"

    supabase_status = "offline_fallback"
    sb_client = get_supabase_client()
    if sb_client is not None:
        try:
            sb_client.table("interaction_pairs").select("canonical_pair").limit(1).execute()
            supabase_status = "connected"
        except Exception:
            supabase_status = "error_fallback"

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "service": "MEDCHECK Clinical Intelligence API",
        "version": "2.0.0",
        "clinical_kb_version": CLINICAL_KB_VERSION,
        "database": db_status,
        "supabase": supabase_status,
        "environment": settings.ENV
    }

async def fetch_and_cache_single_drug(drug_name: str) -> DrugLabelResult:
    cleaned_name = drug_name.strip().lower()

    # 1. Check local/Supabase cache
    cached_detail = await get_cached_drug_detail(cleaned_name)
    if cached_detail:
        return DrugLabelResult(
            generic_name=cached_detail.get("generic_name", cleaned_name),
            brand_names=cached_detail.get("brand_names", []),
            raw_text_summary=cached_detail.get("raw_text_summary", "") or "",
            # Classification round-trips through the cache's `classification`
            # column. A row written before that column existed yields no keys at
            # all, so these fall back to the model defaults -- notably
            # `is_rx=None`, meaning "unknown", never "over-the-counter".
            product_types=cached_detail.get("product_types", []),
            is_rx=cached_detail.get("is_rx"),
            pharm_class_cs=cached_detail.get("pharm_class_cs"),
            dosage_forms=cached_detail.get("dosage_forms", []),
            found=True,
            source="cache"
        )

    # 2. Fetch live OpenFDA label.
    #
    # `fetch_drug_label` returns the output of `extract_label_info`, not a raw
    # OpenFDA document -- the local name below is `extracted_label` rather than
    # the previous `raw_label` because that mismatch is what made the field loss
    # here hard to see.
    try:
        extracted_label = await fetch_drug_label(cleaned_name)
        if extracted_label:
            parsed = parse_drug_label_from_dict(extracted_label)
            await save_drug_detail_to_cache(
                generic_name=parsed.get("generic_name", cleaned_name),
                brand_names=parsed.get("brand_names", []),
                side_effects=parsed.get("side_effects", []),
                food_warnings=parsed.get("food_warnings", []),
                drug_interactions=parsed.get("drug_interactions", []),
                severity=parsed.get("severity", "moderate"),
                raw_text=extracted_label.get("raw_text_summary"),
                product_types=extracted_label.get("product_types", []),
                is_rx=extracted_label.get("is_rx"),
                pharm_class_cs=extracted_label.get("pharm_class_cs"),
                dosage_forms=extracted_label.get("dosage_forms", [])
            )
            return DrugLabelResult(
                generic_name=extracted_label.get("generic_name", cleaned_name),
                brand_names=extracted_label.get("brand_names", []),
                substance_names=extracted_label.get("substance_names", []),
                raw_text_summary=extracted_label.get("raw_text_summary", ""),
                product_types=extracted_label.get("product_types", []),
                is_rx=extracted_label.get("is_rx"),
                pharm_class_cs=extracted_label.get("pharm_class_cs"),
                dosage_forms=extracted_label.get("dosage_forms", []),
                found=True,
                source="openfda"
            )
    except Exception as e:
        logger.warning(f"Error fetching OpenFDA label for '{drug_name}': {e}")

    return DrugLabelResult(
        generic_name=cleaned_name,
        brand_names=[],
        substance_names=[],
        raw_text_summary="",
        found=False,
        source="fallback"
    )

@app.get("/api/medicine/{name}/profile", response_model=MedicineProfileResponse)
@limiter.limit(settings.RATE_LIMIT_PROFILE)
async def get_medicine_profile(
    name: str, 
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns rich individual medicine profile: side effects by frequency,
    food interactions, stomach health score, and clinical guidance.
    """
    label_info = await fetch_and_cache_single_drug(name)
    profile = get_or_build_medicine_profile(
        name, 
        label=label_info.model_dump() if label_info.found else None
    )
    return profile

@app.get("/api/medicines/search", response_model=List[MedicineSearchResult])
@limiter.limit(settings.RATE_LIMIT_SEARCH)
async def search_medicines(
    request: Request,
    q: str = Query("", description="Search term for medicine name or brand"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Autocomplete search returning rich preview cards with stomach risk and top side effects.
    """
    results = search_medicine_database(q)
    return results

@app.post("/api/check", response_model=CheckResponse)
@limiter.limit(settings.RATE_LIMIT_CHECK)
async def check_medicines_basket(
    request: Request,
    req: CheckRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Full clinical intelligence pipeline for a basket of medicines:
    - Parallelized pairwise drug-drug interactions with concurrency throttling
    - Composite Stomach Guardian GI Risk Score & Compounded Anticoagulant+NSAID Risk
    - Side Effect Amplification Detection (Bleeding, Sedation, Hypotension, Hyperkalemia, Hepatic)
    - Food Conflict & Dynamic 24-Hour Patient Schedule
    - Complete Individual Drug Intelligence Profiles
    """
    start_time = time.time()
    medicines = req.medicines
    user_id = current_user.get("id", "anonymous")
    logger.info(f"User {user_id} analyzing basket ({len(medicines)} medicines): {medicines}")

    # 1. Concurrently fetch/cache labels for all medicines in parallel
    label_results: List[DrugLabelResult] = await asyncio.gather(
        *[fetch_and_cache_single_drug(m) for m in medicines]
    )
    drug_labels_map: Dict[str, DrugLabelResult] = {
        med: label for med, label in zip(medicines, label_results)
    }

    # 2. Build full profiles for all medicines in basket
    profiles: Dict[str, MedicineProfileResponse] = {}
    limited_data_drugs = []
    for med in medicines:
        lbl = drug_labels_map.get(med)
        is_found = lbl.found if lbl else False
        if not is_found:
            limited_data_drugs.append(med.capitalize())
        profiles[med] = get_or_build_medicine_profile(
            med, 
            label=lbl.model_dump() if (lbl and lbl.found) else None
        )

    # 3. Parallelized Pairwise Evaluation bounded by Semaphore
    pairs = list(itertools.combinations(medicines, 2))
    detected_interactions: List[InteractionItem] = []
    semaphore = asyncio.Semaphore(5)

    async def evaluate_pair(drug_a: str, drug_b: str) -> Optional[InteractionItem]:
        async with semaphore:
            label_a = drug_labels_map.get(drug_a)
            label_b = drug_labels_map.get(drug_b)

            # Check cache first
            cached_interaction = await get_cached_interaction(drug_a, drug_b)
            if cached_interaction:
                if cached_interaction.severity.value != "none":
                    return cached_interaction
                return None

            interaction = await analyze_drug_pair(
                drug_a=drug_a,
                drug_b=drug_b,
                label_a=label_a.model_dump() if label_a else None,
                label_b=label_b.model_dump() if label_b else None
            )

            has_label_data = (label_a and label_a.found) or (label_b and label_b.found)

            if interaction:
                await save_interaction_to_cache(
                    drug_a=drug_a,
                    drug_b=drug_b,
                    severity=interaction.severity.value,
                    explanation=interaction.explanation,
                    mechanism=interaction.mechanism,
                    clinical_impact=interaction.clinical_impact,
                    stomach_impact=interaction.stomach_impact,
                    food_consideration=interaction.food_consideration,
                    action_guidance=interaction.action_guidance,
                    evidence_source=interaction.evidence_source,
                    confidence=interaction.confidence.value if interaction.confidence else "established",
                    last_reviewed=interaction.last_reviewed
                )
                return interaction
            elif has_label_data:
                await save_interaction_to_cache(
                    drug_a=drug_a,
                    drug_b=drug_b,
                    severity="none",
                    explanation="No clinically significant interaction detected in verified database."
                )
                return None
            return None

    if pairs:
        pair_results = await asyncio.gather(*[evaluate_pair(a, b) for a, b in pairs])
        detected_interactions = [item for item in pair_results if item is not None]

    # 4. Calculate Stomach Guardian Composite GI Score
    gi_score, gi_tier, gi_contributors, gi_recs = calculate_composite_gi_score(medicines, profiles)

    # 5. Detect Side Effect Amplifications
    amplified_side_effects = detect_side_effect_amplifications(medicines, profiles)

    # 6. Generate Food Conflicts & 24-Hour Timeline anchored to the patient's wake time
    timeline_kwargs = {}
    if req.patient_wake_time:
        timeline_kwargs["patient_wake_time"] = req.patient_wake_time
    food_conflicts, timeline = generate_food_conflicts_and_timeline(
        medicines, profiles, **timeline_kwargs
    )

    is_safe = len(detected_interactions) == 0

    limited_data_warnings = []
    if limited_data_drugs:
        limited_data_warnings.append(
            f"Limited FDA label data available for: {', '.join(limited_data_drugs)}. Analysis may be incomplete."
        )

    if is_safe:
        if len(medicines) == 1:
            summary_text = f"Profile analyzed for {medicines[0].capitalize()}. Add a second medicine to check pairwise interactions."
        elif limited_data_drugs:
            summary_text = f"No known interactions detected between verified medications. Note: Limited FDA label data for: {', '.join(limited_data_drugs)}."
        else:
            summary_text = "No known interactions detected between the selected medicines in verified clinical databases."
    else:
        summary_text = f"Identified {len(detected_interactions)} potential interaction{'s' if len(detected_interactions) > 1 else ''} across {len(pairs)} analyzed pairs."

    # 7. Audit Logging (Non-blocking but resilient)
    latency_ms = (time.time() - start_time) * 1000.0
    client_ip = get_remote_address(request)
    try:
        await log_clinical_check(
            user_id=user_id,
            medicines=medicines,
            interaction_count=len(detected_interactions),
            gi_score=gi_score,
            ip_address=client_ip,
            response_time_ms=latency_ms
        )
    except Exception as e:
        logger.warning(f"Audit log recording error: {e}")

    return CheckResponse(
        medicines=medicines,
        interactions=detected_interactions,
        safe=is_safe,
        summary=summary_text,
        analyzed_pairs_count=len(pairs),
        composite_gi_score=gi_score,
        composite_gi_tier=gi_tier,
        composite_gi_contributors=gi_contributors,
        composite_gi_recommendations=gi_recs,
        food_conflicts=food_conflicts,
        daily_food_timeline=timeline,
        aggregated_side_effects=amplified_side_effects,
        profiles=profiles,
        limited_data_warnings=limited_data_warnings
    )

@app.post("/api/basket/analyze", response_model=CheckResponse, include_in_schema=False)
@limiter.limit(settings.RATE_LIMIT_CHECK)
async def analyze_basket_alias(
    request: Request,
    req: CheckRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Compatibility alias for /api/check."""
    return await check_medicines_basket(request, req, current_user)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host=settings.HOST, 
        port=settings.PORT, 
        reload=(settings.ENV == "development")
    )

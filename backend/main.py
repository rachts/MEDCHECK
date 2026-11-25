import os
import sys
import time
import uuid
import asyncio
import itertools
import logging
import hashlib
import jwt
import anyio
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
    Severity,
    RuleConfidence,
    MedicineProfileResponse,
    MedicineSearchResult,
    DrugLabelResult,
    UserCreate,
    UserLogin,
    TokenResponse,
    UserOut,
    PasswordResetRequest,
    PasswordResetConfirm,
    ChatRequest,
    ChatResponse,
    IndiaBanInfo,
    IndiaBanAlert,
    IndiaBannedSearchItem,
    IndiaBannedSearchResponse,
    CatalogueProduct,
    CatalogueSearchResponse,
)
from services.auth import (
    create_user,
    authenticate_user,
    create_access_token,
    create_password_reset,
    reset_password_with_token,
    get_current_user,
    set_session_cookie,
    clear_session_cookie,
    SESSION_COOKIE_NAME
)
from services.openfda import fetch_drug_label
from services.knowledge_base import (
    CLINICAL_KB_VERSION,
    get_or_build_medicine_profile,
    get_fdc_info,
    normalize_drug_query,
)
from services.clinical_rules import (
    match_known_clinical_rule,
    resolve_canonical_name,
    expand_aliases,
    RULE_TABLE_LAST_REVIEWED
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
import services.groq_client as groq_client
from services.groq_client import call_groq_api
from services.medicine_chat import (
    AI_FALLBACK_DISCLAIMER,
    CATALOGUE_DISCLAIMER,
    build_catalogue_answer,
    resolve_medicine_for_chat,
    resolve_ban_ingredients,
    format_canonical_medicine_name,
    get_known_interactions_for_medicine,
    compose_medicine_context,
    build_chat_prompts,
    build_fallback_chat_prompts,
)
from services.india_banned import (
    BanMatch,
    lookup_ban,
    search_banned_with_total,
    build_ban_overview_answer,
)
from services.india_catalogue import (
    match_product_for_chat,
    search_catalogue,
)
from services.knowledge_base import CURATED_MEDICINE_PROFILES

_ORIG_CALL_GROQ_API = call_groq_api

# 1. Initialize Structured Logging
setup_logging(settings.LOG_LEVEL)
logger = logging.getLogger("medcheck_api")

# 2. Initialize Rate Limiter (with optional Redis support)
def rate_limit_key(request: Request) -> str:
    """
    Computes a distinct rate limit key per client.
    - For authenticated requests (Bearer token or session cookie): extracts the unique
      subject / user identifier ('sub' or 'uid'), or a SHA-256 hash of the token.
    - For guest / unauthenticated requests: falls back to client IP address.
    """
    token: Optional[str] = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif SESSION_COOKIE_NAME in request.cookies:
        token = request.cookies.get(SESSION_COOKIE_NAME)

    if token:
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
            user_key = payload.get("uid") or payload.get("sub")
            if user_key:
                return f"usr_{user_key}"
        except Exception:
            # On invalid signature, decode error, or tampering, fall through to IP
            pass

    ip = get_remote_address(request) or "127.0.0.1"
    return f"ip_{ip}"

limiter_kwargs = {"key_func": rate_limit_key}
if settings.REDIS_URL:
    limiter_kwargs["storage_uri"] = settings.REDIS_URL

limiter = Limiter(**limiter_kwargs)

# 3. Create FastAPI Application
app = FastAPI(
    title="MEDCHECK Clinical Intelligence API",
    description="Production-styled architecture medicine safety API with deep individual pharmacology profiling, Stomach Guardian heuristic mucosal scoring, and pairwise interaction checking.",
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

@app.post("/api/auth/forgot-password")
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def forgot_password(request: Request, payload: PasswordResetRequest):
    """Creates a single-use password reset token without disclosing whether the account exists."""
    token = await create_password_reset(payload.username)
    if token:
        reset_link = f"{settings.PASSWORD_RESET_LINK_BASE}?reset_token={token}"
        # MEDCHECK has no email service configured, so the link is delivered
        # through the server log for now; when an email service is configured,
        # send the link there and delete this log line, because a token in a
        # log is a credential in a log.
        logger.info(
            "Password reset link for user '%s': %s",
            payload.username.strip().lower(),
            reset_link,
        )
    return {
        "message": (
            "If an account with that username exists, a password reset link has been "
            f"created. The link is valid for {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes."
        )
    }

@app.post("/api/auth/reset-password")
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def reset_password(request: Request, payload: PasswordResetConfirm):
    """Validates a password reset token and updates the account password once."""
    updated = await reset_password_with_token(payload.token, payload.new_password)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has expired. Please request a new one.",
        )
    return {
        "status": "password_updated",
        "message": "Your password has been updated. Please sign in with your new password.",
    }

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
@app.head("/api/health")
@app.get("/health")
@app.head("/health")
@limiter.limit("120/minute")
async def health_check(request: Request):
    """Health check endpoint reporting database connectivity and clinical KB version."""
    db_status = "ok"
    try:
        import sqlite3
        from contextlib import closing
        def _check_sqlite():
            with closing(sqlite3.connect(settings.SQLITE_DB_PATH, timeout=2.0)) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
        await anyio.to_thread.run_sync(_check_sqlite)
    except Exception as e:
        db_status = f"unhealthy: {e}"

    supabase_status = "offline_fallback"
    sb_client = get_supabase_client()
    if sb_client is not None:
        try:
            await anyio.to_thread.run_sync(
                lambda: sb_client.table("interaction_pairs").select("canonical_pair").limit(1).execute()
            )
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
    canonical_name = resolve_canonical_name(drug_name)
    cleaned_name = canonical_name if canonical_name else drug_name.strip().lower()

    # 1. Check local/Supabase cache
    cached_detail = await get_cached_drug_detail(cleaned_name)
    if cached_detail:
        return DrugLabelResult(
            generic_name=cached_detail.get("generic_name", cleaned_name),
            brand_names=cached_detail.get("brand_names", []),
            raw_text_summary=cached_detail.get("raw_text_summary", "") or "",
            product_types=cached_detail.get("product_types", []),
            is_rx=cached_detail.get("is_rx"),
            pharm_class_cs=cached_detail.get("pharm_class_cs"),
            dosage_forms=cached_detail.get("dosage_forms", []),
            boxed_warnings=cached_detail.get("boxed_warnings", []),
            warnings=cached_detail.get("warnings", []),
            contraindications=cached_detail.get("contraindications", []),
            precautions=cached_detail.get("precautions", []),
            adverse_reactions=cached_detail.get("adverse_reactions", []),
            drug_interactions=cached_detail.get("drug_interactions", []),
            food_warnings=cached_detail.get("food_warnings", []),
            side_effects=cached_detail.get("side_effects", []),
            found=True,
            source="cache"
        )

    # 2. Fetch live OpenFDA label.
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
                boxed_warnings=extracted_label.get("boxed_warnings", []),
                warnings=extracted_label.get("warnings", []),
                contraindications=extracted_label.get("contraindications", []),
                precautions=extracted_label.get("precautions", []),
                adverse_reactions=extracted_label.get("adverse_reactions", []),
                drug_interactions=extracted_label.get("drug_interactions", []),
                food_warnings=extracted_label.get("food_warnings", []),
                side_effects=extracted_label.get("side_effects", []),
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

def _to_india_ban_info(match: Optional[BanMatch]) -> Optional[IndiaBanInfo]:
    if not match:
        return None
    return IndiaBanInfo(
        matched=True,
        heading=match.heading,
        message=match.message,
        entry_name=match.entry_name,
        status=match.status,
        notification=match.notification,
        date=match.date,
        source=match.source,
        qualified=match.qualified,
    )


def _format_queried_medicine_display(raw_name: str) -> str:
    cleaned = (raw_name or "").strip()
    if "+" in cleaned:
        return " + ".join(
            format_canonical_medicine_name(part.strip())
            for part in cleaned.split("+")
            if part.strip()
        )
    return format_canonical_medicine_name(cleaned) or cleaned


def _fallback_ban_ingredients(raw_name: str) -> List[str]:
    """
    Normalizes the requested medicine name directly for CDSCO ban matching when
    profile-based resolution yields no ingredients or no match.
    """
    normalized_name = normalize_drug_query(raw_name)
    if not normalized_name:
        return []
    if "+" in normalized_name:
        parts = [normalize_drug_query(part) for part in normalized_name.split("+")]
        return [part for part in parts if part]
    if "/" in normalized_name:
        parts = [normalize_drug_query(part) for part in normalized_name.split("/")]
        return [part for part in parts if part]
    return [normalized_name]


@app.get("/api/medicine/{name:path}/profile", response_model=MedicineProfileResponse)
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
    if not name or not name.strip():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medicine name is required.",
        )
    label_info = await fetch_and_cache_single_drug(name)
    profile = get_or_build_medicine_profile(
        name, 
        label=label_info.model_dump() if label_info.found else None
    )
    ban_ingredients = resolve_ban_ingredients(
        name,
        canonical_key=profile.generic_name,
        profile=profile,
    )
    ban_info = _to_india_ban_info(lookup_ban(ban_ingredients))
    if not ban_info and not (profile.is_fdc and profile.fdc_ingredients):
        fallback_ingredients = _fallback_ban_ingredients(name)
        if fallback_ingredients:
            ban_info = _to_india_ban_info(lookup_ban(fallback_ingredients))
    if ban_info:
        profile.india_ban = ban_info
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


@app.get("/api/india/banned", response_model=IndiaBannedSearchResponse)
@limiter.limit(settings.RATE_LIMIT_SEARCH)
async def search_india_banned(
    request: Request,
    query: str = Query("", description="Search term for India banned medicine name or ingredient"),
    limit: int = Query(20, ge=1, le=200, description="Maximum number of entries to return"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Searches India's official CDSCO banned and halted medicines dataset.
    Empty query returns the first `limit` Prohibited entries.
    """
    total, results = search_banned_with_total(query=query, limit=limit)
    return IndiaBannedSearchResponse(
        total=total,
        results=[IndiaBannedSearchItem(**item) for item in results],
    )


@app.get("/api/india/catalogue/search", response_model=CatalogueSearchResponse)
@limiter.limit(settings.RATE_LIMIT_SEARCH)
async def search_india_catalogue(
    request: Request,
    query: str = Query("", description="Search term for Indian medicines catalogue"),
    limit: int = Query(10, ge=1, le=200, description="Maximum number of entries to return"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Searches the Indian medicines brand reference catalogue.
    """
    results = await anyio.to_thread.run_sync(search_catalogue, query, limit)
    return CatalogueSearchResponse(
        total=len(results),
        results=results,
    )

async def _execute_check_pipeline(
    request: Request,
    req: CheckRequest,
    current_user: Dict[str, Any]
) -> CheckResponse:
    start_time = time.time()
    medicines = req.medicines
    user_id = current_user.get("id", "anonymous")
    logger.info(f"User {user_id} analyzing basket ({len(medicines)} medicines): {medicines}")

    # Build ingredient mappings and sets for each medicine in basket
    # {resolve_canonical_name(name)} ∪ canonicalized get_fdc_info(name) ingredients
    med_ingredient_sets: Dict[str, Set[str]] = {}
    med_ingredients: Dict[str, List[str]] = {}
    all_ingredient_queries: Set[str] = set()

    for med in medicines:
        canon = resolve_canonical_name(med)
        fdc = get_fdc_info(med)
        ings_set = {canon}
        if fdc and fdc.get("ingredients"):
            fdc_ings = [resolve_canonical_name(i) for i in fdc["ingredients"]]
            ings_set.update(fdc_ings)
            med_ingredients[med] = fdc_ings
        elif "+" in med:
            typed_parts = [resolve_canonical_name(p) for p in med.split("+") if p.strip()]
            ings_set = set(typed_parts) if typed_parts else {canon}
            med_ingredients[med] = typed_parts or [canon]
        else:
            med_ingredients[med] = [canon]
        med_ingredient_sets[med] = ings_set
        all_ingredient_queries.update(ings_set)
        all_ingredient_queries.add(med.strip().lower())

    # 1. Concurrently fetch/cache labels for all medicines and constituents in parallel
    label_results: List[DrugLabelResult] = await asyncio.gather(
        *[fetch_and_cache_single_drug(q) for q in all_ingredient_queries]
    )
    drug_labels_map: Dict[str, DrugLabelResult] = {
        q: label for q, label in zip(all_ingredient_queries, label_results)
    }

    # 2. Build full profiles for all medicines in basket
    profiles: Dict[str, MedicineProfileResponse] = {}
    unverified_drugs: List[str] = []

    for med in medicines:
        lbl = drug_labels_map.get(med.strip().lower()) or drug_labels_map.get(resolve_canonical_name(med))
        profiles[med] = get_or_build_medicine_profile(
            med, 
            label=lbl.model_dump() if (lbl and lbl.found) else None
        )

        # Coverage: a medicine counts as verified only if ALL its ingredients are verified
        all_ings_verified = True
        for ing in med_ingredient_sets[med]:
            ing_prof = get_or_build_medicine_profile(ing)
            ing_lbl = drug_labels_map.get(ing)
            is_verified = (ing_prof and ing_prof.data_source != "unknown_fallback") or (ing_lbl and ing_lbl.found)
            if not is_verified:
                all_ings_verified = False
                break

        if not all_ings_verified or profiles[med].data_source == "unknown_fallback":
            unverified_drugs.append(med.capitalize())

    # 3. Parallelized Pairwise Evaluation bounded by Semaphore
    pairs = list(itertools.combinations(medicines, 2))
    detected_interactions: List[InteractionItem] = []
    semaphore = asyncio.Semaphore(5)

    severity_score_map = {
        Severity.HIGH: 3,
        Severity.MODERATE: 2,
        Severity.LOW: 1,
        Severity.NONE: 0
    }

    async def evaluate_pair(drug_a: str, drug_b: str) -> Optional[InteractionItem]:
        async with semaphore:
            # Check therapeutic duplication first: if ingredient sets intersect, emit duplication finding and skip pair analysis
            shared_ingredients = med_ingredient_sets.get(drug_a, set()) & med_ingredient_sets.get(drug_b, set())
            if shared_ingredients:
                shared_names = ", ".join(sorted(s.capitalize() for s in shared_ingredients))
                dup_item = InteractionItem(
                    drug_a=drug_a,
                    drug_b=drug_b,
                    severity=Severity.HIGH,
                    explanation=f"Therapeutic duplication — same active ingredient: Concurrent use of {drug_a} and {drug_b} leads to duplicate dosing of {shared_names}. Increases risk of cumulative toxicity and adverse events.",
                    mechanism=f"Both medications contain or deliver the same active compound ({shared_names}), resulting in additive pharmacological exposure without increased therapeutic efficacy.",
                    clinical_impact=f"Substantially increases the hazard of concentration-dependent adverse effects, organ toxicity, and accidental overdose of {shared_names}.",
                    action_guidance=f"Avoid concurrent use of {drug_a} and {drug_b}. Use only one product containing {shared_names} unless explicitly directed by a physician.",
                    evidence_source="Deterministic canonical-name match",
                    confidence=RuleConfidence.ESTABLISHED,
                    last_reviewed=RULE_TABLE_LAST_REVIEWED
                )
                return dup_item

            # Non-duplicate pairs: check cache first for product pair
            cached_interaction = await get_cached_interaction(drug_a, drug_b)
            if cached_interaction:
                if cached_interaction.severity.value != "none":
                    return cached_interaction
                return None

            ings_a = med_ingredients.get(drug_a, [resolve_canonical_name(drug_a)])
            ings_b = med_ingredients.get(drug_b, [resolve_canonical_name(drug_b)])
            is_either_fdc = len(ings_a) > 1 or len(ings_b) > 1

            if is_either_fdc:
                highest_finding: Optional[InteractionItem] = None
                highest_score = -1

                for ia in ings_a:
                    for ib in ings_b:
                        lbl_ia = drug_labels_map.get(ia)
                        lbl_ib = drug_labels_map.get(ib)
                        finding = await analyze_drug_pair(
                            drug_a=ia,
                            drug_b=ib,
                            label_a=lbl_ia.model_dump() if lbl_ia else None,
                            label_b=lbl_ib.model_dump() if lbl_ib else None
                        )
                        if finding:
                            score = severity_score_map.get(finding.severity, 0)
                            if score > highest_score:
                                highest_score = score
                                highest_finding = finding

                if highest_finding and highest_finding.severity != Severity.NONE and highest_finding.severity.value != "none":
                    combined_interaction = InteractionItem(
                        drug_a=drug_a,
                        drug_b=drug_b,
                        severity=highest_finding.severity,
                        explanation=highest_finding.explanation,
                        mechanism=highest_finding.mechanism,
                        clinical_impact=highest_finding.clinical_impact,
                        stomach_impact=highest_finding.stomach_impact,
                        food_consideration=highest_finding.food_consideration,
                        action_guidance=highest_finding.action_guidance,
                        evidence_source=highest_finding.evidence_source,
                        confidence=highest_finding.confidence,
                        last_reviewed=highest_finding.last_reviewed
                    )
                    await save_interaction_to_cache(
                        drug_a=drug_a,
                        drug_b=drug_b,
                        severity=combined_interaction.severity.value,
                        explanation=combined_interaction.explanation,
                        mechanism=combined_interaction.mechanism,
                        clinical_impact=combined_interaction.clinical_impact,
                        stomach_impact=combined_interaction.stomach_impact,
                        food_consideration=combined_interaction.food_consideration,
                        action_guidance=combined_interaction.action_guidance,
                        evidence_source=combined_interaction.evidence_source,
                        confidence=combined_interaction.confidence.value if combined_interaction.confidence else "established",
                        last_reviewed=combined_interaction.last_reviewed
                    )
                    return combined_interaction
                else:
                    await save_interaction_to_cache(
                        drug_a=drug_a,
                        drug_b=drug_b,
                        severity="none",
                        explanation="No clinically significant interaction detected across combination ingredients in verified database."
                    )
                    return None
            else:
                label_a = drug_labels_map.get(drug_a.strip().lower()) or drug_labels_map.get(resolve_canonical_name(drug_a))
                label_b = drug_labels_map.get(drug_b.strip().lower()) or drug_labels_map.get(resolve_canonical_name(drug_b))

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
                    if interaction.severity == Severity.NONE or interaction.severity.value == "none":
                        return None
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

    # Calculate analysis coverage across the basket
    unverified_drugs = [
        med.capitalize() for med in medicines
        if profiles.get(med) is None or profiles[med].data_source == "unknown_fallback"
    ]
    verified_count = len(medicines) - len(unverified_drugs)
    total_count = len(medicines)

    if total_count == 0:
        analysis_coverage = "none"
    elif verified_count == total_count:
        analysis_coverage = "full"
    elif verified_count > 0:
        analysis_coverage = "partial"
    else:
        analysis_coverage = "none"

    limited_data_warnings = []
    if unverified_drugs:
        limited_data_warnings.append(
            f"Limited or unverified clinical data for: {', '.join(unverified_drugs)}. Analysis is incomplete."
        )

    # Safe boolean strictly gated: can ONLY be True if analysis_coverage == 'full' AND zero interactions found
    if analysis_coverage != "full":
        is_safe = False
        summary_text = (
            f"Analysis is incomplete. Unverified medicines detected ({', '.join(unverified_drugs)}); "
            "cannot guarantee safety."
        )
    else:
        is_safe = len(detected_interactions) == 0
        if is_safe:
            if len(medicines) == 1:
                summary_text = f"Profile analyzed for {medicines[0].capitalize()}. Add a second medicine to check pairwise interactions."
            else:
                summary_text = "No known interactions detected between the selected medicines in verified clinical databases."
        else:
            summary_text = f"Identified {len(detected_interactions)} potential interaction{'s' if len(detected_interactions) > 1 else ''} across {len(pairs)} analyzed pairs."

    # Check each basket medicine independently against CDSCO India banned list.
    india_ban_alerts: List[IndiaBanAlert] = []
    for med in medicines:
        med_ban_ings = resolve_ban_ingredients(
            med,
            canonical_key=profiles[med].generic_name if med in profiles else resolve_canonical_name(med),
            profile=profiles.get(med),
        )
        ban_info = _to_india_ban_info(lookup_ban(med_ban_ings))
        if ban_info:
            india_ban_alerts.append(IndiaBanAlert(medicine=med, info=ban_info))
            if med in profiles:
                profiles[med].india_ban = ban_info

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
        limited_data_warnings=limited_data_warnings,
        analysis_coverage=analysis_coverage,
        verified_medicines_count=verified_count,
        total_medicines_count=total_count,
        india_ban_alerts=india_ban_alerts,
    )

@app.post("/api/check", response_model=CheckResponse)
@limiter.shared_limit(settings.RATE_LIMIT_CHECK, scope="basket_check")
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
    return await _execute_check_pipeline(request, req, current_user)

@app.post("/api/basket/analyze", response_model=CheckResponse, include_in_schema=False)
@limiter.shared_limit(settings.RATE_LIMIT_CHECK, scope="basket_check")
async def analyze_basket_alias(
    request: Request,
    req: CheckRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Compatibility alias for /api/check sharing the exact same rate limit bucket."""
    return await _execute_check_pipeline(request, req, current_user)


async def _call_groq_safely(user_prompt: str, system_prompt: str, label: str) -> Optional[str]:
    groq_fn = call_groq_api if call_groq_api is not _ORIG_CALL_GROQ_API else groq_client.call_groq_api
    try:
        ai_answer = await groq_fn(user_prompt, system_prompt=system_prompt)
    except Exception as exc:
        logger.warning(f"Groq assistant call raised unexpectedly for '{label}': {exc}")
        return None
    return ai_answer.strip() if isinstance(ai_answer, str) and ai_answer.strip() else None


async def _build_fallback_or_not_found(
    req: ChatRequest,
    not_found_medicine: str,
    not_found_message: str,
    user_id: str,
    known_generic: Optional[str] = None,
) -> ChatResponse:
    system_prompt, user_prompt = build_fallback_chat_prompts(
        typed_medicine=req.medicine,
        question=req.question,
        known_generic=known_generic,
    )
    cleaned_answer = await _call_groq_safely(user_prompt, system_prompt, req.medicine)
    if cleaned_answer is not None:
        logger.info(
            f"User {user_id} chat AI fallback for '{req.medicine}' "
            f"(follow_up={bool(req.question)})"
        )
        return ChatResponse(
            found=False,
            medicine=req.medicine,
            profile=None,
            answer=cleaned_answer,
            ai_available=True,
            ai_fallback=True,
            disclaimer=AI_FALLBACK_DISCLAIMER,
            message=None,
        )

    return ChatResponse(
        found=False,
        medicine=not_found_medicine,
        profile=None,
        answer=None,
        ai_available=False,
        ai_fallback=False,
        disclaimer=None,
        message=not_found_message,
    )


async def _build_unresolved_chat_response(
    req: ChatRequest,
    user_id: str,
    ban_ingredients: List[str],
    ban_display_name: str,
    not_found_medicine: str,
    not_found_message: str,
    known_generic: Optional[str] = None,
    allow_ban_overview: bool = False,
) -> ChatResponse:
    """
    Handles /api/chat when clinical profile resolution failed:
    checks CDSCO ban status, Indian medicines catalogue match, ban overview
    (when applicable), and finally AI fallback or honest not-found response.
    """
    india_ban = _to_india_ban_info(lookup_ban(ban_ingredients))

    if allow_ban_overview and not india_ban:
        q_low = req.medicine.lower()
        if "banned" in q_low or "ban list" in q_low:
            return ChatResponse(
                found=False,
                medicine=req.medicine,
                profile=None,
                answer=build_ban_overview_answer(),
                ai_available=False,
                ai_fallback=False,
                disclaimer=None,
                message=None,
                india_ban=None,
                india_ban_overview=True,
            )

    product = await anyio.to_thread.run_sync(match_product_for_chat, req.medicine)
    if product is not None:
        product_ban = _to_india_ban_info(lookup_ban(resolve_ban_ingredients(product.name)))
        effective_ban = product_ban or india_ban
        return ChatResponse(
            found=False,
            medicine=req.medicine,
            profile=None,
            answer=build_catalogue_answer(product, req.question),
            ai_available=False,
            ai_fallback=False,
            disclaimer=CATALOGUE_DISCLAIMER,
            message=None,
            india_ban=effective_ban,
            india_ban_overview=False,
            catalogue_match=True,
            catalogue=product,
        )

    if india_ban:
        return ChatResponse(
            found=False,
            medicine=ban_display_name,
            profile=None,
            answer=india_ban.message,
            ai_available=False,
            ai_fallback=False,
            disclaimer=None,
            message=None,
            india_ban=india_ban,
            india_ban_overview=False,
        )

    return await _build_fallback_or_not_found(
        req=req,
        not_found_medicine=not_found_medicine,
        not_found_message=not_found_message,
        user_id=user_id,
        known_generic=known_generic,
    )


@app.post("/api/chat", response_model=ChatResponse)
@limiter.limit(settings.RATE_LIMIT_CHECK)
async def chat_about_medicine(
    request: Request,
    req: ChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Medicine chatbot endpoint grounded strictly in MEDCHECK's curated clinical profiles,
    OpenFDA labels, interaction rules, and India's CDSCO banned medicines list,
    summarized in plain language via Groq, with Indian medicines catalogue reference
    and an explicit AI fallback overview when the medicine is absent from the database.
    """
    user_id = current_user.get("id", "anonymous")
    resolved = resolve_medicine_for_chat(req.medicine)
    if not resolved:
        return await _build_unresolved_chat_response(
            req=req,
            user_id=user_id,
            ban_ingredients=resolve_ban_ingredients(req.medicine),
            ban_display_name=_format_queried_medicine_display(req.medicine),
            not_found_medicine=req.medicine,
            not_found_message=(
                f"'{req.medicine}' was not found in the MEDCHECK database. "
                "Please check the spelling or try entering the generic active ingredient name."
            ),
            allow_ban_overview=True,
        )

    canonical_key, profile_query = resolved
    canonical_display = format_canonical_medicine_name(canonical_key)

    label_info: Optional[DrugLabelResult] = None
    if canonical_key in CURATED_MEDICINE_PROFILES:
        profile = get_or_build_medicine_profile(profile_query)
    else:
        label_info = await fetch_and_cache_single_drug(canonical_key)
        profile = get_or_build_medicine_profile(
            profile_query,
            label=label_info.model_dump() if label_info.found else None,
        )

    if profile.data_source == "unknown_fallback":
        return await _build_unresolved_chat_response(
            req=req,
            user_id=user_id,
            ban_ingredients=resolve_ban_ingredients(req.medicine, canonical_key=canonical_key),
            ban_display_name=canonical_display or _format_queried_medicine_display(req.medicine),
            not_found_medicine=canonical_display or req.medicine,
            not_found_message=(
                f"No detailed prescribing label data is currently available for '{req.medicine}'. "
                "Please check the spelling or try entering the generic active ingredient name."
            ),
            known_generic=canonical_display,
            allow_ban_overview=False,
        )

    ban_ingredients = resolve_ban_ingredients(
        req.medicine,
        canonical_key=canonical_key,
        profile=profile,
    )
    india_ban = _to_india_ban_info(lookup_ban(ban_ingredients))
    if india_ban:
        profile.india_ban = india_ban

    known_interactions, boxed_from_rules = get_known_interactions_for_medicine(
        canonical_key,
        fdc_ingredients=profile.fdc_ingredients,
    )

    label_boxed = (
        "\n\n".join(label_info.boxed_warnings)
        if label_info and label_info.boxed_warnings
        else None
    )
    boxed_warning = label_boxed or boxed_from_rules

    label_interaction_notes = (
        [str(item) for item in label_info.drug_interactions if str(item).strip()][:6]
        if label_info and label_info.drug_interactions
        else []
    )

    context = compose_medicine_context(
        canonical_display=canonical_display,
        profile=profile,
        known_interactions=known_interactions,
        boxed_warning=boxed_warning,
        label_interaction_notes=label_interaction_notes,
        typed_medicine=req.medicine,
        india_ban=india_ban,
    )
    system_prompt, user_prompt = build_chat_prompts(
        context=context,
        canonical_display=canonical_display,
        question=req.question,
        typed_medicine=req.medicine,
        india_ban=india_ban,
    )

    cleaned_answer = await _call_groq_safely(user_prompt, system_prompt, canonical_key)
    if india_ban:
        final_answer = (
            f"{india_ban.message}\n\n{cleaned_answer}"
            if cleaned_answer is not None
            else india_ban.message
        )
        ai_available = cleaned_answer is not None
    else:
        final_answer = cleaned_answer
        ai_available = cleaned_answer is not None

    logger.info(
        f"User {user_id} chat lookup for '{canonical_key}' "
        f"(follow_up={bool(req.question)}, ai_available={ai_available}, india_ban={bool(india_ban)})"
    )

    return ChatResponse(
        found=True,
        medicine=canonical_display,
        profile=profile,
        answer=final_answer,
        ai_available=ai_available,
        ai_fallback=False,
        disclaimer=None,
        message=None,
        boxed_warning=boxed_warning,
        known_interactions=known_interactions,
        label_interaction_notes=label_interaction_notes,
        india_ban=india_ban,
        india_ban_overview=False,
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host=settings.HOST, 
        port=settings.PORT, 
        reload=(settings.ENV == "development")
    )

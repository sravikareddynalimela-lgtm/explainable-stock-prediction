"""Supabase Auth token verification for FastAPI.

Sign-up / log-in happen in the browser with supabase-js. The browser then sends
the Supabase access token to this API, and we verify it here:

* Asymmetric signing keys (the default for new Supabase projects): verified
  against the project's public JWKS, no secret needed.
* Legacy projects: set SUPABASE_JWT_SECRET to verify HS256 tokens.

If SUPABASE_URL is not set, auth is disabled (handy for offline development).
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache

import jwt
from fastapi import HTTPException, Query, Request

from . import config  # noqa: F401  (loads backend/.env before reading variables)

log = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
AUDIENCE = os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated")
AUTH_ENABLED = bool(SUPABASE_URL) and os.getenv("AUTH_DISABLED", "0") != "1"

if not AUTH_ENABLED:
    log.warning("SUPABASE_URL not set: API auth is DISABLED. Set it before deploying.")


@lru_cache(maxsize=1)
def _jwks() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json", cache_keys=True, lifespan=3600)


def verify_token(token: str) -> dict:
    try:
        alg = jwt.get_unverified_header(token).get("alg")
        issuer = f"{SUPABASE_URL}/auth/v1"
        if alg in ("ES256", "RS256", "EdDSA"):
            key = _jwks().get_signing_key_from_jwt(token).key
            return jwt.decode(token, key, algorithms=[alg], audience=AUDIENCE, issuer=issuer)
        if alg == "HS256" and SUPABASE_JWT_SECRET:
            return jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience=AUDIENCE, issuer=issuer)
        raise jwt.InvalidAlgorithmError(f"Unsupported token algorithm {alg!r}")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expired. Please log in again.")
    except (jwt.PyJWTError, jwt.PyJWKClientError) as e:
        raise HTTPException(401, f"Invalid session: {e}")


def current_user(request: Request, token: str | None = Query(None, include_in_schema=False)) -> dict:
    """FastAPI dependency. Reads `Authorization: Bearer <jwt>`, or `?token=` for EventSource streams."""
    if not AUTH_ENABLED:
        return {"sub": "local-dev", "email": "dev@localhost"}
    header = request.headers.get("authorization", "")
    raw = header[7:] if header.lower().startswith("bearer ") else token
    if not raw:
        raise HTTPException(401, "Log in to use this endpoint.")
    claims = verify_token(raw)
    if claims.get("role") != "authenticated":
        raise HTTPException(401, "Log in to use this endpoint.")
    return claims

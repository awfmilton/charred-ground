# Owner-managed Gemini and OpenAI decisions

The game no longer collects API keys from players. Local Easy, Normal and Hard computer players need no external service.

To enable external AI providers, the server owner configures each provider independently in the server environment (or the existing private `.env` file), then restarts the server:

- **Gemini**: set `GEMINI_API_KEY` and `GEMINI_MODEL`.
- **OpenAI**: set `OPENAI_API_KEY` and `OPENAI_MODEL`.

Choose a model available to the respective provider account. Leave either the key or model unset for a provider to keep that provider disabled (returning `503` if requested while the other provider remains available if configured). Do not commit the actual values or put them in static hosting configuration, HTML, URLs or client storage.

`GET /api/ai/providers` returns `{ providers: { gemini: { available, label: 'Gemini 4 Argon' }, openai: { available, label: 'ChatGPT' } }, timeoutMs }` without requiring authentication. It exposes only boolean availability, display labels, and the non-secret timeout in milliseconds—never model names or keys.

The browser calls the same-origin `POST /api/ai/decision` endpoint with the existing account bearer session and an optional `provider` field (`"gemini"` or `"openai"`, defaulting to `"gemini"` when omitted; unknown providers return `400`). A signed-in, email-verified account is required. Cookie-only requests are refused. The server constructs an identical bounded game prompt for both providers (treating game context as data, not instructions), supplies the provider key only in the request header (`x-goog-api-key` for Gemini, `Authorization: Bearer <key>` for OpenAI), validates the returned item and aiming values, and returns only the validated decision. An optional `taunt` string from the model is sanitised to plain text (control characters and `<`/`>` stripped, whitespace collapsed, truncated to 80 characters, and omitted if empty); no other extra fields are ever returned. Provider errors and credentials are never forwarded to the browser. Invalid or unavailable decisions fall back to the local computer player.

Limits are shared across both providers and can be tuned via integer environment variables:

- `AI_TIMEOUT_MS` (default `3500`, clamped `1000..20000`): per-request timeout in milliseconds for both Gemini and OpenAI fetches.
- `AI_ACCOUNT_RATE_PER_MIN` (default `12`, clamped `1..60`): per-account request limit per minute across all AI slots (raise when hosting AI-vs-AI matches where both brains bill to the host account).
- `OPENAI_MAX_COMPLETION_TOKENS` (default `400`, clamped `100..4000`): `max_completion_tokens` sent to OpenAI (`maxOutputTokens` for Gemini remains `400`).

For reasoning models such as `gpt-5-mini` that spend hidden reasoning tokens and need longer to respond, we recommend `AI_TIMEOUT_MS=12000` and `OPENAI_MAX_COMPLETION_TOKENS=2000`. Global limits remain 60 requests per minute per server process and four simultaneous provider requests in flight. These process-local limits do not provide a distributed billing quota; spending limits must be configured at each provider (Google Cloud / Google AI Studio and OpenAI) before enabling the service.

This endpoint runs with the existing Node >=22.5 account server and its MySQL/SQLite adapters. Static-only hosting cannot provide it. Tests use a fake provider and an in-memory account database; no paid provider request or live credential was used.

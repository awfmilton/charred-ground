# Owner-managed Gemini and OpenAI decisions

The game no longer collects API keys from players. Local Easy, Normal and Hard computer players need no external service.

To enable external AI providers, the server owner configures each provider independently in the server environment (or the existing private `.env` file), then restarts the server:

- **Gemini**: set `GEMINI_API_KEY` and `GEMINI_MODEL`.
- **OpenAI**: set `OPENAI_API_KEY` and `OPENAI_MODEL`.

Choose a model available to the respective provider account. Leave either the key or model unset for a provider to keep that provider disabled (returning `503` if requested while the other provider remains available if configured). Do not commit the actual values or put them in static hosting configuration, HTML, URLs or client storage.

`GET /api/ai/providers` returns `{ providers: { gemini: { available, label: 'Gemini 4 Argon' }, openai: { available, label: 'ChatGPT' } } }` without requiring authentication. It exposes only boolean availability and display labels—never model names or keys.

The browser calls the same-origin `POST /api/ai/decision` endpoint with the existing account bearer session and an optional `provider` field (`"gemini"` or `"openai"`, defaulting to `"gemini"` when omitted; unknown providers return `400`). A signed-in, email-verified account is required. Cookie-only requests are refused. The server constructs an identical bounded game prompt for both providers (treating game context as data, not instructions), supplies the provider key only in the request header (`x-goog-api-key` for Gemini, `Authorization: Bearer <key>` for OpenAI), validates the returned item and aiming values, and returns only the validated decision. An optional `taunt` string from the model is sanitised to plain text (control characters and `<`/`>` stripped, whitespace collapsed, truncated to 80 characters, and omitted if empty); no other extra fields are ever returned. Provider errors and credentials are never forwarded to the browser. Invalid or unavailable decisions fall back to the local computer player.

Limits are shared across both providers: 12 requests per minute per account, 60 per minute per server process, four simultaneous provider requests in flight, a 3.5-second provider timeout, and 400 requested output tokens (`maxOutputTokens` / `max_completion_tokens`). These process-local limits do not provide a distributed billing quota; spending limits must be configured at each provider (Google Cloud / Google AI Studio and OpenAI) before enabling the service.

This endpoint runs with the existing Node >=22.5 account server and its MySQL/SQLite adapters. Static-only hosting cannot provide it. Tests use a fake provider and an in-memory account database; no paid provider request or live credential was used.

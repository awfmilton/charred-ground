# Owner-managed Gemini decisions

The game no longer collects a Google API key from players. Local Easy, Normal and Hard computer players need no external service.

To enable the separate Gemini option, the server owner sets `GEMINI_API_KEY` and `GEMINI_MODEL` in the server environment (or the existing private `.env` file), then restarts the server. Choose a model available to that Google account. Leave either unset to keep external AI disabled. Do not commit the actual values or put them in static hosting configuration, HTML, URLs or client storage.

The browser calls the same-origin `POST /api/ai/decision` endpoint with the existing account bearer session. A signed-in, email-verified account is required. Cookie-only requests are refused. The server constructs a bounded game prompt, supplies the provider key in a request header, validates the returned item and aiming values, and returns only the decision. Provider errors and credentials are never forwarded to the browser. Invalid or unavailable decisions fall back to the local computer player.

Limits are 12 requests per minute per account, 60 per minute per server process, four simultaneous provider requests, a 3.5-second provider timeout, and 400 requested output tokens. These process-local limits do not provide a distributed billing quota; configure provider spending limits separately when enabling the service on multiple server processes.

This endpoint runs with the existing Node >=22.5 account server and its MySQL/SQLite adapters. Static-only hosting cannot provide it. Tests use a fake provider and an in-memory account database; no paid provider request or live credential was used.

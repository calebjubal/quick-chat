# Production verification

The browser journey suite requires two pre-created, verified accounts. Set `E2E_USER_A_EMAIL`, `E2E_USER_A_PASSWORD`, `E2E_USER_A_USERNAME` and the corresponding `E2E_USER_B_*` values, plus `E2E_BASE_URL` for the frontend and `E2E_API_URL` for the API, then run `pnpm test:e2e`.

The load suite requires k6, a dedicated non-production environment, `K6_API_URL`, `K6_WS_URL`, `K6_SESSION_TOKEN`, and `K6_CONVERSATION_ID`. It exercises 1,000 concurrent sockets, 50 message acknowledgements per second, and a 256-client fan-out cohort. Never point it at production user data.

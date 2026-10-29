# Security Policy

## Supported Versions

| Version | Status | Notes |
| :---: | :---: | :--- |
| `2.0.x` | Supported | Production institutional release (`main` branch & [fasttrade-smoky.vercel.app](https://fasttrade-smoky.vercel.app)) |
| `< 2.0` | Unsupported | Superseded by v2.0 multi-agent & ConTree sandbox architecture |

---

## Institutional Security Controls

FastTrade enforces defense-in-depth security across authentication, code execution, data persistence, and transport:

1. **Credential Storage (`services/auth_service.py`):** Passwords are hashed via `PBKDF2-HMAC-SHA256` (`100,000` iterations) with 16-byte CSPRNG salts and verified via constant-time `secrets.compare_digest`.
2. **Session Integrity (`services/auth_service.py`):** Stateless bearer tokens are cryptographically signed with `HMAC-SHA256` (`FASTTRADE_SECRET_KEY`) and enforce strict expiration claims.
3. **Sandboxed Strategy Execution (`services/nebius_sandbox_service.py`):** Synthesized Python execution policies and custom research snippets pass Python `ast` static safety checks and execute inside isolated remote **Nebius ConTree Linux Micro-VMs (`python:3.12-slim`)** rather than on the host API process.
4. **Pickle-Free ML Inference (`models/`):** Production microstructure classifiers and GRU forecasters load pure-NumPy `.npz` weight tensors, avoiding unsafe `pickle` deserialization.
5. **OWASP HTTP Headers & XSS Protection (`api/main.py`, `services/email_service.py`):** Every HTTP response carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, and `Permissions-Policy`; all outbound HTML committee memos apply `html.escape(..., quote=True)`.
6. **Secret Hygiene:** `.env` files, API tokens (`NEBIUS_API_KEY`, `LANGSMITH_API_KEY`, `TAVILY_API_KEY`, `RESEND_API_KEY`), and local `.db` files are strictly excluded via `.gitignore` and `.vercelignore`.

See [`docs/TECHNICAL_ARCHITECTURE_AND_SECURITY_AUDIT.md`](./docs/TECHNICAL_ARCHITECTURE_AND_SECURITY_AUDIT.md) for the complete security audit matrix.

---

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities. Report suspected security issues privately to:

- **Lead Architect:** Ritesh Kochar (`ensure01@gmail.com`)

Include reproduction steps, affected endpoints/modules, and potential impact. You will receive an acknowledgment within 48 hours.

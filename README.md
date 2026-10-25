# Ustad

Danish's personal German speaking coach for Vienna, A1 to B1. A phone-first PWA: spaced repetition of spoken chunks, likely replies, full conversations to roleplay, Austrian culture phrases and small real-world missions.

- Spec: [SPEC.md](SPEC.md) · review notes: [docs/SPEC_REVIEW.md](docs/SPEC_REVIEW.md) · curriculum: [docs/curriculum.md](docs/curriculum.md)
- Status and next step: [docs/PROGRESS.md](docs/PROGRESS.md)
- Deploy (Cloudflare, free): [docs/DEPLOY.md](docs/DEPLOY.md)

## Run locally (Windows)

```powershell
cd frontend; npm install; copy .dev.vars.example .dev.vars; npm run password   # paste the hash into .dev.vars
cd ..; .\scripts\dev.ps1
```

Open http://localhost:5173. Tests: `.\scripts\test.ps1`.

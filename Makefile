# Linux/macOS. On Windows use scripts/dev.ps1 and scripts/test.ps1 (or the npm scripts directly).
.PHONY: dev test lint deploy audio

dev:
	cd frontend && npm run db:migrate:local && npm run dev

test:
	cd frontend && npm run test

lint:
	cd frontend && npx tsc -b && npm run lint

deploy:
	cd frontend && npm run deploy

audio:
	cd tools/tts && uv run python generate.py

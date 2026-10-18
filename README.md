# 은혜 비서 (Eunhye Secretary)

Private personal secretary for career, education, publications, awards, and research documents.

## Architecture

- `web/`: GitHub Pages static frontend (no secrets, no private documents)
- `server/`: Node.js API for local/private use; reads `WIKI_PATH` and calls OpenAI server-side
- `data/files.json`: generated file catalog used by the frontend

GitHub Pages cannot safely hold an OpenAI key or serve a private document corpus. Deploy the `web/` folder to Pages and run `server/` on a private host (or use a serverless endpoint). Set `VITE_API_BASE_URL` at deployment time or edit `web/config.js`.

## Run locally

1. Create a new OpenAI key after revoking the key previously exposed in chat.
2. In `server/`, copy `.env.example` to `.env` and set `OPENAI_API_KEY`.
3. Set `WIKI_PATH=C:/LLM_wiki`.
4. Run `node server/index.mjs` from this folder.
5. Open `http://localhost:8787`.

No key is included in this repository.

## Deploying Pages

Configure GitHub Pages to publish `/web` from the `main` branch. The Pages app expects `window.ENHE_API_BASE_URL` in `web/config.js` to point to the private API. For a same-origin deployment, reverse proxy `/api` to the server.

## Corpus

The current local catalog contains 15 items under awards, career, images, and research. Documents themselves are intentionally not copied into this repository.

# Eunhye Secretary

Public personal archive and AI secretary for Angel Canelo.

Live website: https://canelo-phd.github.io/eunhye-secretary/

## Architecture

- `web/`: GitHub Pages interface, public archive files, archive catalog, and pre-extracted retrieval index.
- `worker/`: Cloudflare Worker API. It retrieves relevant multilingual archive text and calls OpenAI without exposing the key.
- `tools/build_archive_index.py`: Regenerates `web/archive-index.json` after public archive updates.

The public website communicates with:

`https://eunhye-api.angelcanelophd.workers.dev`

The OpenAI credential is stored only as Cloudflare Worker Secret `OPENAI_API_KEY`. It must never be committed to this repository or added to GitHub Pages.

## Updating the public archive

1. Update the source backup at `C:/Users/todog/내 드라이브/LLM_wiki`.
2. Copy approved public documents into `web/archive/`, preserving the `awards/`, `career/`, and `research/` paths.
3. Run:

   `C:/Users/todog/Python/Python3109/python.exe tools/build_archive_index.py`

4. Update `web/catalog.json` if files were added or removed.
5. Commit and push. GitHub Pages and the Cloudflare Worker Git integration deploy the changes.

## Public archive notice

Everything under `web/archive/` is intentionally public through GitHub and GitHub Pages. The current public résumé is the redacted copy without the phone number.

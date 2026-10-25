import json
import os
import pathlib
import subprocess

root = pathlib.Path(r"C:/Users/todog/내 드라이브/LLM_wiki")
out = pathlib.Path(r"C:/eunhye-secretary/web/archive-index.json")
pdftotext = r"C:/Users/todog/AppData/Local/hermes/git/mingw64/bin/pdftotext.exe"
allowed = {".pdf", ".jpg", ".jpeg", ".png", ".md", ".txt", ".csv", ".json"}
records = []
for path in sorted(root.rglob("*")):
    if not path.is_file() or path.suffix.lower() not in allowed or "images" in path.parts:
        continue
    rel = path.relative_to(root).as_posix()
    ext = path.suffix.lower()
    text = ""
    if ext == ".pdf":
        try:
            text = subprocess.check_output([pdftotext, str(path), "-"], timeout=90).decode("utf-8", "replace")
        except Exception:
            text = ""
    elif ext in {".md", ".txt", ".csv", ".json"}:
        text = path.read_text(encoding="utf-8", errors="replace")
    text = " ".join(text.split())
    if not text:
        text = "[No embedded text layer. This visual document requires OCR or vision review.]"
    text = text[:30000]
    for start in range(0, len(text), 3200):
        records.append({"path": rel, "name": path.name, "chunk": start // 3200, "text": text[start:start + 3600]})
out.write_text(json.dumps({"records": records}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"records={len(records)} bytes={out.stat().st_size}")

import json
import os
import pathlib
import urllib.request

root = pathlib.Path(r"C:/eunhye-secretary")
index_path = root / "web" / "archive-index.json"
key_path = pathlib.Path(r"C:/Users/todog/내 드라이브/openai_key.txt")
key = key_path.read_text(encoding="utf-8").strip()
if not key.startswith("sk-"):
    raise RuntimeError("OpenAI key file is not valid")

data = json.loads(index_path.read_text(encoding="utf-8"))
records = data["records"]
inputs = []
for record in records:
    # Include multilingual filename/path metadata with the document chunk.
    inputs.append(f"File path: {record['path']}\nFile name: {record['name']}\nArchive text: {record['text']}")

request = urllib.request.Request(
    "https://api.openai.com/v1/embeddings",
    data=json.dumps({"model": "text-embedding-3-small", "dimensions": 256, "input": inputs}).encode("utf-8"),
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(request, timeout=180) as response:
    result = json.load(response)

vectors = result["data"]
if len(vectors) != len(records):
    raise RuntimeError("Embedding response count does not match archive records")
for record, vector in zip(records, vectors):
    record["embedding"] = vector["embedding"]
data["embedding_model"] = "text-embedding-3-small"
data["embedding_dimensions"] = 256
index_path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"embedded_records={len(records)} bytes={index_path.stat().st_size}")

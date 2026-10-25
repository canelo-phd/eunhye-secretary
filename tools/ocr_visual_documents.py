import base64
import json
import pathlib
import urllib.request
import fitz

wiki = pathlib.Path(r"C:/Users/todog/내 드라이브/LLM_wiki")
key = pathlib.Path(r"C:/Users/todog/내 드라이브/openai_key.txt").read_text(encoding="utf-8").strip()
out = pathlib.Path(r"C:/eunhye-secretary/tools/ocr_overrides.json")
targets = [
    "awards/Award best academic transcript.pdf",
    "awards/Award JA2018.pdf",
    "awards/GKS_수료증명서.pdf",
    "awards/IPMA level D project management certificate.pdf",
    "awards/Award KSBNS2020.jpg",
]

def pages_as_data_urls(path):
    if path.suffix.lower() in {".jpg", ".jpeg", ".png"}:
        mime = "image/jpeg" if path.suffix.lower() in {".jpg", ".jpeg"} else "image/png"
        return [f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")]
    doc = fitz.open(path)
    urls = []
    for page in doc:
        pix = page.get_pixmap(matrix=fitz.Matrix(1.8, 1.8), alpha=False)
        urls.append("data:image/png;base64," + base64.b64encode(pix.tobytes("png")).decode("ascii"))
    return urls

def extract(path):
    content = [{"type": "text", "text": "Read this award, certificate, or scanned document carefully. Transcribe all meaningful visible text, preserve its original language, identify recipient, issuer, date, award/credential name, and significance. Do not invent unreadable details."}]
    content += [{"type": "image_url", "image_url": {"url": url, "detail": "high"}} for url in pages_as_data_urls(path)]
    payload = {"model": "gpt-4o-mini", "temperature": 0, "messages": [{"role": "user", "content": content}]}
    request = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=json.dumps(payload).encode("utf-8"), headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.load(response)["choices"][0]["message"]["content"]

answers = {}
for rel in targets:
    answers[rel] = extract(wiki / rel)
    print("ocr_complete=" + rel)
out.write_text(json.dumps(answers, ensure_ascii=False, indent=2), encoding="utf-8")
print("ocr_files=" + str(len(answers)))

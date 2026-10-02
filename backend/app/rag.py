"""
RAG pipeline for the SRCW college chatbot.

knowledge/ files (.pdf .txt .md)
   -> pages -> chunks -> embeddings -> FAISS index (saved in storage/)
   -> retrieve -> prompt -> LLM

THIS is where the college information lives: the files inside backend/knowledge/.
The FAISS index in backend/storage/ is just a searchable copy that is rebuilt
automatically whenever the files in knowledge/ change.
"""
import hashlib
import io
import json
import pathlib

import faiss
import numpy as np
from fastembed import TextEmbedding
from pypdf import PdfReader

BASE_DIR = pathlib.Path(__file__).resolve().parent.parent
KNOWLEDGE_DIR = BASE_DIR / "knowledge"
STORAGE_DIR = BASE_DIR / "storage"
SUPPORTED = {".pdf", ".txt", ".md"}

SYSTEM_PROMPT = (
    "You are the official virtual assistant of Sri Ramakrishna College of Arts & Science "
    "for Women (SRCW), Coimbatore. You help students, parents and visitors with questions "
    "about the college. Answer ONLY using the context given. "
    "If the answer is not in the context, say you could not find it and suggest contacting "
    "the college office or visiting https://srcw.ac.in/. Never invent fees, dates, phone "
    "numbers, names or eligibility rules. Be polite, clear and concise; use short bullets "
    "where helpful."
)

_embedder = None


def embed(texts: list[str]) -> np.ndarray:
    """Turn text into normalised vectors."""
    global _embedder
    if _embedder is None:
        _embedder = TextEmbedding("BAAI/bge-small-en-v1.5")  # 384 dims, ~130MB, downloads once
    vecs = np.array(list(_embedder.embed(texts)), dtype="float32")
    faiss.normalize_L2(vecs)  # normalised + inner product = cosine similarity
    return vecs


# ---- Loading files --------------------------------------------------------
def load_pdf(data: bytes) -> list[tuple[int, str]]:
    """Return [(page_number, text), ...] and skip empty pages."""
    reader = PdfReader(io.BytesIO(data))
    pages = []
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            pages.append((i, text))
    return pages


def load_text(raw: str) -> tuple[str, list[tuple[int, str]]]:
    """Text/markdown file. If the first line is 'SOURCE_URL: ...' (written by the
    scraper) use it as the source label. Returns (source_url_or_empty, pages)."""
    raw = raw.strip()
    url = ""
    if raw.startswith("SOURCE_URL:"):
        first, _, raw = raw.partition("\n")
        url = first.replace("SOURCE_URL:", "").strip()
    return url, ([(0, raw.strip())] if raw.strip() else [])  # page 0 = no page numbers


def iter_knowledge_files() -> list[pathlib.Path]:
    if not KNOWLEDGE_DIR.exists():
        return []
    return sorted(p for p in KNOWLEDGE_DIR.rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED)


def fingerprint(files: list[pathlib.Path]) -> str:
    """Changes whenever a file is added, removed or edited -> triggers a rebuild."""
    h = hashlib.sha1()
    for p in files:
        st = p.stat()
        h.update(f"{p.relative_to(KNOWLEDGE_DIR)}|{st.st_size}|{int(st.st_mtime)}".encode())
    return h.hexdigest()


# ---- Chunking -------------------------------------------------------------
def chunk_pages(pages: list[tuple[int, str]], size: int, overlap: int, source: str = "") -> list[dict]:
    """Split each page into overlapping pieces.
    Returns [{"text", "page", "source"}, ...]. page == 0 means 'no page number'."""
    chunks = []
    for page, text in pages:
        start = 0
        while start < len(text):
            piece = text[start : start + size].strip()
            if piece:
                chunks.append({"text": piece, "page": page, "source": source})
            if start + size >= len(text):
                break
            start += size - overlap
    return chunks


def build_index(chunks: list[dict]) -> faiss.Index:
    """Embed every chunk and store the vectors in a FAISS index."""
    vecs = embed([c["text"] for c in chunks])
    index = faiss.IndexFlatIP(vecs.shape[1])
    index.add(vecs)
    return index


def build_knowledge_base(size: int, overlap: int):
    """Read every file in knowledge/ and return (index, chunks, file_names)."""
    files = iter_knowledge_files()
    chunks: list[dict] = []
    for path in files:
        rel = str(path.relative_to(KNOWLEDGE_DIR))
        try:
            if path.suffix.lower() == ".pdf":
                pages = load_pdf(path.read_bytes())
                source = rel
            else:
                url, pages = load_text(path.read_text(encoding="utf-8", errors="ignore"))
                source = url or rel
        except Exception as e:  # one bad file should not break everything
            print(f"[skip] {rel}: {e}")
            continue
        chunks.extend(chunk_pages(pages, size, overlap, source))
    if not chunks:
        return None, [], [p.name for p in files]
    return build_index(chunks), chunks, [str(p.relative_to(KNOWLEDGE_DIR)) for p in files]


def load_or_build(size: int, overlap: int, force: bool = False):
    """Use the saved index if knowledge/ has not changed, otherwise rebuild + save."""
    files = iter_knowledge_files()
    fp = fingerprint(files) + f"|{size}|{overlap}"
    idx_path, meta_path = STORAGE_DIR / "index.faiss", STORAGE_DIR / "meta.json"

    if not force and idx_path.exists() and meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        if meta.get("fingerprint") == fp:
            return faiss.read_index(str(idx_path)), meta["chunks"], meta["files"]

    index, chunks, names = build_knowledge_base(size, overlap)
    if index is not None:
        STORAGE_DIR.mkdir(exist_ok=True)
        faiss.write_index(index, str(idx_path))
        meta_path.write_text(
            json.dumps({"fingerprint": fp, "chunks": chunks, "files": names}), encoding="utf-8"
        )
    return index, chunks, names


# ---- Retrieval + prompt ---------------------------------------------------
def retrieve(index: faiss.Index, chunks: list[dict], question: str, k: int) -> list[dict]:
    """Return the k most similar chunks, each with a "score" added."""
    q = embed([question])
    scores, ids = index.search(q, min(k, len(chunks)))
    return [
        {**chunks[i], "score": round(float(s), 3)}
        for s, i in zip(scores[0], ids[0])
        if i != -1
    ]


def build_prompt(question: str, hits: list[dict]) -> str:
    def tag(h):
        return f"{h['source']}, page {h['page']}" if h["page"] else h["source"]

    context = "\n\n".join(f"[Source: {tag(h)}]\n{h['text']}" for h in hits)
    return f"Context:\n{context}\n\nQuestion: {question}"

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import llm, rag
from .config import CHUNK_OVERLAP, CHUNK_SIZE, TOP_K

app = FastAPI(title="SRCW College Chatbot")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# The college knowledge base, loaded ONCE when the server starts.
# index = FAISS vectors, chunks = the actual text pieces, files = what is in knowledge/
KB: dict = {"index": None, "chunks": [], "files": []}


def load_kb(force: bool = False):
    KB["index"], KB["chunks"], KB["files"] = rag.load_or_build(CHUNK_SIZE, CHUNK_OVERLAP, force)


@app.on_event("startup")
def startup():
    load_kb()
    print(f"Knowledge base: {len(KB['files'])} files, {len(KB['chunks'])} chunks")


class AskBody(BaseModel):
    question: str
    top_k: int = TOP_K


def _require_kb():
    if KB["index"] is None:
        raise HTTPException(
            503,
            "The knowledge base is empty. Add .pdf/.txt/.md files to backend/knowledge/ "
            "(or run tools/scrape_srcw.py) and restart the backend.",
        )


@app.get("/api/health")
def health():
    return {"status": "ok", **llm.info(), "files": len(KB["files"]), "chunks": len(KB["chunks"])}


@app.post("/api/reindex")
def reindex():
    """Re-read backend/knowledge/ without restarting the server."""
    load_kb(force=True)
    return {"files": KB["files"], "chunks": len(KB["chunks"])}


@app.post("/api/search")
def search(body: AskBody):
    """Retrieval only, no LLM. Handy for checking what the bot can find."""
    _require_kb()
    return {"sources": rag.retrieve(KB["index"], KB["chunks"], body.question, body.top_k)}


@app.post("/api/ask")
def ask(body: AskBody):
    _require_kb()
    hits = rag.retrieve(KB["index"], KB["chunks"], body.question, body.top_k)
    prompt = rag.build_prompt(body.question, hits)
    try:
        answer = llm.chat(rag.SYSTEM_PROMPT, prompt)
    except Exception as e:
        raise HTTPException(502, f"LLM call failed ({llm.info()['provider']}): {e}")
    return {"answer": answer, "sources": hits}

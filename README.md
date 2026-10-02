# SRCW College Chatbot

A RAG chatbot for Sri Ramakrishna College of Arts & Science for Women (https://srcw.ac.in/).
Built from the RAG workshop project: React + Vite | FastAPI | FAISS | fastembed | Ollama / Gemini / OpenRouter.

## Where is the college information stored?

```
backend/knowledge/     <-- THE COLLEGE DATA LIVES HERE (your .pdf / .txt / .md files)
backend/storage/       <-- auto-generated search index (safe to delete, rebuilt automatically)
```

You never edit `storage/`. You only add or edit files in `knowledge/`.
When the backend starts, it notices changed files, rebuilds the index, and the bot knows the new info.

## Run it

**1. Backend**
```
cd backend
python -m venv .venv
.venv\Scripts\activate          (Windows)   |   source .venv/bin/activate   (Mac/Linux)
pip install -r requirements.txt
copy .env.example .env          (cp on Mac/Linux) -> set LLM_PROVIDER and key (e.g. gemini)
```

**2. Fill the knowledge base** (from the project root, with internet)
```
python tools/scrape_srcw.py            # downloads website pages + PDFs into backend/knowledge/
```
Then add anything the website lacks: prospectus PDFs, fee structure, placement details.
See `backend/knowledge/_TEMPLATE_college_facts.md.example` for a manual facts file.

**3. Start**
```
uvicorn app.main:app --reload          # in backend/
cd ../frontend && npm install && npm run dev      # open http://localhost:5173
```

After adding files later: restart the backend, or call `POST http://localhost:8000/api/reindex`.

## Improving answers
- Wrong or missing answer -> the info is probably not in `knowledge/`. Add it as a .md file.
- `TOP_K` (.env): how many passages are given to the LLM. Raise to 6-8 for broad questions.
- `CHUNK_SIZE` / `CHUNK_OVERLAP`: after changing these the index rebuilds automatically.
- Check what the bot can find without the LLM: `POST /api/search {"question": "..."}`.

## Known limits
- Single-turn: each question is answered independently (no chat memory yet).
- Website pages built with JavaScript or images/scanned PDFs will not scrape as text.
- No login: do not put private data in `knowledge/`.

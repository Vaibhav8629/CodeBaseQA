from pathlib import Path


SERVER_DIR = Path(__file__).resolve().parent
CHROMA_DIR = SERVER_DIR / "chroma_db"
CHROMA_COLLECTION = "codebaseqa"

from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent

CHROMA_DIR = SERVER_DIR / "chroma_db"
CHROMA_COLLECTION = "codebaseqa"

REPOS_DIR = SERVER_DIR / "repos"
GRAPH_DIR = SERVER_DIR / "graph_data"

REPOS_DIR.mkdir(parents=True, exist_ok=True)
GRAPH_DIR.mkdir(parents=True, exist_ok=True)
import chromadb
import os
from config import CHROMA_COLLECTION, CHROMA_DIR
from dotenv import load_dotenv

load_dotenv(CHROMA_DIR.parent / ".env")

_client = None

resolved_chroma_dir = CHROMA_DIR.resolve()
CHROMA_DIR.mkdir(parents=True, exist_ok=True)
print("ChromaDB path:", resolved_chroma_dir)
db = chromadb.PersistentClient(path=str(resolved_chroma_dir))
collection = db.get_or_create_collection(name=CHROMA_COLLECTION)
print("Collection name:", collection.name)
print("Collection count:", collection.count())
print("Total chunks in DB:", collection.count())


def get_gemini_client():
    global _client

    if _client is None:
        from google import genai

        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError(
                "Gemini API key is not configured. Set GEMINI_API_KEY or GOOGLE_API_KEY in server/.env."
            )

        _client = genai.Client(api_key=api_key)

    return _client


def get_embedding(text):
    response = get_gemini_client().models.embed_content(
        model="gemini-embedding-001",
        contents=text
    )
    return response.embeddings[0].values


def store_chunks(chunks):
    for i, chunk in enumerate(chunks):
        vector = get_embedding(chunk["content"])

        collection.upsert(
            ids=[str(i)],
            documents=[chunk["content"]],
            embeddings=[vector],
            metadatas=[{"file_path": chunk["file_path"]}]
        )
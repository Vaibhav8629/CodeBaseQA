
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pathlib import Path
from urllib.parse import urlparse
from typing import Any, Literal

import os
import hashlib
import git

from chunker import scan_repository
from config import CHROMA_COLLECTION, CHROMA_DIR, SERVER_DIR
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")


app = FastAPI(
    title="CodebaseQA API",
    description="AI-powered codebase understanding platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


REPOS_DIR = SERVER_DIR / "repos"

REPOS_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)


class AskRequest(BaseModel):
    question: str


class RepoDownloadRequest(BaseModel):
    url: str


class ScanRequest(BaseModel):
    url: str


class SourceReference(BaseModel):
    file_path: str
    start_line: int | None = None
    end_line: int | None = None
    snippet: str | None = None


class AnswerExtras(BaseModel):
    sources: list[SourceReference] = Field(default_factory=list)


class StructuredAnswer(BaseModel):
    type: Literal["markdown"] = "markdown"
    text: str
    extras: AnswerExtras = Field(default_factory=AnswerExtras)


class AskResponse(BaseModel):
    success: bool
    answer: StructuredAnswer | None = None
    error: str | None = None


def make_hash(value):
    return hashlib.sha256(
        value.encode("utf-8")
    ).hexdigest()


def get_repo_identity(url):
    parsed = urlparse(url.strip())

    if (
        parsed.scheme != "https"
        or parsed.hostname != "github.com"
        or parsed.port is not None
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise ValueError("Provide a valid HTTPS GitHub repository URL")

    parts = [
        part for part in parsed.path.strip("/").split("/")
        if part
    ]

    if len(parts) != 2:
        raise ValueError(
            "Expected URL format: https://github.com/owner/repo"
        )

    owner = parts[0]
    name = parts[1].removesuffix(".git")

    if not owner or not name:
        raise ValueError("Invalid GitHub repository URL")

    canonical_url = f"https://github.com/{owner}/{name}.git"
    repo_id = make_hash(canonical_url.lower())

    return repo_id, canonical_url


def download_repo(url):
    repo_id, canonical_url = get_repo_identity(url)
    repo_path = REPOS_DIR / repo_id

    if repo_path.exists():
        try:
            repo = git.Repo(repo_path)

            if repo.bare:
                raise ValueError("Existing repository is invalid")

            if "origin" not in [
                remote.name for remote in repo.remotes
            ]:
                raise ValueError("Repository origin remote is missing")

        except (git.InvalidGitRepositoryError, git.NoSuchPathError) as exc:
            raise FileExistsError(
                "Repository directory exists but is not a valid Git repository"
            ) from exc

        return repo_path, False

    try:
        git.Repo.clone_from(canonical_url, str(repo_path))
    except Exception:
        if repo_path.exists():
            import shutil
            shutil.rmtree(repo_path, ignore_errors=True)
        raise

    return repo_path, True

def get_vectorstore():
    from langchain_chroma import Chroma
    from langchain_google_genai import GoogleGenerativeAIEmbeddings

    resolved_chroma_dir = CHROMA_DIR.resolve()
    print("LangChain ChromaDB path:", resolved_chroma_dir)

    api_key = os.getenv("GOOGLE_API_KEY")

    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY is not configured")

    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=api_key
    )

    return Chroma(
        collection_name=CHROMA_COLLECTION,
        embedding_function=embeddings,
        persist_directory=str(resolved_chroma_dir)
    )


def extract_provider_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()

    if isinstance(value, list):
        parts = [extract_provider_text(part) for part in value]
        return "\n\n".join(part for part in parts if part)

    if isinstance(value, dict):
        text = value.get("text")
        if isinstance(text, str):
            return text.strip()

        content = value.get("content")
        if isinstance(content, (str, list, dict)):
            return extract_provider_text(content)

    return ""


def normalize_sources(raw_sources: Any) -> list[SourceReference]:
    if not isinstance(raw_sources, list):
        return []

    sources = []
    for source in raw_sources:
        if not isinstance(source, dict):
            continue

        file_path = source.get("file_path")
        if not isinstance(file_path, str) or not file_path.strip():
            continue

        snippet = source.get("content")
        sources.append(SourceReference(
            file_path=file_path.strip(),
            snippet=snippet.strip() if isinstance(snippet, str) and snippet.strip() else None
        ))

    return sources


def normalize_answer(raw_answer: Any) -> StructuredAnswer:
    if isinstance(raw_answer, dict):
        provider_content = raw_answer.get("content")
        raw_sources = raw_answer.get("sources", [])
    else:
        provider_content = raw_answer
        raw_sources = []

    text = extract_provider_text(provider_content)
    if not text:
        raise ValueError("Gemini returned an empty answer")

    return StructuredAnswer(
        text=text,
        extras=AnswerExtras(sources=normalize_sources(raw_sources))
    )


@app.post("/api/repo/ask", response_model=None)
def ask_repository(request: AskRequest) -> AskResponse | JSONResponse:
    try:
        if not request.question.strip():
            return JSONResponse(
                status_code=400,
                content=AskResponse(
                    success=False,
                    error="Question cannot be empty"
                ).model_dump()
            )

        from generator import generate_answer

        answer = normalize_answer(generate_answer(request.question))

        return AskResponse(success=True, answer=answer)

    except ValueError as exc:
        return JSONResponse(
            status_code=502,
            content=AskResponse(success=False, error=str(exc)).model_dump()
        )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content=AskResponse(
                success=False,
                error=f"Unable to generate an answer: {e}"
            ).model_dump()
        )


@app.post("/api/repo/download")
def download_repository(
    request: RepoDownloadRequest | None = None,
    url: str | None = None
):
    try:
        repository_url = (
            request.url if request is not None else url
        )

        if not repository_url:
            raise HTTPException(
                status_code=400,
                detail="Provide a GitHub repository URL"
            )

        repo_path, cloned = download_repo(repository_url)

        return {
            "success": True,
            "message": (
                "Repository downloaded successfully"
                if cloned
                else "Repository already exists"
            ),
            "repo_id": repo_path.name,
            "path": str(repo_path.relative_to(SERVER_DIR)),
            "already_exists": not cloned
        }

    except HTTPException:
        raise

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc

    except FileExistsError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc)
        ) from exc

    except git.GitError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Unable to clone repository: {exc}"
        ) from exc

    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to prepare repository directory: {exc}"
        ) from exc


@app.post("/api/repo/scan")
def scan_repo_endpoint(request: ScanRequest):
    try:
        repo_id, canonical_url = get_repo_identity(request.url)

        repo_path = REPOS_DIR / repo_id
        print("Repo path:", repo_path)
        print("Repo exists:", os.path.exists(repo_path))

        if not repo_path.exists():
            raise HTTPException(
                status_code=404,
                detail="Repository not found. Download it first."
            )

        repo = git.Repo(repo_path)

        if "origin" not in [remote.name for remote in repo.remotes]:
            raise HTTPException(
                status_code=400,
                detail="Repository origin remote is missing"
            )

        repo.remotes.origin.set_url(canonical_url)
        repo.remotes.origin.pull()

        print("Starting repository scan...")

        result = scan_repository(canonical_url)

        chunks = result["chunks"]

        print("Files scanned:", result["files_scanned"])
        print("Chunks created:", len(chunks))

        if chunks:
            print("First chunk:", chunks[0]["file_path"])
            print("First chunk content length:", len(chunks[0]["content"]))

        vectorstore = get_vectorstore()
        print("Scan collection:", vectorstore._collection.name)

        print("Vectorstore collection count before:", vectorstore._collection.count())

        existing = vectorstore._collection.get(
            where={"repo_id": repo_id},
            include=["metadatas"]
        )

        existing_ids = existing.get("ids", [])
        existing_metadata = existing.get("metadatas") or []

        print("Existing chunks for this repo:", len(existing_ids))

        existing_hashes = {
            chunk_id: metadata.get("content_hash")
            for chunk_id, metadata in zip(
                existing_ids,
                existing_metadata
            )
        }

        current_ids = set()
        changed_documents = []
        changed_ids = []

        from langchain_core.documents import Document

        for chunk in chunks:
            file_path = chunk["file_path"]
            content = chunk["content"]
            chunk_index = chunk["chunk_index"]
            content_hash = chunk["content_hash"]

            chunk_id = make_hash(
                f"{repo_id}:{file_path}:{chunk_index}"
            )

            current_ids.add(chunk_id)

            if existing_hashes.get(chunk_id) == content_hash:
                continue

            changed_documents.append(
                Document(
                    page_content=content,
                    metadata={
                        "repo_id": repo_id,
                        "file_path": file_path,
                        "chunk_index": chunk_index,
                        "content_hash": content_hash
                    }
                )
            )

            changed_ids.append(chunk_id)

        print("Changed documents:", len(changed_documents))

        stale_ids = [
            chunk_id
            for chunk_id in existing_ids
            if chunk_id not in current_ids
        ]

        print("Stale chunks:", len(stale_ids))

        if stale_ids:
            vectorstore.delete(ids=stale_ids)

        if changed_documents:
            vectorstore.add_documents(
                documents=changed_documents,
                ids=changed_ids
            )

        print("Vectorstore collection count after:", vectorstore._collection.count())

        return {
            "success": True,
            "message": "Repository scanned and indexed successfully",
            "repo_id": repo_id,
            "files_scanned": result["files_scanned"],
            "total_chunks": len(chunks),
            "new_or_updated_chunks": len(changed_documents),
            "deleted_chunks": len(stale_ids),
            "unchanged_chunks": len(current_ids) - len(changed_documents)
        }

    except HTTPException:
        raise

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc

    except git.GitError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Git operation failed: {exc}"
        ) from exc

    except Exception as exc:
        import traceback
        traceback   .print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Repository scan failed: {exc}"
        ) from exc



@app.get("/")
def root():
    return {
        "success": True,
        "message": "CodebaseQA API is running"
    }


@app.get("/api/health")
def health_check():
    return {
        "success": True,
        "message": "CodebaseQA API is running"
    }

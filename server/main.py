
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
import re
from collections import Counter, deque

from chunker import scan_repository
from config import SERVER_DIR, CHROMA_DIR, CHROMA_COLLECTION, REPOS_DIR, GRAPH_DIR
from dotenv import load_dotenv
from dependency_graph import GraphAnalysisError, GraphStore, MAX_PREVIEW_LINES

load_dotenv(Path(__file__).resolve().parent / ".env")
FRONTEND_URL = os.getenv("FRONTEND_URL", "").strip().rstrip("/")


app = FastAPI(
    title="CodebaseQA API",
    description="AI-powered codebase understanding platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", FRONTEND_URL] if FRONTEND_URL else ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


REPOS_DIR.mkdir(parents=True, exist_ok=True)
GRAPH_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

graph_store = GraphStore(GRAPH_DIR, REPOS_DIR)


class AskRequest(BaseModel):
    question: str


class RepoDownloadRequest(BaseModel):
    url: str


class ScanRequest(BaseModel):
    url: str


class GraphRegenerateResponse(BaseModel):
    repo_id: str
    status: Literal["missing", "queued", "running", "complete", "failed"]
    progress: int = 0
    graph_version: str | None = None


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
            
        print("Generating dependency graph...")

        graph_result = graph_store.regenerate(repo_id)

        print("Graph status:", graph_result.status)

        print("Vectorstore collection count after:", vectorstore._collection.count())

        return {
            "success": True,
            "message": "Repository scanned and indexed successfully",
            "repo_id": repo_id,
            "files_scanned": result["files_scanned"],
            "total_chunks": len(chunks),
            "new_or_updated_chunks": len(changed_documents),
            "deleted_chunks": len(stale_ids),
            "unchanged_chunks": len(current_ids) - len(changed_documents),
            "graph_status": graph_result.status,
            "graph_version": graph_result.graph_version
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


def _load_graph(repo_id: str) -> dict[str, Any]:
    if not repo_id or not all(char in "0123456789abcdef" for char in repo_id) or len(repo_id) != 64:
        raise HTTPException(status_code=400, detail="Invalid repository ID")
    if not (REPOS_DIR / repo_id).is_dir():
        raise HTTPException(status_code=404, detail="Repository not found. Download it first.")
    graph = graph_store.load(repo_id)
    if graph is None:
        raise HTTPException(status_code=404, detail="Graph has not been generated. Regenerate it first.")
    return graph


def _csv(value: str | None) -> set[str] | None:
    if not value:
        return None
    return {part.strip().lower() for part in value.split(",") if part.strip()}


def _filtered_graph(
    graph: dict[str, Any], mode: str, search: str | None, types: str | None,
    languages: str | None, include_isolated: bool, edge_types: str | None,
    limit: int, offset: int,
) -> dict[str, Any]:
    type_filter, language_filter, edge_filter = _csv(types), _csv(languages), _csv(edge_types)
    candidates = [
        node for node in graph["nodes"]
        if (not search or search.lower() in node["path"].lower())
        and (not type_filter or node["type"].lower() in type_filter)
        and (not language_filter or node["language"].lower() in language_filter)
        and (include_isolated or node["degree"] > 0)
    ]
    if mode == "overview":
        groups: dict[str, dict[str, Any]] = {}
        for node in candidates:
            group = node["path"].split("/", 1)[0] if "/" in node["path"] else "."
            groups.setdefault(group, {"id": group, "label": group, "type": "module", "file_count": 0, "loc": 0})
            groups[group]["file_count"] += 1
            groups[group]["loc"] += node["loc"]
        group_ids = set(groups)
        edges = []
        aggregated: Counter[tuple[str, str]] = Counter()
        node_by_path = {node["id"]: node for node in candidates}
        for edge in graph["edges"]:
            if edge["source"] not in node_by_path or edge["target"] not in node_by_path:
                continue
            if edge_filter and edge["type"].lower() not in edge_filter:
                continue
            source = edge["source"].split("/", 1)[0] if "/" in edge["source"] else "."
            target = edge["target"].split("/", 1)[0] if "/" in edge["target"] else "."
            if source != target:
                aggregated[(source, target)] += 1
        for (source, target), count in aggregated.items():
            edges.append({"id": f"{source}->{target}", "source": source, "target": target, "type": "imports",
                          "label": "imports", "metadata": {"file_dependency_count": count}})
        visible = list(groups.values())[offset:offset + limit]
        visible_ids = {node["id"] for node in visible}
        edges = [edge for edge in edges if edge["source"] in visible_ids and edge["target"] in visible_ids]
        return {"nodes": visible, "edges": edges, "categories": dict(Counter(node["type"] for node in visible))}
    visible = candidates[offset:offset + limit]
    visible_ids = {node["id"] for node in visible}
    edges = [
        edge for edge in graph["edges"]
        if edge["source"] in visible_ids and edge["target"] in visible_ids
        and (not edge_filter or edge["type"].lower() in edge_filter)
    ]
    return {"nodes": visible, "edges": edges, "categories": dict(Counter(node["type"] for node in visible))}


@app.get("/api/repo/{repo_id}/graph")
def get_graph(
    repo_id: str, mode: Literal["file_graph", "overview"] = "file_graph",
    search: str | None = None, types: str | None = None, languages: str | None = None,
    include_isolated: bool = True, include_external: bool = False,
    edge_types: str | None = None, limit: int = 1000, offset: int = 0,
):
    if limit < 1 or limit > 5000 or offset < 0:
        raise HTTPException(status_code=400, detail="limit must be 1-5000 and offset must be non-negative")
    graph = _load_graph(repo_id)
    visible = _filtered_graph(graph, mode, search, types, languages, include_isolated, edge_types, limit, offset)
    metrics = dict(graph["metrics"])
    metrics["visible_nodes"] = len(visible["nodes"])
    metrics["visible_edges"] = len(visible["edges"])
    metrics["filtered_density"] = (
        len(visible["edges"]) / (len(visible["nodes"]) * (len(visible["nodes"]) - 1))
        if len(visible["nodes"]) > 1 else 0
    )
    return {
        "repo_id": repo_id, "mode": mode, "status": "complete",
        "graph_version": graph["graph_version"], "nodes": visible["nodes"],
        "edges": visible["edges"], "categories": visible["categories"],
        "metrics": metrics, "full_graph_metrics": graph["metrics"],
        "diagnostics_summary": dict(Counter(
            "errors" if item["kind"] in {"parser_error", "read_error"} else "warnings"
            for item in graph["diagnostics"]
        )),
        "external_included": False,
    }


@app.get("/api/repo/{repo_id}/graph/nodes/{node_id:path}")
def get_graph_node(repo_id: str, node_id: str, preview_lines: int = 100, offset: int = 0,
                   limit: int = 100, edge_types: str | None = None, incoming_depth: int = 1,
                   outgoing_depth: int = 1, max_nodes: int = 200):
    if node_id.endswith("/dependencies"):
        return get_graph_dependencies(repo_id, node_id[:-len("/dependencies")], offset, limit, edge_types)
    if node_id.endswith("/neighborhood"):
        return get_graph_neighborhood(repo_id, node_id[:-len("/neighborhood")], incoming_depth,
                                      outgoing_depth, max_nodes, edge_types)
    graph = _load_graph(repo_id)
    node_id = node_id.strip("/")
    item = graph["files"].get(node_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Graph node not found")
    if preview_lines < 1 or preview_lines > MAX_PREVIEW_LINES:
        raise HTTPException(status_code=400, detail="preview_lines must be 1-200")
    incoming = [edge for edge in graph["edges"] if edge["target"] == node_id]
    outgoing = [edge for edge in graph["edges"] if edge["source"] == node_id]
    source_preview = []
    for number, line in enumerate(item["source"].splitlines()[:preview_lines], 1):
        if re.search(r"(?:api[_-]?key|password|secret|token)\s*=", line, re.IGNORECASE):
            line = "[redacted]"
        source_preview.append({"line": number, "content": line})
    node = next(node for node in graph["nodes"] if node["id"] == node_id)
    return {
        "node": node,
        "imports_from": outgoing,
        "imported_by": incoming,
        "exports": item["exports"],
        "source_preview": source_preview,
        "diagnostics": [diagnostic for diagnostic in graph["diagnostics"]
                        if diagnostic.get("path") == node_id or diagnostic.get("source") == node_id],
    }


@app.get("/api/repo/{repo_id}/graph/nodes/{node_id:path}/dependencies")
def get_graph_dependencies(repo_id: str, node_id: str, offset: int = 0, limit: int = 100, edge_types: str | None = None):
    graph = _load_graph(repo_id)
    node_id = node_id.strip("/")
    if node_id not in graph["files"]:
        raise HTTPException(status_code=404, detail="Graph node not found")
    allowed = _csv(edge_types)
    outgoing = [edge for edge in graph["edges"] if edge["source"] == node_id and (not allowed or edge["type"].lower() in allowed)]
    incoming = [edge for edge in graph["edges"] if edge["target"] == node_id and (not allowed or edge["type"].lower() in allowed)]
    return {"node_id": node_id, "imports_from": outgoing[offset:offset + limit], "imported_by": incoming[offset:offset + limit],
            "total_imports_from": len(outgoing), "total_imported_by": len(incoming)}


@app.get("/api/repo/{repo_id}/graph/neighborhood/{node_id:path}")
def get_graph_neighborhood(repo_id: str, node_id: str, incoming_depth: int = 1, outgoing_depth: int = 1,
                           max_nodes: int = 200, edge_types: str | None = None):
    graph = _load_graph(repo_id)
    node_id = node_id.strip("/")
    if node_id not in graph["files"]:
        raise HTTPException(status_code=404, detail="Graph node not found")
    if min(incoming_depth, outgoing_depth) < 0 or max_nodes < 1 or max_nodes > 1000:
        raise HTTPException(status_code=400, detail="Invalid neighborhood bounds")
    allowed = _csv(edge_types)
    selected = {node_id}
    queue = deque([(node_id, "in", 0), (node_id, "out", 0)])
    while queue and len(selected) < max_nodes:
        current, direction, depth = queue.popleft()
        max_depth = incoming_depth if direction == "in" else outgoing_depth
        if depth >= max_depth:
            continue
        edges = [edge for edge in graph["edges"] if
                 (edge["target"] == current if direction == "in" else edge["source"] == current)
                 and (not allowed or edge["type"].lower() in allowed)]
        for edge in edges:
            neighbor = edge["source"] if direction == "in" else edge["target"]
            if neighbor not in selected:
                selected.add(neighbor)
                queue.append((neighbor, direction, depth + 1))
                if len(selected) >= max_nodes:
                    break
    return {"node_id": node_id, "nodes": [node for node in graph["nodes"] if node["id"] in selected],
            "edges": [edge for edge in graph["edges"] if edge["source"] in selected and edge["target"] in selected],
            "incoming_depth": incoming_depth, "outgoing_depth": outgoing_depth}


@app.get("/api/repo/{repo_id}/graph/diagnostics")
def get_graph_diagnostics(repo_id: str):
    graph = _load_graph(repo_id)
    return {"repo_id": repo_id, "diagnostics": graph["diagnostics"],
            "unresolved_imports": [item for item in graph["diagnostics"] if item["kind"] == "unresolved_import"],
            "ambiguous_imports": [item for item in graph["diagnostics"] if item["kind"] == "ambiguous_import"],
            "parser_failures": [item for item in graph["diagnostics"] if item["kind"] == "parser_error"],
            "circular_dependencies": graph["metrics"]["strongly_connected_components"]}


@app.post("/api/repo/{repo_id}/graph/regenerate", response_model=GraphRegenerateResponse)
def regenerate_graph(repo_id: str):
    if not re.fullmatch(r"[a-f0-9]{64}", repo_id) or not (REPOS_DIR / repo_id).is_dir():
        raise HTTPException(status_code=404, detail="Repository not found")
    try:
        return graph_store.regenerate(repo_id)
    except GraphAnalysisError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Unable to persist graph: {exc}") from exc


@app.get("/api/repo/{repo_id}/graph/status", response_model=GraphRegenerateResponse)
def graph_status(repo_id: str):
    if not re.fullmatch(r"[a-f0-9]{64}", repo_id):
        raise HTTPException(status_code=400, detail="Invalid repository ID")
    return graph_store.status(repo_id)



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

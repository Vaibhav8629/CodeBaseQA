
from pathlib import Path
from urllib.parse import urlparse
from git import Repo, GitCommandError
from langchain_text_splitters import RecursiveCharacterTextSplitter, Language
from config import CHROMA_DIR,SERVER_DIR
import hashlib

BASE_DIR = SERVER_DIR
REPOS_DIR = SERVER_DIR / "repos"

IGNORED_DIRS = {
    ".git", "node_modules", "venv", ".venv",
    "__pycache__", "dist", "build", CHROMA_DIR.name
}

IGNORED_FILES = {
    ".env", ".env.local", ".env.production"
}

ALLOWED_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx",
    ".cpp", ".cc", ".cxx", ".c", ".h", ".hpp",
    ".java", ".go", ".rs", ".php", ".rb",
    ".html", ".css", ".json", ".md",
    ".yaml", ".yml", ".sql", ".sh"
}

LANGUAGE_MAP = {
    ".py": Language.PYTHON,
    ".js": Language.JS,
    ".jsx": Language.JS,
    ".ts": Language.TS,
    ".tsx": Language.TS,
    ".cpp": Language.CPP,
    ".cc": Language.CPP,
    ".cxx": Language.CPP,
    ".c": Language.C,
    ".h": Language.C,
    ".hpp": Language.CPP,
    ".java": Language.JAVA,
    ".go": Language.GO,
    ".rs": Language.RUST,
    ".php": Language.PHP,
}


def make_hash(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def get_repo_id(repo_url):
    parsed = urlparse(repo_url.strip())

    if parsed.scheme != "https" or parsed.hostname != "github.com":
        raise ValueError("Provide a valid HTTPS GitHub URL")

    parts = parsed.path.strip("/").removesuffix(".git").split("/")

    if len(parts) != 2 or not all(parts):
        raise ValueError("Expected URL: https://github.com/owner/repo")

    canonical_url = (
        f"https://github.com/{parts[0]}/{parts[1]}.git"
    )

    return make_hash(canonical_url), canonical_url


def split_documents(documents):
    chunks = []

    for doc in documents:
        file_path = doc["file_path"]
        content = doc["content"]

        ext = Path(file_path).suffix.lower()
        language = LANGUAGE_MAP.get(ext)

        if language:
            splitter = RecursiveCharacterTextSplitter.from_language(
                language=language,
                chunk_size=1000,
                chunk_overlap=200
            )
        else:
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200
            )

        parts = splitter.split_text(content)

        for i, part in enumerate(parts):
            chunks.append({
                "file_path": file_path,
                "content": part,
                "chunk_index": i,
                "content_hash": make_hash(part)
            })

    return chunks


def scan_repository(repo_url):
    REPOS_DIR.mkdir(parents=True, exist_ok=True)

    repo_id, canonical_url = get_repo_id(repo_url)
    repo_path = REPOS_DIR / repo_id

    try:
        if not repo_path.exists():
            Repo.clone_from(canonical_url, str(repo_path))
        else:
            repo = Repo(str(repo_path))

            if "origin" not in [remote.name for remote in repo.remotes]:
                raise ValueError("Repository origin remote is missing")

            repo.remotes.origin.pull()

        documents = []

        for file_path in repo_path.rglob("*"):
            if not file_path.is_file():
                continue

            relative_path = file_path.relative_to(
                repo_path
            ).as_posix()

            if any(
                part in IGNORED_DIRS
                for part in Path(relative_path).parts
            ):
                continue

            if file_path.name.lower() in IGNORED_FILES:
                continue

            if file_path.suffix.lower() not in ALLOWED_EXTENSIONS:
                continue

            if file_path.stat().st_size > 500_000:
                continue

            try:
                content = file_path.read_text(
                    encoding="utf-8",
                    errors="ignore"
                )
            except OSError:
                continue

            if content.strip():
                documents.append({
                    "file_path": relative_path,
                    "content": content
                })

        chunks = split_documents(documents)

        return {
            "repo_id": repo_id,
            "repo_url": canonical_url,
            "repo_path": str(repo_path),
            "files_scanned": len(documents),
            "total_chunks": len(chunks),
            "chunks": chunks
        }

    except GitCommandError as error:
        raise RuntimeError(
            f"Git operation failed: {error}"
        ) from error

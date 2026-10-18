"""Deterministic repository dependency graph analysis.

The analyzer deliberately uses syntax parsing and conservative import resolution.
It never asks the LLM to infer relationships and stores graph data separately
from the RAG/Chroma data.
"""

from __future__ import annotations

import ast
import hashlib
import json
import os
import re
import threading
import time
from collections import Counter, defaultdict, deque
from pathlib import Path, PurePosixPath
from typing import Any


SUPPORTED = {
    ".py": "python", ".js": "javascript", ".jsx": "javascript",
    ".mjs": "javascript", ".cjs": "javascript", ".ts": "typescript",
    ".tsx": "typescript", ".mts": "typescript", ".cts": "typescript",
    ".c": "c", ".h": "c", ".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp",
    ".hpp": "cpp", ".hh": "cpp", ".hxx": "cpp", ".java": "java",
    ".go": "go", ".rs": "rust", ".php": "php",
}
IGNORED_DIRS = {
    ".git", "node_modules", "venv", ".venv", "env", "__pycache__",
    "dist", "build", "coverage", ".next", ".cache", "target", "vendor",
}
SECRET_NAMES = {".env", ".env.local", ".env.production", ".env.development"}
SECRET_SUFFIXES = (".pem", ".key", ".p12", ".pfx")
MAX_FILE_SIZE = 1_000_000
MAX_FILES = 20_000
MAX_PREVIEW_LINES = 200


class GraphAnalysisError(RuntimeError):
    pass


def _safe_rel(path: str) -> str:
    normalized = PurePosixPath(path.replace("\\", "/"))
    if normalized.is_absolute() or ".." in normalized.parts:
        raise ValueError("Invalid repository-relative path")
    return normalized.as_posix()


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _category(path: str, source: str, language: str) -> tuple[str, str]:
    lower = path.lower()
    name = Path(path).stem.lower()
    if any(part in lower for part in ("config", "settings", ".github/workflows")) or name in {
        "package", "tsconfig", "vite", "webpack", "babel", "eslint", "pyproject",
    }:
        return "config", "configuration filename or directory"
    if any(token in lower for token in ("/pages/", "/page/", "/routes/", "/views/")):
        return "page", "page or route directory"
    if any(token in lower for token in ("/store/", "/stores/", "store.", "slice.")):
        return "store", "state-management filename or directory"
    if any(token in lower for token in ("/api/", "/apis/", "/server/", "/handlers/")):
        return "api", "API or handler directory"
    if re.search(r"(^|/)(schema|schemas|model|models|types)([./_-]|/|$)", lower):
        return "schema", "schema, model, or type filename"
    if language in {"javascript", "typescript"} and (
        "react" in source or re.search(r"\b[A-Z][A-Za-z0-9]*\s*=", source)
    ) and (path.endswith((".jsx", ".tsx")) or re.search(r"\breturn\s*\(", source)):
        return "component", "JSX/TSX or component-shaped source"
    if any(token in lower for token in ("/util", "/utils/", "/lib/", "/helpers/", "helper.")):
        return "utility", "utility directory or filename"
    return "file", "default source-file classification"


def _imports(source: str, language: str) -> tuple[list[dict[str, Any]], list[str], list[dict[str, Any]]]:
    imports: list[dict[str, Any]] = []
    exports: list[str] = []
    errors: list[dict[str, Any]] = []
    if language == "python":
        try:
            tree = ast.parse(source)
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imports.append({"raw": alias.name, "line": node.lineno, "kind": "import"})
                elif isinstance(node, ast.ImportFrom):
                    prefix = "." * node.level + (node.module or "")
                    imports.append({"raw": prefix, "line": node.lineno, "kind": "from"})
                elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    if not node.name.startswith("_"):
                        exports.append(node.name)
        except SyntaxError as exc:
            errors.append({"kind": "parser_error", "line": exc.lineno, "message": str(exc)})
    elif language in {"javascript", "typescript"}:
        pattern = re.compile(
            r"""(?:import\s+(?:[\s\S]*?\s+from\s+)?|export\s+(?:[\s\S]*?\s+from\s+)|require\s*\()\s*['"]([^'"]+)['"]"""
        )
        for match in pattern.finditer(source):
            imports.append({"raw": match.group(1), "line": source.count("\n", 0, match.start()) + 1, "kind": "import"})
        exports.extend(re.findall(r"\bexport\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)", source))
    elif language in {"c", "cpp"}:
        for match in re.finditer(r'^\s*#\s*include\s*[<"]([^">]+)[">]', source, re.MULTILINE):
            imports.append({"raw": match.group(1), "line": source.count("\n", 0, match.start()) + 1, "kind": "include"})
    elif language == "java":
        for match in re.finditer(r"^\s*import\s+(?:static\s+)?([\w.]+)", source, re.MULTILINE):
            imports.append({"raw": match.group(1), "line": source.count("\n", 0, match.start()) + 1, "kind": "import"})
        exports.extend(re.findall(r"\b(?:class|interface|enum)\s+(\w+)", source))
    elif language == "go":
        for match in re.finditer(r'"([^"]+)"', source):
            before = source[max(0, match.start() - 40):match.start()]
            if "import" in before:
                imports.append({"raw": match.group(1), "line": source.count("\n", 0, match.start()) + 1, "kind": "import"})
    elif language == "rust":
        for match in re.finditer(r"^\s*(?:use|mod)\s+([A-Za-z_][\w:]*)", source, re.MULTILINE):
            imports.append({"raw": match.group(1), "line": source.count("\n", 0, match.start()) + 1, "kind": "import"})
    elif language == "php":
        for match in re.finditer(r"^\s*(?:use|require(?:_once)?|include(?:_once)?)\s*[('\"]?([^'\")\s;]+)", source, re.MULTILINE):
            imports.append({"raw": match.group(1), "line": source.count("\n", 0, match.start()) + 1, "kind": "import"})
    return imports, sorted(set(exports)), errors


class DependencyGraphAnalyzer:
    def __init__(self, repo_path: Path):
        self.repo_path = repo_path.resolve()
        self.files: dict[str, dict[str, Any]] = {}
        self.diagnostics: list[dict[str, Any]] = []
        self.aliases: dict[str, list[str]] = {}
        tsconfig = self.repo_path / "tsconfig.json"
        if tsconfig.is_file():
            try:
                compiler = json.loads(tsconfig.read_text(encoding="utf-8")).get("compilerOptions", {})
                self.aliases = compiler.get("paths", {}) if isinstance(compiler.get("paths", {}), dict) else {}
            except (OSError, json.JSONDecodeError):
                self.diagnostics.append({"kind": "parser_error", "path": "tsconfig.json", "message": "Invalid tsconfig.json"})

    def _scan_files(self) -> None:
        if not self.repo_path.is_dir():
            raise GraphAnalysisError("Repository does not exist")
        count = 0
        for path in self.repo_path.rglob("*"):
            if count >= MAX_FILES:
                self.diagnostics.append({"kind": "scan_limit", "message": f"Maximum of {MAX_FILES} files reached"})
                break
            if not path.is_file() or any(part in IGNORED_DIRS for part in path.relative_to(self.repo_path).parts):
                continue
            if path.name.lower() in SECRET_NAMES or path.suffix.lower() in SECRET_SUFFIXES:
                continue
            language = SUPPORTED.get(path.suffix.lower())
            if not language or path.stat().st_size > MAX_FILE_SIZE:
                continue
            relative = _safe_rel(path.relative_to(self.repo_path).as_posix())
            try:
                source = path.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError) as exc:
                self.diagnostics.append({"kind": "read_error", "path": relative, "message": str(exc)})
                continue
            imports, exports, errors = _imports(source, language)
            for error in errors:
                self.diagnostics.append({"path": relative, **error})
            category, reason = _category(relative, source, language)
            self.files[relative] = {
                "path": relative, "label": path.name, "language": language,
                "loc": len(source.splitlines()), "source": source,
                "imports": imports, "exports": exports, "type": category,
                "classification_reason": reason, "hash": _hash_file(path),
            }
            count += 1

    def _resolve(self, source_path: str, raw: str) -> tuple[str | None, str]:
        raw = raw.replace("\\", "/")
        candidates: list[str] = []
        source_dir = PurePosixPath(source_path).parent
        if raw.startswith("."):
            levels = len(raw) - len(raw.lstrip("."))
            base = source_dir
            for _ in range(max(0, levels - 1)):
                base = base.parent
            module = raw[levels:].lstrip("/")
            base = base.joinpath(module) if module else base
        else:
            base = PurePosixPath(raw)
            # Project-root imports and Python packages are both supported.
            if raw.startswith("@/"):
                base = PurePosixPath(raw[2:])
            else:
                for alias, targets in self.aliases.items():
                    prefix = alias.removesuffix("/*")
                    if raw == prefix or raw.startswith(prefix + "/"):
                        target = targets[0] if targets else ""
                        base = PurePosixPath(target.removesuffix("/*")) / raw[len(prefix):].lstrip("/")
                        break
        base_str = base.as_posix().lstrip("./")
        if not raw.startswith(".") and "/" not in raw and "." in raw:
            base_str = raw.replace(".", "/")
        suffixes = ["", ".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".c", ".h", ".cpp", ".java", ".go", ".rs", ".php"]
        for suffix in suffixes:
            candidates.append(base_str + suffix)
        for suffix in suffixes[1:]:
            candidates.append(base_str + "/index" + suffix)
        candidates.append(base_str + "/__init__.py")
        found = [candidate for candidate in dict.fromkeys(candidates) if candidate in self.files]
        if len(found) == 1:
            return found[0], "resolved"
        if len(found) > 1:
            self.diagnostics.append({"kind": "ambiguous_import", "source": source_path, "import": raw, "candidates": found})
            return None, "ambiguous"
        return None, "external" if not raw.startswith(".") else "unresolved"

    def analyze(self) -> dict[str, Any]:
        self._scan_files()
        edges: list[dict[str, Any]] = []
        for source_path, item in self.files.items():
            for import_item in item["imports"]:
                target, status = self._resolve(source_path, import_item["raw"])
                if not target:
                    self.diagnostics.append({
                        "kind": "unresolved_import" if status != "external" else "external_import",
                        "source": source_path, "import": import_item["raw"],
                        "line": import_item["line"], "resolution_status": status,
                    })
                    continue
                edges.append({
                    "id": f"{source_path}->{target}:{import_item['line']}",
                    "source": source_path, "target": target, "type": "imports",
                    "label": "imports", "metadata": {
                        "import_statement": import_item["raw"], "line": import_item["line"],
                        "resolution_status": status,
                    },
                })
        incoming = Counter(edge["target"] for edge in edges)
        outgoing = Counter(edge["source"] for edge in edges)
        nodes = []
        for path, item in self.files.items():
            nodes.append({
                "id": path, "label": item["label"], "path": path, "type": item["type"],
                "language": item["language"], "loc": item["loc"],
                "in_degree": incoming[path], "out_degree": outgoing[path],
                "degree": incoming[path] + outgoing[path],
                "metadata": {"classification_reason": item["classification_reason"]},
            })
        metrics = self._metrics(nodes, edges, self.diagnostics)
        return {
            "nodes": nodes, "edges": edges, "metrics": metrics,
            "diagnostics": self.diagnostics, "files": self.files,
            "graph_version": hashlib.sha256("".join(sorted(v["hash"] for v in self.files.values())).encode()).hexdigest()[:16],
        }

    @staticmethod
    def _metrics(nodes: list[dict[str, Any]], edges: list[dict[str, Any]], diagnostics: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        count = len(nodes)
        isolated = sum(1 for node in nodes if node["degree"] == 0)
        adjacency: dict[str, list[str]] = defaultdict(list)
        for edge in edges:
            adjacency[edge["source"]].append(edge["target"])
        components: list[list[str]] = []
        index = 0
        stack: list[str] = []
        indices: dict[str, int] = {}
        low: dict[str, int] = {}
        on_stack: set[str] = set()

        def visit(node: str) -> None:
            nonlocal index
            indices[node] = low[node] = index
            index += 1
            stack.append(node)
            on_stack.add(node)
            for target in adjacency[node]:
                if target not in indices:
                    visit(target)
                    low[node] = min(low[node], low[target])
                elif target in on_stack:
                    low[node] = min(low[node], indices[target])
            if low[node] == indices[node]:
                component = []
                while True:
                    member = stack.pop()
                    on_stack.remove(member)
                    component.append(member)
                    if member == node:
                        break
                if len(component) > 1 or node in adjacency[node]:
                    components.append(sorted(component))

        for node in (item["id"] for item in nodes):
            if node not in indices:
                visit(node)
        max_edges = count * (count - 1) if count > 1 else 0
        return {
            "total_nodes": count, "total_edges": len(edges), "visible_nodes": count,
            "visible_edges": len(edges), "density": len(edges) / max_edges if max_edges else 0,
            "internal_dependencies": len(edges),
            "external_imports": sum(d.get("kind") == "external_import" for d in (diagnostics or [])),
            "unresolved_imports": sum(d.get("kind") in {"unresolved_import", "ambiguous_import"} for d in (diagnostics or [])),
            "isolated_nodes": isolated, "circular_dependency_groups": len(components),
            "strongly_connected_components": components,
            "high_dependency_nodes": [n["id"] for n in nodes if n["degree"] >= 10],
            "cross_file_dependency_ratio": len(edges) / max(1, count),
        }


class GraphStore:
    _locks: dict[str, threading.Lock] = defaultdict(threading.Lock)

    def __init__(self, data_dir: Path, repo_root: Path):
        self.data_dir, self.repo_root = data_dir, repo_root
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def _file(self, repo_id: str) -> Path:
        if not re.fullmatch(r"[a-f0-9]{64}", repo_id):
            raise ValueError("Invalid repository ID")
        return self.data_dir / f"{repo_id}.json"

    def status(self, repo_id: str) -> dict[str, Any]:
        path = self._file(repo_id)
        if self._locks[repo_id].locked():
            return {"repo_id": repo_id, "status": "running", "progress": 0}
        if not path.exists():
            return {"repo_id": repo_id, "status": "missing", "progress": 0}
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return {"repo_id": repo_id, "status": "complete", "progress": 100, "graph_version": data.get("graph_version")}
        except (OSError, json.JSONDecodeError):
            return {"repo_id": repo_id, "status": "failed", "progress": 0}

    def load(self, repo_id: str) -> dict[str, Any] | None:
        path = self._file(repo_id)
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def regenerate(self, repo_id: str) -> dict[str, Any]:
        lock = self._locks[repo_id]
        if not lock.acquire(blocking=False):
            return {"repo_id": repo_id, "status": "running", "progress": 0}
        try:
            repo = (self.repo_root / repo_id).resolve()
            if repo.parent != self.repo_root.resolve() or not repo.is_dir():
                raise GraphAnalysisError("Repository not found")
            result = DependencyGraphAnalyzer(repo).analyze()
            target = self._file(repo_id)
            temporary = target.with_suffix(".json.tmp")
            temporary.write_text(json.dumps(result, ensure_ascii=True), encoding="utf-8")
            os.replace(temporary, target)
            return {"repo_id": repo_id, "status": "complete", "progress": 100, "graph_version": result["graph_version"]}
        finally:
            lock.release()

import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BookOpenText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Copy,
  FolderOpen,
  GitBranch,
  MessageSquareText,
  PanelRightOpen,
  Plus,
  Search,
  SendHorizonal,
  Sparkles,
  TerminalSquare,
  X,
} from 'lucide-react';

const repoMeta = {
  name: 'acme/platform',
  branch: 'main',
  status: 'Index ready',
  files: 438,
  symbols: 1842,
  lastIndexed: '2 min ago',
};

const recentConversations = [
  { title: 'How authentication works', time: '2h ago', active: true },
  { title: 'Explain the API request flow', time: '1d ago', active: false },
  { title: 'Where is the database connection configured?', time: '2d ago', active: false },
  { title: 'How does error handling work?', time: '4d ago', active: false },
];

const exampleQuestions = [
  'Explain the authentication flow',
  'How are API routes organized?',
  'Trace a request from frontend to database',
  'Where is error handling implemented?',
];

const indexingStages = [
  'Connecting to repository',
  'Discovering source files',
  'Parsing code structure',
  'Preparing searchable code chunks',
  'Index ready',
];

const sourceFiles = {
  'src/server/auth.py': {
    id: 'src/server/auth.py',
    path: 'src/server/auth.py',
    title: 'auth.py',
    language: 'Python',
    code: [
      'def require_session(request: Request) -> UserContext:',
      '    token = request.headers.get("authorization", "").replace("Bearer ", "")',
      '    if not token:',
      '        raise HTTPException(status_code=401, detail="missing token")',
      '',
      '    payload = decode_jwt(token)',
      '    user = session_repo.get_by_id(payload["sub"])',
      '    if not user or user.is_disabled:',
      '        raise HTTPException(status_code=403, detail="user not authorized")',
      '',
      '    return UserContext(id=user.id, role=user.role, org_id=user.org_id)',
      '',
      'def decode_jwt(token: str) -> dict[str, Any]:',
      '    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])',
    ],
    range: { start: 28, end: 38 },
  },
  'src/api/router.ts': {
    id: 'src/api/router.ts',
    path: 'src/api/router.ts',
    title: 'router.ts',
    language: 'TypeScript',
    code: [
      'router.get("/projects/:projectId", async (req, res) => {',
      '  const token = req.headers.authorization?.replace("Bearer ", "")',
      '  const user = await auth.getCurrentUser(token)',
      '  const project = await projectService.getProject(req.params.projectId)',
      '',
      '  if (!project || !user) {',
      '    return res.status(404).json({ error: "Project not found" })',
      '  }',
      '',
      '  const metrics = await analytics.fetchUsage(project.id, user.orgId)',
      '  return res.json({ project, metrics, user })',
      '})',
      '',
      'router.post("/projects", async (req, res) => {',
      '  const payload = validateCreateProject(req.body)',
      '  return res.status(201).json(await projectService.create(payload))',
      '})',
    ],
    range: { start: 15, end: 29 },
  },
  'src/core/db.py': {
    id: 'src/core/db.py',
    path: 'src/core/db.py',
    title: 'db.py',
    language: 'Python',
    code: [
      'DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/platform")',
      'engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)',
      'SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)',
      '',
      'def get_db() -> Generator[Session, None, None]:',
      '    db = SessionLocal()',
      '    try:',
      '        yield db',
      '    finally:',
      '        db.close()',
      '',
      'async def init_db() -> None:',
      '    Base.metadata.create_all(bind=engine)',
    ],
    range: { start: 1, end: 14 },
  },
};

function buildQuestionResponse(question) {
  const normalized = question.toLowerCase();

  if (normalized.includes('auth')) {
    return {
      sections: [
        {
          type: 'heading',
          text: 'Authentication flow',
        },
        {
          type: 'paragraph',
          text:
            'The platform validates a bearer token at the API edge and attaches request-scoped context before any project data is resolved. That pattern keeps the auth checks centralized and makes downstream services assume a trusted user identity.',
        },
        {
          type: 'list',
          items: [
            'The request enters the FastAPI router with the Authorization header intact.',
            'The middleware calls require_session and validates the JWT signature and expiry.',
            'The session payload is mapped to a UserContext containing the user id, org id, and role.',
            'Route handlers use that context to authorize access to project and analytics data.',
          ],
        },
        {
          type: 'code',
          text: 'const token = req.headers.authorization?.replace("Bearer ", "")\nconst user = await auth.getCurrentUser(token)',
        },
      ],
      citations: [
        { id: 'src/server/auth.py', start: 28, end: 38, label: 'auth.py:28-38' },
        { id: 'src/api/router.ts', start: 15, end: 29, label: 'router.ts:15-29' },
      ],
    };
  }

  if (normalized.includes('route') || normalized.includes('api')) {
    return {
      sections: [
        {
          type: 'heading',
          text: 'API structure',
        },
        {
          type: 'paragraph',
          text:
            'Routes are organized into thin endpoint modules that delegate work to domain services. This keeps request validation and auth logic in the HTTP layer while business behavior lives in service modules and repositories.',
        },
        {
          type: 'list',
          items: [
            'The API layer defines request schemas and route bindings.',
            'Service objects perform authorization checks and business transformations.',
            'Persistence is isolated behind repository functions and database sessions.',
          ],
        },
        {
          type: 'code',
          text: 'router.get("/projects/:projectId", async (req, res) => {\n  const project = await projectService.getProject(req.params.projectId)\n  return res.json({ project })\n})',
        },
      ],
      citations: [
        { id: 'src/api/router.ts', start: 15, end: 29, label: 'router.ts:15-29' },
      ],
    };
  }

  if (normalized.includes('database') || normalized.includes('request')) {
    return {
      sections: [
        {
          type: 'heading',
          text: 'Request lifecycle',
        },
        {
          type: 'paragraph',
          text:
            'A request is accepted by the API router, authenticated against the JWT session, then dispatched to the project service. Once the service has resolved the project, the database layer yields a scoped session that the analytics and repository functions can read from safely.',
        },
        {
          type: 'list',
          items: [
            'Request validation happens before any DB touchpoints are opened.',
            'The session context is passed through to the repository layer.',
            'The database connection is closed after the response is sent.',
          ],
        },
      ],
      citations: [
        { id: 'src/core/db.py', start: 1, end: 14, label: 'db.py:1-14' },
        { id: 'src/api/router.ts', start: 15, end: 29, label: 'router.ts:15-29' },
      ],
    };
  }

  return {
    sections: [
      {
        type: 'heading',
        text: 'Error handling pattern',
      },
      {
        type: 'paragraph',
        text:
          'The application centralizes failures in a small set of HTTP-exception and validation boundaries. That pattern gives consistent responses for missing resources, incomplete auth state, and invalid payloads while keeping service code cleaner.',
      },
      {
        type: 'list',
        items: [
          'Validation failures are raised before database writes happen.',
          'Auth middleware handles unauthorized access in a single place.',
          'Resource lookups convert to explicit 404 and 403 responses.',
        ],
      },
    ],
    citations: [
      { id: 'src/server/auth.py', start: 28, end: 38, label: 'auth.py:28-38' },
      { id: 'src/api/router.ts', start: 15, end: 29, label: 'router.ts:15-29' },
    ],
  };
}

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sourcePanelOpen, setSourcePanelOpen] = useState(true);
  const [repoConnected, setRepoConnected] = useState(false);
  const [repoUrl, setRepoUrl] = useState('https://github.com/acme/platform');
  const [repoError, setRepoError] = useState('');
  const [indexing, setIndexing] = useState(false);
  const [indexingStep, setIndexingStep] = useState(0);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);

  useEffect(() => {
    if (!indexing) {
      return undefined;
    }

    if (indexingStep >= indexingStages.length - 1) {
      const timer = setTimeout(() => {
        setRepoConnected(true);
        setIndexing(false);
        setIndexingStep(indexingStages.length - 1);
      }, 600);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setIndexingStep((previousStep) => previousStep + 1);
    }, 700);

    return () => clearTimeout(timer);
  }, [indexing, indexingStep]);

  const currentStatus = repoConnected
    ? 'Index ready'
    : indexing
      ? indexingStages[indexingStep]
      : 'Not connected';

  const progress = repoConnected ? 100 : indexing ? ((indexingStep + 1) / indexingStages.length) * 100 : 0;

  const handleConnectRepository = () => {
    const trimmedUrl = repoUrl.trim();
    const validPattern = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/)?$/;

    if (!trimmedUrl || !validPattern.test(trimmedUrl)) {
      setRepoError('Enter a valid GitHub repository URL, like https://github.com/acme/platform');
      return;
    }

    setRepoError('');
    setIndexing(true);
    setRepoConnected(false);
    setIndexingStep(0);
    setSelectedSource(null);
  };

  const handleExampleQuestion = (question) => {
    const response = buildQuestionResponse(question);

    setMessages([
      { role: 'user', text: question },
      { role: 'assistant', text: response.sections, citations: response.citations },
    ]);
    setDraft('');
    setSelectedSource(null);
  };

  const handleSend = () => {
    const text = draft.trim();

    if (!text) {
      return;
    }

    const response = buildQuestionResponse(text);

    setMessages([
      { role: 'user', text },
      { role: 'assistant', text: response.sections, citations: response.citations },
    ]);
    setDraft('');
    setSelectedSource(null);
  };

  const openSource = (citation) => {
    const file = sourceFiles[citation.id];

    if (!file) {
      return;
    }

    setSourcePanelOpen(true);
    setSelectedSource({ ...citation, file });
  };

  const sourceFile = selectedSource?.file ?? null;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-wrap">
            <div className="brand-mark" aria-hidden="true">
              <span className="mark-left" />
              <span className="mark-right" />
            </div>
            <div className="brand-copy">
              <div className="brand-name">CodebaseQA</div>
              <div className="brand-version">v0.1</div>
            </div>
          </div>
          <button className="icon-button small" type="button" onClick={() => setSidebarCollapsed((value) => !value)}>
            {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        <button className="new-chat-button" type="button" onClick={() => setMessages([])}>
          <Plus size={16} />
          <span>New Chat</span>
          <kbd>⌘K</kbd>
        </button>

        <div className="search-box">
          <Search size={14} />
          <span>Search conversations</span>
        </div>

        <div className="sidebar-section">
          <div className="section-label">Workspace</div>
          <div className="workspace-card">
            <div className="workspace-icon">
              <FolderOpen size={16} />
            </div>
            <div className="workspace-details">
              <div className="workspace-name">{repoMeta.name}</div>
              <div className="workspace-branch">
                <GitBranch size={12} />
                <span>{repoMeta.branch}</span>
              </div>
            </div>
            <div className="status-indicator success">
              <CircleDot size={12} />
            </div>
          </div>
        </div>

        <div className="sidebar-section conversations">
          <div className="section-label">Recent</div>
          {recentConversations.map((conversation) => (
            <button key={conversation.title} className={`conversation-item ${conversation.active ? 'active' : ''}`} type="button">
              <span className="conversation-title">{conversation.title}</span>
              <span className="conversation-time">{conversation.time}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="profile-chip">
            <div className="profile-avatar">AK</div>
            <div className="profile-meta">
              <strong>Alex Kim</strong>
              <span>workspace owner</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-panel">
        <header className="topbar">
          <div className="breadcrumb-wrap">
            <span className="crumb">acme</span>
            <ChevronRight size={12} />
            <span className="crumb strong">platform</span>
          </div>

          <div className="topbar-icons">
            <span className="branch-pill">
              <GitBranch size={12} />
              {repoMeta.branch}
            </span>
            <span className="status-pill active">
              <span className="pulse-dot" />
              {currentStatus}
            </span>
            <button className="source-toggle" type="button" onClick={() => setSourcePanelOpen((value) => !value)}>
              <PanelRightOpen size={14} />
              {sourcePanelOpen ? 'Sources on' : 'Sources off'}
            </button>
            <button className="icon-button" type="button" aria-label="Keyboard shortcuts">
              <BookOpenText size={14} />
            </button>
          </div>
        </header>

        <main className="workspace">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-mark">
                <span className="shape shape-a" />
                <span className="shape shape-b" />
                <span className="shape shape-c" />
              </div>

              <h1>Understand any codebase.</h1>
              <p>Ask questions. Trace logic. Navigate your code with confidence.</p>

              {!repoConnected ? (
                <div className="connect-card">
                  <div className="card-header-row">
                    <span className="tiny-label">Repository URL</span>
                    <span className="tiny-status">Local preview</span>
                  </div>
                  <div className="connect-input-row">
                    <input
                      type="text"
                      value={repoUrl}
                      placeholder="https://github.com/acme/platform"
                      onChange={(event) => setRepoUrl(event.target.value)}
                    />
                    <button type="button" className="primary-button" onClick={handleConnectRepository} disabled={indexing}>
                      {indexing ? 'Indexing...' : 'Connect'}
                    </button>
                  </div>

                  {repoError ? <div className="error-text">{repoError}</div> : null}

                  <div className="example-link-row">
                    <span>Example repo</span>
                    <button type="button" className="link-button" onClick={() => setRepoUrl('https://github.com/acme/platform')}>
                      github.com/acme/platform
                    </button>
                  </div>

                  <div className="indexing-progress">
                    <div className="progress-header">
                      <span>{currentStatus}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="progress-bar">
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="repo-summary-card">
                  <div className="repo-summary-head">
                    <div>
                      <div className="tiny-label">Repository ready</div>
                      <strong>{repoMeta.name}</strong>
                    </div>
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="repo-metrics">
                    <div>
                      <span>Files</span>
                      <strong>{repoMeta.files}</strong>
                    </div>
                    <div>
                      <span>Symbols</span>
                      <strong>{repoMeta.symbols}</strong>
                    </div>
                    <div>
                      <span>Updated</span>
                      <strong>{repoMeta.lastIndexed}</strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="chip-grid">
                {exampleQuestions.map((question) => (
                  <button key={question} type="button" className="question-chip" onClick={() => handleExampleQuestion(question)}>
                    {question}
                  </button>
                ))}
              </div>

              <div className="feature-hints">
                <div>
                  <Sparkles size={14} />
                  <span>Source-grounded answers</span>
                </div>
                <div>
                  <Search size={14} />
                  <span>Code-aware search</span>
                </div>
                <div>
                  <TerminalSquare size={14} />
                  <span>File-level citations</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="chat-shell">
              <div className="message-stream">
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`message-row ${message.role === 'user' ? 'user' : 'assistant'}`}>
                    {message.role === 'assistant' ? (
                      <div className="assistant-avatar">
                        <Sparkles size={13} />
                      </div>
                    ) : null}

                    <div className={`message-bubble ${message.role === 'user' ? 'user' : 'assistant'}`}>
                      {message.role === 'user' ? (
                        <div className="user-text">{message.text}</div>
                      ) : (
                        <>
                          {message.text.map((block, blockIndex) => {
                            if (block.type === 'heading') {
                              return <h3 key={`${block.type}-${blockIndex}`}>{block.text}</h3>;
                            }

                            if (block.type === 'paragraph') {
                              return <p key={`${block.type}-${blockIndex}`}>{block.text}</p>;
                            }

                            if (block.type === 'list') {
                              return (
                                <ul key={`${block.type}-${blockIndex}`}>
                                  {block.items.map((item, itemIndex) => (
                                    <li key={`${block.type}-${itemIndex}`}>{item}</li>
                                  ))}
                                </ul>
                              );
                            }

                            return (
                              <pre key={`${block.type}-${blockIndex}`}>
                                <code>{block.text}</code>
                              </pre>
                            );
                          })}

                          {message.citations && message.citations.length > 0 ? (
                            <div className="citation-row">
                              {message.citations.map((citation) => (
                                <button key={citation.label} type="button" className="citation-chip" onClick={() => openSource(citation)}>
                                  {citation.label}
                                </button>
                              ))}
                            </div>
                          ) : null}

                          <div className="answer-toolbar">
                            <button type="button" className="tool-button">
                              <Copy size={12} />
                              Copy
                            </button>
                            <button type="button" className="tool-button">
                              <ArrowUpRight size={12} />
                              Regenerate
                            </button>
                            <button type="button" className="tool-button">
                              <MessageSquareText size={12} />
                              Helpful
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="composer-wrap">
                <div className="composer-box">
                  <textarea
                    rows={1}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Ask anything about this codebase…"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <div className="composer-footer">
                    <span>Enter to send · Shift + Enter to add a new line</span>
                    <button type="button" className="send-button" onClick={handleSend} disabled={!draft.trim()}>
                      <SendHorizonal size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {sourcePanelOpen ? (
        <aside className="source-panel">
          {sourceFile ? (
            <>
              <div className="source-header">
                <div className="source-headline">
                  <div className="source-breadcrumb">src / server / auth.py</div>
                  <div className="source-title-row">
                    <h3>{sourceFile.title}</h3>
                    <span className="language-badge">{sourceFile.language}</span>
                  </div>
                </div>

                <div className="source-header-actions">
                  <button type="button" className="icon-button small" aria-label="Copy path">
                    <Copy size={13} />
                  </button>
                  <button type="button" className="icon-button small" aria-label="Close panel" onClick={() => setSourcePanelOpen(false)}>
                    <X size={13} />
                  </button>
                </div>
              </div>

              <div className="source-meta-row">
                <span>
                  {selectedSource.start}-{selectedSource.end}
                </span>
                <span>Highlighted range</span>
              </div>

              <div className="code-viewer">
                <div className="code-lines">
                  {sourceFile.code.map((line, index) => {
                    const lineNumber = index + 1;
                    const isActive = lineNumber >= selectedSource.start && lineNumber <= selectedSource.end;

                    return (
                      <div key={`${sourceFile.id}-${lineNumber}`} className={`code-line ${isActive ? 'highlighted' : ''}`}>
                        <span className="line-number">{lineNumber}</span>
                        <code>{line || ' '}</code>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="source-empty">
              <div className="source-empty-mark">
                <MessageSquareText size={20} />
              </div>
              <h3>No source selected</h3>
              <p>Click a citation in the answer to open the matching file and inspect the exact implementation context.</p>
            </div>
          )}
        </aside>
      ) : null}
    </div>
  );
}

export default App;

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });
  } catch {
    throw new Error('Could not reach the CodebaseQA API. Check that the FastAPI server is running.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.detail || payload.message || `Request failed (${response.status})`);
  }
  return payload;
}

export async function connectRepository(url) {
  const trimmedUrl = url.trim();
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(trimmedUrl)) {
    throw new Error('Use a valid HTTPS GitHub URL, for example https://github.com/owner/repository');
  }
  await request('/api/repo/download', { method: 'POST', body: JSON.stringify({ url: trimmedUrl }) });
  return request('/api/repo/scan', { method: 'POST', body: JSON.stringify({ url: trimmedUrl }) });
}

export function askRepository(question) {
  return request('/api/repo/ask', { method: 'POST', body: JSON.stringify({ question }) })
    .then((payload) => {
      if (payload?.success !== true) {
        throw new Error(payload?.error || 'The API could not answer that question.');
      }

      const answer = payload?.answer;
      if (answer?.type !== 'markdown' || typeof answer.text !== 'string' || !answer.text.trim()) {
        throw new Error('The API returned an empty or unsupported answer format.');
      }

      const rawSources = answer.extras?.sources;
      const sources = Array.isArray(rawSources)
        ? rawSources.filter((source) => typeof source?.file_path === 'string' && source.file_path.trim())
        : [];

      return {
        content: answer.text,
        sources,
      };
    });
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

function assertObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object.');
  }
  return body;
}

function requireNonEmptyString(value, fieldName, maxLen = 2000) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`"${fieldName}" must be a non-empty string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLen) {
    throw new ValidationError(`"${fieldName}" exceeds maximum length of ${maxLen} characters.`);
  }
  return trimmed;
}

function validateCompanyInit(body) {
  const b = assertObject(body);
  let budget;
  if (b.budget !== undefined) {
    const num = Number(b.budget);
    if (!Number.isFinite(num) || num < 0.5 || num > 1000000) {
      throw new ValidationError('"budget" must be a finite number between 0.5 and 1,000,000.');
    }
    budget = num;
  }
  return {
    name: typeof b.name === 'string' ? b.name.trim().slice(0, 120) : undefined,
    theme: typeof b.theme === 'string' ? b.theme.trim().slice(0, 160) : undefined,
    goal: typeof b.goal === 'string' ? b.goal.trim().slice(0, 1000) : undefined,
    budget,
    templateId: typeof b.templateId === 'string' ? b.templateId.trim().slice(0, 80) : undefined
  };
}

function validateCompanySettings(body) {
  const b = assertObject(body);
  let speedMs;
  if (b.speedMs !== undefined) {
    const num = Number(b.speedMs);
    if (!Number.isFinite(num) || num < 300 || num > 30000) {
      throw new ValidationError('"speedMs" must be between 300 and 30000 ms.');
    }
    speedMs = Math.round(num);
  }
  const uiTheme = typeof b.uiTheme === 'string' && b.uiTheme.trim() ? b.uiTheme.trim().slice(0, 40) : undefined;
  return { speedMs, uiTheme };
}

function validateTaskAdd(body) {
  const b = assertObject(body);
  return {
    title: requireNonEmptyString(b.title, 'title', 200),
    department: typeof b.department === 'string' ? b.department.trim().slice(0, 60) : 'Engineering',
    collaboratorDept: typeof b.collaboratorDept === 'string' ? b.collaboratorDept.trim().slice(0, 60) : undefined,
    priority: typeof b.priority === 'string' ? b.priority.trim().slice(0, 20) : 'High',
    description: typeof b.description === 'string' ? b.description.trim().slice(0, 2000) : ''
  };
}

function validateConsoleMessage(body) {
  const b = assertObject(body);
  return {
    toAgentId: typeof b.toAgentId === 'string' ? b.toAgentId.trim().slice(0, 60) : 'all',
    message: requireNonEmptyString(b.message, 'message', 4000)
  };
}

function validateRagQuery(body) {
  const b = assertObject(body);
  const query = requireNonEmptyString(b.query, 'query', 500);
  const topK = b.topK !== undefined ? Math.min(10, Math.max(1, Math.round(Number(b.topK) || 4))) : 4;
  const department = typeof b.department === 'string' && b.department.trim() ? b.department.trim().slice(0, 60) : null;
  return { query, department, topK };
}

function validateWorkspaceSave(body) {
  const b = assertObject(body);
  const filename = requireNonEmptyString(b.filename, 'filename', 180);
  if (typeof b.content !== 'string') {
    throw new ValidationError('"content" must be a string.');
  }
  return { filename, content: b.content };
}

module.exports = {
  ValidationError,
  validateCompanyInit,
  validateCompanySettings,
  validateTaskAdd,
  validateConsoleMessage,
  validateRagQuery,
  validateWorkspaceSave
};

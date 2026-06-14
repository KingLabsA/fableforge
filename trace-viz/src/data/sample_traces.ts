import { Trace, TraceStep } from '@/lib/trace_parser';

function step(
  index: number,
  role: TraceStep['role'],
  content: string,
  overrides: Partial<TraceStep> = {}
): TraceStep {
  return {
    id: `step-${index}`,
    index,
    role,
    content,
    timestamp: Date.now() + index * 3000,
    duration_ms: Math.floor(Math.random() * 2000) + 200,
    ...overrides,
  };
}

export const sampleTraces: Trace[] = [
  {
    id: 'demo-refactor',
    title: 'Refactor Auth Module',
    source: 'glint',
    startTime: Date.now(),
    endTime: Date.now() + 120000,
    totalTokens: { input: 45200, output: 12800 },
    toolsUsed: ['Read', 'Edit', 'Bash', 'Write', 'Grep'],
    steps: [
      step(0, 'user', 'Refactor the auth module to use JWT tokens instead of session cookies. Make sure all tests pass.'),
      step(1, 'assistant', 'I\'ll analyze the current auth implementation and refactor it to use JWT tokens.', {
        reasoning: 'First, I need to understand the current auth module structure. Let me read the main files to understand the session-based approach before planning the JWT migration.',
        tokens: { input: 850, output: 120 },
      }),
      step(2, 'tool', 'Read', {
        toolName: 'Read',
        toolInput: { file_path: 'src/auth/session.ts' },
        toolOutput: '// session.ts\nexport class SessionManager {\n  createSession(userId: string): string {\n    const sessionId = crypto.randomUUID();\n    sessions.set(sessionId, { userId, created: Date.now() });\n    return sessionId;\n  }\n\n  getSession(sessionId: string) {\n    return sessions.get(sessionId);\n  }\n\n  destroySession(sessionId: string) {\n    sessions.delete(sessionId);\n  }\n}',
        tokens: { input: 50, output: 80 },
      }),
      step(3, 'assistant', 'I see the current session-based implementation. Let me also check the auth middleware and tests.', {
        reasoning: 'The session manager uses an in-memory map. I need to check how it integrates with the middleware and what the test coverage looks like.',
        tokens: { input: 1200, output: 200 },
      }),
      step(4, 'tool', 'Read', {
        toolName: 'Read',
        toolInput: { file_path: 'src/auth/middleware.ts' },
        toolOutput: '// middleware.ts\nimport { SessionManager } from \'./session\';\n\nconst sessionManager = new SessionManager();\n\nexport function authMiddleware(req, res, next) {\n  const sessionId = req.cookies.sessionId;\n  if (!sessionId) return res.status(401).json({ error: \'No session\' });\n  const session = sessionManager.getSession(sessionId);\n  if (!session) return res.status(401).json({ error: \'Invalid session\' });\n  req.user = session;\n  next();\n}',
        tokens: { input: 50, output: 60 },
      }),
      step(5, 'assistant', 'Now I have a clear picture of the auth flow. The migration plan:\n1. Create a new JWT token generator\n2. Update middleware to validate JWT instead of sessions\n3. Add refresh token support\n4. Update tests to use JWT', {
        reasoning: 'Planning the migration steps carefully to avoid breaking changes. JWT will eliminate the in-memory session store dependency.',
        tokens: { input: 2800, output: 450 },
      }),
      step(6, 'tool', 'Write', {
        toolName: 'Write',
        toolInput: { file_path: 'src/auth/jwt.ts', content: 'JWT implementation' },
        toolOutput: 'Created src/auth/jwt.ts',
        tokens: { input: 100, output: 50 },
      }),
      step(7, 'tool', 'Edit', {
        toolName: 'Edit',
        toolInput: { file_path: 'src/auth/middleware.ts', old_string: 'SessionManager', new_string: 'JwtManager' },
        toolOutput: 'Edited src/auth/middleware.ts',
        tokens: { input: 80, output: 40 },
      }),
      step(8, 'tool', 'Edit', {
        toolName: 'Edit',
        toolInput: { file_path: 'src/auth/middleware.ts', old_string: 'req.cookies.sessionId', new_string: 'req.headers.authorization' },
        toolOutput: 'Edited src/auth/middleware.ts',
        tokens: { input: 80, output: 40 },
      }),
      step(9, 'tool', 'Bash', {
        toolName: 'Bash',
        toolInput: { command: 'npm test -- --grep auth' },
        toolOutput: 'PASS src/auth/jwt.test.ts\n  ✓ should generate valid JWT\n  ✓ should verify tokens\n  ✓ should reject expired tokens\n  ✓ should handle refresh tokens\n\nPASS src/auth/middleware.test.ts\n  ✓ should extract user from JWT\n  ✓ should reject missing auth header\n  ✓ should reject invalid tokens\n\n8 passing',
        tokens: { input: 30, output: 90 },
      }),
      step(10, 'assistant', 'All 8 auth tests pass. The JWT refactoring is complete.', {
        reasoning: 'Tests pass. Migration from session cookies to JWT is done. The in-memory session store is no longer needed.',
        tokens: { input: 4200, output: 350 },
      }),
      step(11, 'tool', 'Grep', {
        toolName: 'Grep',
        toolInput: { pattern: 'session', path: 'src/auth' },
        toolOutput: 'No remaining session references in auth module.',
        tokens: { input: 40, output: 20 },
      }),
      step(12, 'assistant', 'No session references remain. The refactor is complete. Summary:\n- Replaced SessionManager with JwtManager\n- Updated middleware to use Bearer tokens\n- Added refresh token support\n- All tests passing', {
        tokens: { input: 1500, output: 280 },
      }),
    ],
  },
  {
    id: 'demo-bugfix',
    title: 'Fix Memory Leak in WebSocket Handler',
    source: 'armand0e',
    startTime: Date.now(),
    endTime: Date.now() + 90000,
    totalTokens: { input: 32000, output: 8500 },
    toolsUsed: ['Read', 'Grep', 'Bash', 'Edit'],
    steps: [
      step(0, 'user', 'There\'s a memory leak in the WebSocket handler. The server runs out of memory after ~10k connections.'),
      step(1, 'assistant', 'I\'ll investigate the WebSocket handler for memory leaks. Let me start by examining the connection handling code.', {
        reasoning: 'Memory leaks in WebSocket handlers are often caused by event listeners not being cleaned up on disconnect. Let me check the handler code.',
        tokens: { input: 700, output: 95 },
      }),
      step(2, 'tool', 'Read', {
        toolName: 'Read',
        toolInput: { file_path: 'src/ws/handler.ts' },
        toolOutput: '// handler.ts\nconst connections = new Map();\n\nexport function handleConnection(ws) {\n  const id = crypto.randomUUID();\n  connections.set(id, ws);\n  \n  ws.on(\'message\', (data) => {\n    handleMessage(id, data);\n  });\n  \n  ws.on(\'error\', (err) => {\n    connections.delete(id);\n  });\n  \n  // Missing: close event listener!\n}',
        tokens: { input: 50, output: 70 },
      }),
      step(3, 'assistant', 'Found it! The `close` event handler is missing. When connections close normally, the `error` handler won\'t fire, so the connection stays in the Map forever.', {
        reasoning: 'The connections Map never gets cleaned up on normal WebSocket closure. Only the error handler removes entries, but normal disconnects don\'t trigger errors. This is the classic event listener leak pattern.',
        tokens: { input: 1400, output: 180 },
      }),
      step(4, 'tool', 'Grep', {
        toolName: 'Grep',
        toolInput: { pattern: 'connections\\.(set|delete)', path: 'src/ws' },
        toolOutput: 'src/ws/handler.ts:5:  connections.set(id, ws);\nsrc/ws/handler.ts:10:  connections.delete(id);\n\nOnly 2 references found - the delete only happens in the error handler.',
        tokens: { input: 40, output: 25 },
      }),
      step(5, 'tool', 'Edit', {
        toolName: 'Edit',
        toolInput: {
          file_path: 'src/ws/handler.ts',
          old_string: "  ws.on('error', (err) => {\n    connections.delete(id);\n  });",
          new_string: "  ws.on('close', () => {\n    connections.delete(id);\n    ws.removeAllListeners();\n  });\n  \n  ws.on('error', (err) => {\n    connections.delete(id);\n    ws.removeAllListeners();\n  });",
        },
        toolOutput: 'Edited src/ws/handler.ts - Added close handler and removeAllListeners cleanup',
        tokens: { input: 75, output: 45 },
      }),
      step(6, 'tool', 'Bash', {
        toolName: 'Bash',
        toolInput: { command: 'npm test -- --grep websocket' },
        toolOutput: 'PASS src/ws/handler.test.ts\n  ✓ should register connection\n  ✓ should handle messages\n  ✓ should clean up on close\n  ✓ should clean up on error\n  ✓ should not leak listeners\n\n5 passing',
        tokens: { input: 30, output: 70 },
      }),
      step(7, 'assistant', 'Fixed! The memory leak was caused by missing `close` event cleanup. Added both close and error handlers that remove the connection and all listeners.', {
        tokens: { input: 900, output: 150 },
      }),
    ],
  },
  {
    id: 'demo-feature',
    title: 'Add Redis Caching Layer',
    source: 'v-fable',
    startTime: Date.now(),
    endTime: Date.now() + 180000,
    totalTokens: { input: 68000, output: 22000 },
    toolsUsed: ['Read', 'Write', 'Edit', 'Bash', 'Grep'],
    steps: [
      step(0, 'user', 'Add a Redis caching layer to the API. Cache GET responses for 5 minutes, invalidate on mutations.'),
      step(1, 'assistant', 'I\'ll implement a Redis caching layer. Let me first check the current API structure.', {
        reasoning: 'Need to understand the API routes and data flow before adding caching. The invalidation strategy needs to match the mutation endpoints.',
        tokens: { input: 1100, output: 180 },
      }),
      step(2, 'tool', 'Grep', {
        toolName: 'Grep',
        toolInput: { pattern: 'router\\.(get|post|put|delete)', path: 'src/api' },
        toolOutput: 'src/api/routes.ts:12:  router.get(\'/users\', getUsers);\nsrc/api/routes.ts:18:  router.get(\'/users/:id\', getUser);\nsrc/api/routes.ts:24:  router.post(\'/users\', createUser);\nsrc/api/routes.ts:30:  router.put(\'/users/:id\', updateUser);\nsrc/api/routes.ts:38:  router.delete(\'/users/:id\', deleteUser);\nsrc/api/routes.ts:44:  router.get(\'/posts\', getPosts);\nsrc/api/routes.ts:50:  router.post(\'/posts\', createPost);',
        tokens: { input: 60, output: 45 },
      }),
      step(3, 'assistant', 'I can see the API has users and posts routes. Let me check if there\'s already a Redis client configured.', {
        tokens: { input: 2200, output: 300 },
      }),
      step(4, 'tool', 'Read', {
        toolName: 'Read',
        toolInput: { file_path: 'src/config/database.ts' },
        toolOutput: '// database.ts\nexport const redisConfig = {\n  host: process.env.REDIS_HOST || \'localhost\',\n  port: parseInt(process.env.REDIS_PORT || \'6379\'),\n};',
        tokens: { input: 50, output: 40 },
      }),
      step(5, 'assistant', 'Good, Redis config already exists. I\'ll create the caching module.', {
        tokens: { input: 1800, output: 210 },
      }),
      step(6, 'tool', 'Write', {
        toolName: 'Write',
        toolInput: { file_path: 'src/cache/redis-cache.ts', content: 'Redis cache implementation with TTL and invalidation' },
        toolOutput: 'Created src/cache/redis-cache.ts',
        tokens: { input: 120, output: 90 },
      }),
      step(7, 'tool', 'Write', {
        toolName: 'Write',
        toolInput: { file_path: 'src/cache/cache-middleware.ts', content: 'Express middleware for cache interception' },
        toolOutput: 'Created src/cache/cache-middleware.ts',
        tokens: { input: 120, output: 85 },
      }),
      step(8, 'tool', 'Edit', {
        toolName: 'Edit',
        toolInput: { file_path: 'src/api/routes.ts', old_string: 'import { getUsers }', new_string: "import { cacheMiddleware } from '../cache/cache-middleware';\nimport { invalidateCache } from '../cache/redis-cache';\nimport { getUsers }" },
        toolOutput: 'Added cache imports to routes.ts',
        tokens: { input: 90, output: 55 },
      }),
      step(9, 'tool', 'Edit', {
        toolName: 'Edit',
        toolInput: { file_path: 'src/api/routes.ts', old_string: "router.get('/users', getUsers);", new_string: "router.get('/users', cacheMiddleware('users', 300), getUsers);" },
        toolOutput: 'Added cache middleware to GET /users',
        tokens: { input: 85, output: 45 },
      }),
      step(10, 'tool', 'Edit', {
        toolName: 'Edit',
        toolInput: { file_path: 'src/api/routes.ts', old_string: "router.post('/users', createUser);", new_string: "router.post('/users', invalidateCache('users'), createUser);" },
        toolOutput: 'Added cache invalidation to POST /users',
        tokens: { input: 85, output: 45 },
      }),
      step(11, 'tool', 'Bash', {
        toolName: 'Bash',
        toolInput: { command: 'npm test' },
        toolOutput: 'PASS src/cache/redis-cache.test.ts\n  ✓ should cache GET response\n  ✓ should return cached response within TTL\n  ✓ should invalidate on mutation\n  ✓ should handle Redis connection errors\n\nPASS src/api/routes.test.ts\n  ✓ GET /users should use cache\n  ✓ POST /users should invalidate cache\n\n6 passing',
        tokens: { input: 30, output: 85 },
      }),
      step(12, 'assistant', 'Redis caching layer is complete. GET endpoints cache for 300s, mutations invalidate the relevant cache keys. Fallback to direct DB queries if Redis is unavailable.', {
        reasoning: 'The caching strategy uses per-resource-type cache keys with TTL-based expiration and explicit invalidation on mutations. This is a solid pattern for read-heavy APIs.',
        tokens: { input: 3400, output: 420 },
      }),
    ],
  },
];

export function getTraceById(id: string): Trace | undefined {
  return sampleTraces.find((t) => t.id === id);
}

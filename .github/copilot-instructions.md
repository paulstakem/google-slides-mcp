# Google Slides MCP Server - AI Agent Instructions

## Project Overview
This is a **Model Context Protocol (MCP) server** that bridges AI agents with the Google Slides API. The server communicates via stdio transport and exposes Google Slides operations as MCP tools.

**Architecture**: OAuth2 authenticated API wrapper → MCP tool handlers → stdio transport layer

## Critical Setup & Runtime

### Environment Variables (Required)
The server **will not start** without these three environment variables:
- `GOOGLE_CLIENT_ID` - OAuth2 client ID from Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - OAuth2 client secret
- `GOOGLE_REFRESH_TOKEN` - Long-lived token for auth (get via `npm run get-token`)

Validation happens in `src/utils/envCheck.ts` before server initialization.

### Build & Run Workflow
```bash
npm run build    # TypeScript → JavaScript (src/ → build/)
npm run start    # Runs build/index.js with stdio transport
npm run get-token # OAuth flow helper for refresh token acquisition
```

**Important**: This is an MCP server, not a standalone app. It's designed to be invoked by MCP clients (like Claude Desktop) with stdio communication.

## Code Architecture Patterns

### Tool Implementation Pattern
Every tool follows this 4-file structure:

1. **Schema** (`src/schemas.ts`): Zod schema for validation
   ```typescript
   export const CreatePresentationArgsSchema = z.object({
     title: z.string().min(1, { message: '"title" (string) is required.' }),
   });
   ```

2. **Tool Function** (`src/tools/[toolName].ts`): Business logic
   ```typescript
   export const createPresentationTool = async (slides: slides_v1.Slides, args: CreatePresentationArgs) => {
     const response = await slides.presentations.create({ requestBody: { title: args.title } });
     return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
   };
   ```

3. **Tool Registration** (`src/serverHandlers.ts`): MCP tool metadata
   - `ListToolsRequestSchema` handler defines available tools with JSON schemas
   - `CallToolRequestSchema` handler routes to tool executors

4. **Centralized Execution** (`src/utils/toolExecutor.ts`): Unified error handling
   - All tools execute through `executeTool()` wrapper
   - Handles Zod validation errors, Google API errors, and MCP errors consistently

### Adding a New Tool (Step-by-Step)
1. Define Zod schema in `src/schemas.ts`
2. Create tool function in `src/tools/yourTool.ts` that accepts `(slides, args)` and returns MCP response
3. Add tool definition to `setupToolHandlers` in `src/serverHandlers.ts` (both list and call handlers)
4. Import and wire through `executeTool()` in the switch statement

## TypeScript & Module Configuration

- **Module System**: ESM with NodeNext resolution (`"type": "module"` in package.json)
- **Import Extensions**: All imports MUST use `.js` extensions (e.g., `'./schemas.js'`) even though source files are `.ts`
  - This is required for ESM compatibility after compilation
  - TypeScript resolves these correctly during build
- **Strict Mode**: Full strict checks enabled (`strictNullChecks`, `noImplicitAny`, `useUnknownInCatchVariables`)

## Error Handling Philosophy

### Three-Tier Error Strategy
1. **Google API Errors** → `handleGoogleApiError()` converts to `McpError` with `InternalError` code
2. **Validation Errors** → Zod errors converted to `McpError` with `InvalidParams` code
3. **Unknown Errors** → Caught in `toolExecutor.ts`, wrapped with tool context

**Pattern**: Always use `unknown` in catch blocks, then extract message safely (see `extractErrorMessage()` in `toolExecutor.ts`)

## Code Style Conventions

### Enforced by ESLint (eslint.config.js)
- **Function Style**: Prefer arrow functions and function expressions over declarations
  - `func-style: ['error', 'expression', { allowArrowFunctions: true }]`
  - Use `export const toolName = async () => {}` not `export async function toolName()`
- **No `any`**: `@typescript-eslint/no-explicit-any: 'error'` except where MCP SDK compatibility requires it (marked with `eslint-disable-next-line` and comment)
- **Arrow Body Style**: Use implicit returns when possible (`arrow-body-style: ['warn', 'as-needed']`)

### Import Organization
- External packages first (grouped: MCP SDK, googleapis, zod)
- Local utilities last (schemas, tools, utils)
- No circular imports (enforced by `import/no-cycle: 'warn'`)

## Google Slides API Integration

### Authentication Flow
1. OAuth2 client initialized in `src/index.ts` with credentials from env vars
2. Refresh token set via `setCredentials({ refresh_token: REFRESH_TOKEN })`
3. Authenticated `slides` client passed to all tool handlers

### API Response Pattern
All tools return Google API responses as **stringified JSON** in MCP text content:
```typescript
{ content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] }
```

### Field Masks for Optimization
Tools like `summarizePresentation` use specific field masks to minimize API response size:
```typescript
fields: 'presentationId,title,slides(objectId,pageElements(shape(text)))'
```

## Key Files Reference
- **Entry Point**: `src/index.ts` - Server initialization, OAuth setup, signal handling
- **Tool Router**: `src/serverHandlers.ts` - MCP request handlers and tool registry
- **Validation Hub**: `src/schemas.ts` - All Zod schemas in one file
- **Error Central**: `src/utils/errorHandler.ts` - Google API error normalization
- **Execution Wrapper**: `src/utils/toolExecutor.ts` - Unified tool execution with error handling

## Testing & Debugging
- No automated tests currently in the project
- Debug via console.error (visible in MCP client logs)
- Use `npm run lint` to catch style violations before commit
- Test OAuth flow with `npm run get-token` if auth issues arise

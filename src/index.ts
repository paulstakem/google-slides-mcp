#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { google, slides_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import {
  CreatePresentationArgsSchema,
  GetPresentationArgsSchema,
  BatchUpdatePresentationArgsSchema,
  GetPageArgsSchema,
  SummarizePresentationArgsSchema,
} from './schemas.js';
import { createPresentationTool } from './tools/createPresentation.js';
import { getPresentationTool } from './tools/getPresentation.js';
import { batchUpdatePresentationTool } from './tools/batchUpdatePresentation.js';
import { getPageTool } from './tools/getPage.js';
import { summarizePresentationTool } from './tools/summarizePresentation.js';
import { executeTool } from './utils/toolExecutor.js';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error(
    'Error: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN environment variables are required.'
  );
  console.error('Please refer to the README.md for instructions on obtaining these credentials.');
  process.exit(1);
}

class GoogleSlidesServer {
  private server: Server;
  private oauth2Client: OAuth2Client;
  private slides: slides_v1.Slides;

  constructor() {
    this.server = new Server(
      {
        name: 'google-slides-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
    this.oauth2Client.setCredentials({
      refresh_token: REFRESH_TOKEN,
    });

    this.slides = google.slides({
      version: 'v1',
      auth: this.oauth2Client,
    });

    this.setupToolHandlers();

    this.server.onerror = (error: Error) => console.error('[MCP Server Error]', error);

    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down server...');
      await this.server.close();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down server...');
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_presentation',
          description: 'Create a new Google Slides presentation',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'The title of the presentation.',
              },
            },
            required: ['title'],
          },
        },
        {
          name: 'get_presentation',
          description: 'Get details about a Google Slides presentation',
          inputSchema: {
            type: 'object',
            properties: {
              presentationId: {
                type: 'string',
                description: 'The ID of the presentation to retrieve.',
              },
              fields: {
                type: 'string',
                description:
                  'Optional. A mask specifying which fields to include in the response (e.g., "slides,pageSize").',
              },
            },
            required: ['presentationId'],
          },
        },
        {
          name: 'batch_update_presentation',
          description: 'Apply a batch of updates to a Google Slides presentation',
          inputSchema: {
            type: 'object',
            properties: {
              presentationId: {
                type: 'string',
                description: 'The ID of the presentation to update.',
              },
              requests: {
                type: 'array',
                description:
                  'A list of update requests to apply. See Google Slides API documentation for request structures.',
                items: { type: 'object' },
              },
              writeControl: {
                type: 'object',
                description: 'Optional. Provides control over how write requests are executed.',
                properties: {
                  requiredRevisionId: { type: 'string' },
                  targetRevisionId: { type: 'string' },
                },
              },
            },
            required: ['presentationId', 'requests'],
          },
        },
        {
          name: 'get_page',
          description: 'Get details about a specific page (slide) in a presentation',
          inputSchema: {
            type: 'object',
            properties: {
              presentationId: {
                type: 'string',
                description: 'The ID of the presentation.',
              },
              pageObjectId: {
                type: 'string',
                description: 'The object ID of the page (slide) to retrieve.',
              },
            },
            required: ['presentationId', 'pageObjectId'],
          },
        },
        {
          name: 'summarize_presentation',
          description: 'Extract text content from all slides in a presentation for summarization purposes',
          inputSchema: {
            type: 'object',
            properties: {
              presentationId: {
                type: 'string',
                description: 'The ID of the presentation to summarize.',
              },
              include_notes: {
                type: 'boolean',
                description: 'Optional. Whether to include speaker notes in the summary (default: false).',
              },
            },
            required: ['presentationId'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'create_presentation':
          return executeTool(this.slides, name, args, CreatePresentationArgsSchema, createPresentationTool);
        case 'get_presentation':
          return executeTool(this.slides, name, args, GetPresentationArgsSchema, getPresentationTool);
        case 'batch_update_presentation':
          return executeTool(this.slides, name, args, BatchUpdatePresentationArgsSchema, batchUpdatePresentationTool);
        case 'get_page':
          return executeTool(this.slides, name, args, GetPageArgsSchema, getPageTool);
        case 'summarize_presentation':
          return executeTool(this.slides, name, args, SummarizePresentationArgsSchema, summarizePresentationTool);
        default:
          return {
            content: [{ type: 'text', text: `Unknown tool requested: ${name}` }],
            isError: true,
            errorCode: ErrorCode.MethodNotFound,
          };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Google Slides MCP server running and connected via stdio.');
  }
}

const getStartupErrorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  return 'Unknown error';
};

const server = new GoogleSlidesServer();
server.run().catch((error: unknown) => {
  const errorMessage = getStartupErrorMessage(error);
  console.error('Failed to start Google Slides MCP server:', errorMessage, error);
  process.exit(1);
});

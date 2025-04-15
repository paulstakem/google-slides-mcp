#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Request
} from '@modelcontextprotocol/sdk/types.js';
import { google, slides_v1 } from 'googleapis'; // Import slides_v1 specifically
import { OAuth2Client } from 'google-auth-library';

// --- Authentication ---
// Retrieve credentials from environment variables
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

// Validate that credentials are provided
if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('Error: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN environment variables are required.');
  console.error('Please refer to the README.md for instructions on obtaining these credentials.');
  process.exit(1); // Exit if credentials are missing
}

// --- Server Class ---
class GoogleSlidesServer {
  private server: Server;
  private oauth2Client: OAuth2Client;
  private slides: slides_v1.Slides; // Use the specific Slides type

  constructor() {
    // Initialize MCP Server
    this.server = new Server(
      {
        name: 'google-slides-mcp', // Server name
        version: '0.1.0',          // Server version
      },
      {
        capabilities: {
          tools: {}, // Tools will be defined in setupToolHandlers
        },
      }
    );

    // Initialize Google OAuth2 Client
    this.oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET
    );
    this.oauth2Client.setCredentials({
      refresh_token: REFRESH_TOKEN
    });

    // Initialize Google Slides API Client
    this.slides = google.slides({
      version: 'v1',
      auth: this.oauth2Client
    });

    // Set up request handlers for MCP tools
    this.setupToolHandlers();

    // Basic error handling for the MCP server
    this.server.onerror = (error: Error) => console.error('[MCP Server Error]', error);

    // Handle graceful shutdown
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

  // --- Tool Handlers Setup ---
  private setupToolHandlers() {
    // Handler for ListTools request
    // The return type is inferred from the schema
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Define the tools provided by this server
      return {
        tools: [
          // --- Presentation Tools ---
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
                  description: 'Optional. A mask specifying which fields to include in the response (e.g., "slides,pageSize").',
                }
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
                  description: 'A list of update requests to apply. See Google Slides API documentation for request structures.',
                  items: { type: 'object' } // Define specific request types later if needed
                },
                writeControl: {
                   type: 'object',
                   description: 'Optional. Provides control over how write requests are executed.',
                   properties: {
                     requiredRevisionId: { type: 'string' },
                     targetRevisionId: { type: 'string' }
                   }
                }
              },
              required: ['presentationId', 'requests'],
            },
          },
           // --- Page/Slide Tools (Optional examples) ---
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
          // Add more tool definitions here as needed
        ],
      };
    });

    // Handler for CallTool request
    // The request and response types are inferred from the schema
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Route the call to the appropriate tool implementation method
        switch (name) {
          case 'create_presentation':
            return await this.createPresentation(args);
          case 'get_presentation':
            return await this.getPresentation(args);
          case 'batch_update_presentation':
            return await this.batchUpdatePresentation(args);
          case 'get_page':
             return await this.getPage(args);
          // Add cases for other tools here
          default:
            // Handle unknown tool names
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool requested: ${name}`
            );
        }
      } catch (error: any) {
        // Catch errors during tool execution and return an MCP error response
        console.error(`Error executing tool "${name}":`, error);
        // Check if it's already an McpError, otherwise wrap it
        const mcpError = error instanceof McpError ? error : new McpError(
          ErrorCode.InternalError,
          `Failed to execute tool "${name}": ${error.message || 'Unknown error'}`
        );
        return {
          content: [{ type: 'text', text: mcpError.message }],
          isError: true,
          errorCode: mcpError.code,
        };
      }
    });
  }

  // --- Tool Implementation Methods ---

  // Implementation for 'create_presentation'
  // Return type is inferred
  private async createPresentation(args: any) {
    if (!args.title || typeof args.title !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid or missing "title" argument (string required).');
    }

    try {
      const response = await this.slides.presentations.create({
        requestBody: {
          title: args.title,
        },
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
      };
    } catch (error: any) {
      console.error('Google API Error (createPresentation):', error.response?.data || error.message);
      throw new McpError(ErrorCode.InternalError, `Google API Error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // Implementation for 'get_presentation'
  // Return type is inferred
  private async getPresentation(args: any) {
    if (!args.presentationId || typeof args.presentationId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid or missing "presentationId" argument (string required).');
    }

    try {
      const response = await this.slides.presentations.get({
        presentationId: args.presentationId,
        fields: args.fields, // Pass fields mask if provided
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
      };
    } catch (error: any) {
      console.error('Google API Error (getPresentation):', error.response?.data || error.message);
      throw new McpError(ErrorCode.InternalError, `Google API Error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // Implementation for 'batch_update_presentation'
  // Return type is inferred
  private async batchUpdatePresentation(args: any) {
    if (!args.presentationId || typeof args.presentationId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid or missing "presentationId" argument (string required).');
    }
    if (!args.requests || !Array.isArray(args.requests)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid or missing "requests" argument (array required).');
    }

    try {
      const response = await this.slides.presentations.batchUpdate({
        presentationId: args.presentationId,
        requestBody: {
          requests: args.requests,
          writeControl: args.writeControl, // Pass writeControl if provided
        },
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
      };
    } catch (error: any) {
      console.error('Google API Error (batchUpdatePresentation):', error.response?.data || error.message);
      throw new McpError(ErrorCode.InternalError, `Google API Error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

   // Implementation for 'get_page'
   // Return type is inferred
  private async getPage(args: any) {
    if (!args.presentationId || typeof args.presentationId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid or missing "presentationId" argument (string required).');
    }
     if (!args.pageObjectId || typeof args.pageObjectId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid or missing "pageObjectId" argument (string required).');
    }

    try {
      const response = await this.slides.presentations.pages.get({
        presentationId: args.presentationId,
        pageObjectId: args.pageObjectId,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
      };
    } catch (error: any) {
      console.error('Google API Error (getPage):', error.response?.data || error.message);
      throw new McpError(ErrorCode.InternalError, `Google API Error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // Add implementations for other tools here

  // --- Run Method ---
  // Connects the server to the transport (stdio in this case) and starts listening
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    // Log to stderr so it doesn't interfere with stdout communication
    console.error('Google Slides MCP server running and connected via stdio.');
  }
}

// --- Server Instantiation and Execution ---
// Create an instance of the server
const server = new GoogleSlidesServer();
// Run the server, catching any top-level errors during startup
server.run().catch(error => {
  console.error('Failed to start Google Slides MCP server:', error);
  process.exit(1);
});

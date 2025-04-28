#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { google, slides_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';

const CreatePresentationArgsSchema = z.object({
  title: z.string().min(1, { message: '"title" (string) is required.' }),
});
type CreatePresentationArgs = z.infer<typeof CreatePresentationArgsSchema>;

const GetPresentationArgsSchema = z.object({
  presentationId: z.string().min(1, { message: '"presentationId" (string) is required.' }),
  fields: z.string().optional(),
});
type GetPresentationArgs = z.infer<typeof GetPresentationArgsSchema>;

const GoogleSlidesRequestSchema = z.any();
const GoogleSlidesWriteControlSchema = z.any();

const BatchUpdatePresentationArgsSchema = z.object({
  presentationId: z.string().min(1, { message: '"presentationId" (string) is required.' }),
  requests: z.array(GoogleSlidesRequestSchema).min(1, { message: '"requests" (array) is required.' }),
  writeControl: GoogleSlidesWriteControlSchema.optional(),
});
type BatchUpdatePresentationArgs = z.infer<typeof BatchUpdatePresentationArgsSchema>;

const GetPageArgsSchema = z.object({
  presentationId: z.string().min(1, { message: '"presentationId" (string) is required.' }),
  pageObjectId: z.string().min(1, { message: '"pageObjectId" (string) is required.' }),
});
type GetPageArgs = z.infer<typeof GetPageArgsSchema>;

const SummarizePresentationArgsSchema = z.object({
  presentationId: z.string().min(1, { message: '"presentationId" (string) is required.' }),
  include_notes: z.boolean().optional(),
});
type SummarizePresentationArgs = z.infer<typeof SummarizePresentationArgsSchema>;


const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('Error: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN environment variables are required.');
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

    this.oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET
    );
    this.oauth2Client.setCredentials({
      refresh_token: REFRESH_TOKEN
    });

    this.slides = google.slides({
      version: 'v1',
      auth: this.oauth2Client
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
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
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
                  items: { type: 'object' }
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
                }
              },
              required: ['presentationId'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (args === undefined) {
          throw new McpError(ErrorCode.InvalidParams, `Missing arguments for tool "${name}".`);
        }

        switch (name) {
          case 'create_presentation': {
            const parsedArgs = CreatePresentationArgsSchema.parse(args);
            return await this.createPresentation(parsedArgs);
          }
          case 'get_presentation': {
            const parsedArgs = GetPresentationArgsSchema.parse(args);
            return await this.getPresentation(parsedArgs);
          }
          case 'batch_update_presentation': {
            const parsedArgs = BatchUpdatePresentationArgsSchema.parse(args);
            return await this.batchUpdatePresentation(parsedArgs);
          }
          case 'get_page': {
            const parsedArgs = GetPageArgsSchema.parse(args);
             return await this.getPage(parsedArgs);
          }
          case 'summarize_presentation': {
            const parsedArgs = SummarizePresentationArgsSchema.parse(args);
             return await this.summarizePresentation(parsedArgs);
          }
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool requested: ${name}`
            );
        }
      } catch (error: unknown) {
        console.error(`Error executing tool "${name}":`, error);

        let mcpError: McpError;
        if (error instanceof z.ZodError) {
          const validationErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
          mcpError = new McpError(ErrorCode.InvalidParams, `Invalid arguments for tool "${name}": ${validationErrors}`);
        } else if (error instanceof McpError) {
          mcpError = error;
        } else {
          let errorMessage = 'Unknown error';
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (typeof error === 'string') {
            errorMessage = error;
          }
          mcpError = new McpError(ErrorCode.InternalError, `Failed to execute tool "${name}": ${errorMessage}`);
        }

        return {
          content: [{ type: 'text', text: mcpError.message }],
          isError: true,
          errorCode: mcpError.code,
        };
      }
    });
  }

  private async createPresentation(args: CreatePresentationArgs) {
    try {
      const response = await this.slides.presentations.create({
        requestBody: {
          title: args.title,
        },
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
      };
    } catch (error: unknown) {
      let errorMessage = 'Unknown Google API error';
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const gError = error as { response?: { data?: { error?: { message?: string } } } };
        errorMessage = gError.response?.data?.error?.message || (error instanceof Error ? error.message : String(error));
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.error('Google API Error (createPresentation):', error);
      throw new McpError(ErrorCode.InternalError, `Google API Error: ${errorMessage}`);
    }
  }

  private async getPresentation(args: GetPresentationArgs) {
    try {
      const response = await this.slides.presentations.get({
        presentationId: args.presentationId,
        fields: args.fields,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
      };
    } catch (error: unknown) {
      let errorMessage = 'Unknown Google API error';
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const gError = error as { response?: { data?: { error?: { message?: string } } } };
        errorMessage = gError.response?.data?.error?.message || (error instanceof Error ? error.message : String(error));
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.error('Google API Error (getPresentation):', error);
      throw new McpError(ErrorCode.InternalError, `Google API Error: ${errorMessage}`);
    }
  }

  private async batchUpdatePresentation(args: BatchUpdatePresentationArgs) {
    try {
      const response = await this.slides.presentations.batchUpdate({
        presentationId: args.presentationId,
        requestBody: {
          requests: args.requests,
          writeControl: args.writeControl,
        },
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
      };
    } catch (error: unknown) {
       let errorMessage = 'Unknown Google API error';
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const gError = error as { response?: { data?: { error?: { message?: string } } } };
        errorMessage = gError.response?.data?.error?.message || (error instanceof Error ? error.message : String(error));
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.error('Google API Error (batchUpdatePresentation):', error);
      throw new McpError(ErrorCode.InternalError, `Google API Error: ${errorMessage}`);
    }
  }

  private async getPage(args: GetPageArgs) {
    try {
      const response = await this.slides.presentations.pages.get({
        presentationId: args.presentationId,
        pageObjectId: args.pageObjectId,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
      };
    } catch (error: unknown) {
      let errorMessage = 'Unknown Google API error';
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const gError = error as { response?: { data?: { error?: { message?: string } } } };
        errorMessage = gError.response?.data?.error?.message || (error instanceof Error ? error.message : String(error));
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.error('Google API Error (getPage):', error);
      throw new McpError(ErrorCode.InternalError, `Google API Error: ${errorMessage}`);
    }
  }

  private async summarizePresentation(args: SummarizePresentationArgs) {
    const includeNotes = args.include_notes === true;

    try {
      const presentationResponse = await this.slides.presentations.get({
        presentationId: args.presentationId,
      });

      const presentation = presentationResponse.data;
      if (!presentation.slides || presentation.slides.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            title: presentation.title || 'Untitled Presentation',
            slideCount: 0,
            summary: 'This presentation contains no slides.'
          }, null, 2) }],
        };
      }

      const slidesContent = presentation.slides.map((slide, index) => {
        const slideNumber = index + 1;
        let slideText: string[] = [];
        let notes = '';

        if (slide.pageElements) {
          slide.pageElements.forEach(element => {
            if (element.shape && element.shape.text && element.shape.text.textElements) {
              element.shape.text.textElements.forEach(textElement => {
                if (textElement.textRun && textElement.textRun.content) {
                  slideText.push(textElement.textRun.content.trim());
                }
              });
            }

            if (element.table && element.table.tableRows) {
              element.table.tableRows.forEach(row => {
                if (row.tableCells) {
                  row.tableCells.forEach(cell => {
                    if (cell.text && cell.text.textElements) {
                      cell.text.textElements.forEach(textElement => {
                        if (textElement.textRun && textElement.textRun.content) {
                          slideText.push(textElement.textRun.content.trim());
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }

        if (includeNotes && slide.slideProperties && slide.slideProperties.notesPage &&
            slide.slideProperties.notesPage.pageElements) {
          slide.slideProperties.notesPage.pageElements.forEach(element => {
            if (element.shape && element.shape.text && element.shape.text.textElements) {
              element.shape.text.textElements.forEach(textElement => {
                if (textElement.textRun && textElement.textRun.content) {
                  notes += textElement.textRun.content.trim() + ' ';
                }
              });
            }
          });
        }

        return {
          slideNumber,
          slideId: slide.objectId || `slide_${slideNumber}`,
          content: slideText.filter(text => text.length > 0).join(' '),
          ...(includeNotes && notes ? { notes: notes.trim() } : {})
        };
      });

      const summary = {
        title: presentation.title || 'Untitled Presentation',
        slideCount: slidesContent.length,
        lastModified: presentation.revisionId ? `Revision ${presentation.revisionId}` : 'Unknown',
        slides: slidesContent
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
      };
    } catch (error: unknown) {
      let errorMessage = 'Unknown Google API error';
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const gError = error as { response?: { data?: { error?: { message?: string } } } };
        errorMessage = gError.response?.data?.error?.message || (error instanceof Error ? error.message : String(error));
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.error('Google API Error (summarizePresentation):', error);
      throw new McpError(ErrorCode.InternalError, `Google API Error: ${errorMessage}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Google Slides MCP server running and connected via stdio.');
  }
}

const server = new GoogleSlidesServer();
server.run().catch((error: unknown) => {
  let errorMessage = 'Unknown error';
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }
  console.error('Failed to start Google Slides MCP server:', errorMessage, error);
  process.exit(1);
});

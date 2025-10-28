import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { slides_v1 } from 'googleapis';
import { executeTool } from '../../utils/toolExecutor.js';
import { summarizePresentationTool } from '../summarizePresentation.js';
import { SummarizePresentationArgsSchema } from '../../schemas.js';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Mock the Google Slides API client
const mockPresentationsGet = vi.fn();
const mockSlidesClient = {
  presentations: {
    get: mockPresentationsGet,
  },
} as unknown as slides_v1.Slides;

describe('Feature: Summarize Presentation Tool', () => {
  beforeEach(() => {
    // Clear mock history before each test
    mockPresentationsGet.mockClear();
  });

  describe('Scenario: Successfully summarize a presentation', () => {
    it('should extract text content from slides without notes', async () => {
      // Given
      const args = { presentationId: 'presentation-123' };
      const mockPresentation = {
        presentationId: 'presentation-123',
        title: 'My Test Presentation',
        revisionId: 'rev-001',
        slides: [
          {
            objectId: 'slide-1',
            pageElements: [
              {
                objectId: 'element-1',
                shape: {
                  text: {
                    textElements: [
                      { textRun: { content: 'Title Slide' } },
                      { textRun: { content: 'Subtitle Here' } },
                    ],
                  },
                },
              },
            ],
          },
          {
            objectId: 'slide-2',
            pageElements: [
              {
                objectId: 'element-2',
                shape: {
                  text: {
                    textElements: [{ textRun: { content: 'Second Slide Content' } }],
                  },
                },
              },
            ],
          },
        ],
      };
      mockPresentationsGet.mockResolvedValue({ data: mockPresentation });

      // When
      const result = await executeTool(
        mockSlidesClient,
        'summarize_presentation',
        args,
        SummarizePresentationArgsSchema,
        summarizePresentationTool
      );

      // Then
      expect(mockPresentationsGet).toHaveBeenCalledTimes(1);
      expect(mockPresentationsGet).toHaveBeenCalledWith({
        presentationId: 'presentation-123',
        fields: expect.stringContaining('presentationId,title,revisionId,slides'),
      });
      expect(result.isError).toBeUndefined();

      const summary = JSON.parse(result.content[0].text);
      expect(summary.title).toBe('My Test Presentation');
      expect(summary.slideCount).toBe(2);
      expect(summary.lastModified).toBe('Revision rev-001');
      expect(summary.slides).toHaveLength(2);
      expect(summary.slides[0].slideNumber).toBe(1);
      expect(summary.slides[0].slideId).toBe('slide-1');
      expect(summary.slides[0].content).toBe('Title Slide Subtitle Here');
      expect(summary.slides[0].notes).toBeUndefined();
      expect(summary.slides[1].slideNumber).toBe(2);
      expect(summary.slides[1].content).toBe('Second Slide Content');
    });

    it('should include speaker notes when include_notes is true', async () => {
      // Given
      const args = {
        presentationId: 'presentation-456',
        include_notes: true,
      };
      const mockPresentation = {
        presentationId: 'presentation-456',
        title: 'Presentation with Notes',
        revisionId: 'rev-002',
        slides: [
          {
            objectId: 'slide-1',
            pageElements: [
              {
                objectId: 'element-1',
                shape: {
                  text: {
                    textElements: [{ textRun: { content: 'Main Content' } }],
                  },
                },
              },
            ],
            slideProperties: {
              notesPage: {
                pageElements: [
                  {
                    objectId: 'notes-1',
                    shape: {
                      text: {
                        textElements: [{ textRun: { content: 'Speaker notes for slide 1' } }],
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      };
      mockPresentationsGet.mockResolvedValue({ data: mockPresentation });

      // When
      const result = await executeTool(
        mockSlidesClient,
        'summarize_presentation',
        args,
        SummarizePresentationArgsSchema,
        summarizePresentationTool
      );

      // Then
      expect(result.isError).toBeUndefined();
      const summary = JSON.parse(result.content[0].text);
      expect(summary.slides[0].notes).toBe('Speaker notes for slide 1');
    });

    it('should handle slides with table elements', async () => {
      // Given
      const args = { presentationId: 'presentation-789' };
      const mockPresentation = {
        presentationId: 'presentation-789',
        title: 'Presentation with Tables',
        slides: [
          {
            objectId: 'slide-1',
            pageElements: [
              {
                objectId: 'table-1',
                table: {
                  tableRows: [
                    {
                      tableCells: [
                        {
                          text: {
                            textElements: [{ textRun: { content: 'Cell 1' } }],
                          },
                        },
                        {
                          text: {
                            textElements: [{ textRun: { content: 'Cell 2' } }],
                          },
                        },
                      ],
                    },
                    {
                      tableCells: [
                        {
                          text: {
                            textElements: [{ textRun: { content: 'Cell 3' } }],
                          },
                        },
                        {
                          text: {
                            textElements: [{ textRun: { content: 'Cell 4' } }],
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      mockPresentationsGet.mockResolvedValue({ data: mockPresentation });

      // When
      const result = await executeTool(
        mockSlidesClient,
        'summarize_presentation',
        args,
        SummarizePresentationArgsSchema,
        summarizePresentationTool
      );

      // Then
      expect(result.isError).toBeUndefined();
      const summary = JSON.parse(result.content[0].text);
      expect(summary.slides[0].content).toBe('Cell 1 Cell 2 Cell 3 Cell 4');
    });

    it('should handle empty presentation', async () => {
      // Given
      const args = { presentationId: 'empty-presentation' };
      const mockPresentation = {
        presentationId: 'empty-presentation',
        title: 'Empty Presentation',
        slides: [],
      };
      mockPresentationsGet.mockResolvedValue({ data: mockPresentation });

      // When
      const result = await executeTool(
        mockSlidesClient,
        'summarize_presentation',
        args,
        SummarizePresentationArgsSchema,
        summarizePresentationTool
      );

      // Then
      expect(result.isError).toBeUndefined();
      const summary = JSON.parse(result.content[0].text);
      expect(summary.title).toBe('Empty Presentation');
      expect(summary.slideCount).toBe(0);
      expect(summary.summary).toBe('This presentation contains no slides.');
    });

    it('should handle presentation with no title', async () => {
      // Given
      const args = { presentationId: 'untitled-presentation' };
      const mockPresentation = {
        presentationId: 'untitled-presentation',
        slides: [
          {
            objectId: 'slide-1',
            pageElements: [
              {
                objectId: 'element-1',
                shape: {
                  text: {
                    textElements: [{ textRun: { content: 'Content' } }],
                  },
                },
              },
            ],
          },
        ],
      };
      mockPresentationsGet.mockResolvedValue({ data: mockPresentation });

      // When
      const result = await executeTool(
        mockSlidesClient,
        'summarize_presentation',
        args,
        SummarizePresentationArgsSchema,
        summarizePresentationTool
      );

      // Then
      expect(result.isError).toBeUndefined();
      const summary = JSON.parse(result.content[0].text);
      expect(summary.title).toBe('Untitled Presentation');
    });

    it('should filter out empty text elements', async () => {
      // Given
      const args = { presentationId: 'presentation-clean' };
      const mockPresentation = {
        presentationId: 'presentation-clean',
        title: 'Clean Presentation',
        slides: [
          {
            objectId: 'slide-1',
            pageElements: [
              {
                objectId: 'element-1',
                shape: {
                  text: {
                    textElements: [
                      { textRun: { content: 'Real Content' } },
                      { textRun: { content: '   ' } }, // Whitespace only
                      { textRun: { content: '' } }, // Empty
                      { textRun: {} }, // No content
                    ],
                  },
                },
              },
            ],
          },
        ],
      };
      mockPresentationsGet.mockResolvedValue({ data: mockPresentation });

      // When
      const result = await executeTool(
        mockSlidesClient,
        'summarize_presentation',
        args,
        SummarizePresentationArgsSchema,
        summarizePresentationTool
      );

      // Then
      expect(result.isError).toBeUndefined();
      const summary = JSON.parse(result.content[0].text);
      expect(summary.slides[0].content).toBe('Real Content');
    });

    it('should handle slides with no pageElements', async () => {
      // Given
      const args = { presentationId: 'presentation-blank' };
      const mockPresentation = {
        presentationId: 'presentation-blank',
        title: 'Blank Slides',
        slides: [
          {
            objectId: 'slide-1',
            pageElements: undefined,
          },
          {
            objectId: 'slide-2',
          },
        ],
      };
      mockPresentationsGet.mockResolvedValue({ data: mockPresentation });

      // When
      const result = await executeTool(
        mockSlidesClient,
        'summarize_presentation',
        args,
        SummarizePresentationArgsSchema,
        summarizePresentationTool
      );

      // Then
      expect(result.isError).toBeUndefined();
      const summary = JSON.parse(result.content[0].text);
      expect(summary.slideCount).toBe(2);
      expect(summary.slides[0].content).toBe('');
      expect(summary.slides[1].content).toBe('');
    });

    it('should not include notes field when include_notes is false', async () => {
      // Given
      const args = {
        presentationId: 'presentation-no-notes',
        include_notes: false,
      };
      const mockPresentation = {
        presentationId: 'presentation-no-notes',
        title: 'Test',
        slides: [
          {
            objectId: 'slide-1',
            pageElements: [
              {
                objectId: 'element-1',
                shape: {
                  text: {
                    textElements: [{ textRun: { content: 'Content' } }],
                  },
                },
              },
            ],
            slideProperties: {
              notesPage: {
                pageElements: [
                  {
                    objectId: 'notes-1',
                    shape: {
                      text: {
                        textElements: [{ textRun: { content: 'These notes should not appear' } }],
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      };
      mockPresentationsGet.mockResolvedValue({ data: mockPresentation });

      // When
      const result = await executeTool(
        mockSlidesClient,
        'summarize_presentation',
        args,
        SummarizePresentationArgsSchema,
        summarizePresentationTool
      );

      // Then
      expect(result.isError).toBeUndefined();
      const summary = JSON.parse(result.content[0].text);
      expect(summary.slides[0].notes).toBeUndefined();
    });

    it('should handle notes with empty content when include_notes is true', async () => {
      // Given
      const args = {
        presentationId: 'presentation-empty-notes',
        include_notes: true,
      };
      const mockPresentation = {
        presentationId: 'presentation-empty-notes',
        title: 'Test',
        slides: [
          {
            objectId: 'slide-1',
            pageElements: [
              {
                objectId: 'element-1',
                shape: {
                  text: {
                    textElements: [{ textRun: { content: 'Content' } }],
                  },
                },
              },
            ],
            slideProperties: {
              notesPage: {
                pageElements: [
                  {
                    objectId: 'notes-1',
                    shape: {
                      text: {
                        textElements: [{ textRun: { content: '   ' } }], // Whitespace only
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      };
      mockPresentationsGet.mockResolvedValue({ data: mockPresentation });

      // When
      const result = await executeTool(
        mockSlidesClient,
        'summarize_presentation',
        args,
        SummarizePresentationArgsSchema,
        summarizePresentationTool
      );

      // Then
      expect(result.isError).toBeUndefined();
      const summary = JSON.parse(result.content[0].text);
      // Empty notes should not add the notes field
      expect(summary.slides[0].notes).toBeUndefined();
    });
  });

  describe('Scenario: Invalid arguments', () => {
    let consoleErrorSpy: any;

    beforeEach(() => {
      // Suppress console.error for these tests as errors are expected
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      // Restore console.error after the tests
      consoleErrorSpy.mockRestore();
    });

    it('should return an InvalidParams error when presentationId is missing', async () => {
      // Given
      const args = {};

      // When
      const result = await executeTool(
        mockSlidesClient,
        'summarize_presentation',
        args,
        SummarizePresentationArgsSchema,
        summarizePresentationTool
      );

      // Then
      expect(mockPresentationsGet).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('presentationId');
    });

    it('should return an InvalidParams error when arguments are missing entirely', async () => {
      // Given
      const args = undefined;

      // When
      const result = await executeTool(
        mockSlidesClient,
        'summarize_presentation',
        args,
        SummarizePresentationArgsSchema,
        summarizePresentationTool
      );

      // Then
      expect(mockPresentationsGet).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('Missing arguments for tool "summarize_presentation"');
    });

    it('should return an InvalidParams error when presentationId is not a string', async () => {
      // Given
      const args = { presentationId: 12345 };

      // When
      const result = await executeTool(
        mockSlidesClient,
        'summarize_presentation',
        args,
        SummarizePresentationArgsSchema,
        summarizePresentationTool
      );

      // Then
      expect(mockPresentationsGet).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('presentationId');
    });
  });

  describe('Scenario: Google API fails', () => {
    let consoleErrorSpy: any;

    beforeEach(() => {
      // Suppress console.error for these tests as errors are expected
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      // Restore console.error after the tests
      consoleErrorSpy.mockRestore();
    });

    it('should return an InternalError when the presentation does not exist', async () => {
      // Given
      const args = { presentationId: 'non-existent-id' };
      const apiError = new Error('Presentation not found');
      mockPresentationsGet.mockRejectedValue(apiError);

      // When
      const result = await executeTool(
        mockSlidesClient,
        'summarize_presentation',
        args,
        SummarizePresentationArgsSchema,
        summarizePresentationTool
      );

      // Then
      expect(mockPresentationsGet).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Google API Error in summarize_presentation: Presentation not found');
    });

    it('should return an InternalError when API call fails with network error', async () => {
      // Given
      const args = { presentationId: 'presentation-123' };
      const apiError = new Error('Network timeout');
      mockPresentationsGet.mockRejectedValue(apiError);

      // When
      const result = await executeTool(
        mockSlidesClient,
        'summarize_presentation',
        args,
        SummarizePresentationArgsSchema,
        summarizePresentationTool
      );

      // Then
      expect(mockPresentationsGet).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Google API Error in summarize_presentation: Network timeout');
    });

    it('should return an InternalError when access is denied', async () => {
      // Given
      const args = { presentationId: 'private-presentation' };
      const apiError = new Error('Permission denied');
      mockPresentationsGet.mockRejectedValue(apiError);

      // When
      const result = await executeTool(
        mockSlidesClient,
        'summarize_presentation',
        args,
        SummarizePresentationArgsSchema,
        summarizePresentationTool
      );

      // Then
      expect(mockPresentationsGet).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Google API Error in summarize_presentation: Permission denied');
    });
  });
});

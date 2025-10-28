import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { slides_v1 } from 'googleapis';
import { executeTool } from '../../utils/toolExecutor.js';
import { getPageTool } from '../getPage.js';
import { GetPageArgsSchema } from '../../schemas.js';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Mock the Google Slides API client
const mockPresentationsPagesGet = vi.fn();
const mockSlidesClient = {
  presentations: {
    pages: {
      get: mockPresentationsPagesGet,
    },
  },
} as unknown as slides_v1.Slides;

describe('Feature: Get Page Tool', () => {
  beforeEach(() => {
    // Clear mock history before each test
    mockPresentationsPagesGet.mockClear();
  });

  describe('Scenario: Successfully get a page', () => {
    it('should call the Google Slides API and return page data when given valid parameters', async () => {
      // Given
      const args = {
        presentationId: 'presentation-123',
        pageObjectId: 'slide-456',
      };
      const expectedPage = {
        objectId: 'slide-456',
        pageType: 'SLIDE',
        pageElements: [
          {
            objectId: 'element-1',
            shape: {
              shapeType: 'TEXT_BOX',
              text: {
                textElements: [
                  {
                    textRun: {
                      content: 'Hello World',
                    },
                  },
                ],
              },
            },
          },
        ],
      };
      mockPresentationsPagesGet.mockResolvedValue({ data: expectedPage });

      // When
      const result = await executeTool(mockSlidesClient, 'get_page', args, GetPageArgsSchema, getPageTool);

      // Then
      expect(mockPresentationsPagesGet).toHaveBeenCalledTimes(1);
      expect(mockPresentationsPagesGet).toHaveBeenCalledWith({
        presentationId: 'presentation-123',
        pageObjectId: 'slide-456',
      });
      expect(result.isError).toBeUndefined();
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(expectedPage, null, 2) }]);
    });

    it('should handle getting a notes page', async () => {
      // Given
      const args = {
        presentationId: 'presentation-789',
        pageObjectId: 'notes-page-1',
      };
      const expectedPage = {
        objectId: 'notes-page-1',
        pageType: 'NOTES',
        pageElements: [
          {
            objectId: 'notes-element-1',
            shape: {
              text: {
                textElements: [
                  {
                    textRun: {
                      content: 'Speaker notes here',
                    },
                  },
                ],
              },
            },
          },
        ],
      };
      mockPresentationsPagesGet.mockResolvedValue({ data: expectedPage });

      // When
      const result = await executeTool(mockSlidesClient, 'get_page', args, GetPageArgsSchema, getPageTool);

      // Then
      expect(mockPresentationsPagesGet).toHaveBeenCalledTimes(1);
      expect(mockPresentationsPagesGet).toHaveBeenCalledWith({
        presentationId: 'presentation-789',
        pageObjectId: 'notes-page-1',
      });
      expect(result.isError).toBeUndefined();
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(expectedPage, null, 2) }]);
    });

    it('should handle getting a layout page', async () => {
      // Given
      const args = {
        presentationId: 'presentation-abc',
        pageObjectId: 'layout-1',
      };
      const expectedPage = {
        objectId: 'layout-1',
        pageType: 'LAYOUT',
        layoutProperties: {
          name: 'Title Slide',
        },
      };
      mockPresentationsPagesGet.mockResolvedValue({ data: expectedPage });

      // When
      const result = await executeTool(mockSlidesClient, 'get_page', args, GetPageArgsSchema, getPageTool);

      // Then
      expect(mockPresentationsPagesGet).toHaveBeenCalledTimes(1);
      expect(result.isError).toBeUndefined();
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(expectedPage, null, 2) }]);
    });
  });

  describe('Scenario: Invalid arguments', () => {
    let consoleErrorSpy: MockInstance;

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
      const args = {
        pageObjectId: 'slide-123',
      };

      // When
      const result = await executeTool(mockSlidesClient, 'get_page', args, GetPageArgsSchema, getPageTool);

      // Then
      expect(mockPresentationsPagesGet).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('presentationId');
    });

    it('should return an InvalidParams error when pageObjectId is missing', async () => {
      // Given
      const args = {
        presentationId: 'presentation-123',
      };

      // When
      const result = await executeTool(mockSlidesClient, 'get_page', args, GetPageArgsSchema, getPageTool);

      // Then
      expect(mockPresentationsPagesGet).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('pageObjectId');
    });

    it('should return an InvalidParams error when both parameters are missing', async () => {
      // Given
      const args = {};

      // When
      const result = await executeTool(mockSlidesClient, 'get_page', args, GetPageArgsSchema, getPageTool);

      // Then
      expect(mockPresentationsPagesGet).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('presentationId');
      expect(result.content[0].text).toContain('pageObjectId');
    });

    it('should return an InvalidParams error when arguments are missing entirely', async () => {
      // Given
      const args = undefined;

      // When
      const result = await executeTool(mockSlidesClient, 'get_page', args, GetPageArgsSchema, getPageTool);

      // Then
      expect(mockPresentationsPagesGet).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('Missing arguments for tool "get_page"');
    });

    it('should return an InvalidParams error when presentationId is not a string', async () => {
      // Given
      const args = {
        presentationId: 12345,
        pageObjectId: 'slide-123',
      };

      // When
      const result = await executeTool(mockSlidesClient, 'get_page', args, GetPageArgsSchema, getPageTool);

      // Then
      expect(mockPresentationsPagesGet).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('presentationId');
    });
  });

  describe('Scenario: Google API fails', () => {
    let consoleErrorSpy: MockInstance;

    beforeEach(() => {
      // Suppress console.error for these tests as errors are expected
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      // Restore console.error after the tests
      consoleErrorSpy.mockRestore();
    });

    it('should return an InternalError when the page does not exist', async () => {
      // Given
      const args = {
        presentationId: 'presentation-123',
        pageObjectId: 'non-existent-page',
      };
      const apiError = new Error('Page not found');
      mockPresentationsPagesGet.mockRejectedValue(apiError);

      // When
      const result = await executeTool(mockSlidesClient, 'get_page', args, GetPageArgsSchema, getPageTool);

      // Then
      expect(mockPresentationsPagesGet).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Google API Error in get_page: Page not found');
    });

    it('should return an InternalError when the presentation does not exist', async () => {
      // Given
      const args = {
        presentationId: 'non-existent-presentation',
        pageObjectId: 'slide-123',
      };
      const apiError = new Error('Presentation not found');
      mockPresentationsPagesGet.mockRejectedValue(apiError);

      // When
      const result = await executeTool(mockSlidesClient, 'get_page', args, GetPageArgsSchema, getPageTool);

      // Then
      expect(mockPresentationsPagesGet).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Google API Error in get_page: Presentation not found');
    });

    it('should return an InternalError when API call fails with network error', async () => {
      // Given
      const args = {
        presentationId: 'presentation-456',
        pageObjectId: 'slide-789',
      };
      const apiError = new Error('Network timeout');
      mockPresentationsPagesGet.mockRejectedValue(apiError);

      // When
      const result = await executeTool(mockSlidesClient, 'get_page', args, GetPageArgsSchema, getPageTool);

      // Then
      expect(mockPresentationsPagesGet).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Google API Error in get_page: Network timeout');
    });

    it('should return an InternalError when access is denied', async () => {
      // Given
      const args = {
        presentationId: 'presentation-private',
        pageObjectId: 'slide-1',
      };
      const apiError = new Error('Permission denied');
      mockPresentationsPagesGet.mockRejectedValue(apiError);

      // When
      const result = await executeTool(mockSlidesClient, 'get_page', args, GetPageArgsSchema, getPageTool);

      // Then
      expect(mockPresentationsPagesGet).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Google API Error in get_page: Permission denied');
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { slides_v1 } from 'googleapis';
import { executeTool } from '../../utils/toolExecutor.js';
import { batchUpdatePresentationTool } from '../batchUpdatePresentation.js';
import { BatchUpdatePresentationArgsSchema } from '../../schemas.js';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Mock the Google Slides API client
const mockPresentationsBatchUpdate = vi.fn();
const mockSlidesClient = {
  presentations: {
    batchUpdate: mockPresentationsBatchUpdate,
  },
} as unknown as slides_v1.Slides;

describe('Feature: Batch Update Presentation Tool', () => {
  beforeEach(() => {
    // Clear mock history before each test
    mockPresentationsBatchUpdate.mockClear();
  });

  describe('Scenario: Successfully batch update a presentation', () => {
    it('should call the Google Slides API and return batch update response', async () => {
      // Given
      const args = {
        presentationId: 'presentation-123',
        requests: [
          {
            createSlide: {
              objectId: 'new-slide-1',
            },
          },
        ],
      };
      const expectedResponse = {
        presentationId: 'presentation-123',
        replies: [
          {
            createSlide: {
              objectId: 'new-slide-1',
            },
          },
        ],
      };
      mockPresentationsBatchUpdate.mockResolvedValue({ data: expectedResponse });

      // When
      const result = await executeTool(
        mockSlidesClient,
        'batch_update_presentation',
        args,
        BatchUpdatePresentationArgsSchema,
        batchUpdatePresentationTool
      );

      // Then
      expect(mockPresentationsBatchUpdate).toHaveBeenCalledTimes(1);
      expect(mockPresentationsBatchUpdate).toHaveBeenCalledWith({
        presentationId: 'presentation-123',
        requestBody: {
          requests: args.requests,
          writeControl: undefined,
        },
      });
      expect(result.isError).toBeUndefined();
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(expectedResponse, null, 2) }]);
    });

    it('should handle multiple update requests', async () => {
      // Given
      const args = {
        presentationId: 'presentation-456',
        requests: [
          {
            createSlide: {
              objectId: 'slide-1',
            },
          },
          {
            insertText: {
              objectId: 'text-box-1',
              text: 'Hello World',
            },
          },
        ],
      };
      const expectedResponse = {
        presentationId: 'presentation-456',
        replies: [
          { createSlide: { objectId: 'slide-1' } },
          { insertText: {} },
        ],
      };
      mockPresentationsBatchUpdate.mockResolvedValue({ data: expectedResponse });

      // When
      const result = await executeTool(
        mockSlidesClient,
        'batch_update_presentation',
        args,
        BatchUpdatePresentationArgsSchema,
        batchUpdatePresentationTool
      );

      // Then
      expect(mockPresentationsBatchUpdate).toHaveBeenCalledTimes(1);
      expect(mockPresentationsBatchUpdate).toHaveBeenCalledWith({
        presentationId: 'presentation-456',
        requestBody: {
          requests: args.requests,
          writeControl: undefined,
        },
      });
      expect(result.isError).toBeUndefined();
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(expectedResponse, null, 2) }]);
    });

    it('should include writeControl when provided', async () => {
      // Given
      const args = {
        presentationId: 'presentation-789',
        requests: [
          {
            createSlide: {
              objectId: 'slide-2',
            },
          },
        ],
        writeControl: {
          requiredRevisionId: 'revision-123',
        },
      };
      const expectedResponse = {
        presentationId: 'presentation-789',
        replies: [{ createSlide: { objectId: 'slide-2' } }],
      };
      mockPresentationsBatchUpdate.mockResolvedValue({ data: expectedResponse });

      // When
      const result = await executeTool(
        mockSlidesClient,
        'batch_update_presentation',
        args,
        BatchUpdatePresentationArgsSchema,
        batchUpdatePresentationTool
      );

      // Then
      expect(mockPresentationsBatchUpdate).toHaveBeenCalledTimes(1);
      expect(mockPresentationsBatchUpdate).toHaveBeenCalledWith({
        presentationId: 'presentation-789',
        requestBody: {
          requests: args.requests,
          writeControl: {
            requiredRevisionId: 'revision-123',
          },
        },
      });
      expect(result.isError).toBeUndefined();
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(expectedResponse, null, 2) }]);
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
      const args = {
        requests: [{ createSlide: { objectId: 'slide-1' } }],
      };

      // When
      const result = await executeTool(
        mockSlidesClient,
        'batch_update_presentation',
        args,
        BatchUpdatePresentationArgsSchema,
        batchUpdatePresentationTool
      );

      // Then
      expect(mockPresentationsBatchUpdate).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('presentationId');
    });

    it('should return an InvalidParams error when requests are missing', async () => {
      // Given
      const args = {
        presentationId: 'presentation-123',
      };

      // When
      const result = await executeTool(
        mockSlidesClient,
        'batch_update_presentation',
        args,
        BatchUpdatePresentationArgsSchema,
        batchUpdatePresentationTool
      );

      // Then
      expect(mockPresentationsBatchUpdate).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('requests');
    });

    it('should return an InvalidParams error when arguments are missing entirely', async () => {
      // Given
      const args = undefined;

      // When
      const result = await executeTool(
        mockSlidesClient,
        'batch_update_presentation',
        args,
        BatchUpdatePresentationArgsSchema,
        batchUpdatePresentationTool
      );

      // Then
      expect(mockPresentationsBatchUpdate).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('Missing arguments for tool "batch_update_presentation"');
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

    it('should return an InternalError when the Google API call fails', async () => {
      // Given
      const args = {
        presentationId: 'presentation-123',
        requests: [{ createSlide: { objectId: 'slide-1' } }],
      };
      const apiError = new Error('Invalid request: object already exists');
      mockPresentationsBatchUpdate.mockRejectedValue(apiError);

      // When
      const result = await executeTool(
        mockSlidesClient,
        'batch_update_presentation',
        args,
        BatchUpdatePresentationArgsSchema,
        batchUpdatePresentationTool
      );

      // Then
      expect(mockPresentationsBatchUpdate).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain(
        'Google API Error in batch_update_presentation: Invalid request: object already exists'
      );
    });

    it('should return an InternalError when presentation does not exist', async () => {
      // Given
      const args = {
        presentationId: 'non-existent-id',
        requests: [{ createSlide: { objectId: 'slide-1' } }],
      };
      const apiError = new Error('Presentation not found');
      mockPresentationsBatchUpdate.mockRejectedValue(apiError);

      // When
      const result = await executeTool(
        mockSlidesClient,
        'batch_update_presentation',
        args,
        BatchUpdatePresentationArgsSchema,
        batchUpdatePresentationTool
      );

      // Then
      expect(mockPresentationsBatchUpdate).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Google API Error in batch_update_presentation: Presentation not found');
    });

    it('should return an InternalError when writeControl revision mismatch occurs', async () => {
      // Given
      const args = {
        presentationId: 'presentation-123',
        requests: [{ createSlide: { objectId: 'slide-1' } }],
        writeControl: { requiredRevisionId: 'old-revision' },
      };
      const apiError = new Error('Revision ID mismatch');
      mockPresentationsBatchUpdate.mockRejectedValue(apiError);

      // When
      const result = await executeTool(
        mockSlidesClient,
        'batch_update_presentation',
        args,
        BatchUpdatePresentationArgsSchema,
        batchUpdatePresentationTool
      );

      // Then
      expect(mockPresentationsBatchUpdate).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Google API Error in batch_update_presentation: Revision ID mismatch');
    });
  });
});

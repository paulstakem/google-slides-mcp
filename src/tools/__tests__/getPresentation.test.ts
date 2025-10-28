import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { slides_v1 } from 'googleapis';
import { executeTool } from '../../utils/toolExecutor.js';
import { getPresentationTool } from '../getPresentation.js';
import { GetPresentationArgsSchema } from '../../schemas.js';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Mock the Google Slides API client
const mockPresentationsGet = vi.fn();
const mockSlidesClient = {
  presentations: {
    get: mockPresentationsGet,
  },
} as unknown as slides_v1.Slides;

describe('Feature: Get Presentation Tool', () => {
  beforeEach(() => {
    // Clear mock history before each test
    mockPresentationsGet.mockClear();
  });

  describe('Scenario: Successfully get a presentation', () => {
    it('should call the Google Slides API and return presentation data when given a valid presentationId', async () => {
      // Given
      const args = { presentationId: 'presentation-123' };
      const expectedPresentation = {
        presentationId: 'presentation-123',
        title: 'My Presentation',
        slides: [{ objectId: 'slide1' }, { objectId: 'slide2' }],
      };
      mockPresentationsGet.mockResolvedValue({ data: expectedPresentation });

      // When
      const result = await executeTool(
        mockSlidesClient,
        'get_presentation',
        args,
        GetPresentationArgsSchema,
        getPresentationTool
      );

      // Then
      expect(mockPresentationsGet).toHaveBeenCalledTimes(1);
      expect(mockPresentationsGet).toHaveBeenCalledWith({
        presentationId: 'presentation-123',
        fields: undefined,
      });
      expect(result.isError).toBeUndefined();
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(expectedPresentation, null, 2) }]);
    });

    it('should call the Google Slides API with fields parameter when provided', async () => {
      // Given
      const args = {
        presentationId: 'presentation-456',
        fields: 'slides,pageSize,title',
      };
      const expectedPresentation = {
        title: 'Filtered Presentation',
        slides: [{ objectId: 'slide1' }],
        pageSize: { width: 9144000, height: 5143500 },
      };
      mockPresentationsGet.mockResolvedValue({ data: expectedPresentation });

      // When
      const result = await executeTool(
        mockSlidesClient,
        'get_presentation',
        args,
        GetPresentationArgsSchema,
        getPresentationTool
      );

      // Then
      expect(mockPresentationsGet).toHaveBeenCalledTimes(1);
      expect(mockPresentationsGet).toHaveBeenCalledWith({
        presentationId: 'presentation-456',
        fields: 'slides,pageSize,title',
      });
      expect(result.isError).toBeUndefined();
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(expectedPresentation, null, 2) }]);
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
      const args = {}; // Missing presentationId

      // When
      const result = await executeTool(
        mockSlidesClient,
        'get_presentation',
        args,
        GetPresentationArgsSchema,
        getPresentationTool
      );

      // Then
      expect(mockPresentationsGet).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('presentationId: Required');
    });

    it('should return an InvalidParams error when presentationId is not a string', async () => {
      // Given
      const args = { presentationId: 12345 }; // Wrong type

      // When
      const result = await executeTool(
        mockSlidesClient,
        'get_presentation',
        args,
        GetPresentationArgsSchema,
        getPresentationTool
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
        'get_presentation',
        args,
        GetPresentationArgsSchema,
        getPresentationTool
      );

      // Then
      expect(mockPresentationsGet).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('Missing arguments for tool "get_presentation"');
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

    it('should return an InternalError when the presentation does not exist', async () => {
      // Given
      const args = { presentationId: 'non-existent-id' };
      const apiError = new Error('Presentation not found');
      mockPresentationsGet.mockRejectedValue(apiError);

      // When
      const result = await executeTool(
        mockSlidesClient,
        'get_presentation',
        args,
        GetPresentationArgsSchema,
        getPresentationTool
      );

      // Then
      expect(mockPresentationsGet).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Google API Error in get_presentation: Presentation not found');
    });

    it('should return an InternalError when API call fails with network error', async () => {
      // Given
      const args = { presentationId: 'presentation-789' };
      const apiError = new Error('Network timeout');
      mockPresentationsGet.mockRejectedValue(apiError);

      // When
      const result = await executeTool(
        mockSlidesClient,
        'get_presentation',
        args,
        GetPresentationArgsSchema,
        getPresentationTool
      );

      // Then
      expect(mockPresentationsGet).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Google API Error in get_presentation: Network timeout');
    });
  });
});

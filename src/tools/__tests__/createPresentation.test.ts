import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { slides_v1 } from 'googleapis';
import { executeTool } from '../../utils/toolExecutor.js';
import { createPresentationTool } from '../createPresentation.js';
import { CreatePresentationArgsSchema } from '../../schemas.js';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Mock the Google Slides API client
const mockPresentationsCreate = jest.fn();
const mockSlidesClient = {
  presentations: {
    create: mockPresentationsCreate,
  },
} as unknown as slides_v1.Slides;

describe('Feature: Create Presentation Tool', () => {
  beforeEach(() => {
    // Clear mock history before each test
    mockPresentationsCreate.mockClear();
  });

  describe('Scenario: Successfully create a new presentation', () => {
    it('should call the Google Slides API and return the new presentation data when given a valid title', async () => {
      // Given
      const args = { title: 'My New Presentation' };
      const expectedPresentation = {
        presentationId: '12345',
        title: 'My New Presentation',
      };
      mockPresentationsCreate.mockResolvedValue({ data: expectedPresentation });

      // When
      const result = await executeTool(
        mockSlidesClient,
        'create_presentation',
        args,
        CreatePresentationArgsSchema,
        createPresentationTool
      );

      // Then
      expect(mockPresentationsCreate).toHaveBeenCalledTimes(1);
      expect(mockPresentationsCreate).toHaveBeenCalledWith({
        requestBody: {
          title: 'My New Presentation',
        },
      });
      expect(result.isError).toBeUndefined();
      expect(result.content).toEqual([
        { type: 'text', text: JSON.stringify(expectedPresentation, null, 2) },
      ]);
    });
  });

  describe('Scenario: Invalid arguments', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      // Suppress console.error for these tests as errors are expected
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      // Restore console.error after the tests
      consoleErrorSpy.mockRestore();
    });

    it('should return an InvalidParams error when the title is missing', async () => {
      // Given
      const args = {}; // Missing title

      // When
      const result = await executeTool(
        mockSlidesClient,
        'create_presentation',
        args,
        CreatePresentationArgsSchema,
        createPresentationTool
      );

      // Then
      expect(mockPresentationsCreate).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('title: Required');
    });

    it('should return an InvalidParams error when arguments are missing entirely', async () => {
      // Given
      const args = undefined;

      // When
      const result = await executeTool(
        mockSlidesClient,
        'create_presentation',
        args,
        CreatePresentationArgsSchema,
        createPresentationTool
      );

      // Then
      expect(mockPresentationsCreate).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('Missing arguments for tool "create_presentation"');
    });
  });

  describe('Scenario: Google API fails', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      // Suppress console.error for these tests as errors are expected
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      // Restore console.error after the tests
      consoleErrorSpy.mockRestore();
    });

    it('should return an InternalError when the Google API call fails', async () => {
      // Given
      const args = { title: 'A Presentation' };
      const apiError = new Error('API limit reached');
      mockPresentationsCreate.mockRejectedValue(apiError);

      // When
      const result = await executeTool(
        mockSlidesClient,
        'create_presentation',
        args,
        CreatePresentationArgsSchema,
        createPresentationTool
      );

      // Then
      expect(mockPresentationsCreate).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Google API Error in create_presentation: API limit reached');
    });
  });
});

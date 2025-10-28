import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { handleGoogleApiError, getStartupErrorMessage } from '../errorHandler.js';

describe('Feature: Error Handler', () => {
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    // Suppress console.error for these tests as errors are expected
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.error after the tests
    consoleErrorSpy.mockRestore();
  });

  describe('Scenario: handleGoogleApiError', () => {
    it('should handle Google API error with nested response.data.error.message', () => {
      // Given
      const googleError = {
        response: {
          data: {
            error: {
              message: 'Presentation not found',
            },
          },
        },
      };
      const toolName = 'get_presentation';

      // When
      const result = handleGoogleApiError(googleError, toolName);

      // Then
      expect(result.code).toBe(ErrorCode.InternalError);
      expect(result.message).toContain('Google API Error in get_presentation: Presentation not found');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Google API Error (get_presentation):', googleError);
    });

    it('should handle Google API error with response but no nested error message', () => {
      // Given
      const googleError = new Error('API limit exceeded');
      Object.assign(googleError, {
        response: {
          data: {},
        },
      });
      const toolName = 'batch_update';

      // When
      const result = handleGoogleApiError(googleError, toolName);

      // Then
      expect(result.code).toBe(ErrorCode.InternalError);
      expect(result.message).toContain('Google API Error in batch_update: API limit exceeded');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Google API Error (batch_update):', googleError);
    });

    it('should handle standard Error instances', () => {
      // Given
      const error = new Error('Network timeout');
      const toolName = 'create_presentation';

      // When
      const result = handleGoogleApiError(error, toolName);

      // Then
      expect(result.code).toBe(ErrorCode.InternalError);
      expect(result.message).toContain('Google API Error in create_presentation: Network timeout');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Google API Error (create_presentation):', error);
    });

    it('should handle string errors', () => {
      // Given
      const error = 'Connection refused';
      const toolName = 'get_page';

      // When
      const result = handleGoogleApiError(error, toolName);

      // Then
      expect(result.code).toBe(ErrorCode.InternalError);
      expect(result.message).toContain('Google API Error in get_page: Connection refused');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Google API Error (get_page):', error);
    });

    it('should handle unknown error types', () => {
      // Given
      const error = { code: 500, status: 'Internal Server Error' };
      const toolName = 'summarize_presentation';

      // When
      const result = handleGoogleApiError(error, toolName);

      // Then
      expect(result.code).toBe(ErrorCode.InternalError);
      expect(result.message).toContain('Google API Error in summarize_presentation: Unknown Google API error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Google API Error (summarize_presentation):', error);
    });

    it('should handle null errors', () => {
      // Given
      const error = null;
      const toolName = 'test_tool';

      // When
      const result = handleGoogleApiError(error, toolName);

      // Then
      expect(result.code).toBe(ErrorCode.InternalError);
      expect(result.message).toContain('Google API Error in test_tool: Unknown Google API error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Google API Error (test_tool):', error);
    });

    it('should handle undefined errors', () => {
      // Given
      const error = undefined;
      const toolName = 'test_tool';

      // When
      const result = handleGoogleApiError(error, toolName);

      // Then
      expect(result.code).toBe(ErrorCode.InternalError);
      expect(result.message).toContain('Google API Error in test_tool: Unknown Google API error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Google API Error (test_tool):', error);
    });

    it('should handle number errors', () => {
      // Given
      const error = 404;
      const toolName = 'test_tool';

      // When
      const result = handleGoogleApiError(error, toolName);

      // Then
      expect(result.code).toBe(ErrorCode.InternalError);
      expect(result.message).toContain('Google API Error in test_tool: Unknown Google API error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Google API Error (test_tool):', error);
    });
  });

  describe('Scenario: getStartupErrorMessage', () => {
    it('should extract message from Error instances', () => {
      // Given
      const error = new Error('Failed to authenticate');

      // When
      const result = getStartupErrorMessage(error);

      // Then
      expect(result).toBe('Failed to authenticate');
    });

    it('should return string errors as-is', () => {
      // Given
      const error = 'Configuration missing';

      // When
      const result = getStartupErrorMessage(error);

      // Then
      expect(result).toBe('Configuration missing');
    });

    it('should handle unknown error types', () => {
      // Given
      const error = { detail: 'Something went wrong' };

      // When
      const result = getStartupErrorMessage(error);

      // Then
      expect(result).toBe('Unknown error');
    });

    it('should handle null errors', () => {
      // Given
      const error = null;

      // When
      const result = getStartupErrorMessage(error);

      // Then
      expect(result).toBe('Unknown error');
    });

    it('should handle undefined errors', () => {
      // Given
      const error = undefined;

      // When
      const result = getStartupErrorMessage(error);

      // Then
      expect(result).toBe('Unknown error');
    });

    it('should handle number errors', () => {
      // Given
      const error = 500;

      // When
      const result = getStartupErrorMessage(error);

      // Then
      expect(result).toBe('Unknown error');
    });

    it('should handle boolean errors', () => {
      // Given
      const error = false;

      // When
      const result = getStartupErrorMessage(error);

      // Then
      expect(result).toBe('Unknown error');
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { slides_v1 } from 'googleapis';
import { z } from 'zod';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { executeTool } from '../toolExecutor.js';

// Test schema
const TestArgsSchema = z.object({
  testParam: z.string(),
});

type TestArgs = z.infer<typeof TestArgsSchema>;

// Mock Google Slides client
const mockSlidesClient = {} as slides_v1.Slides;

describe('Feature: Tool Executor', () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Suppress console.error for these tests as errors are expected
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.error after the tests
    consoleErrorSpy.mockRestore();
  });

  describe('Scenario: Successfully execute tool', () => {
    it('should execute tool function with valid arguments', async () => {
      // Given
      const args = { testParam: 'test value' };
      const expectedResult = { content: [{ type: 'text', text: 'Success' }] };
      const mockToolFn = vi.fn().mockResolvedValue(expectedResult);

      // When
      const result = await executeTool(mockSlidesClient, 'test_tool', args, TestArgsSchema, mockToolFn);

      // Then
      expect(mockToolFn).toHaveBeenCalledTimes(1);
      expect(mockToolFn).toHaveBeenCalledWith(mockSlidesClient, args);
      expect(result).toEqual(expectedResult);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Scenario: Missing arguments', () => {
    it('should return InvalidParams error when arguments are undefined', async () => {
      // Given
      const args = undefined;
      const mockToolFn = vi.fn();

      // When
      const result = await executeTool(mockSlidesClient, 'test_tool', args, TestArgsSchema, mockToolFn);

      // Then
      expect(mockToolFn).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('Missing arguments for tool "test_tool".');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Scenario: Zod validation errors', () => {
    it('should return InvalidParams error when required field is missing', async () => {
      // Given
      const args = {}; // Missing testParam
      const mockToolFn = vi.fn();

      // When
      const result = await executeTool(mockSlidesClient, 'test_tool', args, TestArgsSchema, mockToolFn);

      // Then
      expect(mockToolFn).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('Invalid arguments for tool "test_tool"');
      expect(result.content[0].text).toContain('testParam: Required');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should return InvalidParams error when field has wrong type', async () => {
      // Given
      const args = { testParam: 123 }; // Should be string
      const mockToolFn = vi.fn();

      // When
      const result = await executeTool(mockSlidesClient, 'test_tool', args, TestArgsSchema, mockToolFn);

      // Then
      expect(mockToolFn).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('Invalid arguments for tool "test_tool"');
      expect(result.content[0].text).toContain('testParam');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle multiple validation errors', async () => {
      // Given
      const MultiFieldSchema = z.object({
        field1: z.string(),
        field2: z.number(),
        field3: z.boolean(),
      });
      const args = {}; // All fields missing
      const mockToolFn = vi.fn();

      // When
      const result = await executeTool(mockSlidesClient, 'multi_field_tool', args, MultiFieldSchema, mockToolFn);

      // Then
      expect(mockToolFn).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('Invalid arguments for tool "multi_field_tool"');
      expect(result.content[0].text).toContain('field1');
      expect(result.content[0].text).toContain('field2');
      expect(result.content[0].text).toContain('field3');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Scenario: McpError thrown by tool function', () => {
    it('should pass through McpError with InvalidRequest code', async () => {
      // Given
      const args = { testParam: 'test' };
      const mcpError = new McpError(ErrorCode.InvalidRequest, 'Resource not found');
      const mockToolFn = vi.fn().mockRejectedValue(mcpError);

      // When
      const result = await executeTool(mockSlidesClient, 'test_tool', args, TestArgsSchema, mockToolFn);

      // Then
      expect(mockToolFn).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidRequest);
      expect(result.content[0].text).toContain('Resource not found');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should pass through McpError with InternalError code', async () => {
      // Given
      const args = { testParam: 'test' };
      const mcpError = new McpError(ErrorCode.InternalError, 'Google API Error');
      const mockToolFn = vi.fn().mockRejectedValue(mcpError);

      // When
      const result = await executeTool(mockSlidesClient, 'test_tool', args, TestArgsSchema, mockToolFn);

      // Then
      expect(mockToolFn).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Google API Error');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Scenario: Generic Error thrown by tool function', () => {
    it('should handle standard Error instances', async () => {
      // Given
      const args = { testParam: 'test' };
      const error = new Error('Unexpected error occurred');
      const mockToolFn = vi.fn().mockRejectedValue(error);

      // When
      const result = await executeTool(mockSlidesClient, 'test_tool', args, TestArgsSchema, mockToolFn);

      // Then
      expect(mockToolFn).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Failed to execute tool "test_tool": Unexpected error occurred');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle string errors', async () => {
      // Given
      const args = { testParam: 'test' };
      const error = 'Something went wrong';
      const mockToolFn = vi.fn().mockRejectedValue(error);

      // When
      const result = await executeTool(mockSlidesClient, 'test_tool', args, TestArgsSchema, mockToolFn);

      // Then
      expect(mockToolFn).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Failed to execute tool "test_tool": Something went wrong');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle unknown error types', async () => {
      // Given
      const args = { testParam: 'test' };
      const error = { code: 500, detail: 'Internal Server Error' };
      const mockToolFn = vi.fn().mockRejectedValue(error);

      // When
      const result = await executeTool(mockSlidesClient, 'test_tool', args, TestArgsSchema, mockToolFn);

      // Then
      expect(mockToolFn).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Failed to execute tool "test_tool": Unknown error');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle null errors', async () => {
      // Given
      const args = { testParam: 'test' };
      const error = null;
      const mockToolFn = vi.fn().mockRejectedValue(error);

      // When
      const result = await executeTool(mockSlidesClient, 'test_tool', args, TestArgsSchema, mockToolFn);

      // Then
      expect(mockToolFn).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Failed to execute tool "test_tool": Unknown error');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle number errors', async () => {
      // Given
      const args = { testParam: 'test' };
      const error = 404;
      const mockToolFn = vi.fn().mockRejectedValue(error);

      // When
      const result = await executeTool(mockSlidesClient, 'test_tool', args, TestArgsSchema, mockToolFn);

      // Then
      expect(mockToolFn).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InternalError);
      expect(result.content[0].text).toContain('Failed to execute tool "test_tool": Unknown error');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Scenario: Complex validation scenarios', () => {
    it('should handle nested object validation errors', async () => {
      // Given
      const NestedSchema = z.object({
        user: z.object({
          name: z.string(),
          age: z.number(),
        }),
      });
      const args = { user: { name: 'John' } }; // Missing age
      const mockToolFn = vi.fn();

      // When
      const result = await executeTool(mockSlidesClient, 'nested_tool', args, NestedSchema, mockToolFn);

      // Then
      expect(mockToolFn).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.InvalidParams);
      expect(result.content[0].text).toContain('Invalid arguments for tool "nested_tool"');
      expect(result.content[0].text).toContain('user.age');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});

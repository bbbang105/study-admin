import { NextResponse } from 'next/server';

/**
 * Standard API error codes
 */
export enum ApiErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: string[];
  };
}

/**
 * Standard API success response format
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

/**
 * API Error class for consistent error handling
 */
export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly details?: string[];

  constructor(
    code: ApiErrorCode,
    message: string,
    statusCode: number,
    details?: string[]
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  /**
   * Convert to NextResponse
   */
  toResponse(): NextResponse<ApiErrorResponse> {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: this.code,
          message: this.message,
          details: this.details,
        },
      },
      { status: this.statusCode }
    );
  }
}

/**
 * Factory functions for common errors
 */
export const Errors = {
  badRequest: (message: string, details?: string[]) =>
    new ApiError(ApiErrorCode.BAD_REQUEST, message, 400, details),

  unauthorized: (message = '인증이 필요합니다.') =>
    new ApiError(ApiErrorCode.UNAUTHORIZED, message, 401),

  forbidden: (message = '권한이 없습니다.') =>
    new ApiError(ApiErrorCode.FORBIDDEN, message, 403),

  notFound: (message = '리소스를 찾을 수 없습니다.') =>
    new ApiError(ApiErrorCode.NOT_FOUND, message, 404),

  conflict: (message: string) =>
    new ApiError(ApiErrorCode.CONFLICT, message, 409),

  validationError: (message: string, details: string[]) =>
    new ApiError(ApiErrorCode.VALIDATION_ERROR, message, 400, details),

  internalError: (message = '서버 오류가 발생했습니다.') =>
    new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500),

  databaseError: (message = '데이터베이스 오류가 발생했습니다.') =>
    new ApiError(ApiErrorCode.DATABASE_ERROR, message, 500),

  externalServiceError: (message: string) =>
    new ApiError(ApiErrorCode.EXTERNAL_SERVICE_ERROR, message, 502),
};

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
    },
    { status }
  );
}

/**
 * Create an error response from an ApiError or unknown error
 */
export function errorResponse(error: unknown): NextResponse<ApiErrorResponse> {
  if (error instanceof ApiError) {
    return error.toResponse();
  }

  // Log unexpected errors with full stack trace
  console.error('Unexpected error:', error);
  if (error instanceof Error) {
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
  }

  // Return generic error for unknown errors
  return Errors.internalError().toResponse();
}

/**
 * Wrap an async handler with error handling
 */
export function withErrorHandling<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | ApiErrorResponse>> {
  return handler().catch((error) => errorResponse(error));
}

/**
 * Validate required fields and return validation errors
 */
export function validateRequired(
  data: Record<string, unknown>,
  requiredFields: { field: string; label: string }[]
): string[] {
  const errors: string[] = [];

  for (const { field, label } of requiredFields) {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      errors.push(`${label}은(는) 필수입니다.`);
    }
  }

  return errors;
}

/**
 * Set Cache-Control header on a NextResponse
 * @param response - NextResponse to modify
 * @param maxAge - Cache duration in seconds (0 = no-store)
 * @param scope - 'private' for user-specific data (default), 'public' for shared data
 */
export function withCache<T>(response: NextResponse<T>, maxAge: number, scope: 'private' | 'public' = 'private'): NextResponse<T> {
  if (maxAge <= 0) {
    response.headers.set('Cache-Control', 'no-store');
  } else {
    response.headers.set('Cache-Control', `${scope}, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`);
  }
  return response;
}

/**
 * Parse pagination parameters from URL search params
 */
export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)));
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
}

/**
 * Create pagination metadata
 */
export function createPaginationMeta(
  page: number,
  pageSize: number,
  totalCount: number
): {
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
} {
  const totalPages = Math.ceil(totalCount / pageSize);
  return {
    page,
    pageSize,
    totalPages,
    totalCount,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

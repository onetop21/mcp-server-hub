import { Request } from 'express';

/**
 * Extended Request interface with user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
  };
}

/**
 * API Error response format
 */
export interface ApiErrorResponse {
  error: string;
  field?: string;
  code?: string;
  timestamp?: string;
  requestId?: string;
}

/**
 * API Success response format
 */
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  timestamp?: string;
}
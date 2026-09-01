/**
 * @webshield/shared
 *
 * Shared types and utilities for the WebShield monorepo.
 *
 * Phase 1: Minimal scaffold — types will be added in Phase 2+
 *
 * Future exports:
 *   - User, Scan, Finding types (Phase 2)
 *   - Security severity enums (Phase 3)
 *   - Shared validation schemas (Phase 2)
 */

// ── API envelope types ────────────────────────────────────────────────────────

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ── Common value types ────────────────────────────────────────────────────────

/** ISO 8601 timestamp string */
export type ISODateString = string;

/** UUID v4 string */
export type UUID = string;

/**
 * Central API configuration — reads from Next.js public env vars.
 */

import axios, { AxiosError, AxiosInstance } from 'axios';

const DEFAULT_API = 'http://localhost:8000/api/v1';
const DEFAULT_WS = 'ws://localhost:8000';

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API).replace(/\/$/, '');
export const WS_BASE = (process.env.NEXT_PUBLIC_WS_URL ?? DEFAULT_WS).replace(/\/$/, '');
export const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? 'development';
export const IS_PRODUCTION = APP_ENV === 'production';

/** Build a full API path, e.g. apiUrl('/auth/login') */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

/** Auth headers for authenticated requests */
export function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** WebSocket URL with query params */
export function wsUrl(path: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${WS_BASE}${normalized}?${qs}`;
}

/** Parse rate-limit headers from a response */
export function parseRateLimitHeaders(headers: Record<string, string>) {
  return {
    limit: Number(headers['x-ratelimit-limit'] ?? headers['X-RateLimit-Limit'] ?? 0),
    remaining: Number(headers['x-ratelimit-remaining'] ?? headers['X-RateLimit-Remaining'] ?? 0),
    reset: Number(headers['x-ratelimit-reset'] ?? headers['X-RateLimit-Reset'] ?? 0),
    bucket: headers['x-ratelimit-bucket'] ?? headers['X-RateLimit-Bucket'] ?? '',
  };
}

/** Shared axios client with 429 backoff */
export const apiClient: AxiosInstance = axios.create({
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const headers = authHeaders();
  if (headers.Authorization) {
    config.headers.Authorization = headers.Authorization;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 429) {
      const retryAfter = Number(error.response.headers['retry-after'] ?? 60);
      const rate = parseRateLimitHeaders(error.response.headers as Record<string, string>);
      console.warn(
        `[Nova] Rate limited (${rate.bucket || 'api'}). Retry after ${retryAfter}s. ` +
        `Remaining: ${rate.remaining}/${rate.limit}`,
      );
    }
    return Promise.reject(error);
  },
);
/**
 * api.ts — Typed fetch client for BlackWorkInc backend.
 * All requests go through /api/v1 (proxied by Vite in dev).
 * JWT token is read from localStorage automatically.
 */

const BASE = '/api/v1';

function getToken(): string | null {
    return localStorage.getItem('bw_token');
}

function headers(extra?: HeadersInit): HeadersInit {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(extra || {}),
    };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: headers(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
}

export const api = {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
    delete: <T>(path: string) => request<T>('DELETE', path),
};

/** Returns the WebSocket URL with the JWT token as a query param. */
export function wsUrl(): string {
    const token = getToken() || '';
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    return `${proto}://${host}/api/v1/ws?token=${token}`;
}

export function saveToken(token: string) {
    localStorage.setItem('bw_token', token);
}

export function clearToken() {
    localStorage.removeItem('bw_token');
}

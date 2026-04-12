/**
 * useWebSocket.ts — React hook for real-time chat.
 * Auto-connects, auto-reconnects, dispatches incoming messages to the store.
 */
import { useEffect, useRef, useCallback } from 'react';
import { wsUrl } from './api';
import { useAppStore } from './store';
import { v4 as uuidv4 } from 'uuid';

export function useWebSocket() {
    const wsRef = useRef<WebSocket | null>(null);
    const addMessage = useAppStore(s => s.addIncomingMessage);

    const connect = useCallback(() => {
        const url = wsUrl();
        if (!url.includes('token=') || url.endsWith('token=')) return; // no token yet

        const ws = new WebSocket(url);

        ws.onopen = () => {
            console.log('✅ WS connected');
        };

        ws.onmessage = (evt) => {
            try {
                const data = JSON.parse(evt.data);
                if (data.conversation_id && data.text && data.sender_id) {
                    addMessage({
                        id: data.id || uuidv4(),
                        matchId: data.conversation_id,
                        senderId: data.sender_id,
                        text: data.text,
                        timestamp: Date.now(),
                    });
                }
            } catch (_) { /* ignore malformed */ }
        };

        ws.onclose = () => {
            console.log('⚠️  WS closed, reconnecting in 3s');
            setTimeout(connect, 3000);
        };

        wsRef.current = ws;
    }, [addMessage]);

    useEffect(() => {
        connect();
        return () => { wsRef.current?.close(); };
    }, [connect]);

    /** Send a message through the WebSocket. */
    const send = useCallback((conversationId: string, text: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ conversation_id: conversationId, text }));
        }
    }, []);

    return { send };
}

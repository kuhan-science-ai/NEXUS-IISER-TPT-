type MessageHandler = (data: any) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private listeners: Set<MessageHandler> = new Set();
  private pingInterval: any = null;
  private reconnectTimeout: any = null;
  private isConnecting: boolean = false;

  connect(token: string) {
    if (this.socket || this.isConnecting) return;
    this.isConnecting = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // Connect directly or via Vite proxy
    const wsUrl = `${protocol}//${host}/ws/nexus?token=${encodeURIComponent(token)}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnecting = false;
        console.log('[NEXUS WebSocket] Connected');
        // Start heartbeat ping every 25s
        this.pingInterval = setInterval(() => {
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ event: 'ping' }));
          }
        }, 25000);
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.listeners.forEach((listener) => listener(data));
        } catch (e) {
          console.error('[NEXUS WebSocket] Parse error:', e);
        }
      };

      this.socket.onclose = () => {
        this.cleanup();
        console.log('[NEXUS WebSocket] Closed. Scheduling reconnect in 3s...');
        this.reconnectTimeout = setTimeout(() => {
          this.connect(token);
        }, 3000);
      };

      this.socket.onerror = (err) => {
        console.warn('[NEXUS WebSocket] Error:', err);
        this.cleanup();
      };
    } catch (e) {
      this.cleanup();
    }
  }

  private cleanup() {
    this.isConnecting = false;
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.cleanup();
  }

  addListener(handler: MessageHandler) {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  send(event: string, payload: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ event, ...payload }));
    }
  }
}

export const wsClient = new WebSocketClient();

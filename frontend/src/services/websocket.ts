type MessageHandler = (data: any) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private listeners: Set<MessageHandler> = new Set();
  private reconnectTimeout: any = null;
  private isConnecting: boolean = false;
  private shouldReconnect = true;

  connect(token: string) {
    if (!token || this.socket || this.isConnecting) return;
    this.shouldReconnect = true;
    this.isConnecting = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsHost = host.includes('localhost') || host.includes('127.0.0.1') ? host : 'nexus-backend.kuhan200973.workers.dev';
    const wsUrl = `${protocol}//${wsHost}/ws/nexus?token=${encodeURIComponent(token)}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnecting = false;
        this.listeners.forEach(listener => listener({ event: 'system.connected' }));
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
        if (!this.shouldReconnect) return;
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
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.cleanup();
  }

  isConnected() { return this.socket?.readyState === WebSocket.OPEN; }

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

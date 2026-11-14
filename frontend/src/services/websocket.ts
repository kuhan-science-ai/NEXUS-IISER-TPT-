type MessageHandler = (data: any) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private listeners: Set<MessageHandler> = new Set();
  private reconnectTimeout: number | null = null;
  private heartbeatTimer: number | null = null;
  private isConnecting = false;
  private shouldReconnect = true;
  private token: string | null = null;
  private lastPongAt = 0;

  connect(token: string) {
    if (!token) return;
    if (this.token !== token) this.disconnect();
    this.shouldReconnect = true;
    this.token = token;
    if (this.socket || this.isConnecting) return;
    this.isConnecting = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsHost = host.includes('localhost') || host.includes('127.0.0.1') ? host : 'nexus-backend.kuhan200973.workers.dev';
    const wsUrl = `${protocol}//${wsHost}/ws/nexus?token=${encodeURIComponent(token)}`;
    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
      this.socket = socket;
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.isConnecting = false;
      this.lastPongAt = 0;
      this.notify({ event: 'system.connected' });
      this.send('ping', {});
      this.heartbeatTimer = window.setInterval(() => this.send('ping', {}), 10_000);
    };
    socket.onmessage = event => {
      if (this.socket !== socket) return;
      try {
        const message = JSON.parse(event.data);
        if (message?.event === 'pong') this.lastPongAt = Date.now();
        this.notify(message);
      }
      catch (error) { console.error('[NEXUS WebSocket] Parse error:', error); }
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.isConnecting = false;
      this.lastPongAt = 0;
      if (this.heartbeatTimer !== null) window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      if (this.shouldReconnect) this.scheduleReconnect();
    };
    socket.onerror = error => {
      console.warn('[NEXUS WebSocket] Error:', error);
      // The close handler owns reconnection and avoids closing a newer socket.
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) socket.close();
    };
  }

  private notify(event: any) { this.listeners.forEach(listener => listener(event)); }

  private scheduleReconnect() {
    if (!this.shouldReconnect || this.reconnectTimeout !== null) return;
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.token && this.shouldReconnect) this.connect(this.token);
    }, 2000);
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimeout !== null) window.clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
    if (this.heartbeatTimer !== null) window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.token = null;
    const socket = this.socket;
    this.socket = null;
    this.isConnecting = false;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
  }

  isConnected() { return this.socket?.readyState === WebSocket.OPEN && Date.now() - this.lastPongAt < 25_000; }
  addListener(handler: MessageHandler) { this.listeners.add(handler); return () => this.listeners.delete(handler); }
  send(event: string, payload: any) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ event, ...payload }));
  }
}

export const wsClient = new WebSocketClient();

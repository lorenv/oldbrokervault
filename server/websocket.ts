import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from './storage';

interface ClientConnection {
  ws: WebSocket;
  userId: number;
  documentId?: number;
  userName: string;
}

class CollaborationManager {
  private clients = new Map<WebSocket, ClientConnection>();
  private documentRooms = new Map<number, Set<WebSocket>>();

  addClient(ws: WebSocket, userId: number, userName: string) {
    this.clients.set(ws, { ws, userId, userName });
    
    ws.on('close', () => {
      this.removeClient(ws);
    });

    ws.on('message', (message) => {
      this.handleMessage(ws, message);
    });
  }

  removeClient(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (client?.documentId) {
      this.leaveDocument(ws, client.documentId);
    }
    this.clients.delete(ws);
  }

  joinDocument(ws: WebSocket, documentId: number) {
    const client = this.clients.get(ws);
    if (!client) return;

    client.documentId = documentId;
    
    if (!this.documentRooms.has(documentId)) {
      this.documentRooms.set(documentId, new Set());
    }
    
    this.documentRooms.get(documentId)!.add(ws);
    
    // Notify others in the room
    this.broadcastToDocument(documentId, {
      type: 'user_joined',
      userId: client.userId,
      userName: client.userName
    }, ws);
  }

  leaveDocument(ws: WebSocket, documentId: number) {
    const client = this.clients.get(ws);
    if (!client) return;

    const room = this.documentRooms.get(documentId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) {
        this.documentRooms.delete(documentId);
      }
    }

    // Release editing lock if this user was editing
    storage.stopEditing(documentId, client.userId).catch(console.error);

    // Notify others
    this.broadcastToDocument(documentId, {
      type: 'user_left',
      userId: client.userId,
      userName: client.userName
    }, ws);

    client.documentId = undefined;
  }

  broadcastToDocument(documentId: number, message: any, exclude?: WebSocket) {
    const room = this.documentRooms.get(documentId);
    if (!room) return;

    const messageStr = JSON.stringify(message);
    room.forEach(clientWs => {
      if (clientWs !== exclude && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(messageStr);
      }
    });
  }

  private async handleMessage(ws: WebSocket, message: Buffer) {
    const client = this.clients.get(ws);
    if (!client) return;

    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'join_document':
          this.joinDocument(ws, data.documentId);
          break;

        case 'leave_document':
          if (client.documentId) {
            this.leaveDocument(ws, client.documentId);
          }
          break;

        case 'start_editing':
          if (client.documentId) {
            const success = await storage.startEditing(
              client.documentId, 
              client.userId, 
              client.userName
            );
            
            ws.send(JSON.stringify({
              type: 'edit_status',
              success,
              isEditing: success
            }));

            if (success) {
              this.broadcastToDocument(client.documentId, {
                type: 'editing_started',
                userId: client.userId,
                userName: client.userName
              }, ws);
            }
          }
          break;

        case 'stop_editing':
          if (client.documentId) {
            await storage.stopEditing(client.documentId, client.userId);
            
            this.broadcastToDocument(client.documentId, {
              type: 'editing_stopped',
              userId: client.userId,
              userName: client.userName
            }, ws);
          }
          break;

        case 'content_change':
          if (client.documentId) {
            this.broadcastToDocument(client.documentId, {
              type: 'content_changed',
              userId: client.userId,
              userName: client.userName,
              field: data.field,
              value: data.value
            }, ws);
          }
          break;

        case 'cursor_position':
          if (client.documentId) {
            this.broadcastToDocument(client.documentId, {
              type: 'cursor_update',
              userId: client.userId,
              userName: client.userName,
              field: data.field,
              position: data.position
            }, ws);
          }
          break;
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('WebSocket message error:', error);
      }
    }
  }

  getDocumentUsers(documentId: number) {
    const room = this.documentRooms.get(documentId);
    if (!room) return [];

    return Array.from(room).map(ws => {
      const client = this.clients.get(ws);
      return client ? {
        userId: client.userId,
        userName: client.userName
      } : null;
    }).filter(Boolean);
  }
}

export function setupWebSocket(server: Server): CollaborationManager {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws'
  });

  const collaborationManager = new CollaborationManager();

  wss.on('connection', (ws, request) => {
    // Extract user info from session/auth
    // For now, we'll handle auth via message after connection
    let isAuthenticated = false;

    ws.on('message', (message) => {
      if (!isAuthenticated) {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'authenticate' && data.userId && data.userName) {
            collaborationManager.addClient(ws, data.userId, data.userName);
            isAuthenticated = true;
            ws.send(JSON.stringify({ type: 'authenticated', success: true }));
          }
        } catch (error) {
          ws.close(1000, 'Authentication failed');
        }
      }
    });

    ws.on('close', () => {
      if (isAuthenticated) {
        collaborationManager.removeClient(ws);
      }
    });
  });

  return collaborationManager;
}
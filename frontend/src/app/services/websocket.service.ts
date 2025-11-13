// src/app/services/websocket.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface WSMessage {
  type?: string;
  payload?: any;
}

export interface FileMessage {
  filename: string;
  size: number;
  type: string;
  data: ArrayBuffer;
  timestamp: number;
}

export interface Metrics {
  clientsConnected: number;
  totalMessages: number;
  totalDisconnected: number;
}

@Injectable({
  providedIn: 'root'
})
export class WebsocketService implements OnDestroy {
  private WS_URL = 'ws://localhost:8080';
  private connectionStatus$ = new Subject<boolean>();
  private incoming$ = new Subject<WSMessage>();
  private incomingFiles$ = new Subject<FileMessage>();
  private metrics$ = new Subject<Metrics>();
  private reconnectInterval = 3000;
  private manualClose = false;
  private nativeSocket?: WebSocket;
  private pendingFileMetadata?: { filename: string; size: number; mimeType: string };

  public messages$(): Observable<WSMessage> {
    return this.incoming$.asObservable();
  }

  public files$(): Observable<FileMessage> {
    return this.incomingFiles$.asObservable();
  }

  public status$(): Observable<boolean> {
    return this.connectionStatus$.asObservable();
  }

  public getMetrics$(): Observable<Metrics> {
    return this.metrics$.asObservable();
  }

  constructor() {
    this.connect();
  }

  private connect() {
    this.manualClose = false;
    
    // Crear WebSocket nativo primero
    this.nativeSocket = new WebSocket(this.WS_URL);
    this.nativeSocket.binaryType = 'arraybuffer'; // Importante: recibir como ArrayBuffer
    
    this.nativeSocket.onopen = () => {
      console.log('[WS] Connected');
      this.connectionStatus$.next(true);
    };
    
    this.nativeSocket.onmessage = (event: MessageEvent) => {
      // Si es ArrayBuffer (archivo binario)
      if (event.data instanceof ArrayBuffer) {
        console.log('[WS] Received binary data (ArrayBuffer), size:', event.data.byteLength);
        
        // Usar metadata pendiente si existe
        let filename = 'archivo_recibido_' + Date.now();
        let mimeType = 'application/octet-stream';
        
        if (this.pendingFileMetadata) {
          filename = this.pendingFileMetadata.filename;
          mimeType = this.pendingFileMetadata.mimeType || mimeType;
          this.pendingFileMetadata = undefined; // Limpiar metadata
        }
        
        const fileMsg: FileMessage = {
          filename: filename,
          size: event.data.byteLength,
          type: mimeType,
          data: event.data,
          timestamp: Date.now()
        };
        this.incomingFiles$.next(fileMsg);
      } 
      // Si es string (mensaje JSON)
      else if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          
          // Si es métricas del servidor
          if (msg.type === 'metrics' && msg.payload) {
            console.log('[WS] Metrics received:', msg.payload);
            this.metrics$.next(msg.payload);
          }
          // Si es metadata de archivo, guardarla para el próximo mensaje binario
          else if (msg.type === 'file-metadata' && msg.payload) {
            this.pendingFileMetadata = {
              filename: msg.payload.filename,
              size: msg.payload.size,
              mimeType: msg.payload.mimeType
            };
            console.log('[WS] File metadata received:', this.pendingFileMetadata);
          } else {
            // Mensaje normal
            this.incoming$.next(msg);
          }
        } catch (e) {
          console.warn('[WS] Failed to parse message:', event.data);
          this.incoming$.next({ type: 'text', payload: event.data });
        }
      }
    };
    
    this.nativeSocket.onclose = () => {
      console.log('[WS] Disconnected');
      this.connectionStatus$.next(false);
      this.nativeSocket = undefined;
      if (!this.manualClose) this.tryReconnect();
    };
    
    this.nativeSocket.onerror = (err) => {
      console.error('[WS] WebSocket error:', err);
    };
  }

  private tryReconnect() {
    setTimeout(() => {
      if (!this.manualClose) {
        this.connect();
      }
    }, this.reconnectInterval);
  }

  public send(msg: WSMessage) {
    try {
      if (this.nativeSocket && this.nativeSocket.readyState === WebSocket.OPEN) {
        this.nativeSocket.send(JSON.stringify(msg));
      } else {
        console.warn('[WS] socket not ready');
      }
    } catch (e) {
      console.error('[WS] send error', e);
    }
  }

  public sendFile(file: File) {
    return new Promise<void>((resolve, reject) => {
      if (!this.nativeSocket || this.nativeSocket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer;
          
          // Primero enviamos metadata como JSON
          const metadata = {
            type: 'file-metadata',
            payload: {
              filename: file.name,
              size: file.size,
              mimeType: file.type,
              timestamp: Date.now()
            }
          };
          this.nativeSocket!.send(JSON.stringify(metadata));

          // Pequeño delay para asegurar que metadata llega primero
          setTimeout(() => {
            // Luego enviamos el archivo binario
            this.nativeSocket!.send(arrayBuffer);
            console.log(`[WS] File sent: ${file.name} (${file.size} bytes)`);
            resolve();
          }, 50);
        } catch (e) {
          console.error('[WS] sendFile error', e);
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  public close() {
    this.manualClose = true;
    if (this.nativeSocket) {
      this.nativeSocket.close();
    }
    this.connectionStatus$.next(false);
  }

  ngOnDestroy(): void {
    this.close();
    this.incoming$.complete();
    this.incomingFiles$.complete();
    this.metrics$.complete();
    this.connectionStatus$.complete();
  }
}

// src/app/components/ws-demo/ws-demo.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { WebsocketService, WSMessage, FileMessage, Metrics } from '../../services/websocket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-ws-demo',
  template: `
    <div class="app-container">
      <!-- Toolbar superior -->
      <mat-toolbar color="primary" class="toolbar">
        <mat-icon class="toolbar-icon">cloud_sync</mat-icon>
        <span class="toolbar-title">WebSocket Chat & Transfer</span>
        <span class="spacer"></span>
        
        <!-- Métricas en tiempo real -->
        <div class="metrics-chips">
          <mat-chip class="metric-chip">
            <mat-icon>people</mat-icon>
            {{ metrics.clientsConnected }} Conectados
          </mat-chip>
          <mat-chip class="metric-chip">
            <mat-icon>message</mat-icon>
            {{ metrics.totalMessages }} Mensajes
          </mat-chip>
          <mat-chip class="metric-chip disconnected-chip">
            <mat-icon>person_off</mat-icon>
            {{ metrics.totalDisconnected }} Desconectados
          </mat-chip>
        </div>
        
        <mat-chip-set class="status-chip-set">
          <mat-chip [highlighted]="connected" [class.connected]="connected" [class.disconnected]="!connected">
            <mat-icon>{{ connected ? 'wifi' : 'wifi_off' }}</mat-icon>
            {{ connected ? 'Conectado' : 'Desconectado' }}
          </mat-chip>
        </mat-chip-set>
      </mat-toolbar>

      <div class="content-container">
        <!-- Grid de 2 columnas -->
        <div class="grid-container">
          
          <!-- Columna izquierda: Envío -->
          <div class="left-column">
            
            <!-- Card de mensaje de texto -->
            <mat-card class="card">
              <mat-card-header>
                <mat-icon mat-card-avatar class="card-icon">chat</mat-icon>
                <mat-card-title>Enviar Mensaje</mat-card-title>
                <mat-card-subtitle>Envía un mensaje de texto a todos los conectados</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Escribe tu mensaje</mat-label>
                  <input matInput [(ngModel)]="outMsg" placeholder="Hola mundo..." 
                         (keyup.enter)="send()" [disabled]="!connected">
                  <mat-icon matSuffix>message</mat-icon>
                </mat-form-field>
              </mat-card-content>
              <mat-card-actions align="end">
                <button mat-raised-button color="primary" (click)="send()" 
                        [disabled]="!outMsg || !connected">
                  <mat-icon>send</mat-icon>
                  Enviar
                </button>
              </mat-card-actions>
            </mat-card>

            <!-- Card de archivo -->
            <mat-card class="card">
              <mat-card-header>
                <mat-icon mat-card-avatar class="card-icon file-icon">attach_file</mat-icon>
                <mat-card-title>Enviar Archivo</mat-card-title>
                <mat-card-subtitle>Comparte archivos en tiempo real</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="file-upload-area" (click)="fileInput.click()" 
                     [class.file-selected]="selectedFile">
                  <input #fileInput type="file" (change)="onFileSelected($event)" hidden>
                  
                  <div class="upload-placeholder" *ngIf="!selectedFile">
                    <mat-icon class="upload-icon">cloud_upload</mat-icon>
                    <p class="upload-text">Click para seleccionar archivo</p>
                    <p class="upload-subtext">o arrastra y suelta aquí</p>
                  </div>

                  <div class="file-info" *ngIf="selectedFile">
                    <mat-icon class="file-icon-large">{{ getFileIcon(selectedFile.name) }}</mat-icon>
                    <div class="file-details">
                      <p class="file-name">{{ selectedFile.name }}</p>
                      <p class="file-size">{{ formatBytes(selectedFile.size) }}</p>
                    </div>
                    <button mat-icon-button (click)="clearFile($event)">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                </div>
              </mat-card-content>
              <mat-card-actions align="end">
                <button mat-raised-button color="accent" (click)="sendFile()" 
                        [disabled]="!selectedFile || !connected || uploading">
                  <mat-icon *ngIf="!uploading">upload</mat-icon>
                  <mat-spinner *ngIf="uploading" diameter="20"></mat-spinner>
                  {{ uploading ? 'Enviando...' : 'Enviar Archivo' }}
                </button>
              </mat-card-actions>
            </mat-card>

            <!-- Botón de desconectar -->
            <button mat-stroked-button color="warn" (click)="disconnect()" 
                    [disabled]="!connected" class="disconnect-btn">
              <mat-icon>power_settings_new</mat-icon>
              Desconectar
            </button>

          </div>

          <!-- Columna derecha: Recepción -->
          <div class="right-column">
            
            <!-- Card de mensajes -->
            <mat-card class="card messages-card">
              <mat-card-header>
                <mat-icon mat-card-avatar class="card-icon">forum</mat-icon>
                <mat-card-title>
                  Mensajes Recibidos
                  <mat-chip *ngIf="messages.length > 0" class="count-badge">{{ messages.length }}</mat-chip>
                </mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="messages-container">
                  <mat-list *ngIf="messages.length > 0">
                    <mat-list-item *ngFor="let m of messages; let i = index">
                      <mat-icon matListItemIcon>chat_bubble</mat-icon>
                      <div matListItemTitle>{{ m.type || 'Mensaje' }}</div>
                      <div matListItemLine class="message-content">{{ m.payload | json }}</div>
                    </mat-list-item>
                  </mat-list>
                  <div class="empty-state" *ngIf="messages.length === 0">
                    <mat-icon>inbox</mat-icon>
                    <p>No hay mensajes aún</p>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>

            <!-- Card de archivos -->
            <mat-card class="card files-card">
              <mat-card-header>
                <mat-icon mat-card-avatar class="card-icon success-icon">folder</mat-icon>
                <mat-card-title>
                  Archivos Recibidos
                  <mat-chip *ngIf="receivedFiles.length > 0" class="count-badge success">{{ receivedFiles.length }}</mat-chip>
                </mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="files-container">
                  <div *ngIf="receivedFiles.length > 0" class="files-list">
                    <div *ngFor="let f of receivedFiles" class="file-item-custom">
                      <div class="file-item-content">
                        <mat-icon class="file-type-icon">{{ getFileIcon(f.filename) }}</mat-icon>
                        <div class="file-item-info">
                          <div class="file-title">{{ f.filename }}</div>
                          <div class="file-meta-line">
                            <span class="file-meta">{{ formatBytes(f.size) }}</span>
                            <span class="file-meta-separator">•</span>
                            <span class="file-meta">{{ getTimeAgo(f.timestamp) }}</span>
                          </div>
                        </div>
                      </div>
                      <button mat-mini-fab color="primary" (click)="downloadFile(f)" 
                              class="download-btn" title="Descargar archivo">
                        <mat-icon>download</mat-icon>
                      </button>
                    </div>
                  </div>
                  <div class="empty-state" *ngIf="receivedFiles.length === 0">
                    <mat-icon>cloud_download</mat-icon>
                    <p>No se han recibido archivos</p>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>

          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      background: transparent;
    }

    .toolbar {
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      position: sticky;
      top: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .toolbar-icon {
      margin-right: 12px;
      font-size: 28px;
      height: 28px;
      width: 28px;
    }

    .toolbar-title {
      font-size: 20px;
      font-weight: 500;
    }

    .spacer {
      flex: 1 1 auto;
    }

    .metrics-chips {
      display: flex;
      gap: 12px;
    }

    .metric-chip {
      background-color: rgba(255,255,255,0.2) !important;
      color: white !important;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px !important;
    }

    .metric-chip mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .disconnected-chip {
      background-color: rgba(244, 67, 54, 0.3) !important;
    }

    .status-chip-set {
      margin-left: 12px;
    }

    mat-chip {
      font-weight: 500;
    }

    mat-chip.connected {
      background-color: #4caf50 !important;
      color: white !important;
    }

    mat-chip.disconnected {
      background-color: #f44336 !important;
      color: white !important;
    }

    .content-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .grid-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    @media (max-width: 960px) {
      .grid-container {
        grid-template-columns: 1fr;
      }
    }

    .card {
      margin-bottom: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
    }

    .card-icon {
      background-color: #3f51b5;
      color: white;
    }

    .file-icon {
      background-color: #ff9800 !important;
    }

    .success-icon {
      background-color: #4caf50 !important;
    }

    .full-width {
      width: 100%;
    }

    .file-upload-area {
      border: 2px dashed #ccc;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s;
      background-color: #fafafa;
    }

    .file-upload-area:hover {
      border-color: #3f51b5;
      background-color: #f5f5f5;
    }

    .file-upload-area.file-selected {
      border-color: #4caf50;
      border-style: solid;
      background-color: #e8f5e9;
    }

    .upload-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .upload-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #9e9e9e;
      margin-bottom: 16px;
    }

    .upload-text {
      font-size: 16px;
      font-weight: 500;
      margin: 0;
      color: #424242;
    }

    .upload-subtext {
      font-size: 14px;
      color: #757575;
      margin: 4px 0 0 0;
    }

    .file-info {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .file-icon-large {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #4caf50;
    }

    .file-details {
      flex: 1;
      text-align: left;
    }

    .file-name {
      font-weight: 500;
      margin: 0 0 4px 0;
      color: #212121;
    }

    .file-size {
      margin: 0;
      color: #757575;
      font-size: 14px;
    }

    .disconnect-btn {
      width: 100%;
      height: 48px;
      font-size: 16px;
    }

    .messages-card, .files-card {
      height: 400px;
      display: flex;
      flex-direction: column;
    }

    .messages-card mat-card-content,
    .files-card mat-card-content {
      flex: 1;
      overflow: hidden;
      padding: 0 !important;
    }

    .messages-container, .files-container {
      height: 100%;
      overflow-y: auto;
      padding: 16px;
    }

    .count-badge {
      margin-left: 8px;
      background-color: #3f51b5;
      color: white;
      font-size: 12px;
      min-height: 24px;
      height: 24px;
      padding: 0 8px;
    }

    .count-badge.success {
      background-color: #4caf50;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #9e9e9e;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .empty-state p {
      font-size: 16px;
      margin: 0;
    }

    .message-content {
      font-size: 13px;
      color: #616161;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .files-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .file-item-custom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background: #fafafa;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
      transition: all 0.2s;
    }

    .file-item-custom:hover {
      background: #f5f5f5;
      border-color: #3f51b5;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .file-item-content {
      display: flex;
      align-items: center;
      gap: 16px;
      flex: 1;
      min-width: 0;
    }

    .file-type-icon {
      color: #ff9800;
      font-size: 40px;
      width: 40px;
      height: 40px;
      flex-shrink: 0;
    }

    .file-item-info {
      flex: 1;
      min-width: 0;
    }

    .file-title {
      font-weight: 500;
      color: #212121;
      font-size: 15px;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-meta-line {
      display: flex;
      align-items: center;
    }

    .file-meta {
      font-size: 13px;
      color: #757575;
    }

    .file-meta-separator {
      margin: 0 8px;
      color: #bdbdbd;
    }

    .download-btn {
      flex-shrink: 0;
      transform: scale(0.9);
    }

    .download-btn:hover {
      transform: scale(1);
    }

    mat-spinner {
      display: inline-block;
      margin-right: 8px;
    }

    /* Scrollbar styling */
    .messages-container::-webkit-scrollbar,
    .files-container::-webkit-scrollbar {
      width: 8px;
    }

    .messages-container::-webkit-scrollbar-track,
    .files-container::-webkit-scrollbar-track {
      background: #f1f1f1;
    }

    .messages-container::-webkit-scrollbar-thumb,
    .files-container::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 4px;
    }

    .messages-container::-webkit-scrollbar-thumb:hover,
    .files-container::-webkit-scrollbar-thumb:hover {
      background: #555;
    }
  `]
})
export class WsDemoComponent implements OnInit, OnDestroy {
  messages: WSMessage[] = [];
  receivedFiles: FileMessage[] = [];
  outMsg = '';
  connected = false;
  selectedFile: File | null = null;
  uploading = false;
  metrics: Metrics = { clientsConnected: 0, totalMessages: 0, totalDisconnected: 0 };
  private subMsg?: Subscription;
  private subFiles?: Subscription;
  private subStatus?: Subscription;
  private subMetrics?: Subscription;

  constructor(private ws: WebsocketService) {}

  ngOnInit(): void {
    this.subMsg = this.ws.messages$().subscribe(msg => {
      this.messages.unshift(msg);
    });

    this.subFiles = this.ws.files$().subscribe(file => {
      this.receivedFiles.unshift(file);
      console.log('File received:', file);
    });

    this.subStatus = this.ws.status$().subscribe(state => {
      this.connected = state;
    });

    this.subMetrics = this.ws.getMetrics$().subscribe(metrics => {
      this.metrics = metrics;
      console.log('Metrics updated:', metrics);
    });
  }

  send() {
    if (!this.outMsg) return;
    const message: WSMessage = { type: 'chat', payload: { text: this.outMsg, ts: Date.now() } };
    this.ws.send(message);
    this.outMsg = '';
  }

  onFileSelected(event: any) {
    const file = event.target?.files?.[0];
    if (file) {
      this.selectedFile = file;
      console.log('File selected:', file.name, file.size, 'bytes');
    }
  }

  async sendFile() {
    if (!this.selectedFile) return;
    
    this.uploading = true;
    try {
      await this.ws.sendFile(this.selectedFile);
      console.log('File sent successfully');
      this.selectedFile = null;
      // Resetear el input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Error sending file:', error);
      alert('Error al enviar archivo: ' + error);
    } finally {
      this.uploading = false;
    }
  }

  downloadFile(fileMsg: FileMessage) {
    console.log('Downloading file:', fileMsg.filename, fileMsg.size, 'bytes');
    
    try {
      // Crear un Blob del ArrayBuffer
      const blob = new Blob([fileMsg.data], { type: fileMsg.type });
      console.log('Blob created:', blob.size, 'bytes, type:', blob.type);
      
      // Crear URL temporal
      const url = window.URL.createObjectURL(blob);
      console.log('Blob URL created:', url);
      
      // Crear link temporal y hacer click
      const a = document.createElement('a');
      a.href = url;
      a.download = fileMsg.filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Limpiar después de un momento
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        console.log('Download cleanup complete');
      }, 100);
      
      console.log('Download initiated successfully');
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error al descargar archivo: ' + error);
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const iconMap: { [key: string]: string } = {
      'pdf': 'picture_as_pdf',
      'doc': 'description',
      'docx': 'description',
      'txt': 'text_snippet',
      'jpg': 'image',
      'jpeg': 'image',
      'png': 'image',
      'gif': 'image',
      'svg': 'image',
      'mp4': 'video_library',
      'avi': 'video_library',
      'mov': 'video_library',
      'mp3': 'audio_file',
      'wav': 'audio_file',
      'zip': 'folder_zip',
      'rar': 'folder_zip',
      'xlsx': 'table_chart',
      'xls': 'table_chart',
      'csv': 'table_chart',
      'ppt': 'slideshow',
      'pptx': 'slideshow',
      'json': 'code',
      'js': 'code',
      'ts': 'code',
      'html': 'code',
      'css': 'code'
    };
    return iconMap[ext || ''] || 'insert_drive_file';
  }

  getTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Hace un momento';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} días`;
  }

  clearFile(event: Event) {
    event.stopPropagation();
    this.selectedFile = null;
  }

  disconnect() {
    this.ws.close();
  }

  ngOnDestroy(): void {
    if (this.subMsg) this.subMsg.unsubscribe();
    if (this.subFiles) this.subFiles.unsubscribe();
    if (this.subStatus) this.subStatus.unsubscribe();
    if (this.subMetrics) this.subMetrics.unsubscribe();
  }
}

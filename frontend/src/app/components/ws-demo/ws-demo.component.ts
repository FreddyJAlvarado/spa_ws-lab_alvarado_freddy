import { Component, OnInit, OnDestroy } from '@angular/core';
import { WebsocketService, WSMessage, FileMessage, Metrics } from '../../services/websocket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-ws-demo',
  templateUrl: './ws-demo.component.html',
  styleUrls: ['./ws-demo.component.css']
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
      const blob = new Blob([fileMsg.data], { type: fileMsg.type });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileMsg.filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
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
      'pdf': 'picture_as_pdf', 'doc': 'description', 'docx': 'description',
      'txt': 'text_snippet', 'jpg': 'image', 'jpeg': 'image', 'png': 'image',
      'gif': 'image', 'svg': 'image', 'mp4': 'video_library', 'avi': 'video_library',
      'mov': 'video_library', 'mp3': 'audio_file', 'wav': 'audio_file',
      'zip': 'folder_zip', 'rar': 'folder_zip', 'xlsx': 'table_chart',
      'xls': 'table_chart', 'csv': 'table_chart', 'ppt': 'slideshow',
      'pptx': 'slideshow', 'json': 'code', 'js': 'code', 'ts': 'code',
      'html': 'code', 'css': 'code'
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

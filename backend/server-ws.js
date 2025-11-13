// server-ws.js
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 }, () => {
  console.log('WebSocket server listening on ws://localhost:8080');
});

// Variables de monitoreo
let totalMessages = 0;
let totalDisconnected = 0;

// Función para obtener métricas
function getMetrics() {
  return {
    clientsConnected: wss.clients.size,
    totalMessages: totalMessages,
    totalDisconnected: totalDisconnected
  };
}

// Función para enviar métricas a todos los clientes
function broadcastMetrics() {
  const metrics = getMetrics();
  const metricsMessage = JSON.stringify({
    type: 'metrics',
    payload: metrics
  });
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(metricsMessage);
    }
  });
}

// Monitoreo periódico cada 10 segundos
setInterval(() => {
  const metrics = getMetrics();
  console.log('📊 Métricas actuales:', metrics);
  console.log(`Clientes conectados: ${metrics.clientsConnected}`);
  console.log(`Mensajes totales: ${metrics.totalMessages}`);
  console.log(`Clientes desconectados: ${metrics.totalDisconnected}`);
  console.log('----------------------------');
  broadcastMetrics();
}, 10000);

wss.on('connection', (ws, req) => {
  console.log('🔌 Cliente conectado. Total:', wss.clients.size);
  
  // Enviar métricas actuales al nuevo cliente
  broadcastMetrics();

  ws.on('message', (raw) => {
    // Intentar parsear como JSON primero
    let isJSON = false;
    let msg;
    
    try {
      const textData = raw.toString('utf8');
      msg = JSON.parse(textData);
      isJSON = true;
      console.log('Received JSON:', msg.type || 'unknown type');
    } catch (e) {
      // No es JSON, probablemente es binario
      isJSON = false;
    }

    if (isJSON) {
      // Es un mensaje JSON (puede ser metadata de archivo o mensaje normal)
      if (msg.type === 'file-metadata') {
        // Es metadata de archivo, contar como mensaje
        totalMessages++;
        console.log('📁 File metadata:', msg.payload.filename, '- Total mensajes:', totalMessages);
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(msg));
          }
        });
        // Enviar métricas actualizadas
        broadcastMetrics();
      } else {
        // Es un mensaje normal, agregar info de servidor
        totalMessages++;
        const broadcast = JSON.stringify({
          type: 'broadcast',
          payload: { from: 'server', message: msg.payload, receivedAt: Date.now() }
        });

        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(broadcast);
          }
        });
        
        // Enviar métricas actualizadas
        broadcastMetrics();
      }
    } else {
      // Es binario (archivo) - ya fue contado en metadata
      console.log('📤 Received binary data (file), size:', raw.length, 'bytes');
      
      // Broadcast el archivo binario a todos los clientes
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(raw, { binary: true });
        }
      });
    }
  });

  ws.on('close', () => {
    totalDisconnected++;
    console.log('❌ Cliente desconectado. Conectados:', wss.clients.size, '| Desconectados totales:', totalDisconnected);
    // Enviar métricas actualizadas
    broadcastMetrics();
  });

  ws.on('error', (err) => {
    console.error('WS Error:', err);
  });
});

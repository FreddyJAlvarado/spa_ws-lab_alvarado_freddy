SPA WS Lab - Angular 17 + Node.js (ws) example
==============================================

Estructura:
  /backend   -> servidor WebSocket (Node.js using 'ws')
  /frontend  -> proyecto Angular 17 (esqueleto)

Requisitos:
  - Node.js (>=18 recommended)
  - npm
  - Angular CLI (opcional, para ng serve). You can install globally:
    npm install -g @angular/cli@17

Pasos para ejecutar:

1) Backend (WebSocket server)
  cd backend
  npm install
  npm start
El servidor escuchará en: ws://localhost:8080

2) Frontend (Angular)
  cd frontend
  npm install
  npm start
Esto ejecuta 'ng serve' y abre la app en el navegador (por defecto http://localhost:4200).

Nota:
  - El frontend es un esqueleto mínimo con el servicio Websocket y el componente de demo.
  - Si no deseas instalar Angular CLI globalmente, puedes ejecutar con npx:
      npx ng serve
  - En entornos con cortafuegos o WSL, asegúrate de permitir el puerto 8080.

Archivos clave:
  - backend/server-ws.js
  - frontend/src/app/services/websocket.service.ts
  - frontend/src/app/components/ws-demo/ws-demo.component.ts

Autor: Generado por ChatGPT para Ricardo

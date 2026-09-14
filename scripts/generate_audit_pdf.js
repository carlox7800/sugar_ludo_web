const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Informe Ejecutivo de Auditoría Técnica - Sugar Ludo v9.2.8</title>
  <style>
    @page {
      size: A4;
      margin: 14mm 12mm 14mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #080c16;
      color: #e2e8f0;
      font-size: 11.5px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      page-break-after: always;
      position: relative;
    }
    .page:last-child {
      page-break-after: avoid;
    }
    /* Header & Branding */
    .header {
      border-bottom: 2px solid #00f0ff;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-cube {
      width: 38px;
      height: 38px;
      background: linear-gradient(135deg, #ff007a, #7928ca);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 24px;
      color: #ffffff;
      box-shadow: 0 0 15px rgba(255, 0, 122, 0.4);
    }
    .title-group h1 {
      font-size: 18px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .title-group h1 span {
      color: #00f0ff;
    }
    .title-group p {
      font-size: 9.5px;
      color: #94a3b8;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .meta-box {
      text-align: right;
      font-size: 9px;
      color: #94a3b8;
    }
    .meta-box strong {
      color: #ffffff;
    }
    .badge-version {
      background: rgba(0, 240, 255, 0.15);
      border: 1px solid rgba(0, 240, 255, 0.4);
      color: #00f0ff;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 800;
      display: inline-block;
      margin-top: 3px;
    }

    /* Section Styles */
    .section-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #00f0ff;
      margin: 14px 0 8px 0;
      display: flex;
      align-items: center;
      gap: 8px;
      border-left: 3px solid #00f0ff;
      padding-left: 8px;
    }
    .card {
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 10px;
    }

    /* KPI Grid & Semáforo */
    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .kpi-card {
      background: #0f172a;
      border-radius: 8px;
      padding: 8px 10px;
      text-align: center;
      border: 1px solid rgba(255, 255, 255, 0.07);
    }
    .kpi-status {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 3px 6px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 4px;
    }
    .kpi-title {
      font-size: 11px;
      font-weight: 700;
      color: #ffffff;
    }
    .kpi-desc {
      font-size: 8.5px;
      color: #94a3b8;
      margin-top: 2px;
    }

    /* Status Colors */
    .status-excellent {
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
      border: 1px solid #10b981;
    }
    .status-optimal {
      background: rgba(0, 240, 255, 0.2);
      color: #00f0ff;
      border: 1px solid #00f0ff;
    }
    .status-warning {
      background: rgba(245, 158, 11, 0.2);
      color: #f59e0b;
      border: 1px solid #f59e0b;
    }
    .status-critical {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border: 1px solid #ef4444;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 10px;
    }
    th {
      background: #1e293b;
      color: #00f0ff;
      text-align: left;
      padding: 6px 8px;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 9px;
      border: 1px solid #334155;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #1e293b;
      background: #0f172a;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background: #0b1325;
    }
    .tag-before {
      color: #f87171;
      font-weight: 700;
    }
    .tag-after {
      color: #34d399;
      font-weight: 700;
    }

    /* Highlights & Code */
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      background: rgba(0, 240, 255, 0.1);
      color: #38bdf8;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 9px;
    }
    .highlight-box {
      border-left: 3px solid #10b981;
      background: rgba(16, 185, 129, 0.08);
      padding: 8px 10px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 8px;
      font-size: 10.5px;
    }
    .warning-box {
      border-left: 3px solid #f59e0b;
      background: rgba(245, 158, 11, 0.08);
      padding: 8px 10px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 8px;
      font-size: 10.5px;
    }

    /* Footer */
    .footer {
      border-top: 1px solid #1e293b;
      padding-top: 8px;
      margin-top: 14px;
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
      color: #64748b;
    }
  </style>
</head>
<body>

  <!-- PÁGINA 1: RESUMEN EJECUTIVO Y TABLERO SEMAFÓRICO -->
  <div class="page">
    <div class="header">
      <div class="logo-container">
        <div class="logo-cube">S</div>
        <div class="title-group">
          <h1>SUGAR <span>LUDO</span> ARENA</h1>
          <p>Informe Ejecutivo de Auditoría Técnica y Seguridad</p>
        </div>
      </div>
      <div class="meta-box">
        <div><strong>Versión Auditada:</strong> <span class="badge-version">v9.2.8</span></div>
        <div><strong>Fecha:</strong> Septiembre 2026 • <strong>Entorno:</strong> Producción</div>
        <div><strong>Dictamen:</strong> APROBADO PARA OPERACIÓN</div>
      </div>
    </div>

    <div class="highlight-box">
      <strong>RESUMEN EJECUTIVO:</strong> La versión <strong>v9.2.8</strong> de Sugar Ludo consolida un hito crítico de madurez técnica. Se resolvió la autenticación en ordenadores mediante Google OAuth con enlace profundo (deep link), se redujo el tamaño de los paquetes de descarga excluyendo instaladores anidados, se corrigió la posición de la consola de turnos de la inteligencia artificial sobre el pie de página sin solapar casillas, y se desacopló la página de inicio en un portal estático independiente de costo <strong>$0.00</strong>. Todas las validaciones financieras y jugadas se ejecutan de forma autoritativa en el servidor.
    </div>

    <!-- 1. TABLERO DE CONTROL Y SEMÁFORO -->
    <div class="section-title">1. Tablero de Control y Semáforo de Estados</div>
    <div class="grid-4">
      <div class="kpi-card" style="border-top: 3px solid #10b981;">
        <span class="kpi-status status-excellent">EXCELENTE</span>
        <div class="kpi-title">Autenticación OAuth</div>
        <div class="kpi-desc">Token Google 100% capturado vía IPC en PC y Google Play Services en Android.</div>
      </div>

      <div class="kpi-card" style="border-top: 3px solid #00f0ff;">
        <span class="kpi-status status-optimal">ÓPTIMO</span>
        <div class="kpi-title">Empaquetado y Peso</div>
        <div class="kpi-desc">PC: 248 MB / Android: 47 MB. Sin copias recursivas ni instaladores anidados.</div>
      </div>

      <div class="kpi-card" style="border-top: 3px solid #10b981;">
        <span class="kpi-status status-excellent">EXCELENTE</span>
        <div class="kpi-title">Bóveda Financiera</div>
        <div class="kpi-desc">Deducción de saldo y premios 100% en backend. Cero control en el cliente.</div>
      </div>

      <div class="kpi-card" style="border-top: 3px solid #00f0ff;">
        <span class="kpi-status status-optimal">ÓPTIMO</span>
        <div class="kpi-title">Cuota Spark ($0.00)</div>
        <div class="kpi-desc">Landing 100% estática. Cero llamadas innecesarias a base de datos.</div>
      </div>
    </div>

    <!-- 2. TABLA COMPARATIVA ANTES VS DESPUÉS -->
    <div class="section-title">2. Matriz Comparativa "Antes vs. Después" (Evolución Técnica)</div>
    <table>
      <thead>
        <tr>
          <th style="width: 22%;">Área / Subsistema</th>
          <th style="width: 39%;">Estado Anterior (Problema / Riesgo)</th>
          <th style="width: 39%;">Estado Actual v9.2.8 (Solución Implementada)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Autenticación en PC (Desktop)</strong></td>
          <td><span class="tag-before">FALLO:</span> Se enviaba el token interno de Firebase al deep link. La aplicación de escritorio no podía revalidar la sesión y volvía a pedir iniciar sesión repetidamente.</td>
          <td><span class="tag-after">RESUELTO:</span> Se extrae la credencial OAuth pura de Google (<code>accessToken</code>). <code>main.js</code> almacena el token en un búfer seguro y lo entrega al juego sin fricción.</td>
        </tr>
        <tr>
          <td><strong>Peso de Instaladores</strong></td>
          <td><span class="tag-before">SOBREPESO:</span> El instalador de PC acumulaba versiones anteriores dentro de la carpeta pública, superando 500 MB y generando descargas lentas.</td>
          <td><span class="tag-after">OPTIMIZADO:</span> Regla estricta <code>!out/downloads/**</code> en la configuración. Binarios limpios: PC a <strong>~248 MB</strong> y Android APK a <strong>~47 MB</strong>.</td>
        </tr>
        <tr>
          <td><strong>Tableros e IA (Bots)</strong></td>
          <td><span class="tag-before">INTERFERENCIA:</span> El texto de eventos de la IA se ubicaba en el centro inferior, tapando la base del tablero cuadrado y la punta del hexágono.</td>
          <td><span class="tag-after">AISLADO Y LIMPIO:</span> Anclado flotante sobre el copyright (<code>bottom-16 md:bottom-20</code>). <strong>0 enlaces</strong> con el modo multijugador online.</td>
        </tr>
        <tr>
          <td><strong>Centro de Descargas</strong></td>
          <td><span class="tag-before">ACOPLADO:</span> La página de inicio estaba integrada dentro del código del juego, sobrecargando la carga inicial web.</td>
          <td><span class="tag-after">INDEPENDIENTE:</span> Micro-sitio autónomo <code>sugar-ludo-landing</code> con botones simétricos 1:1, fondo interactivo a 60 FPS y costo <strong>$0.00</strong>.</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <span>Sugar Ludo Arena — Documento Técnico Oficial</span>
      <span>Página 1 de 2</span>
    </div>
  </div>

  <!-- PÁGINA 2: SEGURIDAD, ECONOMÍA Y CONCLUSIÓN -->
  <div class="page">
    <div class="header">
      <div class="logo-container">
        <div class="logo-cube">S</div>
        <div class="title-group">
          <h1>SUGAR <span>LUDO</span> ARENA</h1>
          <p>Auditoría de Seguridad, Economía y Veredicto</p>
        </div>
      </div>
      <div class="meta-box">
        <div><strong>Fecha:</strong> Septiembre 2026</div>
        <div><strong>Clasificación:</strong> Confidencial / Corporativo</div>
      </div>
    </div>

    <!-- 3. AUDITORÍA DE SEGURIDAD Y ECONOMÍA -->
    <div class="section-title">3. Auditoría Crítica de Seguridad y Economía (Dinero Real)</div>

    <div class="card">
      <h3 style="color: #ffffff; font-size: 11px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
        <span style="color: #10b981;">🛡️</span> A. Protección de Balances y Cero Lógica Financiera en Cliente
      </h3>
      <p style="font-size: 10px; color: #cbd5e1; margin-bottom: 6px;">
        <strong>Hallazgo:</strong> En una plataforma de juegos competitivos con dinero real, el riesgo principal es que un usuario intente alterar su saldo modificando variables en la memoria del navegador o cliente local.
      </p>
      <div class="highlight-box" style="margin-bottom: 4px;">
        <strong>Arquitectura Verificada:</strong>
        <ul style="margin-left: 14px; margin-top: 2px; list-style-type: square;">
          <li><strong>Cero saldo en cliente:</strong> El cliente web/PC/móvil es únicamente una vista que refleja el saldo emitido por el servidor. Ninguna función local puede incrementar ni descontar monedas.</li>
          <li><strong>Cobro de entrada y comisiones (Rake):</strong> La deducción del costo de inscripción en partidas competitivas y la acreditación de premios al ganador se procesa de forma atómica en <code>juego-de-servidor</code> y Cloud Functions.</li>
          <li><strong>Bóveda de Cajeros:</strong> Las órdenes P2P de depósito y retiro se canalizan a través de <code>sugar-ludo-admin-hub</code>, requiriendo firma y validación cruzada antes de liberar fondos.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <h3 style="color: #ffffff; font-size: 11px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
        <span style="color: #00f0ff;">🎲</span> B. Dados y Mecánica de Juego 100% Autoritativos (Anti-Cheat)
      </h3>
      <p style="font-size: 10px; color: #cbd5e1; margin-bottom: 4px;">
        <strong>Hallazgo:</strong> En el código de <code>online-game-engine.tsx</code>, el jugador no genera los números del dado localmente. Al pulsar "Lanzar Dado", el cliente emite una solicitud de intención (<code>intent_roll_dice</code>). El servidor genera los números de forma criptográfica y devuelve el evento autoritativo a todos los participantes en la sala.
      </p>
      <p style="font-size: 10px; color: #cbd5e1;">
        <strong>Resultado:</strong> Si un jugador malicioso intenta inyectar números favoritos (ej. sacar 6 repetidamente desde la consola de desarrollo), el servidor rechaza el movimiento por discordancia de turno y estado de partida.
      </p>
    </div>

    <div class="card">
      <h3 style="color: #ffffff; font-size: 11px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
        <span style="color: #fbbf24;">🔐</span> C. Control de Accesos y Roles en Panel de Control (Admin Hub)
      </h3>
      <p style="font-size: 10px; color: #cbd5e1; margin-bottom: 4px;">
        <strong>Hallazgo:</strong> <code>sugar-ludo-admin-hub/middleware.ts</code> protege los puntos de acceso administrativos en el borde (Edge). Las rutas de superadministrador y cajero están estrictamente segmentadas. Las credenciales de servicio maestras residen en variables protegidas de Node.js (<code>FIREBASE_ADMIN_*</code>) inaccesibles para el cliente.
      </p>
    </div>

    <!-- 4. ARQUITECTURA DE DESPLIEGUE -->
    <div class="section-title">4. Mapa de Despliegue y Distribución Activa</div>
    <table>
      <thead>
        <tr>
          <th>Canal / Entorno</th>
          <th>Tecnología</th>
          <th>Ruta / Endpoint</th>
          <th>Costo Operativo</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Juego Web Principal</strong></td>
          <td>Next.js 16 + WebSockets</td>
          <td><code>https://sugar-ludo-web.onrender.com</code></td>
          <td>Plan Free Render</td>
        </tr>
        <tr>
          <td><strong>Centro de Descargas</strong></td>
          <td>Next.js Estático (Export)</td>
          <td><code>sugar-ludo-landing</code> (Static Site)</td>
          <td>$0.00 (Sin BD)</td>
        </tr>
        <tr>
          <td><strong>Servidor de Partidas</strong></td>
          <td>Node.js + Socket.IO</td>
          <td><code>https://juego-de-servidor.onrender.com</code></td>
          <td>Backend Autoritativo</td>
        </tr>
        <tr>
          <td><strong>Panel Administrativo</strong></td>
          <td>Next.js + Firebase Admin</td>
          <td><code>sugar-ludo-admin-hub</code></td>
          <td>RBAC con Roles</td>
        </tr>
        <tr>
          <td><strong>Instalador Windows</strong></td>
          <td>Electron Builder (NSIS)</td>
          <td>GitHub Releases v9.2.8 (248 MB)</td>
          <td>Alojamiento Gratuito</td>
        </tr>
        <tr>
          <td><strong>Aplicación Android</strong></td>
          <td>Capacitor 8 Nativo</td>
          <td>GitHub Releases v9.2.8 (47 MB)</td>
          <td>Alojamiento Gratuito</td>
        </tr>
      </tbody>
    </table>

    <!-- 5. DICTAMEN FINAL -->
    <div class="section-title">5. Conclusión y Veredicto Final de Auditoría</div>
    <div class="highlight-box" style="border-left-color: #00f0ff; background: rgba(0, 240, 255, 0.08);">
      <strong>VEREDICTO: CERTIFICACIÓN APROBADA (ÓPTIMO / PRODUCCIÓN LISTA)</strong><br>
      El sistema Sugar Ludo v9.2.8 presenta una separación ejemplar de responsabilidades: los clientes de juego son ligeros y reactivos, la economía y la física de partidas están blindadas en el servidor, y la infraestructura cumple estrictamente el consumo de <strong>$0.00/mes</strong> en la cuota Spark de Firebase. Se autoriza la distribución pública y el despliegue general.
    </div>

    <div class="footer">
      <span>Sugar Ludo Arena — Documento Técnico Oficial</span>
      <span>Página 2 de 2</span>
    </div>
  </div>

</body>
</html>`;

async function main() {
  console.log('Iniciando renderizado de informe PDF con Puppeteer...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  const outputPath = path.resolve(__dirname, '..', 'informe-auditoria-sugarludo-v9.2.8.pdf');

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0mm',
      bottom: '0mm',
      left: '0mm',
      right: '0mm'
    }
  });

  await browser.close();
  console.log('PDF generado exitosamente en:', outputPath);
}

main().catch(err => {
  console.error('Error al generar PDF:', err);
  process.exit(1);
});

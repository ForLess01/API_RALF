import { groqService } from './services/groq';
import { cerebrasService } from './services/cerebras';
import type { AIService, ChatMessage } from './types';
import { geminiService } from './services/gemini';
import { geminiTwoService } from './services/gemini_two';
import { openrouterService } from './services/openrouter';

const services: AIService[] = [
    groqService,
    cerebrasService,
    geminiService,
    geminiTwoService,
    openrouterService,
];

// State Management
interface ServiceState {
    name: string;
    cooldownUntil: number; // Timestamp when cooldown ends
}

const servicesState: Record<string, ServiceState> = {};
// Initialize state
services.forEach(s => {
    servicesState[s.name] = { name: s.name, cooldownUntil: 0 };
});

let currentServiceIndex = 0;

function getNextHealthyServiceIndex(startIndex: number): number {
    const now = Date.now();
    for (let i = 0; i < services.length; i++) {
        const idx = (startIndex + i) % services.length;
        const service = services[idx]!;
        if (servicesState[service.name]!.cooldownUntil < now) {
            return idx;
        }
    }
    return -1; // All services busy/cooldown
}

function jsonResponse(data: any, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

const server = Bun.serve({
    port: process.env.PORT ?? 3000,
    async fetch(req: Request): Promise<Response> {
        const { pathname } = new URL(req.url);

        // CORS headers
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        // Handle OPTIONS for CORS
        if (req.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers });
        }

        try {
            // Root endpoint - Interactive web UI
            if (pathname === '/' && req.method === 'GET') {
                const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API_RALF - Multi-AI Chat API</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            color: white;
            margin-bottom: 40px;
        }
        .header h1 {
            font-size: 3em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .header p {
            font-size: 1.2em;
            opacity: 0.9;
        }
        .cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .card h2 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 1.5em;
        }
        .endpoint {
            background: #f7f7f7;
            padding: 12px;
            border-radius: 8px;
            margin: 10px 0;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }
        .method {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
            margin-right: 8px;
            font-size: 0.8em;
        }
        .get { background: #61affe; color: white; }
        .post { background: #49cc90; color: white; }
        .service-badge {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            margin: 5px;
            font-size: 0.9em;
        }
        .chat-container {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .chat-messages {
            height: 400px;
            overflow-y: auto;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 15px;
            background: #fafafa;
        }
        .message {
            margin-bottom: 15px;
            padding: 12px;
            border-radius: 8px;
            max-width: 80%;
        }
        .user-message {
            background: #667eea;
            color: white;
            margin-left: auto;
        }
        .ai-message {
            background: #e0e0e0;
            color: #333;
        }
        .input-group {
            display: flex;
            gap: 10px;
        }
        input {
            flex: 1;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 1em;
        }
        button {
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1em;
            font-weight: bold;
            transition: transform 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .status {
            text-align: center;
            padding: 10px;
            border-radius: 8px;
            margin-top: 10px;
            font-size: 0.9em;
        }
        .status.loading {
            background: #fff3cd;
            color: #856404;
        }
        .code-block {
            background: #282c34;
            color: #abb2bf;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.85em;
            margin: 10px 0;
        }
        .footer {
            text-align: center;
            color: white;
            margin-top: 40px;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 API_RALF</h1>
            <p>API de Chat Unificada con Balanceo de Carga Multi-IA</p>
        </div>

        <div class="cards">
            <div class="card">
                <h2>📊 Servicios Activos</h2>
                <p>Balanceo automático entre:</p>
                ${services.map(s => `<span class="service-badge">${s.name}</span>`).join('')}
                <p style="margin-top: 15px; font-size: 0.9em; color: #666;">
                    El sistema distribuye las peticiones usando round-robin
                </p>
            </div>

            <div class="card">
                <h2>🚀 Endpoints</h2>
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span>/health</span>
                </div>
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span>/services</span>
                </div>
                <div class="endpoint">
                    <span class="method post">POST</span>
                    <span>/chat</span>
                </div>
            </div>

            <div class="card">
                <h2>📝 Ejemplo de Uso</h2>
                <div class="code-block">curl -X POST ${server.url}chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Hola!"
      }
    ]
  }'</div>
            </div>
        </div>

        <div class="chat-container">
            <h2 style="color: #667eea; margin-bottom: 20px;">💬 Prueba la API en Vivo</h2>
            <div class="chat-messages" id="messages"></div>
            <div class="input-group">
                <input 
                    type="text" 
                    id="messageInput" 
                    placeholder="Escribe tu mensaje aquí..."
                    onkeypress="if(event.key === 'Enter') sendMessage()"
                />
                <button onclick="sendMessage()" id="sendBtn">Enviar</button>
            </div>
            <div id="status"></div>
        </div>

        <div class="footer">
            <p>Desarrollado con ❤️ usando Bun • En producción con Coolify</p>
        </div>
    </div>

    <script>
        const messagesDiv = document.getElementById('messages');
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const statusDiv = document.getElementById('status');

        function addMessage(content, isUser) {
            const div = document.createElement('div');
            div.className = 'message ' + (isUser ? 'user-message' : 'ai-message');
            div.textContent = content;
            messagesDiv.appendChild(div);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        async function sendMessage() {
            const message = input.value.trim();
            if (!message) return;

            addMessage(message, true);
            input.value = '';
            sendBtn.disabled = true;
            statusDiv.className = 'status loading';
            statusDiv.textContent = '🤖 Procesando...';

            try {
                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [{ role: 'user', content: message }]
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Error en la API');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let aiResponse = '';
                const aiDiv = document.createElement('div');
                aiDiv.className = 'message ai-message';
                messagesDiv.appendChild(aiDiv);

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value);
                    aiResponse += chunk;
                    aiDiv.textContent = aiResponse;
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }

                statusDiv.textContent = '';
            } catch (error) {
                statusDiv.className = 'status';
                statusDiv.style.background = '#f8d7da';
                statusDiv.style.color = '#721c24';
                statusDiv.textContent = '❌ Error: ' + error.message;
                setTimeout(() => statusDiv.textContent = '', 3000);
            } finally {
                sendBtn.disabled = false;
                input.focus();
            }
        }
    </script>
</body>
</html>`;
                return new Response(html, {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }

            // Health check endpoint
            if (pathname === '/health' && req.method === 'GET') {
                return jsonResponse({
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    services: services.length,
                });
            }

            // Services list endpoint
            if (pathname === '/services' && req.method === 'GET') {
                return jsonResponse({
                    total: services.length,
                    current: services[currentServiceIndex]?.name,
                    available: services.map((s, i) => {
                        const state = servicesState[s.name]!;
                        const now = Date.now();
                        const isCooldown = state.cooldownUntil > now;
                        return {
                            name: s.name,
                            index: i,
                            active: i === currentServiceIndex,
                            status: isCooldown ? 'COOLDOWN' : 'READY',
                            cooldownRemaining: isCooldown ? Math.ceil((state.cooldownUntil - now) / 1000) + 's' : '0s'
                        };
                    }),
                });
            }

            // Chat endpoint
            if (req.method === 'POST' && pathname === '/chat') {
                const body = await req.json() as { messages: ChatMessage[] };

                // Validación
                if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
                    return jsonResponse({
                        error: 'Invalid request',
                        message: 'El campo "messages" es requerido y debe ser un array no vacío',
                    }, 400);
                }

                // Validar estructura de mensajes
                for (const msg of body.messages) {
                    if (!msg.role || !msg.content) {
                        return jsonResponse({
                            error: 'Invalid message format',
                            message: 'Cada mensaje debe tener "role" y "content"',
                        }, 400);
                    }
                    if (!['system', 'user', 'assistant'].includes(msg.role)) {
                        return jsonResponse({
                            error: 'Invalid role',
                            message: 'El role debe ser "system", "user" o "assistant"',
                        }, 400);
                    }
                }

                const serviceStartIndex = getNextHealthyServiceIndex(currentServiceIndex);

                // If no services available at all initially
                if (serviceStartIndex === -1) {
                    return new Response(`data: Rate Limit : Todos los servicios están en cooldown (1h)\n\n`, {
                        headers: {
                            ...headers,
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                        },
                    });
                }

                // Update global index for next request to ensure rotation
                currentServiceIndex = (serviceStartIndex + 1) % services.length;

                let attemptIndex = serviceStartIndex;
                let attempts = 0;
                const maxAttempts = services.length;

                while (attempts < maxAttempts) {
                    const service = services[attemptIndex]!;

                    // Double check if healthy (in case it failed in another request just now)
                    if (servicesState[service.name]!.cooldownUntil > Date.now()) {
                        attemptIndex = getNextHealthyServiceIndex(attemptIndex + 1);
                        if (attemptIndex === -1) break; // No more healthy services
                        continue;
                    }

                    console.log(`[${new Date().toISOString()}] Using service: ${service.name} (Attempt ${attempts + 1})`);

                    try {
                        const stream = await service.chat(body.messages);

                        return new Response(stream, {
                            headers: {
                                ...headers,
                                'Content-Type': 'text/event-stream',
                                'Cache-Control': 'no-cache',
                                'Connection': 'keep-alive',
                            },
                        });
                    } catch (error: any) {
                        console.error(`[${new Date().toISOString()}] Error with ${service.name}:`, error);

                        // Check for Rate Limit (429)
                        const isRateLimit = error?.status === 429 ||
                            error?.message?.toLowerCase().includes('rate limit') ||
                            error?.message?.toLowerCase().includes('too many requests') ||
                            error?.message?.includes('429');

                        if (isRateLimit) {
                            console.warn(`⚠️ RATE LIMIT DETECTED for ${service.name}. Enabling 1h Cooldown.`);
                            servicesState[service.name]!.cooldownUntil = Date.now() + (60 * 60 * 1000); // 1 hour

                            // Try next service
                            attemptIndex = getNextHealthyServiceIndex(attemptIndex + 1);
                            if (attemptIndex === -1) break; // No more services
                            attempts++;
                        } else {
                            // Non-rate-limit error: Fail request or try next?
                            // Usually if it's a 500 from provider, we might want to try next too?
                            // For now, let's treat generic errors as fatal for that request unless we want full robustness.
                            // Let's stick to Rate Limit plan.
                            return jsonResponse({
                                error: 'Service error',
                                message: error.message || 'Error executing AI service',
                                service: service.name,
                            }, 500);
                        }
                    }
                }

                // If we exit loop, all services failed or are busy
                console.error(`[${new Date().toISOString()}] All services unavailable or rate limited.`);

                // Fallback valid response for Agent
                return new Response(`data: Rate Limit : Todos los servicios ocupados. Intente más tarde.\n\n`, {
                    headers: {
                        ...headers,
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    },
                });
            }

            // 404 para rutas no encontradas
            return jsonResponse({
                error: 'Not found',
                message: 'Endpoint no encontrado. Visita "/" para ver la documentación',
                availableEndpoints: ['/', '/health', '/services', '/chat'],
            }, 404);

        } catch (error) {
            console.error(`[${new Date().toISOString()}] Server error:`, error);
            return jsonResponse({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Error desconocido',
            }, 500);
        }
    },
});

console.log(`🚀 Server is running on ${server.url}`);
console.log(`📚 API Documentation: ${server.url}`);
console.log(`💚 Health Check: ${server.url}health`);
console.log(`🤖 Services: ${services.map(s => s.name).join(', ')}`);
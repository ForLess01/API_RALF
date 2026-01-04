import { groqService } from './services/groq';
import { cerebrasService } from './services/cerebras';
import type { AIService, ChatMessage } from './types';
import { geminiService } from './services/gemini';

const services: AIService[] = [
    groqService,
    cerebrasService,
    geminiService,
];

let currentServiceIndex = 0;

function getNextService() {
    const service = services[currentServiceIndex];
    currentServiceIndex = (currentServiceIndex + 1) % services.length;
    return service;
}

function jsonResponse(data: any, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

const server = Bun.serve({
    port: process.env.PORT ?? 3000,
    async fetch(req: Request) {
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
            // Root endpoint - API documentation
            if (pathname === '/' && req.method === 'GET') {
                return jsonResponse({
                    name: 'API_RALF',
                    version: '1.0.0',
                    description: 'API de chat unificada con balanceo de carga entre múltiples proveedores de IA',
                    endpoints: {
                        '/': 'Esta documentación',
                        '/health': 'Estado del servidor',
                        '/services': 'Lista de servicios disponibles',
                        '/chat': 'Endpoint principal para chat (POST)',
                    },
                    providers: services.map(s => s.name),
                    usage: {
                        method: 'POST',
                        endpoint: '/chat',
                        body: {
                            messages: [
                                { role: 'user', content: 'Tu mensaje aquí' }
                            ]
                        }
                    },
                    repository: 'https://github.com/tu-usuario/API_RALF',
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
                    available: services.map((s, i) => ({
                        name: s.name,
                        index: i,
                        active: i === currentServiceIndex,
                    })),
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

                const service = getNextService();
                console.log(`[${new Date().toISOString()}] Using service: ${service?.name}`);

                try {
                    const stream = await service?.chat(body.messages);

                    return new Response(stream, {
                        headers: {
                            ...headers,
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                        },
                    });
                } catch (error) {
                    console.error(`[${new Date().toISOString()}] Error with ${service?.name}:`, error);
                    return jsonResponse({
                        error: 'Service error',
                        message: 'Error al procesar la solicitud con el servicio de IA',
                        service: service?.name,
                    }, 500);
                }
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
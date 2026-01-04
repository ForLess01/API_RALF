# API_RALF 🤖

API de chat unificada que implementa balanceo de carga round-robin entre múltiples proveedores de IA (Groq, Cerebras y Google Gemini), construida con Bun.

> 🌐 **En producción**: Este proyecto está desplegado y funcionando en un VPS usando Coolify.

## 🚀 Características

- ✅ **Balanceo de carga automático**: Distribuye las peticiones entre 3 proveedores de IA
- ✅ **Streaming en tiempo real**: Respuestas en streaming mediante Server-Sent Events
- ✅ **API REST simple**: Un solo endpoint `/chat` compatible con formato OpenAI
- ✅ **TypeScript**: Totalmente tipado para mayor seguridad
- ✅ **Alta velocidad**: Construido con Bun para máximo rendimiento
- ✅ **Múltiples modelos**:
  - Groq: `moonshotai/kimi-k2-instruct-0905`
  - Cerebras: `zai-glm-4.6`
  - Google Gemini: `gemini-3-flash-preview`

## 📋 Requisitos Previos

- [Bun](https://bun.sh) >= 1.0
- Claves API de los proveedores (al menos una):
  - [Groq API Key](https://console.groq.com)
  - [Cerebras API Key](https://cloud.cerebras.ai)
  - [Google Gemini API Key](https://makersuite.google.com/app/apikey)

## 🔧 Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd API_RALF
```

2. **Instalar dependencias**
```bash
bun install
```

3. **Configurar variables de entorno**

Crea un archivo `.env` en la raíz del proyecto:

```env
GROQ_API_KEY=tu_clave_groq
CEREBRAS_API_KEY=tu_clave_cerebras
GEMINI_API_KEY=tu_clave_gemini
PORT=3000  # Opcional, por defecto es 3000
```

> ⚠️ **IMPORTANTE**: El archivo `.env` está en `.gitignore` y **nunca debe ser commiteado**. Contiene información sensible.

## 🏃 Uso

### Modo desarrollo (con hot-reload)
```bash
bun run dev
```

### Modo producción
```bash
bun run start
```

El servidor se iniciará en `http://localhost:3000`

## 📡 API Reference

### POST `/chat`

Envía un mensaje y recibe una respuesta en streaming.

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Explica qué es Fibonacci en JavaScript"
    }
  ]
}
```

**Roles válidos:** `"system"`, `"user"`, `"assistant"`

**Response:** 
- Content-Type: `text/event-stream`
- Streaming de texto en tiempo real

**Ejemplo con curl (localhost):**
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Hola, ¿cómo estás?"
      }
    ]
  }'
```

**Ejemplo con curl (producción):**
```bash
# Usando archivo JSON
echo '{
  "messages": [
    {"role": "user", "content": "Explica Fibonacci en JavaScript"}
  ]
}' > request.json

curl -X POST https://tu-dominio.com/chat \
  -H "Content-Type: application/json" \
  -d "@request.json"
```

**Ejemplo con fetch (JavaScript):**
```javascript
// Cambiar la URL según el entorno
const API_URL = 'https://tu-dominio.com/chat'; // Producción
// const API_URL = 'http://localhost:3000/chat'; // Desarrollo

const response = await fetch(API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: '¿Qué es recursión?' }
    ]
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  console.log(chunk); // Imprime cada fragmento de la respuesta
}
```

## 🔄 Balanceo de Carga

El sistema implementa un algoritmo **round-robin** que distribuye las peticiones secuencialmente:

```
Petición 1 → Groq
Petición 2 → Cerebras
Petición 3 → Gemini
Petición 4 → Groq
Petición 5 → Cerebras
...
```

Esto permite:
- Distribuir la carga entre proveedores
- Evitar límites de rate-limiting de un solo proveedor
- Redundancia automática

## 🏗️ Estructura del Proyecto

```
API_RALF/
├── index.ts              # Servidor principal y routing
├── types.ts              # Definiciones TypeScript
├── services/
│   ├── groq.ts          # Implementación Groq
│   ├── cerebras.ts      # Implementación Cerebras
│   └── gemini.ts        # Implementación Gemini
├── package.json
├── tsconfig.json
├── nixpacks.toml        # Configuración para despliegue
└── .env                 # Variables de entorno (no commitear)
```

## 🚢 Deploy en Producción

### Despliegue con Coolify (VPS)

Este proyecto está en producción usando [Coolify](https://coolify.io) en un VPS:

**Pasos para desplegar:**

1. **Conecta tu repositorio Git** a Coolify
2. **Configura las variables de entorno** en el panel de Coolify:
   - `GROQ_API_KEY`
   - `CEREBRAS_API_KEY`
   - `GEMINI_API_KEY`
   - `PORT` (opcional, por defecto 3000)

3. **Coolify detectará automáticamente** el `nixpacks.toml` y:
   - Instalará Bun
   - Ejecutará `bun install`
   - Iniciará el servidor con `bun run start`

4. **Configura el dominio** y SSL (Coolify lo hace automáticamente)

**Ventajas de usar Coolify:**
- ✅ Deploy automático con Git push
- ✅ SSL/HTTPS automático con Let's Encrypt
- ✅ Gestión de logs en tiempo real
- ✅ Monitoreo de recursos
- ✅ Rollback fácil a versiones anteriores

### Alternativas de Despliegue

**Railway:**
1. Conecta tu repositorio a [Railway](https://railway.app)
2. Configura las variables de entorno
3. Railway detectará automáticamente `nixpacks.toml`

## 🛠️ Desarrollo

### Agregar un nuevo proveedor

1. Crear archivo en `services/nombre-proveedor.ts`:
```typescript
import type { AIService, ChatMessage } from '../types';

export const miServicio: AIService = {
  name: 'MiProveedor',
  async chat(messages: ChatMessage[]) {
    // Implementar lógica de streaming
    return (async function* () {
      // yield chunks de respuesta
    })();
  }
};
```

2. Importar y agregar al array en `index.ts`:
```typescript
import { miServicio } from './services/mi-proveedor';

const services: AIService[] = [
  groqService,
  cerebrasService,
  geminiService,
  miServicio, // ← Nuevo servicio
];
```

## 📝 Tipos

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIService {
  name: string;
  chat: (messages: ChatMessage[]) => Promise<AsyncIterable<string>>;
}
```

## 🐛 Troubleshooting

**Error: "Failed to parse JSON"**
- Verifica que el JSON esté correctamente formateado
- En PowerShell, usa comillas simples para el JSON

**Error: No se encuentra el módulo**
- Ejecuta `bun install` nuevamente

**Respuestas vacías**
- Verifica que las API keys sean válidas
- Revisa los logs del servidor para errores específicos

## 📄 Licencia

Este proyecto es privado y no tiene licencia pública.

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

Desarrollado con ❤️ usando [Bun](https://bun.sh)
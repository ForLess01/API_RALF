const server = Bun.serve({
    port: process.env.PORT ?? 3000,
    async fetch(req) {
        return new Response("API Bun is running!, correctly!");
    }
})

console.log(`Server running at ${server.url}:${server.port}`);

// Helper to simulate
export class RateLimitError extends Error {
    status = 429;
    constructor(msg: string) { super(msg); }
}

declare module 'https-proxy-agent' {
  import type { Agent } from 'node:http';

  export class HttpsProxyAgent extends Agent {
    constructor(proxy: string | URL, options?: Record<string, unknown>);
  }
}

// Type definitions for Deno Edge Functions
// These suppress TypeScript errors when editing in VS Code

declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined;
    };
  };
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(
    handler: (request: Request) => Response | Promise<Response>
  ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export { createClient } from "@supabase/supabase-js";
}

declare module "https://esm.sh/stripe@12.18.0?target=deno" {
  export default class Stripe {
    constructor(apiKey: string, config?: any);
    static createFetchHttpClient(): any;
    static createSubtleCryptoProvider(): any;
    webhooks: {
      constructEventAsync(
        payload: string,
        signature: string,
        secret: string,
        tolerance?: number,
        cryptoProvider?: any
      ): Promise<any>;
    };
    subscriptions: {
      retrieve(id: string): Promise<any>;
    };
    checkout: {
      sessions: {
        create(params: any): Promise<any>;
      };
    };
    billingPortal: {
      sessions: {
        create(params: any): Promise<any>;
      };
    };
  }
}

declare module "https://esm.sh/@fal-ai/serverless-client@0.7.3" {
  export function config(options: { credentials: string }): void;
  export function subscribe(endpoint: string, options: any): Promise<any>;
}

export {};

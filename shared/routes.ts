import { z } from 'zod';
import { 
  insertClientSchema, 
  insertAssetSchema, 
  insertLiabilitySchema, 
  insertCashFlowSchema,
  clients,
  assets,
  liabilities,
  cashFlows,
  strategies
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// Response schema for the unified dashboard view
const dashboardResponseSchema = z.object({
  client: z.custom<typeof clients.$inferSelect>(),
  assets: z.array(z.custom<typeof assets.$inferSelect>()),
  liabilities: z.array(z.custom<typeof liabilities.$inferSelect>()),
  cashFlows: z.array(z.custom<typeof cashFlows.$inferSelect>()),
  strategies: z.array(z.custom<typeof strategies.$inferSelect>()),
});

export const api = {
  clients: {
    list: {
      method: 'GET' as const,
      path: '/api/clients' as const,
      responses: {
        200: z.array(z.custom<typeof clients.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/clients/:id' as const,
      responses: {
        200: z.custom<typeof clients.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    dashboard: {
      method: 'GET' as const,
      path: '/api/clients/:id/dashboard' as const,
      responses: {
        200: dashboardResponseSchema,
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/clients' as const,
      input: insertClientSchema,
      responses: {
        201: z.custom<typeof clients.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    generateStrategy: {
      method: 'POST' as const,
      path: '/api/clients/:id/generate-strategy' as const,
      responses: {
        200: z.array(z.custom<typeof strategies.$inferSelect>()),
        404: errorSchemas.notFound,
        500: errorSchemas.internal,
      },
    }
  },
  assets: {
    create: {
      method: 'POST' as const,
      path: '/api/assets' as const,
      input: insertAssetSchema,
      responses: {
        201: z.custom<typeof assets.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  liabilities: {
    create: {
      method: 'POST' as const,
      path: '/api/liabilities' as const,
      input: insertLiabilitySchema,
      responses: {
        201: z.custom<typeof liabilities.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  cashFlows: {
    create: {
      method: 'POST' as const,
      path: '/api/cash-flows' as const,
      input: insertCashFlowSchema,
      responses: {
        201: z.custom<typeof cashFlows.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

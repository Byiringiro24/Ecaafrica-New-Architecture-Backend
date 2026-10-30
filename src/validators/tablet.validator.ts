import { z } from 'zod';

// IPv4 regex pattern
const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

export const createTabletSchema = {
  body: z.object({
    name: z.string().min(1).max(100),
    ip: z.string().regex(ipv4Pattern, 'Invalid IPv4 address'),
    port: z.number().int().min(1024).max(65535).optional().default(5000),
    location: z.string().max(100).optional(),
    notes: z.string().optional(),
    firmware_version: z.string().max(50).optional(),
    os_info: z.string().max(100).optional(),
  }),
};

export const updateTabletSchema = {
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(BigInt),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    ip: z.string().regex(ipv4Pattern, 'Invalid IPv4 address').optional(),
    port: z.number().int().min(1024).max(65535).optional(),
    location: z.string().max(100).optional(),
    notes: z.string().optional(),
    firmware_version: z.string().max(50).optional(),
    os_info: z.string().max(100).optional(),
    is_active: z.boolean().optional(),
  }),
};

export const tabletIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(BigInt),
});

export const listTabletsSchema = {
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10'),
    status: z.enum(['online', 'offline', 'error', 'maintenance']).optional(),
    search: z.string().optional(),
    is_active: z.string().transform(val => val === 'true').optional(),
  }),
};

export const updateTabletStatusSchema = {
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(BigInt),
  }),
  body: z.object({
    status: z.enum(['online', 'offline', 'error', 'maintenance']),
  }),
};

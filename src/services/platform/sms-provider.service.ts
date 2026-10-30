import { Prisma } from "@prisma/client";
import type { sms_providers } from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

type SmsProviderPricing = { unit_cost: Prisma.Decimal; currency: string };

const formatSmsProvider = (record: sms_providers, pricing?: SmsProviderPricing) => ({
  ...record,
  id: record.id.toString(),
  unit_cost: pricing?.unit_cost.toString() ?? "0",
  currency: pricing?.currency.trim() ?? "RWF"
});

const findPricing = async (id: bigint) => {
  const [pricing] = await prisma.$queryRaw<SmsProviderPricing[]>`
    SELECT unit_cost, currency FROM sms_providers WHERE id = ${id}
  `;
  return pricing;
};

export type SmsProviderCreateInput = {
  name: string;
  slug: string;
  api_key_masked?: string | null;
  sender_id?: string | null;
  is_default?: boolean;
  is_active?: boolean;
  priority?: number;
  unit_cost?: number | string;
  currency?: string;
  config?: Prisma.InputJsonValue | null;
};

export type SmsProviderUpdateInput = Partial<SmsProviderCreateInput>;

const clearOtherDefaults = async (excludeId?: bigint) => {
  await prisma.sms_providers.updateMany({
    where: excludeId ? { id: { not: excludeId } } : {},
    data: { is_default: false }
  });
};

export const createSmsProvider = async (input: SmsProviderCreateInput) => {
  try {
    if (input.is_default) {
      await clearOtherDefaults();
    }

    const record = await prisma.sms_providers.create({
      data: {
        name: input.name,
        slug: input.slug,
        api_key_masked: input.api_key_masked ?? null,
        sender_id: input.sender_id ?? null,
        is_default: input.is_default ?? false,
        is_active: input.is_active ?? true,
        priority: input.priority ?? 1,
        config: input.config ?? undefined
      }
    });

    await prisma.$executeRaw`
      UPDATE sms_providers
      SET unit_cost = ${new Prisma.Decimal(input.unit_cost ?? 0)},
          currency = ${input.currency ?? "RWF"}
      WHERE id = ${record.id}
    `;

    return formatSmsProvider(record, await findPricing(record.id));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError("conflict", "SMS provider slug already exists", 409);
    }

    throw error;
  }
};

export const findAllSmsProviders = async (pagination: PaginationParams) => {
  const { page, limit } = pagination;

  const [items, total] = await prisma.$transaction([
    prisma.sms_providers.findMany({
      orderBy: [{ priority: "asc" }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.sms_providers.count()
  ]);

  const pricingRows = await prisma.$queryRaw<Array<SmsProviderPricing & { id: bigint }>>`
    SELECT id, unit_cost, currency FROM sms_providers
  `;
  const pricingMap = new Map(pricingRows.map((row) => [row.id.toString(), row]));

  return {
    data: items.map((item) => formatSmsProvider(item, pricingMap.get(item.id.toString()))),
    meta: { page, limit, total }
  };
};

export const findSmsProviderById = async (id: string) => {
  const record = await prisma.sms_providers.findUnique({
    where: { id: toBigInt(id) }
  });

  if (!record) {
    throw new AppError("not_found", "SMS provider not found", 404);
  }

  return formatSmsProvider(record, await findPricing(record.id));
};

export const findDefaultSmsProvider = async (country?: string) => {
  if (country) {
    const providers = await prisma.sms_providers.findMany({
      where: { is_active: true },
      orderBy: [{ priority: "asc" }, { name: "asc" }]
    });

    const normalizedCountry = country.trim().toLowerCase();
    
    // Try exact match on country string
    let countryProvider = providers.find((provider) => {
      const slug = provider.slug.toLowerCase();
      const name = provider.name.toLowerCase();
      const config = (provider.config ?? {}) as Record<string, unknown>;
      const providerTag =
        typeof config.provider === "string" ? config.provider.toLowerCase() : null;
      const apiType =
        typeof config.api_type === "string" ? config.api_type.toLowerCase() : null;

      return (
        slug.includes(normalizedCountry) ||
        name.includes(normalizedCountry) ||
        providerTag === normalizedCountry ||
        apiType === normalizedCountry
      );
    });

    if (countryProvider) {
      return countryProvider;
    }

    // If country is Rwanda, explicitly look for Rwanda provider
    if (normalizedCountry.includes("rwanda")) {
      countryProvider = providers.find((provider) => {
        const config = (provider.config ?? {}) as Record<string, unknown>;
        const providerTag =
          typeof config.provider === "string" ? config.provider.toLowerCase() : null;
        const apiType =
          typeof config.api_type === "string" ? config.api_type.toLowerCase() : null;
        
        return providerTag === "rwanda" || apiType === "rwanda";
      });
      if (countryProvider) return countryProvider;
    }

    // If country is Uganda, explicitly look for Uganda provider
    if (normalizedCountry.includes("uganda")) {
      countryProvider = providers.find((provider) => {
        const config = (provider.config ?? {}) as Record<string, unknown>;
        const providerTag =
          typeof config.provider === "string" ? config.provider.toLowerCase() : null;
        const apiType =
          typeof config.api_type === "string" ? config.api_type.toLowerCase() : null;
        
        return providerTag === "uganda" || apiType === "uganda";
      });
      if (countryProvider) return countryProvider;
    }
  }

  // Try to find default provider
  const defaultRecord = await prisma.sms_providers.findFirst({
    where: { is_active: true, is_default: true },
    orderBy: { priority: "asc" }
  });

  if (defaultRecord) {
    return defaultRecord;
  }

  // Fallback to first active provider
  return prisma.sms_providers.findFirst({
    where: { is_active: true },
    orderBy: { priority: "asc" }
  });
};

export const updateSmsProvider = async (id: string, input: SmsProviderUpdateInput) => {
  const existing = await prisma.sms_providers.findUnique({
    where: { id: toBigInt(id) }
  });

  if (!existing) {
    throw new AppError("not_found", "SMS provider not found", 404);
  }

  if (input.is_default) {
    await clearOtherDefaults(existing.id);
  }

  const record = await prisma.sms_providers.update({
    where: { id: existing.id },
    data: {
      name: input.name ?? undefined,
      slug: input.slug ?? undefined,
      api_key_masked:
        input.api_key_masked !== undefined ? input.api_key_masked : undefined,
      sender_id: input.sender_id !== undefined ? input.sender_id : undefined,
      is_default: input.is_default ?? undefined,
      is_active: input.is_active ?? undefined,
      priority: input.priority ?? undefined,
      config:
        input.config !== undefined
          ? input.config === null
            ? Prisma.DbNull
            : input.config
          : undefined
    }
  });

  if (input.unit_cost !== undefined || input.currency !== undefined) {
    const currentPricing = await findPricing(record.id);
    await prisma.$executeRaw`
      UPDATE sms_providers
      SET unit_cost = ${new Prisma.Decimal(input.unit_cost ?? currentPricing?.unit_cost ?? 0)},
          currency = ${input.currency ?? currentPricing?.currency.trim() ?? "RWF"}
      WHERE id = ${record.id}
    `;
  }

  return formatSmsProvider(record, await findPricing(record.id));
};

export const deleteSmsProvider = async (id: string) => {
  const existing = await prisma.sms_providers.findUnique({
    where: { id: toBigInt(id) }
  });

  if (!existing) {
    throw new AppError("not_found", "SMS provider not found", 404);
  }

  await prisma.sms_providers.delete({ where: { id: existing.id } });
  return formatSmsProvider(existing);
};

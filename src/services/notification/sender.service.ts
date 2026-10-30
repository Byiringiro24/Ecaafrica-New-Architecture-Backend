import type {
  NotificationChannel,
  NotificationStatus
} from "@prisma/client";
import { NotificationRecipientType, Prisma } from "@prisma/client";
import nodemailer from "nodemailer";
import { env } from "../../configs/env";
import { createQueue, isQueueEnabled, QUEUE_NAMES } from "../../configs/queue";
import { prisma } from "../../database/prisma";
import { NotificationChannel as ChannelConst, NotificationStatus as StatusConst } from "../../constants/enums";
import { AppError } from "../../middleware/errorHandler";
import { logger } from "../../utils/logger";
import { emitNewNotification } from "../../sockets/notification.socket";
import { findDefaultSmsProvider } from "../platform/sms-provider.service";
import { renderTemplate, findTemplateById } from "./template.service";

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const normalizeUgandaPhone = (phone: string) => phone.replace(/[^\d]/g, "").replace(/^256/, "0");

const normalizeRwandaPhone = (phone: string) => {
  const digits = phone.replace(/[^\d]/g, "");
  
  // Remove country code if present and return local format (07xx xxx xxxx)
  if (digits.startsWith("250")) {
    const local = digits.slice(3);
    return local.startsWith("0") ? local : `0${local}`;
  }
  
  if (digits.startsWith("0")) {
    return digits;
  }
  
  // If just 9 digits (7/8/9 prefix), add 0
  if (/^[789]\d{8}$/.test(digits)) {
    return `0${digits}`;
  }
  
  return digits;
};

const appendSmsTimestamp = (message: string) => {
  const now = new Date();
  const date = now.toLocaleDateString("en-GB", {
    timeZone: "Africa/Kampala",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const time = now.toLocaleTimeString("en-GB", {
    timeZone: "Africa/Kampala",
    hour: "2-digit",
    minute: "2-digit"
  });

  const hasDate = /(^|\n)Date:/i.test(message);
  const hasTime = /(^|\n)Time:/i.test(message);

  if (hasDate && hasTime) {
    return message;
  }

  const missingParts = [];
  if (!hasDate) missingParts.push(`Date: ${date}`);
  if (!hasTime) missingParts.push(`Time: ${time}`);

  if (!missingParts.length) {
    return message;
  }

  return `${message}\n${missingParts.join("\n")}`;
};

const getSmsProviderType = (config: Record<string, unknown>) => {
  const providerTag = typeof config.provider === "string" ? config.provider.toLowerCase() : undefined;
  const apiType = typeof config.api_type === "string" ? config.api_type.toLowerCase() : undefined;

  if (providerTag === "rwanda" || apiType === "rwanda") {
    return "rwanda" as const;
  }

  if (providerTag === "uganda" || apiType === "uganda") {
    return "uganda" as const;
  }

  return "uganda" as const;
};

const hasSmtpConfig = Boolean(
  env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM
);

const emailTransport = hasSmtpConfig
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    })
  : null;

let notificationQueue: ReturnType<typeof createQueue> | null = null;
let smsQueue: ReturnType<typeof createQueue> | null = null;

const getNotificationQueue = () => {
  if (!notificationQueue && isQueueEnabled()) {
    notificationQueue = createQueue(QUEUE_NAMES.NOTIFICATION);
  }

  return notificationQueue;
};

const getSmsQueue = () => {
  if (!smsQueue && isQueueEnabled()) {
    smsQueue = createQueue(QUEUE_NAMES.SMS);
  }

  return smsQueue;
};

const formatLog = (record: {
  id: bigint;
  school_id: bigint;
  template_id: bigint | null;
  recipient_type: NotificationRecipientType;
  recipient_id: bigint | null;
  phone: string | null;
  email: string | null;
  channel: NotificationChannel;
  trigger_type: string | null;
  body_en: string | null;
  body_kin: string | null;
  language_sent: string | null;
  status: NotificationStatus;
  provider_id: bigint | null;
  provider_ref: string | null;
  sent_at: Date | null;
  delivered_at: Date | null;
  retry_count: number;
  error_message: string | null;
  created_at: Date;
}) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  template_id: record.template_id ? record.template_id.toString() : null,
  recipient_id: record.recipient_id ? record.recipient_id.toString() : null,
  provider_id: record.provider_id ? record.provider_id.toString() : null
});

const createNotificationLog = async (data: Prisma.notification_logsCreateInput) => {
  const record = await prisma.notification_logs.create({ data });
  return formatLog(record);
};

const dispatchSmsJob = async (_logId: string, payload: SmsJobPayload): Promise<void> => {
  // Fire-and-forget: don't await SMS delivery so attendance logs save instantly.
  // SMS is sent in the background — if it fails, the log is marked FAILED but
  // attendance is already recorded and the live monitor already updated.
  void (async () => {
    try {
      const { processSmsJob } = await import("../../jobs/sms.job");
      await processSmsJob(payload);
    } catch (err) {
      logger.warn({ err, logId: payload.logId }, "Background SMS delivery failed");
    }
  })();
};

const dispatchNotificationJob = async (
  logId: string,
  payload: NotificationJobPayload
) => {
  const queue = getNotificationQueue();
  if (queue) {
    await queue.add("send-notification", payload, {
      jobId: `notification-${logId}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 }
    });
    return;
  }

  const { processNotificationJob } = await import("../../jobs/notification.job");
  await processNotificationJob(payload);
};

export type SmsJobPayload = {
  logId: string;
  recipientPhone: string;
  message: string;
  providerId?: string;
  schoolId: string;
};

export type NotificationJobPayload = {
  logId: string;
  channel: "email" | "in_app";
  to?: string;
  subject?: string;
  body: string;
  recipientId?: string;
  schoolId: string;
  type?: string;
};

export type BulkRecipient = {
  recipient_type: NotificationRecipientType | string;
  recipient_id?: string | number | bigint;
  phone?: string;
  email?: string;
  variables?: Record<string, string | number | boolean>;
};

export const sendSMS = async (
  recipientPhone: string,
  message: string,
  providerId: string | undefined,
  schoolId: string | number | bigint,
  options: {
    recipientType?: NotificationRecipientType | string;
    recipientId?: string | number | bigint;
    templateId?: string | number | bigint;
    triggerType?: string;
  } = {}
) => {
  const school = await prisma.schools.findUnique({
    where: { id: toBigInt(schoolId) },
    select: { country: true }
  });

  // Detect country from phone number if not provided
  const normalizedPhone = recipientPhone.replace(/[^\d+]/g, "");
  let countryFromPhone: string | null = null;
  
  if (normalizedPhone.startsWith("+250") || normalizedPhone.startsWith("250")) {
    countryFromPhone = "Rwanda";
  } else if (normalizedPhone.startsWith("+256") || normalizedPhone.startsWith("256") || normalizedPhone.startsWith("0")) {
    countryFromPhone = "Uganda";
  }

  // Use school country first, then fallback to detected country
  const targetCountry = school?.country ?? countryFromPhone;

  const resolvedProviderId = providerId
    ? toBigInt(providerId)
    : (await findDefaultSmsProvider(targetCountry ?? undefined))?.id;

  if (!resolvedProviderId) {
    throw new AppError("bad_request", "No active SMS provider configured for this region", 400);
  }

  const provider = await prisma.sms_providers.findUnique({
    where: { id: resolvedProviderId }
  });

  if (!provider || !provider.is_active) {
    throw new AppError("bad_request", "SMS provider not available", 400);
  }

  const providerConfig = (provider.config ?? {}) as Record<string, unknown>;
  const providerType = getSmsProviderType(providerConfig);
  const normalizedRecipientPhone =
    providerType === "rwanda"
      ? normalizeRwandaPhone(recipientPhone)
      : normalizeUgandaPhone(recipientPhone);

  const finalizedMessage = appendSmsTimestamp(message);

  const [pricing] = await prisma.$queryRaw<Array<{ unit_cost: Prisma.Decimal; currency: string }>>`
    SELECT unit_cost, currency
    FROM sms_providers
    WHERE id = ${resolvedProviderId}
  `;

  const log = await createNotificationLog({
    school: { connect: { id: toBigInt(schoolId) } },
    template: options.templateId
      ? { connect: { id: toBigInt(options.templateId) } }
      : undefined,
    recipient_type: (options.recipientType ?? "parent") as NotificationRecipientType,
    recipient_id: options.recipientId ? toBigInt(options.recipientId) : null,
    phone: normalizedRecipientPhone,
    channel: ChannelConst.SMS as NotificationChannel,
    trigger_type: options.triggerType ?? null,
    body_en: finalizedMessage,
    status: StatusConst.QUEUED as NotificationStatus,
    provider: { connect: { id: resolvedProviderId } }
  });

  await prisma.$executeRaw`
    UPDATE notification_logs
    SET sms_cost = ${pricing?.unit_cost ?? new Prisma.Decimal(0)},
        sms_currency = ${pricing?.currency?.trim() || "RWF"}
    WHERE id = ${toBigInt(log.id)}
  `;

  await dispatchSmsJob(log.id, {
    logId: log.id,
    recipientPhone: normalizedRecipientPhone,
    message: finalizedMessage,
    providerId: resolvedProviderId.toString(),
    schoolId: String(schoolId)
  });

  return log;
};

export const sendEmail = async (
  to: string,
  subject: string,
  body: string,
  schoolId: string | number | bigint,
  options: {
    recipientType?: NotificationRecipientType | string;
    recipientId?: string | number | bigint;
    templateId?: string | number | bigint;
  } = {}
) => {
  const log = await createNotificationLog({
    school: { connect: { id: toBigInt(schoolId) } },
    template: options.templateId
      ? { connect: { id: toBigInt(options.templateId) } }
      : undefined,
    recipient_type: (options.recipientType ?? "parent") as NotificationRecipientType,
    recipient_id: options.recipientId ? toBigInt(options.recipientId) : null,
    email: to,
    channel: ChannelConst.EMAIL as NotificationChannel,
    body_en: body,
    status: StatusConst.QUEUED as NotificationStatus
  });

  await dispatchNotificationJob(log.id, {
    logId: log.id,
    channel: "email",
    to,
    subject,
    body,
    schoolId: String(schoolId)
  });

  return log;
};

export const sendInApp = async (
  recipientId: string | number | bigint,
  message: string,
  type: string,
  schoolId: string | number | bigint
) => {
  const log = await createNotificationLog({
    school: { connect: { id: toBigInt(schoolId) } },
    recipient_type: type as NotificationRecipientType,
    recipient_id: toBigInt(recipientId),
    channel: ChannelConst.IN_APP as NotificationChannel,
    trigger_type: type,
    body_en: message,
    status: StatusConst.QUEUED as NotificationStatus
  });

  if (log.recipient_id) {
    emitNewNotification(log.recipient_id, log);
  }

  // Keep manually sent in-app messages visible in the Parent App inbox too.
  // Recipient ids are shared across some user tables, so confirm that this
  // recipient is a parent in the same school before creating the app record.
  try {
    const parent = await prisma.parents_guardians.findFirst({
      where: {
        id: toBigInt(recipientId),
        school_id: toBigInt(schoolId)
      },
      select: { id: true }
    });
    if (parent) {
      const title = type
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
      await prisma.parent_app_notifications.create({
        data: {
          parent_id: parent.id,
          school_id: toBigInt(schoolId),
          title,
          body: message,
          type,
          metadata: { source: "notification_service" }
        }
      });
    }
  } catch (error) {
    logger.warn({ error, recipientId, schoolId }, "Could not mirror in-app notification to parent inbox");
  }

  await dispatchNotificationJob(log.id, {
    logId: log.id,
    channel: "in_app",
    body: message,
    recipientId: String(recipientId),
    schoolId: String(schoolId),
    type
  });

  return log;
};

export const sendBulk = async (
  recipientList: BulkRecipient[],
  templateId: string | number | bigint,
  variables: Record<string, string | number | boolean> = {},
  schoolId: string | number | bigint
) => {
  const template = await findTemplateById(schoolId, String(templateId));
  const results = [];

  for (const recipient of recipientList) {
    const mergedVariables = { ...variables, ...(recipient.variables ?? {}) };
    const body = renderTemplate(template.body_en, mergedVariables);
    const phone = recipient.phone;
    const email = recipient.email;

    if (phone) {
      results.push(
        await sendSMS(phone, body, undefined, schoolId, {
          recipientType: recipient.recipient_type,
          recipientId: recipient.recipient_id,
          templateId,
          triggerType: template.trigger_type
        })
      );
    } else if (email) {
      results.push(
        await sendEmail(email, template.name, body, schoolId, {
          recipientType: recipient.recipient_type,
          recipientId: recipient.recipient_id,
          templateId
        })
      );
    } else if (recipient.recipient_id) {
      results.push(
        await sendInApp(recipient.recipient_id, body, recipient.recipient_type, schoolId)
      );
    } else {
      logger.warn({ recipient }, "Skipping bulk recipient without contact info");
    }
  }

  return results;
};

export type NotificationLogFilters = {
  status?: string;
  channel?: string;
  recipient_type?: string;
  from?: string | Date;
  to?: string | Date;
};

export const findNotificationLogs = async (
  schoolId: string | number | bigint,
  pagination: { page: number; limit: number },
  filters: NotificationLogFilters = {}
) => {
  const { page, limit } = pagination;
  const where: Prisma.notification_logsWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.status) {
    where.status = filters.status as NotificationStatus;
  }

  where.channel = (filters.channel ?? ChannelConst.SMS) as NotificationChannel;

  if (filters.recipient_type) {
    where.recipient_type = filters.recipient_type as NotificationRecipientType;
  }

  if (filters.from || filters.to) {
    where.created_at = {};
    if (filters.from) {
      where.created_at.gte =
        filters.from instanceof Date ? filters.from : new Date(filters.from);
    }
    if (filters.to) {
      where.created_at.lte =
        filters.to instanceof Date ? filters.to : new Date(filters.to);
    }
  }

  const [items, total, sent, failed, pending] = await prisma.$transaction([
    prisma.notification_logs.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.notification_logs.count({ where }),
    prisma.notification_logs.count({
      where: { ...where, status: { in: [StatusConst.SENT, StatusConst.DELIVERED] } }
    }),
    prisma.notification_logs.count({ where: { ...where, status: StatusConst.FAILED } }),
    prisma.notification_logs.count({
      where: { ...where, status: { in: [StatusConst.QUEUED, StatusConst.RETRY] } }
    })
  ]);

  const recipientIds = items
    .filter((item) => item.recipient_type === NotificationRecipientType.parent && item.recipient_id)
    .map((item) => item.recipient_id as bigint);

  const parents = recipientIds.length
    ? await prisma.parents_guardians.findMany({
        where: { id: { in: recipientIds } },
        select: { id: true, first_name: true, last_name: true }
      })
    : [];

  const parentMap = new Map(
    parents.map((parent) => [
      parent.id.toString(),
      [parent.first_name, parent.last_name].filter(Boolean).join(" ").trim()
    ])
  );

  return {
    data: items.map((item) => ({
      ...formatLog(item),
      recipient_name:
        item.recipient_type === NotificationRecipientType.parent && item.recipient_id
          ? parentMap.get(item.recipient_id.toString()) ?? null
          : null
    })),
    meta: {
      page,
      limit,
      total,
      summary: {
        totalSms: total,
        sent,
        failed,
        pending
      }
    }
  };
};

export const deliverEmail = async (to: string, subject: string, body: string) => {
  if (!emailTransport || !env.SMTP_FROM) {
    logger.warn({ to }, "SMTP is not configured; skipping deliverEmail");
    return;
  }

  await emailTransport.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text: body
  });
};

type SmsTokenCacheEntry = {
  token: string;
  expiresAt: number;
};

const smsTokenCache = new Map<string, SmsTokenCacheEntry>();

const getTokenValue = (payload: Record<string, unknown>) => {
  const token =
    payload.access_token ??
    payload.accessToken ??
    payload.token ??
    payload.token_value;

  return typeof token === "string" ? token : null;
};

const getExpiresIn = (payload: Record<string, unknown>) => {
  const raw = payload.expires_in ?? payload.expiresIn;
  const value = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  return Number.isFinite(value) ? value : 3600;
};

const getMtnAccessToken = async (
  providerKey: string,
  config: {
    token_url?: string;
    tokenUrl?: string;
    client_id?: string;
    clientId?: string;
    client_secret?: string;
    clientSecret?: string;
    scope?: string;
    token_headers?: Record<string, string>;
    token_body?: Record<string, unknown>;
    token_body_format?: "json" | "form";
  }
) => {
  const cached = smsTokenCache.get(providerKey);
  if (cached && cached.expiresAt > Date.now() + 30000) {
    return cached.token;
  }

  const tokenUrl =
    config.token_url ??
    config.tokenUrl ??
    "https://api.mtn.com/v1/oauth/access_token/accesstoken?grant_type=client_credentials";
  const clientId = config.client_id ?? config.clientId;
  const clientSecret = config.client_secret ?? config.clientSecret;

  if (!clientId || !clientSecret) {
    throw new AppError("bad_request", "SMS provider auth is missing", 400);
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(config.token_headers ?? {})
  };

  const hasAuthHeader = Object.keys(headers).some(
    (key) => key.toLowerCase() === "authorization"
  );

  if (!hasAuthHeader) {
    headers.Authorization = `Basic ${Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString("base64")}`;
  }

  let body: string | undefined;
  if (config.token_body) {
    if (config.token_body_format === "form") {
      const params = new URLSearchParams();
      Object.entries(config.token_body).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = params.toString();
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(config.token_body);
    }
  } else {
    const params = new URLSearchParams();
    params.set("grant_type", "client_credentials");
    if (config.scope) {
      params.set("scope", config.scope);
    }
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = params.toString();
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers,
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `SMS token request failed with ${response.status}: ${errorText || "unknown error"}`
    );
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const token = getTokenValue(payload);

  if (!token) {
    throw new Error("SMS token response missing access token");
  }

  const expiresIn = getExpiresIn(payload);
  smsTokenCache.set(providerKey, {
    token,
    expiresAt: Date.now() + expiresIn * 1000
  });

  return token;
};

export const deliverSms = async (
  recipientPhone: string,
  message: string,
  providerId: string,
  options: {
    clientCorrelatorId?: string;
  } = {}
) => {
  const provider = await prisma.sms_providers.findUnique({
    where: { id: toBigInt(providerId) }
  });

  if (!provider || !provider.is_active) {
    throw new AppError("bad_request", "SMS provider not available", 400);
  }

  const config = (provider.config ?? {}) as Record<string, unknown>;
  const resolvedConfig = config as {
    provider?: string;
    api_type?: string;
    base_url?: string;
    baseUrl?: string;
    outbound_url?: string;
    outboundUrl?: string;
    token_url?: string;
    tokenUrl?: string;
    client_id?: string;
    clientId?: string;
    client_secret?: string;
    clientSecret?: string;
    scope?: string;
    service_code?: string;
    serviceCode?: string;
    sender_address?: string;
    senderAddress?: string;
    sender_id?: string;
    keyword?: string;
    request_delivery_receipt?: boolean | string;
    token_headers?: Record<string, string>;
    token_body?: Record<string, unknown>;
    token_body_format?: "json" | "form";
    headers?: Record<string, string>;
    endpoint?: string;
    path?: string;
    user?: string;
    username?: string;
    password?: string;
    sender?: string;
    senderId?: string;
    api_key?: string;
    apiKey?: string;
    token?: string;
    access_token?: string;
    bearer_token?: string;
    auth_token?: string;
    authToken?: string;
    api_secret?: string;
    apiSecret?: string;
    secret?: string;
    x_api_secret?: string;
  };

  const providerType = getSmsProviderType(resolvedConfig);
  const sender =
    resolvedConfig.sender ??
    resolvedConfig.sender_id ??
    resolvedConfig.senderId ??
    provider.sender_id ??
    env.SMS_UGANDA_SENDER ??
    "EducationCare";

  if (providerType === "rwanda") {
    const baseUrl =
      resolvedConfig.base_url ??
      resolvedConfig.baseUrl ??
      "https://smsconnect.tech/api/v1";
    const endpoint =
      resolvedConfig.endpoint ??
      resolvedConfig.path ??
      "/sms/send";
    // Remove leading slash if present to properly append to baseUrl
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
    const url = new URL(`${baseUrl.replace(/\/$/, "")}/${cleanEndpoint}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(resolvedConfig.headers ?? {}) as Record<string, string>
    };

    const bearerToken =
      resolvedConfig.api_key ??
      resolvedConfig.apiKey ??
      resolvedConfig.token ??
      resolvedConfig.access_token ??
      resolvedConfig.bearer_token ??
      resolvedConfig.auth_token ??
      resolvedConfig.authToken;

    if (!bearerToken) {
      throw new AppError("bad_request", "SMS provider auth is missing", 400);
    }

    headers.Authorization = `Bearer ${String(bearerToken)}`;

    const apiSecret =
      resolvedConfig.api_secret ??
      resolvedConfig.apiSecret ??
      resolvedConfig.secret ??
      resolvedConfig.x_api_secret ??
      resolvedConfig.apiSecret;

    if (apiSecret) {
      headers["X-API-SECRET"] = String(apiSecret);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(url.toString(), {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        recipient: normalizeRwandaPhone(recipientPhone),
        message,
        ...(sender ? { sender_id: String(sender) } : {})
      })
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `SMS provider responded with ${response.status}: ${errorText || "unknown error"}`
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const providerRef =
      payload?.data && typeof payload.data === "object" &&
      (payload.data as Record<string, unknown>).message_id
        ? String((payload.data as Record<string, unknown>).message_id)
        : String(Date.now());

    return providerRef;
  }

  const apiUrl =
    resolvedConfig.base_url ??
    resolvedConfig.baseUrl ??
    env.SMS_UGANDA_API_URL ??
    "http://text.emediauganda.com/api.php";
  const username = resolvedConfig.user ?? resolvedConfig.username ?? env.SMS_UGANDA_USER;
  const password = resolvedConfig.password ?? env.SMS_UGANDA_PASSWORD;

  if (!username || !password) {
    throw new AppError("bad_request", "SMS provider auth is missing", 400);
  }

  const url = new URL(apiUrl);
  url.searchParams.set("user", username);
  url.searchParams.set("password", password);
  url.searchParams.set("sender", sender);
  url.searchParams.set("message", message);
  url.searchParams.set("reciever", normalizeUgandaPhone(recipientPhone));

  const ugandaController = new AbortController();
  const ugandaTimer = setTimeout(() => ugandaController.abort(), 10_000);
  const response = await fetch(url.toString(), { method: "GET", signal: ugandaController.signal });
  clearTimeout(ugandaTimer);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `SMS provider responded with ${response.status}: ${errorText || "unknown error"}`
    );
  }

  return `emedia-${Date.now()}`;
};

export const updateLogStatus = async (
  logId: string,
  status: NotificationStatus,
  options: {
    providerRef?: string;
    errorMessage?: string;
    incrementRetry?: boolean;
  } = {}
) => {
  const now = new Date();
  const data: Prisma.notification_logsUpdateInput = {
    status,
    error_message: options.errorMessage ?? null,
    provider_ref: options.providerRef ?? undefined,
    retry_count: options.incrementRetry ? { increment: 1 } : undefined
  };

  if (status === StatusConst.SENT || status === StatusConst.DELIVERED) {
    data.sent_at = now;
  }

  if (status === StatusConst.DELIVERED) {
    data.delivered_at = now;
  }

  const record = await prisma.notification_logs.update({
    where: { id: toBigInt(logId) },
    data
  });

  return formatLog(record);
};

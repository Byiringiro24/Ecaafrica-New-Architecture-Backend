import type {
  AnnouncementStatus,
  AnnouncementTargetScope,
  AnnouncementType,
  Prisma,
  announcements
} from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";

type AnnouncementCreateInput = {
  title: string;
  body: string;
  type?: string;
  target_scope?: string;
  target_values?: Prisma.InputJsonValue | null;
  status?: string;
  scheduled_at?: string | Date | null;
  sent_at?: string | Date | null;
  send_inapp?: boolean;
  send_email?: boolean;
  created_by?: string | number | bigint | null;
};

type AnnouncementUpdateInput = Partial<AnnouncementCreateInput>;

type AnnouncementFilters = {
  status?: string;
  type?: string;
  target_scope?: string;
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(value);
  }

  return BigInt(value);
};

const toDateValue = (value: string | Date | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
};

const formatAnnouncement = (announcement: announcements) => ({
  ...announcement,
  id: announcement.id.toString(),
  created_by: announcement.created_by ? announcement.created_by.toString() : null
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "updated_at", "scheduled_at", "sent_at"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.announcementsOrderByWithRelationInput;
  }

  return { created_at: "desc" } as Prisma.announcementsOrderByWithRelationInput;
};

export const createAnnouncement = async (input: AnnouncementCreateInput) => {
  const created = await prisma.announcements.create({
    data: {
      title: input.title,
      body: input.body,
      type: (input.type as AnnouncementType) ?? undefined,
      target_scope: (input.target_scope as AnnouncementTargetScope) ?? undefined,
      target_values: input.target_values ?? undefined,
      status: (input.status as AnnouncementStatus) ?? undefined,
      scheduled_at: toDateValue(input.scheduled_at) ?? undefined,
      sent_at: toDateValue(input.sent_at) ?? undefined,
      send_inapp: input.send_inapp ?? undefined,
      send_email: input.send_email ?? undefined,
      created_by:
        input.created_by !== undefined && input.created_by !== null
          ? toBigInt(input.created_by)
          : undefined
    }
  });

  return formatAnnouncement(created);
};

export const findAllAnnouncements = async (
  pagination: PaginationParams,
  filters: AnnouncementFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.announcementsWhereInput = {};

  if (filters.status) where.status = filters.status as AnnouncementStatus;
  if (filters.type) where.type = filters.type as AnnouncementType;
  if (filters.target_scope) {
    where.target_scope = filters.target_scope as AnnouncementTargetScope;
  }

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { body: { contains: q, mode: "insensitive" } }
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.announcements.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.announcements.count({ where })
  ]);

  return {
    data: items.map((item) => formatAnnouncement(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findAnnouncementById = async (id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid announcement id", 400);
  }

  const announcement = await prisma.announcements.findFirst({
    where: { id: toBigInt(id) }
  });

  if (!announcement) {
    throw new AppError("not_found", "Announcement not found", 404);
  }

  return formatAnnouncement(announcement);
};

export const updateAnnouncement = async (id: string, input: AnnouncementUpdateInput) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid announcement id", 400);
  }

  const existing = await prisma.announcements.findFirst({
    where: { id: toBigInt(id) }
  });

  if (!existing) {
    throw new AppError("not_found", "Announcement not found", 404);
  }

  const updated = await prisma.announcements.update({
    where: { id: existing.id },
    data: {
      title: input.title ?? undefined,
      body: input.body ?? undefined,
      type: input.type ? (input.type as AnnouncementType) : undefined,
      target_scope: input.target_scope
        ? (input.target_scope as AnnouncementTargetScope)
        : undefined,
      target_values: input.target_values ?? undefined,
      status: input.status ? (input.status as AnnouncementStatus) : undefined,
      scheduled_at: toDateValue(input.scheduled_at),
      sent_at: toDateValue(input.sent_at),
      send_inapp: input.send_inapp ?? undefined,
      send_email: input.send_email ?? undefined
    }
  });

  return formatAnnouncement(updated);
};

export const deleteAnnouncement = async (id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid announcement id", 400);
  }

  const existing = await prisma.announcements.findFirst({
    where: { id: toBigInt(id) }
  });

  if (!existing) {
    throw new AppError("not_found", "Announcement not found", 404);
  }

  const deleted = await prisma.announcements.delete({
    where: { id: existing.id }
  });

  return formatAnnouncement(deleted);
};

export const markAnnouncementRead = async (input: {
  announcement_id: string | number | bigint;
  school_id: string | number | bigint;
  user_id?: string | number | bigint | null;
}) => {
  const read = await prisma.announcement_reads.upsert({
    where: {
      announcement_id_school_id: {
        announcement_id: toBigInt(input.announcement_id),
        school_id: toBigInt(input.school_id)
      }
    },
    update: {
      user_id:
        input.user_id !== undefined && input.user_id !== null
          ? toBigInt(input.user_id)
          : undefined,
      read_at: new Date()
    },
    create: {
      announcement_id: toBigInt(input.announcement_id),
      school_id: toBigInt(input.school_id),
      user_id:
        input.user_id !== undefined && input.user_id !== null
          ? toBigInt(input.user_id)
          : null
    }
  });

  return {
    ...read,
    id: read.id.toString(),
    announcement_id: read.announcement_id.toString(),
    school_id: read.school_id.toString(),
    user_id: read.user_id ? read.user_id.toString() : null
  };
};

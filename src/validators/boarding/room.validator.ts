import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);
const capacityInput = z.number().int().min(1).max(32767);

export const dormRoomIdParamSchema = z.object({
  id: z.string().min(1)
});

const createDormRoomBodySchema = z.object({
  dormitory_id: idInput,
  room_number: z.string().min(1),
  capacity: capacityInput.optional()
});

const updateDormRoomBodySchema = z
  .object({
    dormitory_id: idInput.optional(),
    room_number: z.string().min(1).optional(),
    capacity: capacityInput.optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listDormRoomsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  dormitory_id: z.string().optional()
});

export const createDormRoomSchema = z.object({
  body: createDormRoomBodySchema
});

export const updateDormRoomSchema = z.object({
  params: dormRoomIdParamSchema,
  body: updateDormRoomBodySchema
});

export const listDormRoomsSchema = z.object({
  query: listDormRoomsQuerySchema
});

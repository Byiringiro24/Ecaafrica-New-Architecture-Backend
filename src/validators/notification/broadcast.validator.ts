import { z } from "zod";

const idString = z.string().regex(/^\d+$/, "Invalid id");

const audienceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all") }),
  z.object({ type: z.literal("class"), class_id: idString }),
  z.object({ type: z.literal("section"), section_id: idString }),
  z.object({
    type: z.literal("students"),
    student_ids: z.array(idString).min(1).max(500)
  })
]);

export const parentBroadcastSchema = z.object({
  title: z.string().trim().min(3).max(255),
  body: z.string().trim().min(3).max(2000),
  audience: audienceSchema
});

export const parentBroadcastPreviewSchema = z.object({
  audience: audienceSchema
});

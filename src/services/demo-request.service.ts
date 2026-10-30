import { prisma } from "../database/prisma";
import { deliverEmail } from "./notification/sender.service";
import { logger } from "../utils/logger";

export const createDemoRequest = async (input: any) => {
  const request = await prisma.demo_requests.create({
    data: {
      school_name: input.schoolName,
      country: input.country,
      country_code: input.countryCode,
      phone_country_code: input.phoneCountryCode,
      contact_name: input.contactName,
      job_title: input.jobTitle,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
      student_count: input.studentCount,
      teacher_count: input.teacherCount,
      staff_count: input.staffCount,
      has_current_system: input.hasCurrentSystem === "yes",
      current_software: input.currentSoftware || null,
      modules: input.modules,
      preferred_date: input.preferredDate || null,
      preferred_time: input.preferredTime || null,
      additional_details: input.additionalDetails || null,
      consent: input.consent
    }
  });

  const body = `Hello ${request.contact_name},\n\nThank you for requesting a demo of Education Care Africa for ${request.school_name}. Our team has received your request and will contact you shortly.\n\nRequest ID: ${request.id}\nPreferred date: ${request.preferred_date || "Not specified"}\nPreferred time: ${request.preferred_time || "Not specified"}\n\nRegards,\nEducation Care Africa`;
  try {
    await deliverEmail(request.email, "We received your demo request", body);
  } catch (error) {
    logger.error({ error, demoRequestId: request.id, email: request.email }, "Demo request confirmation email failed");
  }
  return format(request);
};

export const listDemoRequests = async () => {
  const requests = await prisma.demo_requests.findMany({ orderBy: { created_at: "desc" } });
  return requests.map(format);
};

export const updateDemoRequest = async (id: string, status: string) => {
  return format(await prisma.demo_requests.update({ where: { id }, data: { status } }));
};

export const deleteDemoRequest = async (id: string) => {
  await prisma.demo_requests.delete({ where: { id } });
};

const format = (request: any) => ({
  id: request.id,
  createdAt: request.created_at.toISOString(),
  updatedAt: request.updated_at.toISOString(),
  status: request.status,
  schoolName: request.school_name,
  country: request.country,
  countryCode: request.country_code,
  phoneCountryCode: request.phone_country_code,
  contactName: request.contact_name,
  jobTitle: request.job_title,
  phone: request.phone,
  whatsapp: request.whatsapp,
  email: request.email,
  studentCount: request.student_count,
  teacherCount: request.teacher_count,
  staffCount: request.staff_count,
  hasCurrentSystem: request.has_current_system ? "yes" : "no",
  currentSoftware: request.current_software || "",
  modules: request.modules,
  preferredDate: request.preferred_date || "",
  preferredTime: request.preferred_time || "",
  additionalDetails: request.additional_details || "",
  consent: request.consent
});

import { UserRole } from "@prisma/client";
import { prisma } from "../database/prisma";

const subjectSeeds = ["Mathematics", "English", "Biology", "Chemistry", "History"];

const periodSeeds = [
  { name: "Period 1", start: "08:00", end: "08:45", sort: 1 },
  { name: "Period 2", start: "08:50", end: "09:35", sort: 2 },
  { name: "Break", start: "09:35", end: "09:55", sort: 3, is_break: true },
  { name: "Period 3", start: "10:00", end: "10:45", sort: 4 },
  { name: "Period 4", start: "10:50", end: "11:35", sort: 5 }
];

const buildTime = (value: string) => new Date(`1970-01-01T${value}:00Z`);

export const seedAcademic = async () => {
  const schools = await prisma.schools.findMany({ where: { deleted_at: null } });

  for (const school of schools) {
    const teachers = await prisma.users.findMany({
      where: { school_id: school.id, role: UserRole.teacher }
    });

    const sections = await prisma.sections.findMany({
      where: { school_id: school.id }
    });

    const subjects = [];
    for (const name of subjectSeeds) {
      const existing = await prisma.subjects.findFirst({
        where: { school_id: school.id, name }
      });

      const subject = existing
        ? await prisma.subjects.update({
            where: { id: existing.id },
            data: { name }
          })
        : await prisma.subjects.create({
            data: {
              school_id: school.id,
              name
            }
          });

      subjects.push(subject);
    }

    const periods = [];
    for (const period of periodSeeds) {
      const existing = await prisma.timetable_periods.findFirst({
        where: { school_id: school.id, name: period.name }
      });

      const data = {
        school_id: school.id,
        name: period.name,
        start_time: buildTime(period.start),
        end_time: buildTime(period.end),
        is_break: Boolean(period.is_break),
        sort_order: period.sort
      };

      const record = existing
        ? await prisma.timetable_periods.update({
            where: { id: existing.id },
            data
          })
        : await prisma.timetable_periods.create({ data });

      periods.push(record);
    }

    if (teachers.length && sections.length && subjects.length && periods.length) {
      const teacher = teachers[0];
      const section = sections[0];

      for (let day = 1; day <= 5; day += 1) {
        const subject = subjects[(day - 1) % subjects.length];
        const period = periods[(day - 1) % periods.length];

        const existing = await prisma.timetable_slots.findFirst({
          where: {
            school_id: school.id,
            section_id: section.id,
            subject_id: subject.id,
            teacher_id: teacher.id,
            period_id: period.id,
            day_of_week: day
          }
        });

        if (!existing) {
          await prisma.timetable_slots.create({
            data: {
              school_id: school.id,
              section_id: section.id,
              subject_id: subject.id,
              teacher_id: teacher.id,
              period_id: period.id,
              day_of_week: day
            }
          });
        }
      }
    }

    const holidaySeeds = [
      { name: "Founders Day", start: "2024-10-10", end: "2024-10-10" },
      { name: "Midterm Break", start: "2025-02-14", end: "2025-02-18" }
    ];

    for (const holiday of holidaySeeds) {
      const existing = await prisma.holidays.findFirst({
        where: { school_id: school.id, name: holiday.name }
      });

      const data = {
        school_id: school.id,
        name: holiday.name,
        start_date: new Date(holiday.start),
        end_date: new Date(holiday.end)
      };

      if (existing) {
        await prisma.holidays.update({ where: { id: existing.id }, data });
      } else {
        await prisma.holidays.create({ data });
      }
    }
  }
};

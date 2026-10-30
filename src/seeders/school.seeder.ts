import {
  BillingCycle,
  SchoolStatus,
  SchoolSubscriptionStatus,
  SchoolType
} from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../database/prisma";

const schoolSeeds = [
  {
    name: "Nexus Demo School",
    province: "Kigali",
    district: "Gasabo",
    school_type: SchoolType.private,
    has_boarding: true,
    has_biometrics: true,
    has_gate: true,
    has_visitor_mgmt: true,
    has_exam_system: true,
    has_salary_mgmt: true,
    has_parent_app: true
  },
  {
    name: "Ecare Africa Pilot",
    province: "Northern",
    district: "Musanze",
    school_type: SchoolType.government,
    has_boarding: false,
    has_biometrics: true,
    has_gate: true,
    has_visitor_mgmt: true,
    has_exam_system: true,
    has_salary_mgmt: false,
    has_parent_app: true
  }
];

const ensureSchool = async (seed: typeof schoolSeeds[number], planId: bigint) => {
  const existing = await prisma.schools.findFirst({
    where: { name: seed.name }
  });

  const data = {
    uuid: existing?.uuid ?? uuidv4(),
    name: seed.name,
    province: seed.province,
    district: seed.district,
    school_type: seed.school_type,
    status: SchoolStatus.trial,
    subscription_plan_id: planId,
    has_boarding: seed.has_boarding,
    has_biometrics: seed.has_biometrics,
    has_gate: seed.has_gate,
    has_visitor_mgmt: seed.has_visitor_mgmt,
    has_exam_system: seed.has_exam_system,
    has_salary_mgmt: seed.has_salary_mgmt,
    has_parent_app: seed.has_parent_app,
    has_bulk_sms: true
  };

  if (existing) {
    return prisma.schools.update({ where: { id: existing.id }, data });
  }

  return prisma.schools.create({ data });
};

const ensureSubscription = async (schoolId: bigint, planId: bigint, amount: string) => {
  const existing = await prisma.school_subscriptions.findFirst({
    where: { school_id: schoolId, plan_id: planId }
  });

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setFullYear(endsAt.getFullYear() + 1);

  const data = {
    school_id: schoolId,
    plan_id: planId,
    billing_cycle: BillingCycle.annual,
    amount,
    currency: "RWF",
    status: SchoolSubscriptionStatus.trial,
    starts_at: startsAt,
    ends_at: endsAt,
    trial_ends_at: new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000)
  };

  if (existing) {
    return prisma.school_subscriptions.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.school_subscriptions.create({ data });
};

const ensureAcademicYear = async (schoolId: bigint, name: string) => {
  const startDate = new Date("2024-09-01");
  const endDate = new Date("2025-07-15");

  return prisma.academic_years.upsert({
    where: { school_id_name: { school_id: schoolId, name } },
    update: {
      start_date: startDate,
      end_date: endDate,
      is_current: true
    },
    create: {
      school_id: schoolId,
      name,
      start_date: startDate,
      end_date: endDate,
      is_current: true
    }
  });
};

const ensureTerms = async (schoolId: bigint, academicYearId: bigint) => {
  const termSeeds = [
    { name: "Term 1", start: "2024-09-01", end: "2024-12-15" },
    { name: "Term 2", start: "2025-01-06", end: "2025-03-29" },
    { name: "Term 3", start: "2025-04-14", end: "2025-07-15" }
  ];

  for (const term of termSeeds) {
    const existing = await prisma.terms.findFirst({
      where: { school_id: schoolId, name: term.name }
    });

    const data = {
      school_id: schoolId,
      academic_year_id: academicYearId,
      name: term.name,
      start_date: new Date(term.start),
      end_date: new Date(term.end),
      is_current: term.name === "Term 1"
    };

    if (existing) {
      await prisma.terms.update({ where: { id: existing.id }, data });
    } else {
      await prisma.terms.create({ data });
    }
  }
};

const ensureLevels = async (schoolId: bigint) => {
  const levelSeeds = [
    { label: "S1", sort_order: 1 },
    { label: "S2", sort_order: 2 }
  ];

  const levelRecords = [];

  for (const levelSeed of levelSeeds) {
    const existing = await prisma.school_levels.findFirst({
      where: {
        school_id: schoolId,
        label: levelSeed.label,
        deleted_at: null
      }
    });

    const record = existing
      ? await prisma.school_levels.update({
          where: { id: existing.id },
          data: {
            sort_order: levelSeed.sort_order,
            is_active: true,
            deleted_at: null
          }
        })
      : await prisma.school_levels.create({
          data: {
            school_id: schoolId,
            label: levelSeed.label,
            sort_order: levelSeed.sort_order,
            is_active: true
          }
        });

    levelRecords.push(record);
  }

  return levelRecords;
};

const ensureClassesAndSections = async (schoolId: bigint, academicYearId: bigint) => {
  const levels = await ensureLevels(schoolId);
  const classSeeds = levels.map((level) => ({
    name: level.label,
    level_id: level.id,
    level: level.sort_order,
    level_label: level.label
  }));

  for (const classSeed of classSeeds) {
    const classRecord = await prisma.classes.upsert({
      where: {
        school_id_name_academic_year_id: {
          school_id: schoolId,
          name: classSeed.name,
          academic_year_id: academicYearId
        }
      },
      update: {
        level: classSeed.level,
        level_id: classSeed.level_id,
        level_label: classSeed.level_label
      },
      create: {
        school_id: schoolId,
        academic_year_id: academicYearId,
        name: classSeed.name,
        level: classSeed.level,
        level_id: classSeed.level_id,
        level_label: classSeed.level_label
      }
    });

    const sectionNames = ["A", "B"];
    for (const sectionName of sectionNames) {
      const existingSection = await prisma.sections.findFirst({
        where: {
          school_id: schoolId,
          class_id: classRecord.id,
          name: sectionName
        }
      });

      const data = {
        school_id: schoolId,
        class_id: classRecord.id,
        name: sectionName,
        full_name: `${classSeed.name}${sectionName}`,
        capacity: 40
      };

      if (existingSection) {
        await prisma.sections.update({ where: { id: existingSection.id }, data });
      } else {
        await prisma.sections.create({ data });
      }
    }
  }
};

export const seedSchools = async () => {
  const plans = await prisma.subscription_plans.findMany({
    orderBy: { sort_order: "asc" }
  });

  if (!plans.length) {
    throw new Error("No subscription plans found. Run platform seeder first.");
  }

  const schools = [];

  for (const [index, seed] of schoolSeeds.entries()) {
    const plan = plans[Math.min(index, plans.length - 1)];
    const school = await ensureSchool(seed, plan.id);

    await ensureSubscription(school.id, plan.id, plan.price_annual.toString());

    const academicYear = await ensureAcademicYear(school.id, "2024/2025");
    await ensureTerms(school.id, academicYear.id);
    await ensureClassesAndSections(school.id, academicYear.id);

    schools.push(school);
  }

  return schools;
};

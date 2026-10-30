import { UserRole, UserStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { ROLE_PERMISSIONS } from "../constants/permissions";
import { SchoolRole } from "../constants/roles";
import { prisma } from "../database/prisma";
import { hashPassword } from "../utils/hash";

const DEFAULT_SCHOOL_PASSWORD = "Password@123";

const roleNameMap: Record<SchoolRole, string> = {
  [SchoolRole.SCHOOL_ADMIN]: "School Admin",
  [SchoolRole.TEACHER]: "Teacher",
  [SchoolRole.STAFF]: "Staff",
  [SchoolRole.GATE_KEEPER]: "Gate Keeper",
  [SchoolRole.BOARDING_OFFICER]: "Boarding Officer",
  [SchoolRole.DIRECTOR_OF_DISCIPLINE]: "Director of Discipline",
  [SchoolRole.DIRECTOR_OF_STUDIES]: "Director of Studies",
  [SchoolRole.PATRON]: "Patron",
  [SchoolRole.MATRON]: "Matron",
  [SchoolRole.FINANCE_OFFICER]: "Finance Officer",
  [SchoolRole.PARENT]: "Parent",
  [SchoolRole.STUDENT]: "Student",
};

const ensureRoles = async (schoolId: bigint) => {
  const roles: Record<string, { id: bigint; slug: string }> = {};

  for (const slug of Object.values(SchoolRole)) {
    const existing = await prisma.roles.findFirst({
      where: { school_id: schoolId, slug },
    });

    const data = {
      school_id: schoolId,
      name: roleNameMap[slug],
      slug,
      permissions: ROLE_PERMISSIONS[slug],
      is_system: true,
    };

    const role = existing
      ? await prisma.roles.update({ where: { id: existing.id }, data })
      : await prisma.roles.create({ data });

    roles[slug] = { id: role.id, slug: role.slug };
  }

  return roles;
};

const upsertUser = async (input: {
  schoolId: bigint;
  name: string;
  email: string;
  role: UserRole;
}) => {
  const passwordHash = await hashPassword(DEFAULT_SCHOOL_PASSWORD);
  const existing = await prisma.users.findFirst({
    where: { school_id: input.schoolId, email: input.email },
  });

  const data = {
    uuid: existing?.uuid ?? uuidv4(),
    school_id: input.schoolId,
    name: input.name,
    email: input.email,
    password_hash: passwordHash,
    role: input.role,
    status: UserStatus.active,
    email_verified: true,
  };

  if (existing) {
    return prisma.users.update({ where: { id: existing.id }, data });
  }

  return prisma.users.create({ data });
};

const ensureParentProfile = async (input: {
  schoolId: bigint;
  userId: bigint;
  firstName: string;
  lastName: string;
  phone: string;
}) => {
  const existing = await prisma.parents_guardians.findFirst({
    where: { school_id: input.schoolId, phone: input.phone },
  });

  const data = {
    school_id: input.schoolId,
    user_id: input.userId,
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
    relationship: "parent",
  };

  if (existing) {
    return prisma.parents_guardians.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.parents_guardians.create({ data });
};

const ensureStudent = async (input: {
  schoolId: bigint;
  studentNumber: string;
  firstName: string;
  lastName: string;
}) => {
  const existing = await prisma.students.findFirst({
    where: {
      school_id: input.schoolId,
      student_id_number: input.studentNumber,
    },
  });

  const data = {
    uuid: existing?.uuid ?? uuidv4(),
    school_id: input.schoolId,
    student_id_number: input.studentNumber,
    first_name: input.firstName,
    last_name: input.lastName,
    admission_date: new Date(),
    nationality: "Rwandan",
  };

  if (existing) {
    return prisma.students.update({ where: { id: existing.id }, data });
  }

  return prisma.students.create({ data });
};

export const seedUsers = async () => {
  const schools = await prisma.schools.findMany({
    where: { deleted_at: null },
  });

  for (const school of schools) {
    const roles = await ensureRoles(school.id);

    const usersToCreate = [
      {
        name: `${school.name} Admin`,
        email: `admin@${school.id.toString()}.ecare.test`,
        role: UserRole.school_admin,
        roleSlug: SchoolRole.SCHOOL_ADMIN,
      },
      {
        name: `${school.name} Teacher 1`,
        email: `teacher1@${school.id.toString()}.ecare.test`,
        role: UserRole.teacher,
        roleSlug: SchoolRole.TEACHER,
      },
      {
        name: `${school.name} Teacher 2`,
        email: `teacher2@${school.id.toString()}.ecare.test`,
        role: UserRole.teacher,
        roleSlug: SchoolRole.TEACHER,
      },
      {
        name: `${school.name} Staff 1`,
        email: `staff1@${school.id.toString()}.ecare.test`,
        role: UserRole.staff,
        roleSlug: SchoolRole.STAFF,
      },
      {
        name: `${school.name} Staff 2`,
        email: `staff2@${school.id.toString()}.ecare.test`,
        role: UserRole.staff,
        roleSlug: SchoolRole.STAFF,
      },
      {
        name: `${school.name} Gate Keeper`,
        email: `gatekeeper@${school.id.toString()}.ecare.test`,
        role: UserRole.gate_keeper,
        roleSlug: SchoolRole.GATE_KEEPER
      },
      {
        name: `${school.name} Boarding Officer`,
        email: `boarding@${school.id.toString()}.ecare.test`,
        role: UserRole.boarding_officer,
        roleSlug: SchoolRole.BOARDING_OFFICER
      },
      {
        name: `${school.name} Director of Discipline`,
        email: `dod@${school.id.toString()}.ecare.test`,
        role: UserRole.director_of_discipline,
        roleSlug: SchoolRole.DIRECTOR_OF_DISCIPLINE
      },
      {
        name: `${school.name} Director of Studies`,
        email: `dos@${school.id.toString()}.ecare.test`,
        role: UserRole.director_of_studies,
        roleSlug: SchoolRole.DIRECTOR_OF_STUDIES
      },
      {
        name: `${school.name} Patron`,
        email: `patron@${school.id.toString()}.ecare.test`,
        role: UserRole.patron,
        roleSlug: SchoolRole.PATRON
      },
      {
        name: `${school.name} Matron`,
        email: `matron@${school.id.toString()}.ecare.test`,
        role: UserRole.matron,
        roleSlug: SchoolRole.MATRON
      },
      {
        name: `${school.name} Finance Officer`,
        email: `finance@${school.id.toString()}.ecare.test`,
        role: UserRole.finance_officer,
        roleSlug: SchoolRole.FINANCE_OFFICER
      },
      {
        name: `${school.name} Parent 1`,
        email: `parent1@${school.id.toString()}.ecare.test`,
        role: UserRole.parent,
        roleSlug: SchoolRole.PARENT,
      },
      {
        name: `${school.name} Parent 2`,
        email: `parent2@${school.id.toString()}.ecare.test`,
        role: UserRole.parent,
        roleSlug: SchoolRole.PARENT,
      },
      {
        name: `${school.name} Parent 3`,
        email: `parent3@${school.id.toString()}.ecare.test`,
        role: UserRole.parent,
        roleSlug: SchoolRole.PARENT,
      },
    ];

    const createdUsers = [];
    for (const userSeed of usersToCreate) {
      const user = await upsertUser({
        schoolId: school.id,
        name: userSeed.name,
        email: userSeed.email,
        role: userSeed.role,
      });

      createdUsers.push({ user, roleSlug: userSeed.roleSlug });
    }

    await prisma.user_roles.createMany({
      data: createdUsers.map((entry) => ({
        school_id: school.id,
        user_id: entry.user.id,
        role_id: roles[entry.roleSlug].id,
      })),
      skipDuplicates: true,
    });

    const parentUsers = createdUsers.filter(
      (entry) => entry.user.role === UserRole.parent,
    );

    for (const [index, entry] of parentUsers.entries()) {
      await ensureParentProfile({
        schoolId: school.id,
        userId: entry.user.id,
        firstName: `Parent${index + 1}`,
        lastName: school.name.split(" ")[0],
        phone: `25078${school.id.toString().slice(-2)}${index + 1}000`,
      });
    }

    for (let i = 1; i <= 5; i += 1) {
      await ensureStudent({
        schoolId: school.id,
        studentNumber: `STU-${school.id.toString()}-${i}`,
        firstName: `Student${i}`,
        lastName: school.name.split(" ")[0],
      });
    }
  }
};

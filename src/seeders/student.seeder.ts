import { BiometricType, EnrollmentStatus, FeeAssignmentStatus } from "@prisma/client";
import { prisma } from "../database/prisma";

const ensureFeeStructure = async (schoolId: bigint, academicYearId: bigint) => {
  const existing = await prisma.fee_structures.findFirst({
    where: { school_id: schoolId, academic_year_id: academicYearId, name: "Tuition" }
  });

  const data = {
    school_id: schoolId,
    academic_year_id: academicYearId,
    name: "Tuition",
    amount: "50000.00",
    currency: "RWF",
    is_mandatory: true,
    due_date: new Date("2024-11-15")
  };

  if (existing) {
    return prisma.fee_structures.update({ where: { id: existing.id }, data });
  }

  return prisma.fee_structures.create({ data });
};

export const seedStudents = async () => {
  const schools = await prisma.schools.findMany({ where: { deleted_at: null } });

  for (const school of schools) {
    const academicYear = await prisma.academic_years.findFirst({
      where: { school_id: school.id, is_current: true }
    });

    if (!academicYear) {
      continue;
    }

    const sections = await prisma.sections.findMany({ where: { school_id: school.id } });
    const students = await prisma.students.findMany({ where: { school_id: school.id } });
    const parents = await prisma.parents_guardians.findMany({ where: { school_id: school.id } });

    if (!sections.length || !students.length) {
      continue;
    }

    const feeStructure = await ensureFeeStructure(school.id, academicYear.id);
    const section = sections[0];

    for (const [index, student] of students.entries()) {
      const existingEnrollment = await prisma.student_section_enrollments.findFirst({
        where: {
          school_id: school.id,
          student_id: student.id,
          academic_year_id: academicYear.id
        }
      });

      if (!existingEnrollment) {
        await prisma.student_section_enrollments.create({
          data: {
            school_id: school.id,
            student_id: student.id,
            section_id: section.id,
            academic_year_id: academicYear.id,
            enrolled_at: new Date(),
            status: EnrollmentStatus.active
          }
        });
      }

      if (parents.length) {
        const parent = parents[index % parents.length];
        const link = await prisma.student_parent_links.findFirst({
          where: { student_id: student.id, parent_id: parent.id }
        });

        if (!link) {
          await prisma.student_parent_links.create({
            data: {
              student_id: student.id,
              parent_id: parent.id,
              is_primary: index % parents.length === 0
            }
          });
        }
      }

      const biometric = await prisma.biometric_enrollments.findFirst({
        where: { school_id: school.id, student_id: student.id, type: BiometricType.card_qr }
      });

      if (!biometric) {
        await prisma.biometric_enrollments.create({
          data: {
            school_id: school.id,
            student_id: student.id,
            type: BiometricType.card_qr,
            card_uid: `CARD-${school.id.toString()}-${student.id.toString()}`
          }
        });
      }

      const assignment = await prisma.student_fee_assignments.findFirst({
        where: {
          school_id: school.id,
          student_id: student.id,
          fee_structure_id: feeStructure.id
        }
      });

      if (!assignment) {
        await prisma.student_fee_assignments.create({
          data: {
            school_id: school.id,
            student_id: student.id,
            fee_structure_id: feeStructure.id,
            amount_due: feeStructure.amount,
            amount_paid: "0",
            balance: feeStructure.amount,
            status: FeeAssignmentStatus.unpaid,
            due_date: feeStructure.due_date
          }
        });
      }
    }
  }
};

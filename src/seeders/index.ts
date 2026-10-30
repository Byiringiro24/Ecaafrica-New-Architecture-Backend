import { prisma } from "../database/prisma";
import { seedPlatform } from "./platform.seeder";
import { seedSchools } from "./school.seeder";
import { seedUsers } from "./user.seeder";
import { seedAcademic } from "./academic.seeder";
import { seedStudents } from "./student.seeder";

export const runSeeders = async () => {
  await seedPlatform();
  await seedSchools();
  await seedUsers();
  await seedAcademic();
  await seedStudents();
};

if (require.main === module) {
  runSeeders()
    .then(() => {
      console.log("Seed completed");
    })
    .catch((err) => {
      console.error("Seed failed", err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

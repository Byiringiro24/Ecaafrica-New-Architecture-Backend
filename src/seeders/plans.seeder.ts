import { prisma } from "../database/prisma";
import { seedPlans } from "./platform.seeder";

seedPlans()
  .then((plans) => {
    console.log(`Subscription plans seeded: ${plans.length}`);
  })
  .catch((error) => {
    console.error("Subscription plan seeding failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

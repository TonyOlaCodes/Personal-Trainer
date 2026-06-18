import { prisma } from "../src/lib/prisma";
import { getUserCheckInSchedule } from "../src/lib/checkInSchedule";

async function main() {
    try {
        const user = await prisma.user.findFirst();
        if (!user) {
            console.log("No user found in DB.");
            return;
        }
        console.log("Found user:", user.id, "Name:", user.name, "Role:", user.role);
        
        console.log("Testing getUserCheckInSchedule...");
        const schedule = await getUserCheckInSchedule(user.id);
        console.log("Schedule:", schedule);
    } catch (e) {
        console.error("Test failed with error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

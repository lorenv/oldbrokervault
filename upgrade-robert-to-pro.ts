
import { db } from "./server/db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function upgradeRobertToPro() {
  try {
    console.log("🔄 Upgrading robert@dealve.cc to Pro plan...");

    // Set subscription to end far in the future (like the premium account)
    const endsAt = new Date("2035-12-31T23:59:59.000Z");

    const [updatedUser] = await db
      .update(users)
      .set({
        subscriptionStatus: "standard", // Pro plan is called "standard" in the schema
        subscriptionEndsAt: endsAt,
        subscriptionId: "manual_upgrade_pro", // Add a subscription ID for tracking
      })
      .where(eq(users.email, "robert@dealve.cc"))
      .returning();

    if (updatedUser) {
      console.log("✅ Successfully upgraded robert@dealve.cc to Pro plan!");
      console.log("User details:");
      console.log(`  - Email: ${updatedUser.email}`);
      console.log(`  - Plan: ${updatedUser.subscriptionStatus}`);
      console.log(`  - Expires: ${updatedUser.subscriptionEndsAt}`);
      console.log(`  - Subscription ID: ${updatedUser.subscriptionId}`);
    } else {
      console.error("❌ User not found with email: robert@dealve.cc");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error upgrading user:", error);
    process.exit(1);
  }
}

upgradeRobertToPro();

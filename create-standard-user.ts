
import { db } from "./server/db";
import { users } from "./shared/schema";
import { hashPassword } from "./server/auth";
import { eq } from "drizzle-orm";

async function createStandardUser() {
  try {
    console.log("Creating standard user with email: bchaiprasit@tworld.com");
    
    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, "bchaiprasit@tworld.com"));
    
    if (existingUser.length > 0) {
      console.log("User already exists with that email");
      return;
    }
    
    // Hash the password
    const hashedPassword = await hashPassword("ChangeMe123!");
    
    // Set subscription end date to 1 year from now
    const subscriptionEndsAt = new Date();
    subscriptionEndsAt.setFullYear(subscriptionEndsAt.getFullYear() + 1);
    
    // Create the user with standard subscription
    const newUser = await db.insert(users).values({
      email: "bchaiprasit@tworld.com",
      password: hashedPassword,
      isAdmin: false,
      subscriptionStatus: "standard",
      subscriptionEndsAt: subscriptionEndsAt,
      monthlyDocumentsCreated: 0,
      monthlyRegenerationsUsed: 0,
      lastUsageReset: new Date()
    }).returning();
    
    console.log("User created successfully:", {
      id: newUser[0].id,
      email: newUser[0].email,
      subscriptionStatus: newUser[0].subscriptionStatus,
      subscriptionEndsAt: newUser[0].subscriptionEndsAt
    });
    
    console.log("Standard subscription benefits:");
    console.log("- 20 CIM generations per month");
    console.log("- Unlimited regenerations per month");
    console.log("- Subscription valid until:", subscriptionEndsAt.toDateString());
    
  } catch (error) {
    console.error("Error creating user:", error);
  } finally {
    process.exit(0);
  }
}

createStandardUser();

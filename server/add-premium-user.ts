
import { storage } from "./storage";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function main() {
  // Check if user exists
  const email = "robert@dealve.cc";
  let user = await storage.getUserByEmail(email);
  
  if (!user) {
    // Create user with premium status
    console.log(`Creating new user: ${email}`);
    user = await storage.createUser({
      email,
      password: await hashPassword("Flydccstone500!"),
      isAdmin: true, // Setting as admin for unlimited access
    });
    console.log(`User created with ID: ${user.id}`);
  } else {
    console.log(`User exists with ID: ${user.id}`);
    // Update password if user exists
    const hashedPassword = await hashPassword("Flydccstone500!");
    await storage.updateUserPassword(user.id, hashedPassword);
    console.log("Password updated");
  }
  
  // Set premium subscription with unlimited access
  const endsAt = new Date();
  endsAt.setFullYear(endsAt.getFullYear() + 10); // 10 years premium for unlimited access
  
  await storage.updateSubscription(user.id, "premium", endsAt);
  console.log(`Subscription updated to premium until ${endsAt.toISOString()}`);
  
  // Set admin status for unlimited features
  const { db } = await import("./db");
  const { users } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  
  await db.update(users).set({ 
    isAdmin: true,
    monthlyDocumentsCreated: 0, // Reset counter
    monthlyRegenerationsUsed: 0 // Reset counter
  }).where(eq(users.id, user.id));
  
  console.log("Admin status granted for unlimited access");
  
  // Print summary
  const updatedUser = await storage.getUser(user.id);
  console.log("User details:", {
    id: updatedUser.id,
    email: updatedUser.email,
    status: updatedUser.subscriptionStatus,
    isAdmin: updatedUser.isAdmin,
    endsAt: updatedUser.subscriptionEndsAt,
    documentsCreated: updatedUser.monthlyDocumentsCreated,
    regenerationsUsed: updatedUser.monthlyRegenerationsUsed
  });
  
  console.log("\n✅ Premium unlimited account created successfully!");
  console.log("📧 Email: robert@dealve.cc");
  console.log("🔑 Password: Flydccstone500!");
  console.log("🚀 Features: Unlimited CIM creations, regenerations, and all premium features");
  
  process.exit(0);
}

main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});

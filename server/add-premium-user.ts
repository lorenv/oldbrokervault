
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
  const email = "robert@businessexits.com";
  let user = await storage.getUserByEmail(email);
  
  if (!user) {
    // Create user with premium status
    console.log(`Creating new user: ${email}`);
    user = await storage.createUser({
      email,
      password: await hashPassword("ChangeMe123!"), // Temporary password
      isAdmin: false,
    });
    console.log(`User created with ID: ${user.id}`);
  } else {
    console.log(`User exists with ID: ${user.id}`);
  }
  
  // Set premium subscription
  const endsAt = new Date();
  endsAt.setMonth(endsAt.getMonth() + 12); // 12 months premium
  
  await storage.updateSubscription(user.id, "premium", endsAt);
  console.log(`Subscription updated to premium until ${endsAt.toISOString()}`);
  
  // Print summary
  const updatedUser = await storage.getUser(user.id);
  console.log("User details:", {
    id: updatedUser.id,
    email: updatedUser.email,
    status: updatedUser.subscriptionStatus,
    endsAt: updatedUser.subscriptionEndsAt
  });
  
  process.exit(0);
}

main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});

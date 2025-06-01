import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { Pool } from '@neondatabase/serverless';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function resetPassword() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const newHash = await hashPassword('ChangeMe123!');
    console.log('New password hash:', newHash);
    
    await pool.query(
      'UPDATE users SET password = $1 WHERE email = $2',
      [newHash, 'robert@businessexits.com']
    );
    
    console.log('Password reset successfully for robert@businessexits.com');
  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    await pool.end();
  }
}

resetPassword();
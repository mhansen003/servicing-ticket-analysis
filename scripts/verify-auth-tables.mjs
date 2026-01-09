// Quick script to verify auth tables exist
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyTables() {
  try {
    console.log('Checking auth tables...\n');

    // Check auth_otp table
    const otpCount = await prisma.auth_otp.count();
    console.log('✅ auth_otp table exists');
    console.log(`   Records: ${otpCount}`);

    // Check auth_rate_limit table
    const rateLimitCount = await prisma.auth_rate_limit.count();
    console.log('✅ auth_rate_limit table exists');
    console.log(`   Records: ${rateLimitCount}`);

    console.log('\n🎉 All auth tables created successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTables();

#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createInterface } from "readline/promises";

const prisma = new PrismaClient();

interface BootstrapData {
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  companyName: string;
}

async function promptUser(): Promise<BootstrapData> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const companyName = await rl.question("Enter company name: ");
    const adminName = await rl.question("Enter admin user name: ");
    const adminEmail = await rl.question("Enter admin email: ");
    
    // Hide password input
    const adminPassword = await rl.question("Enter admin password (min 8 chars): ");

    if (!companyName || !adminName || !adminEmail || !adminPassword) {
      throw new Error("All fields are required");
    }

    if (adminPassword.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
      throw new Error("Invalid email format");
    }

    return { adminEmail, adminPassword, adminName, companyName };
  } finally {
    rl.close();
  }
}

async function checkSystemEmpty(): Promise<boolean> {
  const userCount = await prisma.user.count();
  const companyCount = await prisma.company.count();
  
  console.log(`Current state: ${userCount} users, ${companyCount} companies`);
  
  return userCount === 0 && companyCount === 0;
}

async function createBootstrap(data: BootstrapData) {
  const hashedPassword = await bcrypt.hash(data.adminPassword, 12);

  const result = await prisma.$transaction(async (tx) => {
    // Create the company
    const company = await tx.company.create({
      data: {
        name: data.companyName,
      },
    });

    // Create the admin user
    const adminUser = await tx.user.create({
      data: {
        email: data.adminEmail,
        name: data.adminName,
        hashedPassword,
        role: "admin",
        activeCompanyId: company.id,
        memberOfCompanies: {
          connect: { id: company.id },
        },
      },
    });

    return { company, adminUser };
  });

  console.log("✅ Bootstrap completed successfully!");
  console.log(`📧 Admin user: ${result.adminUser.email}`);
  console.log(`🏢 Company: ${result.company.name}`);
  console.log(`🆔 Company ID: ${result.company.id}`);
  console.log(`🆔 User ID: ${result.adminUser.id}`);
}

async function main() {
  try {
    console.log("🚀 ERP System Bootstrap CLI");
    console.log("=====================================");

    // Check if system is empty
    const isEmpty = await checkSystemEmpty();
    
    if (!isEmpty) {
      console.log("❌ System already has users and/or companies.");
      console.log("Bootstrap is only allowed on empty databases.");
      process.exit(1);
    }

    console.log("✅ Database is empty. Ready for bootstrap.");
    console.log("");

    // Prompt for user input
    const data = await promptUser();

    console.log("");
    console.log("Creating admin user and company...");

    // Create bootstrap
    await createBootstrap(data);

    console.log("");
    console.log("🎉 You can now login at the web interface!");
    
  } catch (error) {
    console.error("❌ Bootstrap failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
} 
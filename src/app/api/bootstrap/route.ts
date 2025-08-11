import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { UserRole } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    // Check if database is empty (no users exist)
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return NextResponse.json(
        { error: "Database already has users. Bootstrap is only allowed on empty databases." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { adminEmail, adminPassword, adminName, companyName } = body;

    // Validate required fields
    if (!adminEmail || !adminPassword || !adminName || !companyName) {
      return NextResponse.json(
        { error: "Missing required fields: adminEmail, adminPassword, adminName, companyName" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate password strength
    if (adminPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create company and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the company
      const company = await tx.company.create({
        data: {
          name: companyName,
        },
      });

      // Create initial settings for the company
      const initialSettings = await tx.settings.create({
        data: {
          companyId: company.id,
          companyName: companyName,
          vatId: "", // Will be filled by user
          domicile: "", // Will be filled by user
          streetAddress: "", // Will be filled by user
          postalCode: "", // Will be filled by user
          city: "", // Will be filled by user
          countryCode: "FI", // Default to Finland
          countryName: "Finland", // Default to Finland
          bankAccountIBAN: "", // Will be filled by user
          bankAccountBIC: "", // Will be filled by user
          website: "", // Will be filled by user
          sellerIdentifier: "", // Will be filled by user
          sellerIntermediatorAddress: "", // Will be filled by user
          bankName: "", // Will be filled by user
          defaultInvoicePaymentTermsDays: 30, // Default to 30 days
          defaultVatRatePercent: null, // Will be filled by user
        },
      });

      // Create the admin user
      const adminUser = await tx.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          hashedPassword,
          role: UserRole.admin,
          activeCompanyId: company.id,
          memberOfCompanies: {
            connect: { id: company.id },
          },
        },
      });

      return { company, adminUser, settings: initialSettings };
    });

    return NextResponse.json({
      success: true,
      message: "Bootstrap completed successfully",
      company: {
        id: result.company.id,
        name: result.company.name,
      },
      user: {
        id: result.adminUser.id,
        email: result.adminUser.email,
        name: result.adminUser.name,
        role: result.adminUser.role,
      },
    });
  } catch (error) {
    console.error("Bootstrap error:", error);
    return NextResponse.json(
      { error: "Failed to bootstrap system" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Check if bootstrap is needed
    const userCount = await prisma.user.count();
    const companyCount = await prisma.company.count();
    
    return NextResponse.json({
      needsBootstrap: userCount === 0 && companyCount === 0,
      userCount,
      companyCount,
    });
  } catch (error) {
    console.error("Bootstrap status check error:", error);
    return NextResponse.json(
      { error: "Failed to check bootstrap status" },
      { status: 500 }
    );
  }
} 
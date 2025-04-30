# Simplified ERP System

This project is a web application designed to streamline core business processes including inventory management, order processing, invoicing, and customer relationship management for small to medium-sized businesses.

## Tech Stack

- Next.js (App Router)
- React
- TypeScript
- Prisma (ORM)
- PostgreSQL (e.g., hosted via Supabase)
- NextAuth.js (Authentication)
- tRPC (API Layer)
- Shadcn UI
- Tailwind CSS
- Zod (Validation)
- React Hook Form

## Architecture Overview

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL
- **ORM:** Prisma
- **API:** tRPC
- **Authentication:** NextAuth.js
- **UI Components:** shadcn/ui, react-hook-form, react-toastify
- **Drag & Drop:** @dnd-kit (for Production Kanban)

## Multi-Tenancy (Planned)

The application is planned to support multiple companies operating independently within the same instance.

- **Data Isolation:** Company-specific data (Customers, Orders, Inventory, Invoices, Settings) will be scoped using a mandatory `companyId` field.
- **User Membership:** Users can belong to multiple companies via a `CompanyUser` join table.
- **Active Company:** Users will have an `activeCompanyId` stored in their profile and session to determine the current working context.
- **Authorization:** tRPC procedures accessing scoped data will use a dedicated `companyProtectedProcedure` that verifies session validity and active company membership, automatically injecting `userId` and `companyId` into the context for database queries.
- **Admin Roles:** Global admins (`UserRole.admin`) will have additional capabilities (future implementation). The first user to sign up is automatically promoted to `admin`.

## Key Features

- Customer Management
- Inventory Management
- Order Management (Create, Edit, List)
- Invoicing
- Production Kanban Board (Drag & Drop status updates)
- User Authentication

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd simplified-erp
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or yarn install or pnpm install
    ```
3.  **Set up environment variables:**
    *   Copy `.env.example` to `.env.local`.
    *   Fill in the required variables, especially `DATABASE_URL` (pointing to your PostgreSQL instance) and `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
    ```bash
    cp .env.example .env.local
    # Edit .env.local with your credentials
    ```
4.  **Run database migrations:**
    ```bash
    npx prisma migrate dev
    ```
5.  **Run the development server:**
    ```bash
    npm run dev
    # or yarn dev or pnpm dev
    ```
6. **First Sign-up:** The first user account created via email sign-in will automatically be granted the `admin` role.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

Refer to `docs/01-architecture-layout.md` for a detailed explanation of the project structure.

## Documentation

Detailed requirements, architecture, type flows, user flows, and implementation plans can be found in the `/docs` directory.

## Current Status & Known Issues

- **Build Failing:** The production build (`npm run build`) currently fails due to a persistent TypeScript error related to `PageProps` constraints in `src/app/(erp)/orders/[id]/edit/page.tsx`. Standard fixes and `@ts-ignore` have not resolved it. Requires further investigation (potentially Next.js 15.1.0 bug or project conflict).
- **IDE Linter Discrepancies:** The IDE (e.g., VS Code) shows numerous type errors (missing Prisma/Zod types, react-hook-form conflicts) that are *not* reported by `tsc --noEmit`. This suggests an issue with the IDE's TS Server state, making development checks unreliable, but likely not blocking the build itself.
- **Dashboard Auth Redirect:** Navigating to `/dashboard` sometimes results in a redirect loop back to the sign-in page, despite a valid session existing. Needs investigation into NextAuth config/cookies.
- **Multi-Tenancy:** Not yet implemented. See plan above.
- **Settings Page:** User profile settings (e.g., First Name) and initial company setup are not yet implemented. 
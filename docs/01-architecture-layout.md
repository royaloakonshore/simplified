# Architecture Layout - Simplified ERP System

## 1. Overview

This ERP system utilizes a modern web architecture based on Next.js (App Router), React, TypeScript, and Prisma. It emphasizes server-side rendering (SSR) and React Server Components (RSC) for performance and reduced client-side load, with minimal, targeted use of Client Components for interactivity.

## 2. Technology Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript 5.x (strict mode)
- **UI Library:** React 18+, Shadcn UI
- **Styling:** Tailwind CSS
- **State Management:** Zustand (minimal use for global UI state if needed), URL State (`nuqs` or similar)
- **Forms:** React Hook Form + Zod
- **Data Fetching/API:** tRPC (client/server)
- **Database ORM:** Prisma
- **Database Hosting:** PostgreSQL (e.g., via Supabase, Neon, local)
- **Authentication:** NextAuth.js (with Prisma Adapter)

## 3. Directory Structure (`/src`)

```
erp-system/
├── .env.local             # Environment variables (Supabase keys, etc.) - MANAGED BY USER
├── .eslintrc.json         # ESLint configuration
├── .gitignore
├── .prettierrc.json       # Prettier configuration
├── components.json        # Shadcn UI configuration
├── next.config.mjs        # Next.js configuration
├── package.json
├── postcss.config.js      # PostCSS configuration (for Tailwind)
├── public/
│   └── ...                # Static assets
├── README.md
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── (auth)/        # Authentication routes (login, signup)
│   │   │   └── ...
│   │   ├── (main)/        # Main application layout (requires auth)
│   │   │   ├── layout.tsx # Main authenticated layout
│   │   │   ├── dashboard/ # Main dashboard page
│   │   │   │   └── page.tsx
│   │   │   ├── customers/ # Customer management feature
│   │   │   │   └── ...
│   │   │   ├── inventory/ # Inventory management feature
│   │   │   │   └── ...
│   │   │   ├── orders/    # Order management feature
│   │   │   │   └── ...
│   │   │   └── invoices/  # Invoicing feature
│   │   │       └── ...
│   │   ├── api/           # API routes (if needed beyond Server Actions)
│   │   │   └── ...
│   │   ├── favicon.ico
│   │   ├── globals.css    # Global styles (Tailwind base, Shadcn theme)
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Root (landing/public) page
│   ├── components/        # Reusable UI components
│   │   ├── auth/          # Auth-specific components (forms)
│   │   ├── core/          # Core application components (layout, nav)
│   │   ├── forms/         # General form components/wrappers
│   │   ├── icons/         # Icon components
│   │   └── ui/            # Shadcn UI components (auto-generated/customized)
│   ├── lib/               # Core logic, utilities, types, services
│   │   ├── api/           # tRPC API definitions
│   │   │   ├── root.ts      # Root tRPC router
│   │   │   ├── trpc.ts      # tRPC server setup
│   │   │   └── routers/     # Feature-specific routers (e.g., customer.ts)
│   │   ├── constants.ts   # Application-wide constants
│   │   ├── db.ts          # Prisma client instance
│   │   ├── errors.ts      # Custom error types/handling
│   │   ├── hooks/         # Custom React hooks
│   │   ├── schemas/       # Zod validation schemas (organized by feature)
│   │   ├── services/      # Business logic services (e.g., Finvoice)
│   │   │   └── finvoice.service.ts
│   │   ├── store/         # Zustand global state store (if needed)
│   │   ├── trpc/          # tRPC client setup
│   │   │   └── react.tsx    # React Query provider for tRPC
│   │   ├── types/         # Core TypeScript types and interfaces (branded types)
│   │   └── utils.ts       # Utility functions
│   ├── middleware.ts    # Next.js middleware (NextAuth session handling)
│   └── ...              # Other src files as needed
├── tailwind.config.ts     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
└── tests/                 # Vitest configuration and test setup (Optional top-level)
    └── ...
```

## 4. Component Strategy

- **Server Components First:** Default to Server Components for data fetching and rendering static or server-rendered content.
- **Client Components (`\'use client\'`):** Use only when necessary for interactivity (event handlers, hooks like `useState`, `useEffect`, `useContext`). Keep them small and push state down as much as possible. Fetch data and perform mutations using the tRPC React Query hooks (`@/lib/trpc/react`).
- **Composition:** Build complex UIs by composing smaller, reusable components.
- **Data Fetching:** Primarily via tRPC procedures called from Server or Client Components using the appropriate tRPC client/hooks. Use Suspense for loading states.

## 5. State Management

- **URL State:** Prefer managing UI state like filters, sorting, pagination via URL search parameters (e.g., using `nuqs`).
- **Server Actions:** Replaced by tRPC mutations. Handle mutations and related state updates via tRPC procedures and React Query's cache invalidation/optimistic update capabilities.
- **Zustand:** Reserve for truly global client-side UI state not easily managed by URL or component state (e.g., notification toasts, sidebar open/closed state). Avoid storing server data fetched via tRPC/React Query in Zustand.

## 6. Error Handling

- **tRPC Procedures:** Throw `TRPCError` for expected errors. Utilize tRPC middleware for centralized error handling/logging if needed.
- **Client Components:** Use React Error Boundaries. Handle tRPC errors using React Query's `onError` callbacks or error states.
- **API Routes:** Standard HTTP error codes and JSON error responses (less common with tRPC).
- **UI:** Display user-friendly error messages (e.g., using Shadcn `Toast`) based on errors from tRPC calls. Log detailed errors.

## 7. Database Design

- See `prisma/schema.prisma` for the database schema.
- Use Prisma Migrate (`npx prisma migrate dev`) for schema changes.
- Database access rules can be managed via application logic, as Supabase RLS is not directly used with Prisma in this setup (though database-level permissions still apply).

## 8. Architecture Layout & Project Structure

This document outlines the planned architecture and directory structure for the ERP system. We will leverage a standard Next.js starter template (e.g., `next-ai-starter` or similar) as the foundation, adapting it as needed.

### 8.1. Core Principles

*   **Next.js App Router:** Utilize Server Components (RSC) by default for data fetching and rendering. Client Components (`'use client'`) for interactivity only.
*   **TypeScript:** Strict mode enabled for maximum type safety.
*   **Modular Design:** Components and logic organized by feature/domain.
*   **Prisma ORM:** For database interaction and migrations.
*   **NextAuth.js:** For authentication, configured with Prisma Adapter.
*   **tRPC:** Primary mechanism for API communication (queries and mutations).
*   **Shadcn UI & Tailwind:** For UI components and styling (monochrome theme).

### 8.2. Expected Directory Structure (Adaptable from Starter)

```
erp-system/
├── .env.local             # Environment variables (Supabase keys, etc.) - MANAGED BY USER
├── .eslintrc.json         # ESLint configuration
├── .gitignore
├── .prettierrc.json       # Prettier configuration
├── components.json        # Shadcn UI configuration
├── next.config.mjs        # Next.js configuration
├── package.json
├── postcss.config.js      # PostCSS configuration (for Tailwind)
├── public/
│   └── ...                # Static assets
├── README.md
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── (auth)/        # Authentication routes (login, signup)
│   │   │   └── ...
│   │   ├── (main)/        # Main application layout (requires auth)
│   │   │   ├── layout.tsx # Main authenticated layout
│   │   │   ├── dashboard/ # Main dashboard page
│   │   │   │   └── page.tsx
│   │   │   ├── customers/ # Customer management feature
│   │   │   │   └── ...
│   │   │   ├── inventory/ # Inventory management feature
│   │   │   │   └── ...
│   │   │   ├── orders/    # Order management feature
│   │   │   │   └── ...
│   │   │   └── invoices/  # Invoicing feature
│   │   │       └── ...
│   │   ├── api/           # API routes (if needed beyond Server Actions)
│   │   │   └── ...
│   │   ├── favicon.ico
│   │   ├── globals.css    # Global styles (Tailwind base, Shadcn theme)
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Root (landing/public) page
│   ├── components/        # Reusable UI components
│   │   ├── auth/          # Auth-specific components (forms)
│   │   ├── core/          # Core application components (layout, nav)
│   │   ├── forms/         # General form components/wrappers
│   │   ├── icons/         # Icon components
│   │   └── ui/            # Shadcn UI components (auto-generated/customized)
│   ├── lib/               # Core logic, utilities, types, services
│   │   ├── api/           # tRPC API definitions
│   │   │   ├── root.ts      # Root tRPC router
│   │   │   ├── trpc.ts      # tRPC server setup
│   │   │   └── routers/     # Feature-specific routers (e.g., customer.ts)
│   │   ├── constants.ts   # Application-wide constants
│   │   ├── db.ts          # Prisma client instance
│   │   ├── errors.ts      # Custom error types/handling
│   │   ├── hooks/         # Custom React hooks
│   │   ├── schemas/       # Zod validation schemas (organized by feature)
│   │   ├── services/      # Business logic services (e.g., Finvoice)
│   │   │   └── finvoice.service.ts
│   │   ├── store/         # Zustand global state store (if needed)
│   │   ├── trpc/          # tRPC client setup
│   │   │   └── react.tsx    # React Query provider for tRPC
│   │   ├── types/         # Core TypeScript types and interfaces (branded types)
│   │   └── utils.ts       # Utility functions
│   ├── middleware.ts    # Next.js middleware (NextAuth session handling)
│   └── ...              # Other src files as needed
├── tailwind.config.ts     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
└── tests/                 # Vitest configuration and test setup (Optional top-level)
    └── ...
```

### 8.3. Key Components & Interactions

*   **Root Layout (`src/app/layout.tsx`):** Provides the basic HTML structure, includes global styles and providers (e.g., Toaster).
*   **Auth Layout (`src/app/(auth)/layout.tsx`):** Layout for login/signup pages.
*   **Main Layout (`src/app/(main)/layout.tsx`):** Authenticated layout containing navigation (sidebar/header) and main content area. Manages session via NextAuth.
*   **Feature Routes (e.g., `src/app/(main)/customers/page.tsx`):** Entry points for each major feature, using Server Components for structure and potentially Client Components with tRPC hooks for data display/interaction.
*   **UI Components (`src/components/ui/`, `src/components/core/`):** Shadcn components and custom reusable UI elements.
*   **tRPC Procedures (`src/lib/api/routers/`):** Handle all API logic (queries and mutations), interact with Prisma, perform validation using Zod schemas. Defined within feature-specific routers.
*   **Prisma Client (`src/lib/db.ts`):** Singleton instance of the Prisma client for database access.
*   **Middleware (`src/middleware.ts`):** Handles session management and protects routes using NextAuth middleware helpers.
*   **Zod Schemas (`src/lib/schemas/`):** Define data shapes and validation rules, used in forms and tRPC procedures.
*   **Types (`src/lib/types/`, generated Prisma types):** Define application-specific types and Prisma generated types.
*   **tRPC Client (`src/lib/trpc/react.tsx`):** Sets up the React Query client and provider for consuming tRPC procedures in Client Components.

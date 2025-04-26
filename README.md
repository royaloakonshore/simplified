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

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

Refer to `docs/01-architecture-layout.md` for a detailed explanation of the project structure.

## Documentation

Detailed requirements, architecture, type flows, user flows, and implementation plans can be found in the `/docs` directory. 
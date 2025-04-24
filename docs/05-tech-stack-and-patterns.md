# Tech Stack & Development Patterns - Simplified ERP System

## 1. Core Technologies

- **Framework:** Next.js 14+ (App Router)
- **UI:** React 18+, Shadcn UI, Tailwind CSS
- **Language:** TypeScript 5.x (Strict Mode)
- **State Management:** URL State (`nuqs`), Minimal Zustand, Server State via RSC/Actions
- **Forms:** React Hook Form + Zod
- **Database:** Supabase (PostgreSQL, Auth, Storage)
- **API/Mutations:** Next.js Server Actions
- **Styling:** Tailwind CSS (with Shadcn presets)
- **Testing:** Vitest (Unit/Integration), React Testing Library, Playwright (E2E - optional)
- **Linting/Formatting:** ESLint, Prettier

## 2. Key Development Patterns

### 2.1. Server Components First
- Default to React Server Components (RSCs) for pages and data-display components.
- Fetch data directly within RSCs or via Server Actions called from RSCs.
- Minimize `'use client'` directive.

### 2.2. Targeted Client Components
- Use Client Components (`'use client'`) only when interactivity is required (event handlers, `useState`, `useEffect`, browser APIs).
- Keep Client Components small and focused. Pass data down from Server Components via props.
- Lift state up only when necessary, or use URL state/minimal Zustand.

### 2.3. Server Actions for Mutations
- Use Server Actions for all data mutations (Create, Update, Delete).
- Define actions in `src/lib/actions/`.
- Ensure actions are secure, perform validation (Zod), handle errors, and return structured responses (e.g., `{ success: boolean, data?: T, error?: { message: string, code?: string } }`).
- Use `revalidatePath` or `revalidateTag` within actions to update cached data and refresh UI.

### 2.4. Type Safety
- **TypeScript Strict Mode:** Enable and adhere to strict type checking.
- **Branded Types:** Use for IDs, monetary values, specific string formats (see `02-type-flow-and-finvoice.md`).
- **Zod Validation:** Validate all external inputs (forms, API/Action parameters) rigorously.
- **Database Types:** Generate types from Supabase schema (`supabase gen types typescript`).
- **Consistent Naming:** PascalCase for types/interfaces, camelCase for variables/functions.

### 2.5. State Management Strategy
- **URL State:** Primary method for client UI state like filters, pagination, sorting (`nuqs` library recommended).
- **Component State:** Use `useState` for local component interactivity.
- **Server State:** Managed implicitly by RSCs and revalidation via Server Actions.
- **Global Client State (Zustand):** Use *sparingly* only for truly global UI concerns not tied to server data (e.g., toast notifications, theme toggle, sidebar state). Avoid storing server-fetched data here.

### 2.6. Error Handling
- **Server Actions:** Return structured error objects. Consider Railway Oriented Programming (Result types) for robust error flow.
- **UI:** Use React Error Boundaries for unexpected rendering errors. Display user-friendly messages (e.g., Shadcn `Toast` or `Alert`) based on errors returned from Server Actions.
- **Logging:** Implement basic console logging; consider integrating a service like Sentry for production.

### 2.7. Functional Programming & Immutability
- Prefer pure functions where possible.
- Avoid direct state mutation; use functional updates (`setState(prev => ...)`, immutable array/object updates).
- Break down logic into smaller, composable functions.

### 2.8. Styling & UI
- **Shadcn UI:** Leverage pre-built components. Customize via props and Tailwind classes.
- **Tailwind CSS:** Use utility classes for styling. Configure `tailwind.config.js` for the monochrome theme (black/white/grays).
- **Responsiveness:** Design mobile-first using Tailwind's responsive modifiers.
- **Accessibility:** Follow accessibility best practices (semantic HTML, ARIA attributes where needed).

### 2.9. Testing Strategy
- **Unit Tests (Vitest):** Test utility functions, complex logic within components/actions, Zustand stores (if used).
- **Integration Tests (Vitest/RTL):** Test Server Actions (mocking DB calls), interactions between components and actions/state.
- **E2E Tests (Playwright - Optional):** Simulate user flows across multiple pages/modules.
- **Colocation:** Place test files (`*.test.ts(x)`) alongside the code they test.
- **Mocking:** Use Vitest's mocking capabilities for dependencies (DB, external APIs).

### 2.10. Finvoice Generation
- Isolate Finvoice XML generation logic in a dedicated service (`src/lib/services/finvoice.service.ts`).
- Use a reliable XML builder library.
- Map internal types carefully to the Finvoice 3.0 (Netvisor) schema.
- Retrieve Seller Party configuration from application settings.

## 3. Bug Resistance Recommendations

- **Strong Typing & Validation:** The most critical aspect. Be rigorous with TypeScript and Zod at all boundaries.
- **Immutability:** Reduces side effects and makes state changes predictable.
- **Pure Functions:** Easier to test and reason about.
- **Server Actions with Structured Responses:** Centralizes mutation logic and makes error handling consistent.
- **Minimal Client State:** Reduces complexity and potential state synchronization issues.
- **Comprehensive Testing:** Catch regressions and validate logic.
- **Code Reviews:** Ensure adherence to patterns and catch potential issues early.
- **Principle of Least Privilege (RLS):** Prevent unauthorized data access at the database level.

**Note:** This project will commence using a pre-configured Next.js starter template (e.g., `next-ai-starter` or similar), providing a base setup for Next.js, TypeScript, Tailwind, Shadcn UI, and Supabase integration.

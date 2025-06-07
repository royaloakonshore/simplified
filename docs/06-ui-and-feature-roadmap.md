# 06: UI Enhancements and New Feature Roadmap

This document outlines planned UI enhancements using `shadcn/ui` and new feature integrations, such as the Y-tunnus lookup.

## 1. Y-tunnus (Finnish Business ID) Search Functionality

**Objective:** To streamline customer data entry by allowing users to search for and autofill company information using their Y-tunnus (Finnish Business ID / VAT ID) via the PRH (Finnish Patent and Registration Office) open API.

**Relevant API:** PRH YTJ API - [https://avoindata.prh.fi/en/ytj/swagger-ui](https://avoindata.prh.fi/en/ytj/swagger-ui)

**Key Data Points to Fetch (examples, based on typical API responses):**
*   Company Name (`name`)
*   Full Address (`addresses[].street`, `addresses[].postCode`, `addresses[].city`) - may need to find the "primary" or "postal" address.
*   Business ID (`businessId`) - for verification
*   Company Form (`companyForm`)
*   Registration Date (`registrationDate`)
*   VAT Number (if separate or derivable)

**UI Integration (Customer Form - `src/components/customers/CustomerForm.tsx`):**
1.  Add a new input field specifically for "Y-tunnus Search" (distinct from the regular Y-tunnus/VAT ID data field).
2.  Add a "Search" button next to this field.
3.  When the "Search" button is clicked:
    *   Disable the button and show a loading indicator.
    *   The Y-tunnus from the search field is used to make an API call.
4.  On successful API response:
    *   Populate relevant fields in the `CustomerForm` (Name, Address fields, VAT ID if it matches the searched Y-tunnus).
    *   Display a success message (e.g., toast notification: "Company data fetched for [Company Name]").
    *   Re-enable the search button.
5.  On API error or if company not found:
    *   Display an error message (e.g., toast notification: "Could not find company data for Y-tunnus [Y-tunnus]" or "Invalid Y-tunnus format").
    *   Re-enable the search button.
    *   Do not clear already manually entered data in other fields.
6.  Consider a small, non-intrusive display area to show raw fetched data temporarily or key unmatched fields for user review before they "accept" the autofill (optional enhancement).

**Backend Implementation (tRPC Route):**
1.  Create a new protected tRPC procedure (e.g., `customer.getYTunnusInfo`).
2.  Input schema: Zod schema for Y-tunnus format validation.
3.  Procedure Logic:
    *   Takes Y-tunnus as input.
    *   Makes a server-side HTTP GET request to the PRH YTJ API endpoint (e.g., `https://avoindata.prh.fi/bis/v1/{businessId}` or the relevant search endpoint).
    *   Handles API authentication if required (the swagger indicates no auth for basic GETs).
    *   Parses the JSON response.
    *   Maps relevant data fields from the API response to a structured object (defined by a Zod schema) to be returned to the client.
    *   Handles API errors gracefully (network issues, 404, rate limits etc.).

**Error Handling:**
*   Client-side: Validate Y-tunnus format before sending.
*   Server-side: Robust error handling for API calls (timeouts, non-200 responses, unexpected data structure).
*   User feedback: Clear toast notifications for success, failure, or "not found".

**Data Mapping Considerations:**
*   The PRH API provides a rich dataset. Decide which fields are essential for the customer form.
*   Address data might be an array; select the primary or postal address.
*   Ensure mapping aligns with `prisma/schema.prisma` Customer model fields (e.g., `vatId`, `name`, `streetAddress`, `postalCode`, `city`, `country` - may need to default country to "Finland" if not provided by API).

**Future Considerations:**
*   Throttling/debouncing on the client-side search input.
*   Storing the raw API response or a subset of it for audit/reference (e.g., in a new `CustomerApiCache` table or a JSON field on `Customer`).
*   User option to "clear and re-search" or "overwrite existing fields".

## 2. UI Redesign and Enhancements with shadcn/ui

The following UI components and layouts will be updated or implemented using `shadcn/ui` and blocks from `originui` or `shadcn-ui-blocks`. Commands provided are for initial scaffolding; integration will require careful adaptation to existing code and types.

**Global `components.json` Check:**
Ensure `components.json` is configured correctly for aliases (`@/components`, `@/lib/utils`) before running `add` commands.

**A. Sign-in Page Redesign:**
*   **Goal:** Modernize the sign-in page.
*   **Component:** `login-04` from `shadcn-ui-blocks`.
*   **Command:** `npx shadcn-ui@latest add login-04`
*   **Integration:**
    *   The command will likely create files in `src/components/blocks/login-04/`.
    *   Adapt the generated component to replace the current content of `src/app/auth/signin/page.tsx`.
    *   Ensure form submission logic, error handling, and `next-auth/react` `signIn` function calls are correctly wired.
    *   Update styling to match the application's theme.

**B. General Table and Filter Menu Design:**
*   **Goal:** Improve the look and feel of data tables and their filtering UI.
*   **Reference:** [https://21st.dev/originui/table/data-table-with-filters-made-with-tan-stack-table](https://21st.dev/originui/table/data-table-with-filters-made-with-tan-stack-table)
*   **Component Set:** `originui/table`
*   **Command:** `npx shadcn-ui@latest add "https://21st.dev/r/originui/table"`
*   **Integration:**
    *   This will likely add several components related to tables (e.g., `data-table.tsx`, `data-table-column-header.tsx`, `data-table-pagination.tsx`, `data-table-toolbar.tsx`, etc.) potentially under `src/components/ui/`.
    *   Identify key existing tables (e.g., Customers list, Orders list, Invoices list, Inventory list).
    *   Gradually refactor these tables to use the new `originui` table components and structure. This will be a significant task, likely involving changes to how data is passed, columns are defined, and actions (like view, edit, delete) are handled.
    *   Pay close attention to adapting existing `react-table` (if used) or custom table logic to the new structure.
    *   The filter menu design from the example (dropdowns, search inputs in a toolbar) should be implemented.

**C. Sidebar Navigation Redesign:**
*   **Goal:** Update the main application sidebar.
*   **Component:** `sidebar-07` from `shadcn-ui-blocks`.
*   **Command:** `npx shadcn-ui@latest add sidebar-07`
*   **Integration:**
    *   The command will create files in `src/components/blocks/sidebar-07/`.
    *   Integrate this new sidebar structure into `src/app/(erp)/layout.tsx`, replacing or augmenting the current sidebar logic.
    *   Ensure navigation links, active states, and any dynamic content (like user info/company switcher) are correctly ported.
    *   The "user button with image" from `sidebar-07` should be added to the bottom of the sidebar, linking to a user profile/settings page.

**2.C.1. Company Switcher Implementation**

*   **Status:** Implemented
*   **Objective:** Allow users who are members of multiple companies to switch their active company context within the application, impacting data visibility and operations throughout the ERP.
*   **Key Components & Logic:**
    *   **Database Schema (`prisma/schema.prisma`):**
        *   Modified `User` and `Company` models to establish a many-to-many relationship (`CompanyMemberships`), allowing a user to be associated with multiple companies.
        *   Added `activeCompanyId` field (and `activeCompany` relation) to the `User` model to store the ID of the currently selected active company.
        *   A database migration (`add_company_memberships_and_active_company`) was created and successfully applied to reflect these schema changes.
    *   **Authentication (`src/lib/auth/index.ts`):
        *   The NextAuth `jwt` callback was updated to fetch `activeCompanyId` from the user's database record and use it to populate the `companyId` field in the session token. This ensures the session always reflects the user's chosen active company.
    *   **tRPC Backend (`src/lib/api/routers/user.ts`):**
        *   `getMemberCompanies` (Query): A new `protectedProcedure` was added to fetch the list of all companies a user is a member of (leveraging the `CompanyMemberships` relation). It returns essential company details (e.g., `id`, `name`) for the switcher UI.
        *   `setActiveCompany` (Mutation): A new `protectedProcedure` was added that allows a user to set their `activeCompanyId`. This mutation first verifies that the user is indeed a member of the target company before updating the `User.activeCompanyId` in the database.
    *   **UI Component (`src/components/team-switcher.tsx`):**
        *   The existing `TeamSwitcher` component was significantly refactored.
        *   It now uses the `getMemberCompanies` tRPC query to populate the list of companies available for switching.
        *   On selection, it calls the `setActiveCompany` tRPC mutation.
        *   Upon successful mutation, it triggers `useSession().update()` from `next-auth/react` to ensure the NextAuth session (and thereby `session.user.companyId`) is immediately updated to reflect the new active company.
        *   The component includes handling for loading, error, and empty states (e.g., if a user is not part of any companies).
        *   It uses a default icon for companies, as company-specific logos are not yet part of the `Company` model.
    *   **Sidebar Integration (`src/components/AppSidebar.tsx`):**
        *   The refactored and fully functional `TeamSwitcher` component has been integrated into the `AppSidebar`. It is positioned prominently, typically below the main application logo/header, making it easily accessible for users to switch their company context.
*   **Impact & Next Steps:**
    *   This feature provides the core mechanism for users to navigate between different company contexts if they have multiple memberships.
    *   It is a foundational element for enforcing multi-tenancy, as data-access procedures using `companyProtectedProcedure` (which relies on `session.user.companyId`) will now operate correctly based on the selected company.
    *   Further enhancements could include company-specific logos or additional details in the switcher, and refining the UX for users with no or only one company.

**2.C.2. Create New User Functionality**

*   **Status:** Implemented (for Global Admins)
*   **Objective:** Allow Global Administrators to create new users within the system and associate them with the admin's currently active company.
*   **Key Components & Logic:**
    *   **tRPC Backend (`src/lib/api/routers/user.ts`):**
        *   `createUserInActiveCompany` (Mutation): A new `companyProtectedProcedure` was added. This procedure is restricted to users with the `UserRole.admin` (global admin) role.
        *   It takes user details (name, email, password, initial role) as input.
        *   It creates a new `User` record in the database.
        *   The new user is automatically added as a member of the creating admin's `activeCompanyId`.
        *   The new user's `activeCompanyId` is set to the creating admin's `activeCompanyId`.
    *   **UI Integration (`src/app/(erp)/settings/page.tsx`):**
        *   A new "Create User" form, encapsulated within a `Card` component, has been added to the `/settings` page.
        *   This form is conditionally rendered and is only visible to users with `UserRole.admin`.
        *   The form collects the new user's name, email, password, and role (defaulting to `USER`).
        *   On submission, it calls the `createUserInActiveCompany` tRPC mutation.
        *   Appropriate loading states and toast notifications (success/error) are handled.
*   **Impact & Next Steps:**
    *   Global administrators can now onboard new users and assign them to their current company context.
    *   Future enhancements could include inviting users via email, allowing users to set their own password upon first login, or more granular role assignment during creation.

**2.C.3. Create New Company (Tenant) Functionality**

*   **Status:** Implemented (for Global Admins)
*   **Objective:** Allow Global Administrators to create new companies (tenants) in the system. The creating admin is automatically made a member of the new company, and it becomes their active company.
*   **Key Components & Logic:**
    *   **tRPC Backend (`src/lib/api/routers/company.ts`):**
        *   A new router, `companyRouter`, was created and added to the main `appRouter` in `src/lib/api/root.ts`.
        *   `create` (Mutation): A new `protectedProcedure` (available to any authenticated user, but UI might restrict to admins) was added to this router.
        *   It takes the new company's name as input.
        *   It creates a new `Company` record.
        *   It adds the currently authenticated user (the creator) as a member of this new company through the `CompanyMemberships` relation.
        *   It updates the creator's `activeCompanyId` to the ID of the newly created company.
    *   **UI Integration (`src/components/team-switcher.tsx`):**
        *   The "Add Company" / "Create Company" functionality within the `TeamSwitcher` component has been enhanced.
        *   A dialog (`CreateCompanyDialog`) is presented when a user (typically an admin, based on UI conditional rendering) clicks "Create Company".
        *   This dialog contains a form to input the new company's name.
        *   On submission, it calls the `company.create` tRPC mutation.
        *   Upon successful creation, the session is updated (`useSession().update()`) to reflect the new `activeCompanyId`, and the list of companies in the switcher is refreshed (via `utils.user.getMemberCompanies.invalidate()`).
*   **Impact & Next Steps:**
    *   Global administrators can now provision new tenants/companies.
    *   The creating admin is seamlessly transitioned into the context of the new company.
    *   Future enhancements could include more detailed company setup options during creation (e.g., address, default currency, etc.) and specific UI for managing tenants by super-admins.

**D. User and Customer Edit Page/Dialog Design:**
*   **Goal:** Standardize the UI for editing entities, possibly using dialogs for a smoother UX.
*   **Reference:** [https://21st.dev/originui/dialog/edit-profile-dialog](https://21st.dev/originui/dialog/edit-profile-dialog)
*   **Component Set:** `originui/dialog` (likely uses shadcn `Dialog` and `Form` components)
*   **Command:** `npx shadcn-ui@latest add "https://21st.dev/r/originui/dialog"`
*   **Integration:**
    *   This will add dialog components and potentially form components to `src/components/ui/`.
    *   For User Edit:
        *   Create a new page or use a dialog for `/settings/profile` (or similar).
        *   The form within should allow users to update their name, password (with confirmation), and potentially other profile details.
    *   For Customer Edit:
        *   Currently, edit likely happens on a full page (e.g., `/customers/[id]/edit`).
        *   Consider if converting this to an "Edit Customer" dialog (launched from the customers list or detail page) improves workflow. If so, reuse the `CustomerForm.tsx` within the new `originui` dialog structure.
        *   If full pages are preferred, ensure the form elements within `CustomerForm.tsx` adopt the styling inspired by the reference.
    *   This task focuses on the *presentation* of edit forms. The underlying `CustomerForm.tsx` or a new `UserEditForm.tsx` will still handle the form logic and data submission.

**E. General Form Layout and Feel:**
*   **Goal:** Ensure all forms (create, edit) have a consistent, modern, and user-friendly stacked layout.
*   **Reference:** [https://www.shadcn-ui-blocks.com/examples/form-layouts/stacked](https://www.shadcn-ui-blocks.com/examples/form-layouts/stacked)
*   **Integration:**
    *   This is more of a design principle than a single component to add.
    *   Review existing forms (e.g., `CustomerForm.tsx`, `OrderForm.tsx`, `InvoiceForm.tsx`).
    *   Ensure they use `shadcn/ui` components like `Input`, `Label`, `Button`, `Select`, `Checkbox`, `Textarea` correctly.
    *   Apply consistent spacing, typography, and layout as demonstrated in the "stacked" example. This primarily involves Tailwind CSS utility classes for margins, padding, and flexbox/grid layouts within the forms.
    *   No specific `add` command here, but rather a refactoring effort on existing forms to align with the visual style. Use the `Form` component from `shadcn/ui` (`@/components/ui/form`) which integrates `react-hook-form` and Zod for a cohesive structure.

**Implementation Notes for UI Redesigns:**
*   **Iterative Approach:** Implement these UI changes one by one to manage complexity.
*   **Component Reusability:** Leverage `shadcn/ui`'s composability.
*   **Responsiveness:** Ensure all new UI components are responsive.
*   **Accessibility:** Maintain accessibility standards.
*   **Testing:** Thoroughly test each UI change across different browsers and devices.
*   **Backup:** Before running `npx shadcn-ui@latest add ...`, ensure your `components.json` is correctly configured and commit any pending changes. The `add` command can sometimes overwrite existing files if names conflict or if it installs dependencies.
*   **File Locations:** The `add` commands might place new components directly into `src/components/ui/` or into `src/components/blocks/`. Be mindful of these locations and adjust imports or file locations as needed to maintain project structure. Prefer moving block-like structures to `src/components/blocks/` and utility/UI primitives to `src/components/ui/`.

This roadmap provides a structured approach to these enhancements.

## 3. Dashboard Enhancements Plan

**Objective:** To create a comprehensive and interactive dashboard providing key business metrics and insights at a glance, with real-time data updates and customizable date filtering.

**Inspiration:** `dashboard-01` block from [https://ui.shadcn.com/blocks#blocks](https://ui.shadcn.com/blocks#blocks) and user-provided examples.

**Location:** `src/app/(erp)/dashboard/page.tsx`

**Key Features & Implementation Notes:**

**A. Real-time Updates:**
*   **Goal:** Synchronize changes across the application, such as inventory updates or Kanban task movements, reflecting them on the dashboard without requiring a manual refresh.
*   **To-Do:**
    *   Investigate and decide on a real-time update mechanism. Options include:
        *   WebSockets (e.g., using `socket.io` or a managed service).
        *   Server-Sent Events (SSE).
        *   Polling with tRPC queries (could leverage Inngest events to trigger client-side refetching via a context or Zustand store).
        *   Services like Supabase Realtime or Pusher if integrating external services is an option.
    *   Implement chosen mechanism to push or trigger updates for relevant data points (e.g., new orders, inventory level changes affecting replenishment).

**B. Date Range Selectors & Filtering:**
*   **Goal:** Allow users to filter dashboard visualizations based on a selected date range ('From' and 'To' dates).
*   **Component:** `originui/calendar` (added via `npx shadcn@latest add calendar -p originui`).
*   **Integration:**
    *   Utilize the `DateRangePicker` component created at `src/components/ui/date-range-picker.tsx`.
    *   Place this component prominently on the dashboard, likely in the header section.
*   **To-Do:**
    *   Connect the selected date range to the tRPC procedures that fetch data for the dashboard visualizations.
    *   Ensure all relevant charts and tables update dynamically when the date range changes.
    *   Implement weekly/monthly toggle for the revenue trend chart, which will also interact with the date range.

**C. Statistics Cards (Top Section):**
*   **Goal:** Display key performance indicators (KPIs) with comparison percentages.
*   **Layout:** Four cards at the top of the dashboard.
*   **Metrics:**
    1.  **Shipped Orders (Period):** Count of orders marked 'Shipped' within the selected date range. Comparison to the previous equivalent period.
    2.  **Pending Production:** Count of orders currently in 'Pending' or 'In Production' status. Comparison could be to an average or a target.
    3.  **Late Orders:** Count of orders whose delivery date is past and are not yet 'Shipped'. Comparison to the previous period.
    4.  **Total Revenue (Period):** Sum of revenue from invoiced orders within the selected date range. Comparison to the previous equivalent period.
*   **Placeholder:** `StatsCard` component implemented in `src/app/(erp)/dashboard/page.tsx`.
*   **To-Do:**
    *   Create tRPC procedures to fetch data for each stat, accepting `companyId` (from context) and date range as input.
    *   Implement logic for calculating comparison percentages (e.g., ((currentPeriod - previousPeriod) / previousPeriod) * 100).
    *   Wire up the `StatsCard` components to display fetched data.

**D. Revenue Trend Chart (Middle Section):**
*   **Goal:** Visualize revenue trends over time with a comparison to a previous period.
*   **Chart Type:** Wide area chart (e.g., using `recharts` as per user example).
*   **Features:**
    *   Primary line for current period revenue.
    *   Secondary line/area for previous period comparison (e.g., previous month, previous year's same period).
    *   Toggles for "Weekly" / "Monthly" data aggregation view.
*   **Placeholder:** `PlaceholderAreaChart` component in `src/components/dashboard/PlaceholderAreaChart.tsx`.
*   **To-Do:**
    *   Create a tRPC procedure to fetch aggregated revenue data (e.g., daily, weekly, or monthly sums based on the selected view and date range). This will need to fetch relevant invoice data.
    *   Implement the area chart using a library like `recharts`, ensuring it's responsive.
    *   Connect the chart to the date range selectors and weekly/monthly toggles.

**E. Bottom Tables (Height-Limited):**
*   **Goal:** Display recent activity and critical alerts in compact, scrollable tables.
*   **Layout:** Two tables side-by-side or stacked, each with a limited height and internal scrolling.

    **1. Recent Orders Table:**
    *   **Content:** Display a list of the most recent orders (e.g., last 10-15 orders) with key details like Order ID, Customer Name, Status, and Order Date.
    *   **Placeholder:** `PlaceholderRecentOrdersTable` in `src/components/dashboard/PlaceholderRecentOrdersTable.tsx`.
    *   **To-Do:**
        *   Create a tRPC procedure to fetch recent orders (e.g., `order.list` with appropriate sorting and limit).
        *   Implement a compact data table (e.g., using `shadcn/ui Table` or parts of `originui/table` if suitable for a compact view) to display the data.
        *   Consider making rows clickable to navigate to the order detail page.

    **2. Replenishment Alerts Table:**
    *   **Content:** Display inventory items that are below their defined `reorderLevel` or `minimumStockLevel`. Show Item Name/SKU, Current Stock, Reorder Level.
    *   **Placeholder:** `PlaceholderReplenishmentTable` in `src/components/dashboard/PlaceholderReplenishmentTable.tsx`.
    *   **To-Do:**
        *   Create a tRPC procedure to fetch inventory items requiring replenishment.
        *   Implement a compact data table to display these alerts.
        *   Consider quick actions like "Create Purchase Order" (future enhancement).

**General Implementation Notes for Dashboard:**
*   **Data Fetching:** All data should be fetched via tRPC procedures. These procedures must be company-scoped using `companyProtectedProcedure` where applicable.
*   **Loading States:** Implement appropriate loading skeletons or indicators for each dashboard section while data is being fetched. The current placeholder components serve as a basic visual.
*   **Error Handling:** Gracefully handle errors if data fetching fails for any section, displaying informative messages.
*   **Responsiveness:** Ensure the entire dashboard layout and its components are responsive across different screen sizes.
*   **Permissions:** Dashboard data should respect user roles and permissions if certain metrics are sensitive (though initially, assume all authenticated users within a company can see the full dashboard).

## Phase 3: Core Feature Enhancements (Near-Term)

-   **Invoice Actions Refactor:**
    -   **Description:** Consolidate invoice actions (status changes, export PDF/XML, copy, credit note) into a unified dropdown menu on both the invoice detail page and invoice list rows. Remove redundant buttons.
    -   **Priority:** High
    -   **Status:** Planned
-   **Orders Table Enhancements:**
    -   **Description:** Add VAT Amount and Order Type (Quote/Work Order pill) columns to the Orders table. Implement multi-select checkboxes and sorting for new columns.
    -   **Priority:** High
    -   **Status:** Planned
-   **Free Text Tags (Inventory & BOM):**
    -   **Description:** Allow users to add searchable free-text tags to Inventory Items and Bills of Materials for better categorization and searching.
    -   **Priority:** Medium
    -   **Status:** Planned

## Phase 4: Advanced Inventory & Product Management (Mid-Term)

-   **Bill of Material (BOM) Variants:**
    -   **Description:** Implement functionality for creating and managing product variants from a template BOM. This includes defining variant attributes, auto-generating variant SKUs (editable), and copying the template BOM to new variants for further modification.
    -   **Priority:** Medium-High (Core for manufacturing)
    -   **Status:** Planned
    -   **Notes:** Requires careful data modeling and workflow design, drawing inspiration from ERPNext.
-   **Inventory Data Management via Excel Import/Export:**
    -   **Description:** Enable users to export the inventory list to Excel, make bulk changes or add new items in the Excel file, and import it back to update inventory records, with robust validation and a preview/confirmation step.
    -   **Priority:** Medium
    -   **Status:** Planned
    -   **Notes:** Library `Siemienik/XToolset` identified for consideration. Focus on data integrity and user safeguards.

## Phase 5: Future Considerations & Polish (Long-Term)

-   **Advanced BOM Variant Attribute System:** 
    -   **Description:** If the initial JSON-based attribute system for BOM variants proves limiting, consider a more structured approach (e.g., separate `ItemAttribute` models) for better querying, management, and definition of attribute types.
    -   **Priority:** Low-Medium
    -   **Status:** Idea
-   **Batch Actions for Orders:**
    -   **Description:** Based on the multi-select functionality in the Orders table, implement useful batch actions (e.g., batch status update, batch export).
    -   **Priority:** Low-Medium
    -   **Status:** Idea
-   **Enhanced PDF Generation Options/Templates:**
    -   **Description:** Provide more customization or templates for PDF exports (invoices, orders, etc.). Investigate a shared PDF templating engine.
    -   **Priority:** Low
    -   **Status:** Idea
-   **Excel Import Safeguards - Advanced:**
    -   **Description:** For Excel inventory import, explore advanced safeguards like data versioning or temporary staging areas for easier rollback, especially for very large datasets or critical updates.
    -   **Priority:** Low
    -   **Status:** Idea

## X. Bill of Materials (BOM) UI Development

- **Objective:** Create a user-friendly interface for managing Bills of Materials.
- **Status:** Initial scaffolding in progress.
- **Key Components Created:**
    - `src/components/boms/BOMForm.tsx` (for creating and editing BOMs)
    - `src/components/boms/BOMTable.tsx` (for listing BOMs)
    - `src/components/ui/combobox-responsive.tsx` (reusable component for item selection)
- **Page Structure:**
    - `src/app/(erp)/boms/page.tsx` (List View)
    - `src/app/(erp)/boms/add/page.tsx` (Add New BOM)
    - `src/app/(erp)/boms/[id]/edit/page.tsx` (Edit BOM)
    - `src/app/(erp)/boms/[id]/page.tsx` (View Single BOM - Currently blocked by build error)
- **Recent Updates:**
    - The link between a BOM and a manufactured item (`manufacturedItemId`) is now optional, allowing more flexibility in BOM creation.
- **Next Steps for UI:**
    - Resolve the build error for the BOM view page.
    - Finalize `BOMForm.tsx`, including implementing an enhanced table-based multi-select UI for adding numerous raw material components efficiently.
    - Implement delete functionality for BOMs and their components.
    - Thoroughly test all CRUD operations and UI interactions. 
# Product Admin Dashboard

A modern, responsive admin dashboard for managing products, built with Next.js (App Router), Tailwind CSS, and Axios, consuming the DummyJSON API.

## Features Finished

- **Authentication**: Login page (`/login`) with error handling. Only authenticated users can access the dashboard.
- **Product List**: Responsive table on desktop and card view on mobile.
- **Pagination**: Server-side pagination with customizable page sizes (10, 20, 50).
- **Search & Filter**: Debounced search functionality and category filtering. (Note: Search clears category, and category clears search due to API limitations).
- **Sorting**: Sort by price, rating, or title.
- **Product Details**: Dedicated page (`/products/[id]`) showing product info, images, and reviews. Handles 404s gracefully.
- **Simulated Mutability**: Add, Edit, and Delete actions with optimistic local state updates so changes reflect immediately in the UI.
- **UX Polish**: Loading spinners, empty states, error states with retry functionality, and a beautiful premium design.

## Setup Steps

1. Clone the repository.
2. Ensure you have Node.js installed (v18+ recommended).
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the development server (Note: Webpack is enforced for compatibility):
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.
6. Login credentials:
   - Username: `emilys`
   - Password: `emilyspass`

## Development Notes

### Architectural Choices
- **Next.js App Router**: Used for modern React server/client paradigms and file-based routing. 
- **Axios Interceptors**: A single global Axios instance was created (`src/lib/api.ts`) to automatically attach the JWT token to every request and globally catch `401 Unauthorized` responses to redirect users to login.
- **Custom `useDebounce` Hook**: Used to delay search API calls by 500ms, reducing unnecessary network requests while typing. An `AbortController` was also implemented in the API call to cancel stale requests and prevent race conditions.
- **Local State for Mutations**: Since DummyJSON doesn't persist POST/PUT/DELETE requests, I implemented a local `localModifications` state. When a product is modified, the change is saved locally and merged with the API response, giving the illusion of a fully functional backend during the session.

### Problem Faced & Solution
**Problem**: The Next.js 16.3.6 default bundler (Turbopack) crashed on the local Windows environment due to missing native WebAssembly bindings. Additionally, the Next.js `middleware.ts` convention was throwing a deprecation warning indicating it should be a `proxy` export.
**Fix**: I solved the bundler issue by updating the `package.json` scripts to explicitly use Webpack (`next dev --webpack` and `next build --webpack`). For the middleware deprecation, I renamed `middleware.ts` to `proxy.ts` and updated the exported function name to `proxy` to comply with the latest Next.js 16 requirements.

### AI Assistance
AI was highly beneficial in scaffolding the initial Next.js boilerplate, generating the Tailwind CSS layout structure (especially the responsive table-to-cards conversion), and rapidly generating the boilerplate for Axios interceptors and the complex local state merging logic for fake mutability. AI also helped diagnose and fix the Turbopack and proxy.ts issues encountered with the bleeding-edge Next.js version.

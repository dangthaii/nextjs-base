# Technical Stack

> Last Updated: 2025-08-29
> Version: 1.0.0

## Application Framework

- **Framework:** Next.js 15 (App Router)
- **Version:** 15.0.3
- **Language:** TypeScript 5.7.2
- **Runtime:** Node.js
- **Development Server:** Turbopack

## Database

- **Primary Database:** CockroachDB
- **ORM:** Prisma
- **Schema Management:** Prisma migrations via db push

## JavaScript

- **Framework:** React 19.0.0
- **State Management:** React Query (@tanstack/react-query)
- **Form Management:** React Hook Form with Zod validation
- **Import Strategy:** ES6 modules

## CSS Framework

- **Framework:** Tailwind CSS v4
- **Configuration:** app/globals.css (v4 format)

## UI Component Library

- **Primary Library:** Radix UI
- **Custom Components:** Located in /components/ui
- **Icon Library:** Lucide React

## Fonts Provider

- **Provider:** Next.js built-in font optimization
- **Default:** System fonts

## Testing Framework

- **Test Runner:** Vitest
- **Testing Library:** React Testing Library
- **Coverage:** Built-in Vitest coverage

## Authentication

- **Strategy:** JWT with refresh tokens
- **Implementation:** Custom middleware.ts

## AI Integration

- **Provider:** Google Gemini API
- **Features:** Text annotations, image generation
- **Image Storage:** Cloudinary

## Application Hosting

- **Platform:** TBD
- **Deployment Solution:** TBD

## Database Hosting

- **Provider:** CockroachDB Cloud
- **Connection:** DATABASE_URL environment variable

## Asset Hosting

- **Images:** Cloudinary
- **Static Assets:** Next.js built-in optimization

## Code Repository

- **Platform:** Git
- **Repository URL:** TBD

## Development Tools

- **Linting:** ESLint
- **Code Quality:** TypeScript strict mode
- **Package Manager:** npm
- **Build Tool:** Next.js compiler with Turbopack
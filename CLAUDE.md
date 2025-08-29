# CLAUDE.md

## Development Commands

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build the application for production
- `npm start` - Start the production server
- `npm run lint` - Run ESLint to check code quality

## Database Commands

- `npx prisma db push` - Push schema changes to database
- `npx prisma migrate dev` - Create and apply new migration
- `npx prisma studio` - Open Prisma Studio for database browsing
- `npx prisma generate` - Generate Prisma client after schema changes

## Project Architecture

This is a Next.js 15 reading application with text annotation and AI-powered features:

### Core Technologies

- **Framework**: Next.js 15 (App Router)
- **Database**: CockroachDB with Prisma ORM
- **Authentication**: JWT-based with refresh tokens
- **Styling**: TailwindCSS v4
- **UI Components**: Radix UI with custom components in `/components/ui`
- **AI Integration**: Google Gemini for annotations, Cloudinary for image generation

### Database Schema

The application centers around a hierarchical content structure:

- **Users** (with role-based permissions: admin/null)
- **Articles** (belong to users)
- **Paragraphs** (belong to articles, ordered)
- **Sentences** (belong to paragraphs, ordered, contain annotations as JSON)
- **GeneratedImages** (belong to paragraphs, multiple images per paragraph)

### Key Features

1. **Text Annotation**: Users can select text to get AI-powered Vietnamese translations
2. **Image Generation**: Admin users can generate images for selected text using AI
3. **Reading Position Memory**: Automatically saves and restores scroll position
4. **Shared AI Panel**: Unified panel system for all AI-powered text analysis features
5. **Role-based Access**: Admin features for image generation

### Important Files

- `middleware.ts` - JWT authentication and route protection
- `lib/prisma.ts` - Database client singleton
- `app/articles/[id]/page.tsx` - Main article reading interface
- `components/ExplanationPanel.tsx` - Shared panel for AI text analysis features
- `components/ParagraphWithImageGeneration.tsx` - Handles image generation UI
- `hooks/useAuth.ts` - Authentication state management
- `hooks/useScrollPosition.tsx` - Reading position persistence

### API Structure

- `/api/auth/*` - Authentication endpoints
- `/api/gemini` - AI annotation processing

### Development Notes

- TypeScript and ESLint errors are ignored in build (see next.config.ts)
- Uses React Query for data fetching and caching
- Implements optimistic updates for annotations

### Environment Variables Required

- `DATABASE_URL` - CockroachDB connection string
- Google AI API keys for Gemini
- Cloudinary configuration for image hosting

**IMPORTANT**: Always await `params` before accessing properties in API routes:

```typescript
// ✅ Correct - await params first
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Use id here...
}

// ❌ Incorrect - accessing params directly
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id; // This causes warnings
}
```

### Styling (Tailwind CSS v4)

- **Using Tailwind CSS v4** - Different from v3, uses new configuration format
- **Configuration location**: `app/globals.css` (NOT tailwind.config.js)

## Environment Requirements

- CockroachDB database (connection via `DATABASE_URL`)
- Cloudinary account for image storage
- Google Gemini AI API access

## Development Notes

- Don't need to run server again, always avalaible on localhost:3000

## CRITICAL WARNINGS

- **NEVER use `prisma migrate reset --force`** - This deletes ALL database data permanently!
- Never use any way that can remove all data in database
- Using npx prisma db push or npx prisma db pull to migrate db, don't use npx prisma migrate dev

## Database Operations Notes

- Write script when need to check database data, migrate or modify.

- when complete task, don't need to check is it working, I will check, don't run like npm run build or npm run build, or npm run dev

- Please use @lib\gemini.ts to request to AI instead call directly

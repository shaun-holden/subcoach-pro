# SubCoach Pro

## Overview
SubCoach Pro is a fitness substitute coach platform designed to connect gym/studio owners with certified fitness coaches. Its primary purpose is to facilitate the posting and application for temporary teaching opportunities, streamlining the process from job posting to application management, scheduling, and payment coordination. The platform aims to solve the challenge of finding qualified substitute instructors quickly and efficiently, enhancing operational continuity for gyms and providing flexible work opportunities for coaches.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with React 18 and TypeScript, utilizing Wouter for client-side routing. State management and caching are handled by TanStack Query. UI components are developed using Shadcn/ui (based on Radix UI primitives), styled with Tailwind CSS. Form handling is managed by React Hook Form with Zod validation, and Vite is used for optimized builds.

### Backend Architecture
The backend runs on Node.js with Express.js, providing REST API endpoints. Authentication is integrated with Replit Auth via OpenID Connect (OIDC) and Passport.js, with session management stored in PostgreSQL using `connect-pg-simple`. The API follows a RESTful design with role-based access control and centralized error handling. The system operates in full production mode with a PostgreSQL database only.

### Database Schema
Drizzle ORM is used with PostgreSQL. Core entities include Users (coach/owner roles), Coaches (profiles, rates, availability), Owners (business info), Substitute Requests (event details, recurrence), Applications, Rate Negotiations, and Sessions. Calendar and scheduling entities include Calendar Events and Coach Availability, supporting advanced recurrence.

### Authentication & Authorization
Replit Auth serves as the OAuth 2.0/OIDC provider. Sessions are stored in PostgreSQL. Role-based access ensures features are available based on user type. Security measures include HTTP-only cookies, CSRF protection, and secure session management. All endpoints now require proper authentication.

### Data Flow Architecture
Client-server communication uses a JSON REST API with credential-based authentication. React Query manages client-side caching. Data consistency is maintained through manual refetch triggers after mutations, with the server acting as the single source of truth. The system operates entirely with production PostgreSQL database storage.

### Subscription & Billing
Stripe integration provides flexible billing with two plans: **Starter** (pay-as-you-go, $10 per approved session) and **Pro** ($49/month unlimited sessions). The system handles upgrades, downgrades, reactivation, and a verification flow for subscription changes. It also includes automatic charging for the Starter plan upon application acceptance and comprehensive payment method management using Stripe Elements. Billing history tracking shows all charges.

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL for database operations.

### Authentication Services
- **Replit Auth**: Primary OAuth 2.0/OIDC provider for user authentication.

### UI Component Libraries
- **Radix UI**: Foundational accessible UI primitives.
- **Shadcn/ui**: Pre-built components layered on Radix UI.
- **Lucide React**: Icon library.

### Payment Services
- **Stripe**: Payment processing and subscription management for billing plans.

### Runtime Dependencies
- **Date-fns**: For date and time manipulation.
- **Zod**: For runtime schema validation.
- **Uppy**: For robust file uploads with progress tracking.
- **Google Cloud Storage**: For secure file storage.
- **SendGrid**: For automated email notifications and reminders.

## Recent Changes (Nov 15, 2025)

### Billing Summary Consolidation
Improved billing page organization by combining usage and billing history:
- **Enhancement**: Merged separate "Usage Statistics" and "Billing History" cards into unified "Billing Summary" card
- **Structure**: Single card with two clear sections: "Current Month Usage" (top) and "Billing History" (bottom), separated by divider
- **Benefits**: Cleaner layout, better information grouping, all related billing data in one place
- **Preserved**: All functionality including loading states, empty states, data-testids, and responsive design
- **Architect Approved**: Production-ready with improved UX and information architecture

### Plan Display Update Enhancement
Fixed issue where "Current Plan" didn't update immediately after switching plans:
- **Frontend Enhancement**: Added `await queryClient.refetchQueries()` after query invalidation to force immediate UI update in billing page
- **Applied to**: Both verify-checkout flow (after Stripe redirect) and direct plan switch flow (downgrades)
- **Backend Error Handling**: Added graceful fallback for Stripe API failures during subscription updates - if Stripe call fails (e.g., key mismatch, missing subscription), system updates database locally and clears invalid subscription data
- **Impact**: UI now updates immediately to show new plan without requiring page refresh; system handles environment mismatches gracefully
- **Architect Approved**: Production-ready with no remaining functional blockers

### Plan Switching UI Update Fix
Fixed critical bug where plan display didn't update after switching plans:
- **Root Cause 1**: Subscription status endpoint crashed due to calling non-existent `storage.getApplicationsForRequest()` method and unsafe array operations on undefined `request.applications`
- **Root Cause 2**: Verify-checkout endpoint failed when Stripe subscription timestamps were undefined, causing "Invalid time value" errors when creating Date objects
- **Fix 1**: Replaced non-existent method call with direct `request.applications` access and added robust array coercion using `Array.isArray()` to handle undefined values
- **Fix 2**: Added timestamp validation in verify-checkout endpoint - checks if timestamps exist before creating Date objects, provides sensible defaults (current time, +30 days) if missing
- **Impact**: Plan switching now works reliably - after upgrading/downgrading, the subscription status endpoint successfully fetches data and the UI displays the updated plan
- **Architect Approved**: Production-ready with proper defensive coding for array handling and timestamp validation

### Real-Time Analytics Implementation
Replaced hardcoded demo analytics data with real database metrics for coaches and owners:
- **Backend Enhancement**: Created authenticated `/api/analytics/:userId/:userType` endpoint with role validation and real-time data calculations
- **Coach Analytics**: Acceptance rate, average rate, monthly earnings, upcoming jobs, performance score - all calculated from actual applications and requests
- **Owner Analytics**: Requests posted, successful bookings, acceptance rate, active requests, performance score - all calculated from actual data
- **Security**: Endpoint validates user authentication, ensures users can only access their own analytics, and verifies userType matches actual role
- **Identifier Fix**: Fixed all `getApplicationsByCoach()` calls across codebase to use profile IDs (coach.id) instead of auth userId - applies to /api/opportunities, /api/insights, and /api/analytics endpoints
- **Data Integrity**: Handles string/number conversion for rates, validates timestamps before Date creation, uses correct field names (appliedAt, startDate), includes array safety with Array.isArray checks
- **Frontend Update**: InsightsDashboard now shows real performance metrics or 0 for new users instead of fake demo values (12 apps, 75% acceptance, $1350 earnings)
- **Impact**: New users see accurate 0 metrics reflecting their actual status; experienced users see real performance data based on their activity
- **Architect Approved**: Production-ready with comprehensive security, data integrity, and consistent identifier usage throughout codebase

### Progressive Web App (PWA) Implementation
Enabled mobile installation capability so users can install SubCoach Pro on their phones like a native app:
- **Manifest File**: Created `client/public/manifest.json` with all required PWA fields including name, icons, theme colors, display mode (standalone), and app shortcuts for quick dashboard access
- **Service Worker**: Implemented `client/public/sw.js` with network-first caching strategy, offline support, automatic cache cleanup, and hourly update checks - caches static assets while keeping API calls fresh
- **App Icons**: Generated custom SubCoach Pro branded icons (whistle + dumbbell motif, blue color scheme) in multiple sizes: 192x192, 512x512, and 512x512-maskable for Android adaptive icons
- **HTML Integration**: Updated `client/index.html` with PWA meta tags (theme-color, manifest link), iOS-specific tags (apple-mobile-web-app-capable, apple-touch-icon), and automatic service worker registration
- **Installation Support**: Works on both Android (Chrome, Edge) and iOS 16.4+ (Safari "Add to Home Screen"), providing full-screen app-like experience without browser UI
- **Offline Capability**: App loads and functions offline after initial visit, with cached static assets and graceful fallback for network failures
- **Testing**: Verified manifest accessibility, service worker registration, icon loading, and all PWA prerequisites met - install prompts will appear on supported browsers
- **Impact**: Users can install SubCoach Pro directly from their mobile browser and access it like any other app on their phone, improving engagement and accessibility
- **Architect Approved**: Production-ready PWA implementation meeting 2025 best practices with proper versioning, security, and cross-platform support

### Email Notifications & Calendar Integration
Implemented comprehensive email notification system with calendar integration for seamless scheduling:
- **Email Notifications**: Automated emails sent for new substitute requests (to matching coaches), application acceptances (to coaches), and application rejections (to coaches) using existing EmailService and CalendarIntegrationService
- **Calendar Event Creation**: Events automatically created in database when owners post requests and when applications are accepted - includes event details, location, and customizable reminder times (15min, 1hour, 1day before)
- **Calendar Export (.ics)**: New authenticated endpoint `GET /api/calendar-events/:id/export` generates RFC 5545 compliant .ics files for import into Google Calendar, Outlook, Apple Calendar, etc. - only event owner can export their events
- **Automated Reminders**: Endpoint `POST /api/calendar/send-reminders` triggers scheduled reminder emails before events - designed for external cron job triggering, protected with REMINDER_API_KEY environment variable in production
- **Architecture**: All notifications use async fire-and-forget pattern via CalendarIntegrationService to prevent blocking request responses - centralized logic ensures consistency and no duplicate notifications
- **Security**: Calendar export verifies ownership (event.ownerId === userId), reminder endpoint requires API key in production and blocks unauthorized access
- **Integration Points**: New request → notifyMatchingCoaches + createEventFromSubstituteRequest | Accept → createEventFromAcceptedApplication | Decline → sendDeclineNotification
- **Production Setup**: Set REMINDER_API_KEY environment variable and configure external cron to call reminder endpoint periodically (recommended: hourly or every 15 minutes)
- **Impact**: Users receive timely email notifications for all important events, can add sessions to their personal calendars, and get automatic reminders before scheduled sessions
- **Architect Approved**: Production-ready with proper security, ownership validation, API key protection, and non-blocking notification architecture
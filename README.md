# Mind365

Mind365 is a modern personal growth dashboard built with Next.js, TypeScript, Tailwind CSS, Chart.js, Framer Motion, and Capacitor.

It helps you:
- log daily mood, thoughts, reading, and study sessions
- keep a quote and deep-thinking library
- review weekly/monthly growth metrics
- visualize progress with animated charts
- package the app as Android mobile app via Capacitor

## Tech Stack

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- Framer Motion
- Chart.js (`react-chartjs-2`)
- Capacitor (`@capacitor/core`, `@capacitor/android`)
- LocalStorage (no backend)

## Run Locally (Web)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Capacitor (Android)

Capacitor is configured as:
- App name: `Mind365`
- Package ID: `com.mind365.app`
- Web assets directory: `out`

Build static web assets and sync Android project:

```bash
npm run mobile:android
```

Open Android Studio project:

```bash
npm run cap:android
```

## Data Storage

LocalStorage keys:
- `daily_logs`
- `quotes`
- `notes`
- `settings`

Schemas:

```ts
// daily_logs
{
  id: string
  createdAt: string
  date: string
  mood: number
  thoughts: string
  reading: string
  studyHours: number
  tags: string[]
}

// quotes
{
  id: string
  text: string
  author: string
  book: string
  tags: string[]
}

// notes
{
  id: string
  title: string
  content: string
  tags: string[]
}
```

## Pages

- `/` Overview
- `/daily-log` Journal
- `/timeline` Timeline
- `/journal?id=<entryId>` Journal entry detail
- `/quotes` Quote Library
- `/notes` Deep Thinking
- `/weekly-review` Weekly Review
- `/monthly-review` Monthly Review
- `/analytics` Data Dashboard
- `/settings` Settings

## Scripts

- `npm run dev` - start development server
- `npm run build` - static production build (outputs `out/`)
- `npm run lint` - run lint checks
- `npm run build:web` - build static web assets for Capacitor
- `npm run cap:copy` - copy `out/` assets into Capacitor platforms
- `npm run cap:sync` - sync Capacitor platforms and plugins
- `npm run cap:android` - open Android project in Android Studio
- `npm run mobile:android` - build static assets + sync Android platform
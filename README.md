# Mind365

Mind365 is a modern personal growth dashboard built with Next.js, TypeScript, Tailwind CSS, Chart.js, and Framer Motion.

It helps you:
- log daily mood, thoughts, reading, and study sessions
- keep a quote and deep-thinking library
- review weekly/monthly growth metrics
- visualize progress with animated charts

## Tech Stack

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- Framer Motion
- Chart.js (`react-chartjs-2`)
- LocalStorage (no backend)

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data Storage

LocalStorage keys:
- `daily_logs`
- `quotes`
- `notes`

Schemas:

```ts
// daily_logs
{
  id: string
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
- `/quotes` Quote Library
- `/notes` Deep Thinking
- `/weekly-review` Weekly Review
- `/monthly-review` Monthly Review
- `/analytics` Data Dashboard

## Folder Structure

```text
.
├─ public
│  └─ illustrations
├─ src
│  ├─ app
│  │  ├─ analytics/page.tsx
│  │  ├─ daily-log/page.tsx
│  │  ├─ monthly-review/page.tsx
│  │  ├─ notes/page.tsx
│  │  ├─ quotes/page.tsx
│  │  ├─ timeline/page.tsx
│  │  ├─ weekly-review/page.tsx
│  │  ├─ globals.css
│  │  ├─ layout.tsx
│  │  └─ page.tsx
│  ├─ components
│  │  ├─ charts
│  │  │  ├─ bar-chart-card.tsx
│  │  │  ├─ chart-registry.ts
│  │  │  └─ line-chart-card.tsx
│  │  ├─ dashboard
│  │  │  └─ summary-card.tsx
│  │  ├─ layout
│  │  │  ├─ app-shell.tsx
│  │  │  └─ nav-items.ts
│  │  └─ ui
│  │     ├─ button.tsx
│  │     ├─ empty-state.tsx
│  │     ├─ illustration.tsx
│  │     ├─ input.tsx
│  │     ├─ page-title.tsx
│  │     ├─ page-transition.tsx
│  │     ├─ panel.tsx
│  │     └─ textarea.tsx
│  ├─ lib
│  │  ├─ analytics.ts
│  │  ├─ cn.ts
│  │  ├─ date.ts
│  │  ├─ storage-store.ts
│  │  └─ storage.ts
│  └─ types
│     └─ index.ts
├─ package.json
└─ README.md
```

## Scripts

- `npm run dev` - start development server
- `npm run build` - build production bundle
- `npm run start` - run production server
- `npm run lint` - run lint checks

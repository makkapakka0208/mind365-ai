# Mind365

Mind365 is a personal growth dashboard built with Next.js, TypeScript, Tailwind CSS, Chart.js, Framer Motion, Supabase, and Capacitor.

## Features

- 写日记：记录情绪、学习时长、阅读记录和反思
- 日记详情：点击时间线卡片查看完整内容并编辑
- 周 / 月 / 年复盘：图表统计 + 可选 AI 复盘
- 灵感书库：保存金句并展示今日推荐
- 深度思考：记录长篇笔记
- 数据看板：查看长期趋势
- Supabase 云同步：日记数据支持云端同步，本地缓存继续保留
- 数据备份：支持 JSON 导入 / 导出
- Capacitor：可同步到 Android 项目

## Tech Stack

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- Framer Motion
- Chart.js (`react-chartjs-2`)
- Supabase (`@supabase/supabase-js`)
- Capacitor (`@capacitor/core`, `@capacitor/android`)
- LocalStorage + Supabase

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create `.env.local` in the project root:

```env
# AI review (SiliconFlow preferred, OPENAI_API_KEY kept for backward compatibility)
SILICONFLOW_API_KEY=your_siliconflow_key
OPENAI_API_KEY=your_backup_key

# Optional: Supabase can also be configured from the Settings page
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_MIND365_USER_ID=your_uuid
```

If you do not configure AI or Supabase, the app still works with local caching only.

## Supabase Schema

Create a table named `diaries`:

```sql
create table if not exists public.diaries (
  id uuid primary key,
  user_id uuid not null,
  content text not null,
  ai_analysis text,
  created_at timestamp with time zone not null default now()
);
```

Notes:
- The current app serializes the full diary object into `content` so existing fields like `mood`, `studyHours`, `reading`, `tags`, and `thoughts` are preserved.
- Use the same `user_id` on multiple devices if you want them to sync the same diary stream.

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

- `/` 成长概览
- `/daily-log` 写日记
- `/timeline` 日记时间线
- `/journal?id=<entryId>` 日记详情
- `/quotes` 灵感书库
- `/notes` 深度思考
- `/weekly-review` 周度复盘
- `/monthly-review` 月度复盘
- `/yearly-review` 年度复盘
- `/analytics` 数据看板
- `/settings` 设置

## Scripts

- `npm run dev` - start development server
- `npm run build` - production build
- `npm run lint` - run lint checks
- `npm run build:web` - build static web assets for Capacitor
- `npm run cap:copy` - copy `out/` assets into Capacitor platforms
- `npm run cap:sync` - sync Capacitor platforms and plugins
- `npm run cap:android` - open Android project in Android Studio
- `npm run mobile:android` - build static assets + sync Android platform

export interface DailyLog {
  id: string;
  createdAt: string;
  date: string;
  mood: number;
  thoughts: string;
  reading: string;
  studyHours: number;
  tags: string[];
  images?: string[];
}

export interface Quote {
  id: string;
  createdAt: string;
  text: string;
  author: string;
  book: string;
  readingHours: number;
  tags: string[];
  /**
   * The user's "认知体系" theme this quote belongs to, e.g. "成长" / "赚钱".
   * Optional — when missing, the archive view falls back to keyword-based
   * auto classification.
   */
  themeCategory?: string;
}

export interface TimeEntry {
  id: string;
  createdAt: string;
  date: string;
  type: "study" | "reading";
  hours: number;
  note?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
}

/**
 * Eisenhower matrix quadrant:
 * - q1 重要且紧急  - q2 重要不紧急
 * - q3 不重要紧急  - q4 不重要不紧急
 */
export type TodoQuadrant = "q1" | "q2" | "q3" | "q4";

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  /** Sort order — smaller is higher in the list. */
  order: number;
  /** Which Eisenhower quadrant this item lives in. */
  quadrant: TodoQuadrant;
  createdAt: string;
  /** ISO timestamp of the last mutation — used for last-write-wins sync. */
  updatedAt: string;
  /** ISO timestamp when marked done; cleared when un-done. */
  completedAt?: string;
  /** Optional due date, ISO calendar date (yyyy-MM-dd). */
  dueDate?: string;
}

export interface Mind365Settings {
  enableSupabaseSync: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseUserId: string;
  weeklyStudyTarget: number;
  weeklyReadingTarget: number;
}

export interface ReviewReport {
  id: string;
  createdAt: string;
  period: "week" | "month" | "year";
  rangeStart: string; // ISO date yyyy-MM-dd
  rangeEnd: string;
  title: string;
  metrics: {
    averageMood: number;
    totalReadingHours: number;
    totalStudyHours: number;
    entries: number;
    /** Todos completed within the period (optional; added later). */
    todosCompleted?: number;
    /** Todos created within the period (optional; added later). */
    todosCreated?: number;
  };
  notes: string; // 用户手写的复盘笔记
}

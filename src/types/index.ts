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

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
}

export interface Mind365Settings {
  enableSupabaseSync: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseUserId: string;
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
  };
  notes: string; // 用户手写的复盘笔记
}

export interface DailyLog {
  id: string;
  createdAt: string;
  date: string;
  mood: number;
  thoughts: string;
  reading: string;
  studyHours: number;
  tags: string[];
}

export interface Quote {
  id: string;
  text: string;
  author: string;
  book: string;
  tags: string[];
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

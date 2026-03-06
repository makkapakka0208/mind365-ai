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

export interface Policy {
  id: string;
  user_id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  status: "active" | "extinct";
  created_at: string;
  extinct_at: string | null;
  sort_order: number;
  // Assembled on the frontend, not stored in DB
  children?: Policy[];
  streak?: number;
  todayCheckin?: "success" | "fail" | null;
}

export interface PolicyCheckin {
  id: string;
  policy_id: string;
  user_id: string;
  date: string;
  result: "success" | "fail";
  note: string | null;
  created_at: string;
}

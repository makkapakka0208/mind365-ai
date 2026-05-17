"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RecordRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/daily-log"); }, [router]);
  return null;
}

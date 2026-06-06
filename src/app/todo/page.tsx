"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// The standalone Todo page has been merged into Life Path (人生主线).
// Keep this route as a client-side redirect so old links / bookmarks still
// work (server redirects aren't available under `output: export`).
export default function TodoRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/life-path");
  }, [router]);
  return null;
}

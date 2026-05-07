"use client";

import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function OnlineStatus() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    // Check initial state
    if (!navigator.onLine) setIsOffline(true);

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ duration: 0.25 }}
          className="fixed left-0 right-0 top-0 z-[70] flex items-center justify-center gap-2 py-2 text-xs font-medium text-white md:hidden"
          style={{
            background: "rgba(139,94,60,0.92)",
            backdropFilter: "blur(8px)",
            paddingTop: "calc(8px + env(safe-area-inset-top, 0px))",
          }}
        >
          <WifiOff size={13} />
          离线模式 · 数据已保存在本地
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

/**
 * SidebarCompanion — 侧栏里一只一直在动的小猫。
 * 待机时呼吸、眨眼、甩尾、偶尔抖耳；悬停冒出一句温暖的话；
 * 点一下会跳一下。纯 SVG + CSS 动画，颜色跟随主题。
 */

const PHRASES = [
  "今天也辛苦了。",
  "喝口水，歇会儿。",
  "记一笔今天的心情？",
  "慢一点也没关系。",
  "我一直在这儿。",
  "深呼吸，再继续。",
  "你已经做得很好了。",
];

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了，早点睡。";
  if (h < 11) return "早上好呀。";
  if (h < 14) return "记得吃午饭。";
  if (h < 18) return "下午也加油。";
  if (h < 22) return "晚上好。";
  return "夜深了，早点睡。";
}

export function SidebarCompanion() {
  const [hovered, setHovered] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [hopping, setHopping] = useState(false);
  const hopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (hopTimer.current) clearTimeout(hopTimer.current); };
  }, []);

  const onEnter = () => {
    setHovered(true);
    setPhrase(Math.random() < 0.5 ? greetingByHour() : PHRASES[Math.floor(Math.random() * PHRASES.length)]);
  };

  const onPet = () => {
    setHopping(true);
    setPhrase(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
    if (hopTimer.current) clearTimeout(hopTimer.current);
    hopTimer.current = setTimeout(() => setHopping(false), 720);
  };

  return (
    <div className="mb-2 flex items-end gap-2" style={{ padding: "0 6px", minHeight: 64 }}>
      {/* 小猫 */}
      <button
        aria-label="逗一逗小猫"
        className="relative shrink-0 outline-none"
        onClick={onPet}
        onMouseEnter={onEnter}
        onMouseLeave={() => setHovered(false)}
        type="button"
        style={{ background: "transparent", border: "none", cursor: "pointer", lineHeight: 0 }}
      >
        <svg
          width="56"
          height="56"
          viewBox="0 0 80 80"
          className={hopping ? "cat-hop" : undefined}
          aria-hidden
        >
          {/* 尾巴（独立摆动，画在身体之后但视觉在身后） */}
          <path
            className="cat-tail"
            d="M58 60 q16 2 14 -14 q-1 -8 -7 -8 q-4 0 -3 5 q1 9 -6 11 z"
            fill="var(--v5-accent-soft)"
          />
          {/* 身体（面包猫） */}
          <g className="cat-body">
            <ellipse cx="40" cy="58" rx="22" ry="18" fill="var(--v5-accent)" />
            {/* 肚子高光 */}
            <ellipse cx="40" cy="62" rx="13" ry="10" fill="var(--v5-accent-soft)" opacity="0.55" />
            {/* 头 */}
            <circle cx="40" cy="38" r="19" fill="var(--v5-accent)" />
            {/* 耳朵 */}
            <path className="cat-ear-l" d="M26 26 L23 9 L39 21 Z" fill="var(--v5-accent)" />
            <path className="cat-ear-r" d="M54 26 L57 9 L41 21 Z" fill="var(--v5-accent)" />
            <path d="M27 22 L25.5 13 L34 19 Z" fill="var(--v5-rose)" opacity="0.7" />
            <path d="M53 22 L54.5 13 L46 19 Z" fill="var(--v5-rose)" opacity="0.7" />
            {/* 眼睛（眨眼） */}
            <g className="cat-eyes" fill="#2a1c10">
              <circle cx="33" cy="38" r="2.6" />
              <circle cx="47" cy="38" r="2.6" />
            </g>
            {/* 鼻子 + 嘴 */}
            <path d="M40 43 l-2.4 2.4 a1.4 1.4 0 0 0 2.4 1 a1.4 1.4 0 0 0 2.4 -1 z" fill="var(--v5-rose)" />
            <path d="M40 46.8 v2" stroke="#2a1c10" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
            {/* 腮红 */}
            <circle cx="28" cy="43" r="3" fill="var(--v5-rose)" opacity="0.32" />
            <circle cx="52" cy="43" r="3" fill="var(--v5-rose)" opacity="0.32" />
            {/* 胡须 */}
            <g stroke="var(--v5-ink3)" strokeWidth="0.8" strokeLinecap="round" opacity="0.5">
              <path d="M24 40 h-9" />
              <path d="M24 44 h-8" />
              <path d="M56 40 h9" />
              <path d="M56 44 h8" />
            </g>
          </g>
        </svg>
      </button>

      {/* 气泡 */}
      <div
        className="mb-3 origin-bottom-left transition-all duration-300"
        style={{
          opacity: hovered || hopping ? 1 : 0,
          transform: hovered || hopping ? "translateY(0) scale(1)" : "translateY(4px) scale(0.92)",
          pointerEvents: "none",
        }}
      >
        <div
          className="relative rounded-2xl rounded-bl-sm px-3 py-1.5"
          style={{
            background: "var(--v5-card)",
            border: "1px solid var(--v5-rule)",
            boxShadow: "var(--v5-sh-2)",
            fontFamily: "var(--v5-serif)",
            fontSize: 12.5,
            lineHeight: 1.4,
            color: "var(--v5-ink2)",
            whiteSpace: "nowrap",
          }}
        >
          {phrase || greetingByHour()}
        </div>
      </div>
    </div>
  );
}

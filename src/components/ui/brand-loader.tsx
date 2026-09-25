/**
 * 品牌加载动画：沿用年轮的刻度语言——一圈 60 根细刻度，一小段金色刻度像彗尾一样绕圈点亮，
 * 中央是小型大写的 Mind365，下方一行斜体提示轻轻呼吸。
 * 200ms 后才淡入，快速加载时不会闪一下；系统「减少动态效果」时静止。
 */

const TICKS = 60;
const C = 60;
// 服务端与浏览器的三角函数末位精度不同，取两位小数避免水合不一致
const r2 = (n: number) => Math.round(n * 100) / 100;

export function BrandLoader({ label = "正在翻开今天…" }: { label?: string }) {
  return (
    <div className="brand-loader flex flex-col items-center" role="status" aria-live="polite">
      <svg viewBox="0 0 120 120" width={132} height={132} aria-hidden>
        {Array.from({ length: TICKS }, (_, i) => {
          const rad = ((i / TICKS) * 360 - 90) * (Math.PI / 180);
          const long = i % 5 === 0;
          const r1 = long ? 45 : 48;
          const outer = 54;
          return (
            <line
              key={i}
              x1={r2(C + Math.cos(rad) * r1)}
              y1={r2(C + Math.sin(rad) * r1)}
              x2={r2(C + Math.cos(rad) * outer)}
              y2={r2(C + Math.sin(rad) * outer)}
              className="brand-loader-tick"
              style={{ animationDelay: `${r2((i / TICKS) * 1.8 - 1.8)}s` }}
              stroke="var(--v5-accent)"
              strokeWidth={long ? 1.3 : 0.8}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx={C} cy={C} r={40} fill="none" stroke="var(--v5-rule-strong)" strokeWidth="0.5" />
        <text
          x={C}
          y={C + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--v5-serif)"
          fontSize="13"
          fontWeight="500"
          letterSpacing="0.06em"
          fill="var(--v5-ink)"
          style={{ fontVariant: "small-caps" }}
        >
          Mind365
        </text>
      </svg>
      <p
        className="brand-loader-label mt-5"
        style={{ fontFamily: "var(--v5-serif)", fontStyle: "italic", fontSize: 14, letterSpacing: "0.08em", color: "var(--v5-ink3)" }}
      >
        {label}
      </p>
    </div>
  );
}

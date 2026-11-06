/** Lovable Crest — shield with gold S */
export function CrestMark({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 1.15}
      viewBox="0 0 40 46"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M20 2 L37 8 V22 C37 33 29 40 20 44 C11 40 3 33 3 22 V8 Z"
        className="fill-primary stroke-gold"
        strokeWidth="1.5"
      />
      <path
        d="M20 6 L33 10.5 V22 C33 30.5 27 36 20 39.5 C13 36 7 30.5 7 22 V10.5 Z"
        fill="none"
        className="stroke-gold"
        strokeWidth="0.6"
      />
      <text
        x="20"
        y="28"
        textAnchor="middle"
        className="fill-gold"
        style={{ font: "600 17px 'Playfair Display', serif" }}
      >
        S
      </text>
    </svg>
  );
}

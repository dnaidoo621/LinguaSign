/** Composable circular stamp seal — double ring + italic label + curved sub-text. */
export default function StampSeal({
  size = 56,
  label = "LS",
  sub = "LINGUASIGN",
}: {
  size?: number;
  label?: string;
  sub?: string;
}) {
  return (
    <div className="stamp-seal" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 3" />
        <text
          x="50"
          y="56"
          textAnchor="middle"
          fontFamily="var(--serif)"
          fontStyle="italic"
          fontSize="24"
          fill="currentColor"
        >
          {label}
        </text>
      </svg>
      {sub && (
        <svg viewBox="0 0 100 100" width={size} height={size} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <path id={`seal-arc-${label}`} d="M 50,50 m -34,0 a 34,34 0 1,1 68,0" fill="none" />
          </defs>
          <text fontFamily="var(--mono)" fontSize="7.5" letterSpacing="2" fill="currentColor">
            <textPath href={`#seal-arc-${label}`} startOffset="25%" textAnchor="middle">
              {sub}
            </textPath>
          </text>
        </svg>
      )}
    </div>
  );
}

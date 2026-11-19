export function Brand() {
  return (
    <svg
      className="ep-brand"
      viewBox="0 0 280 200"
      role="img"
      aria-label="EP LAB — Embedded PTIT Lab"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>EP LAB — Embedded PTIT Lab</title>
      <g transform="translate(5 0)">
        <path
          className="logo-red"
          d="M92 12h72l-10 22h-54l-8 20h49l-10 22H82l-9 23h66l-10 23H41l37-93Q84 12 92 12Z"
        />
        <path
          className="logo-blue"
          d="M173 12h36c34 0 50 18 39 44-10 25-31 36-61 36h-16l-13 30h-29Z"
        />
        <g
          className="logo-trace"
          fill="none"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M57 96c17-22 27-29 53-29h12" />
          <circle cx="129" cy="67" r="6" />
          <path d="M92 109h36c22 0 34-37 52-40h13" />
          <circle cx="200" cy="69" r="6" />
          <path d="M180 34q22-21 44 0M185 44q17-16 34 0M191 53q11-10 22 0" />
        </g>
      </g>
      <text
        x="140"
        y="162"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontSize="48"
        fontWeight="900"
        letterSpacing="-1"
      >
        <tspan className="logo-red">EP</tspan>
        <tspan className="logo-blue" dx="9">
          LAB
        </tspan>
      </text>
      <path
        className="logo-rule"
        d="M14 184h16m220 0h16"
        fill="none"
        strokeWidth="1.5"
      />
      <text
        className="logo-blue"
        x="140"
        y="190"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontSize="19"
        fontWeight="700"
        letterSpacing="0.4"
      >
        EMBEDDED PTIT LAB
      </text>
    </svg>
  );
}

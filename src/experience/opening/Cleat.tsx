/**
 * The Lloyds Wharf mooring cleat — the geometry from the approved prototype, stroke for stroke.
 * Each stroke carries `pathLength="1"` so the draw is a dash offset from 1 to 0.
 */
export function Cleat() {
  return (
    <div className="op-cleatwrap" data-cleatwrap>
      <div className="op-cleatglow" data-cleatglow />
      <svg
        className="op-cleat"
        viewBox="0 0 1000 340"
        fill="none"
        stroke="currentColor"
        strokeWidth={17}
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label="The Lloyds Wharf mooring cleat"
      >
        <path
          className="op-stroke"
          pathLength={1}
          d="M 26 52 C 170 22, 350 14, 500 14 C 650 14, 830 22, 974 52 C 990 62, 988 82, 966 88 C 830 68, 650 60, 500 60 C 350 60, 170 68, 34 88 C 12 82, 10 62, 26 52 Z"
        />
        <path
          className="op-stroke"
          pathLength={1}
          d="M 196 62 C 202 122, 252 172, 322 200 C 394 224, 606 224, 678 200 C 748 172, 798 122, 804 62"
        />
        <path className="op-stroke" pathLength={1} d="M 500 60 L 500 288" />
        <path className="op-stroke" pathLength={1} d="M 240 150 L 190 288 L 810 288 L 760 150" />
        <rect className="op-stroke" pathLength={1} x={252} y={190} width={30} height={44} rx={14} />
        <rect className="op-stroke" pathLength={1} x={718} y={190} width={30} height={44} rx={14} />
        <circle className="op-stroke" pathLength={1} cx={238} cy={262} r={14} />
        <circle className="op-stroke" pathLength={1} cx={762} cy={262} r={14} />
      </svg>
    </div>
  );
}

// Ilustração do estado vazio (Figma S1): blob azul com grade e estrelas.
export function EmptyIllustration() {
  const cells = [];
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 3; y++) {
      const strong = (x + y) % 3 === 0;
      cells.push(
        <rect
          key={`${x}-${y}`}
          x={46 + x * 20}
          y={34 + y * 22}
          width={16}
          height={16}
          rx={3}
          fill={strong ? "#006be2" : "#5cc7e6"}
          opacity={(x + y) % 2 ? 0.55 : 1}
        />,
      );
    }
  }
  const star = (cx: number, cy: number, r: number) =>
    `M${cx} ${cy - r} L${cx + r * 0.3} ${cy - r * 0.3} L${cx + r} ${cy} L${cx + r * 0.3} ${cy + r * 0.3} L${cx} ${cy + r} L${cx - r * 0.3} ${cy + r * 0.3} L${cx - r} ${cy} L${cx - r * 0.3} ${cy - r * 0.3} Z`;
  return (
    <svg viewBox="0 0 180 130" className="h-[130px] w-[180px]" aria-hidden>
      <ellipse cx="90" cy="67" rx="75" ry="55" fill="#c7e6fc" />
      {cells}
      <path d={star(161, 19, 11)} fill="#ffcc33" />
      <path d={star(18, 92, 8)} fill="#ffcc33" />
      <path d={star(166, 102, 6)} fill="#ffcc33" />
    </svg>
  );
}

/** Silhouette humaine simplifiée (générique face/dos) — sert de fond à la bodychart. */
export function BodySilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 480" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <g className="fill-slate-200 dark:fill-slate-700/60 stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.5">
        {/* Tête */}
        <circle cx="100" cy="34" r="26" />
        {/* Cou */}
        <rect x="88" y="56" width="24" height="16" rx="6" />
        {/* Épaules + torse */}
        <path d="M60 92 C60 78 78 72 100 72 C122 72 140 78 140 92 L146 176 C146 200 128 214 100 214 C72 214 54 200 54 176 Z" />
        {/* Bras gauche */}
        <path d="M60 92 C44 96 32 112 28 140 L20 216 C18 228 30 232 34 222 L48 152 C50 138 56 118 64 104 Z" />
        {/* Bras droit */}
        <path d="M140 92 C156 96 168 112 172 140 L180 216 C182 228 170 232 166 222 L152 152 C150 138 144 118 136 104 Z" />
        {/* Bassin */}
        <path d="M66 210 L134 210 L140 258 C140 270 122 278 100 278 C78 278 60 270 60 258 Z" />
        {/* Jambe gauche */}
        <path d="M66 258 C64 300 60 360 58 410 C57 424 76 426 78 412 C82 366 88 310 92 264 Z" />
        {/* Jambe droite */}
        <path d="M134 258 C136 300 140 360 142 410 C143 424 124 426 122 412 C118 366 112 310 108 264 Z" />
        {/* Pieds */}
        <ellipse cx="66" cy="428" rx="16" ry="8" />
        <ellipse cx="134" cy="428" rx="16" ry="8" />
      </g>
    </svg>
  )
}

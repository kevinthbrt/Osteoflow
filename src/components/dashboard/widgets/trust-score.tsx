import { MarkdownContent } from './markdown-content'

type Score = 'A' | 'B' | 'C' | 'D' | 'E'

interface Props {
  score: Score
  explanation?: string | null
}

const GRADES: { letter: Score; bg: string; label: string }[] = [
  { letter: 'A', bg: '#2e7d32', label: 'Très fiable' },
  { letter: 'B', bg: '#558b2f', label: 'Fiable' },
  { letter: 'C', bg: '#f9a825', label: 'Modéré' },
  { letter: 'D', bg: '#e65100', label: 'Limité' },
  { letter: 'E', bg: '#c62828', label: 'Faible' },
]

export function TrustScore({ score, explanation }: Props) {
  const activeGrade = GRADES.find((g) => g.letter === score)

  return (
    <div>
      <div className="inline-flex flex-col items-stretch rounded-xl border-2 px-3 pt-2 pb-2.5 gap-1.5 min-w-[200px]">
        <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase text-center">
          T(H)rust Score
        </p>
        <div className="flex items-center gap-0.5">
          {GRADES.map((g) => {
            const isActive = g.letter === score
            return (
              <div key={g.letter} className="relative flex-1 flex items-center justify-center">
                {isActive ? (
                  <div
                    className="flex items-center justify-center rounded-full font-black shadow-lg z-10"
                    style={{
                      backgroundColor: g.bg,
                      color: '#fff',
                      width: 36,
                      height: 36,
                      fontSize: 16,
                      marginTop: -6,
                      marginBottom: -6,
                      boxShadow: `0 4px 14px 0 ${g.bg}99`,
                    }}
                  >
                    {g.letter}
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center w-full h-7 text-xs font-bold opacity-40"
                    style={{
                      backgroundColor: g.bg,
                      color: '#fff',
                      borderRadius:
                        g.letter === 'A' ? '6px 0 0 6px' : g.letter === 'E' ? '0 6px 6px 0' : 0,
                    }}
                  >
                    {g.letter}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-[10px] font-semibold text-center" style={{ color: activeGrade?.bg }}>
          {activeGrade?.label}
        </p>
      </div>

      {explanation && (
        <div
          className="mt-3 rounded-lg p-3 border-l-4 text-sm"
          style={{ borderColor: activeGrade?.bg, backgroundColor: `${activeGrade?.bg}10` }}
        >
          <MarkdownContent content={explanation} />
        </div>
      )}
    </div>
  )
}

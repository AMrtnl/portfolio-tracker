import { useGround } from '@/wh/ground'
import { Lockup, Mark, cutFor } from '@/wh/Mark'
import '@/wh/pages/brand.css'

const SIZES = [300, 120, 64, 28] as const

/** Four grounds. Each declares itself once; the panel chooses nothing else. */
const GROUNDS: Array<{ name: string; ground?: 'light' | 'dark'; fill: string }> = [
  { name: 'Marble', ground: 'light', fill: 'var(--wh-marble)' },
  { name: 'White card', ground: 'light', fill: 'var(--wh-card)' },
  { name: 'Ultramarine', ground: 'dark', fill: '#1F3FD0' },
  { name: 'Night', ground: 'dark', fill: '#0C1230' },
]

/** /brand/mark: the Phase 1 acceptance page. One Mark component, no variant prop, right on every ground. */
export default function MarkPage() {
  const root = useGround()
  return (
    <div className="wh-brandpage a-page">
      <header>
        <h1 className="wh-serif">The mark adapts by itself</h1>
        <p>
          There is one logo component. Nobody chooses a light or dark version of it. A surface declares
          once whether it is a light ground or a dark ground, and every mark placed on it follows, at any
          depth. The weight follows the width: 62 lines from 260 px, 46 from 110 px, 24 from 48 px, 15 below.
        </p>
        <p>
          The page&rsquo;s own ground is <b>{root}</b>, from your system setting. The two lower panels declare a
          dark ground; the two upper panels declare a light one, whatever the system says.
        </p>
      </header>

      <div className="wh-grounds">
        {GROUNDS.map((g) => (
          <section
            key={g.name}
            className="wh-ground"
            data-ground={g.ground}
            data-name={g.name}
            style={{ ['--ground' as string]: g.fill }}
            aria-label={`${g.name} ground`}
          >
            <figure>
              {SIZES.map((w) => (
                <div key={w}>
                  <Mark width={w} decorative />
                  <span>
                    {w} px · {cutFor(w)}
                  </span>
                </div>
              ))}
            </figure>
            <Lockup size={26} />
            <div className="wh-ground-label">
              <b>{g.name}</b> · data-ground=&quot;{g.ground}&quot;
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

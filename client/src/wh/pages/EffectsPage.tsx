import { Eyebrow } from '@/wh/layout'
import { DotField } from '@/wh/effects/DotField'
import { GridLift } from '@/wh/effects/GridLift'
import '@/wh/pages/brand.css'

/** /brand/effects: two canvases that answer the pointer, drawn in the tokens of whatever ground they sit on. */
export default function EffectsPage() {
  return (
    <div className="wh-brandpage a-page">
      <header>
        <h1 className="wh-serif">Surfaces that answer the pointer</h1>
        <p>
          Two effects after ObsidianUI&rsquo;s <b>Dotted Grid</b> and <b>Grid Lift</b>, rebuilt for Wealth Hub with no library,
          no black and no fixed colour. Both read the tokens of the surface they sit in, so a dark ground restyles them
          by itself, and both go still when the system asks for reduced motion.
        </p>
        <p>
          The dot field draws the garden live, one dot per point of the picture, and the pointer leaves a trail where
          the dots draw in and take the blue more deeply. The grid lift reads the temple from its light map and raises
          its cells out of a hairline grid near the pointer, the roof in gold. A tap or Enter sweeps a light across.
        </p>
      </header>

      <div className="wh-brandcols">
        <div className="wh-brandcol" style={{ flex: '1 1 420px' }}>
          <Eyebrow>Dot field</Eyebrow>
          <DotField image="/wh/images/garden-dots-marble.png" darkImage="/wh/images/garden-dots-night.png" position={[46, 40]} spacing={5} style={{ height: 320, borderRadius: 28, boxShadow: 'var(--wh-shadow)' }}>
            <div className="wh-picture-line">Own the whole picture.</div>
          </DotField>
          <p className="wh-caption">Behind the net-worth figure on the phone and in the picture card on the web. The still picture shows until the first frame, and stays wherever canvas is missing.</p>
        </div>
        <div className="wh-brandcol" style={{ flex: '1 1 420px' }}>
          <Eyebrow>Grid lift</Eyebrow>
          <GridLift height={320}>
            <span className="wh-lift-hint">Move across the grid, or press Enter.</span>
          </GridLift>
          <p className="wh-caption">On the first-run screen, before anything is connected. The temple rests a shade deeper than the grid, so it is there before the light finds it.</p>
        </div>
      </div>

      <div className="wh-brandpanel" style={{ gap: 12 }}>
        <Eyebrow>Where they may go</Eyebrow>
        <p>
          Only on surfaces that carry a picture or a first-run message, never behind a figure that is being read,
          never in a row. They decorate nothing that counts: the dots are the picture, the grid is the mark.
        </p>
        <p className="wh-caption">ObsidianUI is MIT licensed. These are independent implementations of the two ideas, in the app&rsquo;s own idiom.</p>
      </div>
    </div>
  )
}

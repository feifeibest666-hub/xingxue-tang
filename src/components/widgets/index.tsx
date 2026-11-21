import type { ReactNode } from 'react'
import { DiurnalWidget, FlashlightWidget, HemiWidget, OrbitWidget, SphereWidget, SwingWidget, TiltWidget, TwoCirclesWidget } from './sky'
import { CakeWidget, MoonYearWidget, PrecessionWidget, RingWidget, SignsVsConstWidget } from './circle'
import { CalcWidget, CrossesWidget, DoorWidget, ElementsWidget, GearsWidget, GlyphsWidget, MirrorWidget, SpeedWidget, WebWidget, ZipperWidget } from './signs'
import { SeasonsWidget, SkySimWidget, SunDateWidget } from './tools'
import type { WidgetMap } from './common'
import { W02 } from './stage02'
import { W03 } from './stage03'
import { W04 } from './stage04'
import { W05 } from './stage05'
import { W06 } from './stage06'
import { W07 } from './stage07'
import { W08 } from './stage08'
import { W09 } from './stage09'
import { W10 } from './stage10'
import { W12 } from './stage12'
import { W13 } from './stage13'
import { W14 } from './stage14'
import { W15 } from './stage15'
import { W16 } from './stage16'

const EXTRA: WidgetMap = {
  ...W02,
  ...W03,
  ...W04,
  ...W05,
  ...W06,
  ...W07,
  ...W08,
  ...W09,
  ...W10,
  ...W12,
  ...W13,
  ...W14,
  ...W15,
  ...W16,
}

/** 课程里的互动屏按名字取部件 */
export function Widget({ name, args = {} }: { name: string; args?: Record<string, unknown> }): ReactNode {
  switch (name) {
    case 'sphere': return <SphereWidget />
    case 'diurnal': return <DiurnalWidget />
    case 'orbit': return <OrbitWidget close={Boolean(args.close)} />
    case 'twoCircles': return <TwoCirclesWidget seasons={Boolean(args.seasons)} />
    case 'tilt': return <TiltWidget />
    case 'flashlight': return <FlashlightWidget />
    case 'swing': return <SwingWidget />
    case 'hemi': return <HemiWidget />
    case 'ring': return <RingWidget terms={Boolean(args.terms)} />
    case 'moonYear': return <MoonYearWidget />
    case 'cake': return <CakeWidget />
    case 'signsVsConst': return <SignsVsConstWidget />
    case 'precession': return <PrecessionWidget />
    case 'zipper': return <ZipperWidget />
    case 'elements': return <ElementsWidget triangles={Boolean(args.triangles)} />
    case 'crosses': return <CrossesWidget />
    case 'door': return <DoorWidget />
    case 'gears': return <GearsWidget />
    case 'glyphs': return <GlyphsWidget signs={(args.signs as number[]) ?? [1, 2]} />
    case 'web': return <WebWidget />
    case 'mirror': return <MirrorWidget />
    case 'calc': return <CalcWidget />
    case 'speed': return <SpeedWidget />
    case 'seasons': return <SeasonsWidget />
    case 'sunDate': return <SunDateWidget mode={(args.mode as 'basic' | 'sidereal' | 'attrs') ?? 'basic'} />
    case 'sim': return <SkySimWidget />
    default: if (EXTRA[name]) return EXTRA[name](args)
      return <div className="soon">（互动"{name}"还没做好）</div>
  }
}

export const WIDGET_NAMES = ['sphere', 'diurnal', 'orbit', 'twoCircles', 'tilt', 'flashlight', 'swing', 'hemi', 'ring', 'moonYear', 'cake', 'signsVsConst', 'precession',
  'zipper', 'elements', 'crosses', 'door', 'gears', 'glyphs', 'web', 'mirror', 'calc', 'speed', 'seasons', 'sunDate', 'sim', ...Object.keys(EXTRA)]

import { useEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { HeartPulse, Package, TriangleAlert, RadioTower, Home, Plus, Minus, Maximize } from 'lucide-react'
import { mesh, sfx, WORLD, PRIORITY_COLOR, type Snapshot, type Pin, type PinType, type Priority, type ZoneKind } from './meshEngine'

export type Tool = 'select' | 'pin' | 'zone'
export type Sel = { kind: 'pin' | 'zone'; id: string } | null

export const PIN_ICON: Record<PinType, LucideIcon> = {
  Medical: HeartPulse,
  Supply: Package,
  Hazard: TriangleAlert,
  Relay: RadioTower,
  Shelter: Home,
}

interface Props {
  snap: Snapshot
  tool: Tool
  pinType: PinType
  priority: Priority
  zoneKind: ZoneKind
  sel: Sel
  onSelect: (s: Sel) => void
}

type Drag =
  | { mode: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { mode: 'zone'; sx: number; sy: number }
  | { mode: 'pin'; id: string }

const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v))
const cell = (x: number, y: number) =>
  'ABCDEFGHIJ'[Math.min(9, Math.max(0, Math.floor(x / 100)))] + (Math.min(6, Math.max(0, Math.floor(y / 100))) + 1)

export default function TacticalMap({ snap, tool, pinType, priority, zoneKind, sel, onSelect }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const fitted = useRef(false)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [hover, setHover] = useState({ x: 0, y: 0 })
  const [draft, setDraft] = useState<{ x: number; y: number; r: number } | null>(null)
  const [space, setSpace] = useState(false)

  const fitView = (w: number, h: number) => {
    const k = Math.min(w / WORLD.w, h / WORLD.h) * 0.94
    setView({ k, x: (w - WORLD.w * k) / 2, y: (h - WORLD.h * k) / 2 })
  }

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width: w, height: h } = e.contentRect
      setSize({ w, h })
      if (!fitted.current && w > 0 && h > 0) { fitted.current = true; fitView(w, h) }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // zoom (native listener so we can preventDefault)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const h = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const mx = e.clientX - r.left, my = e.clientY - r.top
      setView((v) => {
        const k = Math.min(6, Math.max(0.3, v.k * Math.exp(-e.deltaY * 0.0015)))
        const wx = (mx - v.x) / v.k, wy = (my - v.y) / v.k
        return { k, x: mx - wx * k, y: my - wy * k }
      })
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [])

  // space = pan modifier
  useEffect(() => {
    const typing = (t: EventTarget | null) => ['INPUT', 'TEXTAREA', 'SELECT'].includes((t as HTMLElement)?.tagName)
    const kd = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || typing(e.target)) return
      e.preventDefault()
      ;(document.activeElement as HTMLElement | null)?.blur?.()
      setSpace(true)
    }
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space') setSpace(false) }
    const bl = () => setSpace(false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    window.addEventListener('blur', bl)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', bl) }
  }, [])

  const toWorld = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k }
  }

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || (e.button === 0 && space)) {
      e.preventDefault()
      drag.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    if (e.button !== 0) return
    const w = toWorld(e)
    if (tool === 'pin') {
      if (w.x < 0 || w.y < 0 || w.x > WORLD.w || w.y > WORLD.h) return
      const pin = mesh.addPin({ type: pinType, priority, x: w.x, y: w.y })
      sfx.ping(priority)
      onSelect({ kind: 'pin', id: pin.id })
    } else if (tool === 'zone') {
      drag.current = { mode: 'zone', sx: w.x, sy: w.y }
      setDraft({ x: w.x, y: w.y, r: 0 })
      e.currentTarget.setPointerCapture(e.pointerId)
    } else onSelect(null)
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const w = toWorld(e)
    setHover(w)
    mesh.setCursor(w.x, w.y)
    const d = drag.current
    if (!d) return
    if (d.mode === 'pan') setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }))
    else if (d.mode === 'zone') setDraft({ x: d.sx, y: d.sy, r: Math.hypot(w.x - d.sx, w.y - d.sy) })
    else if (d.mode === 'pin') mesh.updatePin(d.id, { x: clamp(w.x, WORLD.w), y: clamp(w.y, WORLD.h) })
  }

  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (d?.mode === 'zone' && draft && draft.r > 14) {
      const z = mesh.addZone({ kind: zoneKind, x: draft.x, y: draft.y, r: draft.r })
      sfx.click()
      onSelect({ kind: 'zone', id: z.id })
    }
    setDraft(null)
  }

  const pinDown = (e: React.PointerEvent, p: Pin) => {
    if (tool === 'zone' || e.button !== 0 || space) return
    e.stopPropagation()
    sfx.click()
    onSelect({ kind: 'pin', id: p.id })
    if (tool === 'select') {
      drag.current = { mode: 'pin', id: p.id }
      svgRef.current?.setPointerCapture(e.pointerId)
    }
  }

  const pts = useMemo(
    () => [...snap.preset.nodes, ...snap.pins.filter((p) => p.type === 'Relay').map((p) => [p.x, p.y] as [number, number])],
    [snap.preset, snap.pins],
  )
  const links = useMemo(() => {
    const out: { a: [number, number]; b: [number, number]; d: number }[] = []
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])
        if (d > 0 && d < 260) out.push({ a: pts[i], b: pts[j], d })
      }
    return out
  }, [pts])

  const s = 1 / Math.sqrt(view.k)
  const cursor = space ? 'grab' : tool === 'select' ? 'default' : 'crosshair'
  const meshColor = snap.blackout ? '#F59E0B' : '#10B981'

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden bg-[#090B0E]">
      <svg
        ref={svgRef}
        className="h-full w-full touch-none select-none"
        style={{ cursor }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <style>{`.mesh-line{animation:vdash 1.4s linear infinite}@keyframes vdash{to{stroke-dashoffset:-20}}`}</style>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <rect x={0} y={0} width={WORLD.w} height={WORLD.h} fill="#0B0F14" stroke="#1C2530" strokeWidth={1.5} />
          {Array.from({ length: 11 }, (_, i) => (
            <line key={`v${i}`} x1={i * 100} y1={0} x2={i * 100} y2={WORLD.h} stroke="#121A23" strokeWidth={1} />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 100} x2={WORLD.w} y2={i * 100} stroke="#121A23" strokeWidth={1} />
          ))}
          {Array.from({ length: 10 }, (_, i) => (
            <text key={`c${i}`} x={i * 100 + 50} y={12} fontSize={9} fill="#334155" textAnchor="middle" className="font-mono">{'ABCDEFGHIJ'[i]}</text>
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <text key={`r${i}`} x={7} y={i * 100 + 54} fontSize={9} fill="#334155" className="font-mono">{i + 1}</text>
          ))}

          {snap.preset.sectors.map((sc) => (
            <g key={sc[0]}>
              <rect x={sc[1]} y={sc[2]} width={sc[3]} height={sc[4]} rx={6} fill="#0F1620" stroke="#1E2A38" strokeDasharray="4 4" />
              <text x={sc[1] + 10} y={sc[2] + 20} fontSize={11} fill="#3B4B5E" letterSpacing={2} className="font-mono">{sc[0].toUpperCase()}</text>
            </g>
          ))}

          {snap.preset.roads.map((r, i) => {
            const pointsStr = r.map((p) => p.join(',')).join(' ')
            return (
              <g key={i}>
                <polyline points={pointsStr} fill="none" stroke="#141C26" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={pointsStr} fill="none" stroke="#2A3646" strokeWidth={1} strokeDasharray="6 6" />
              </g>
            )
          })}

          {snap.zones.map((z) => {
            const c = z.kind === 'hazard' ? '#EF4444' : '#10B981'
            const isSel = sel?.kind === 'zone' && sel.id === z.id
            return (
              <g
                key={z.id}
                style={{ pointerEvents: tool === 'select' ? 'all' : 'none', cursor: 'pointer' }}
                onPointerDown={(e) => {
                  if (tool !== 'select' || e.button !== 0 || space) return
                  e.stopPropagation()
                  sfx.click()
                  onSelect({ kind: 'zone', id: z.id })
                }}
              >
                <circle cx={z.x} cy={z.y} r={z.r} fill={c} fillOpacity={0.1} stroke={c} strokeWidth={isSel ? 2.5 : 1.5} strokeDasharray="7 5" />
                <text x={z.x} y={z.y - z.r - 6} fontSize={10} fill={c} textAnchor="middle" className="font-mono" style={{ pointerEvents: 'none' }}>{z.label}</text>
              </g>
            )
          })}

          {links.map((l, i) => (
            <line key={i} className="mesh-line" x1={l.a[0]} y1={l.a[1]} x2={l.b[0]} y2={l.b[1]} stroke={meshColor} strokeWidth={1.2} strokeDasharray="5 5" opacity={Math.max(0.15, 1 - l.d / 300)} style={{ pointerEvents: 'none' }} />
          ))}
          {snap.preset.nodes.map((n, i) => (
            <rect key={i} x={n[0] - 4} y={n[1] - 4} width={8} height={8} transform={`rotate(45 ${n[0]} ${n[1]})`} fill="#0B0F14" stroke={meshColor} strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
          ))}

          {snap.pins.map((p) => {
            const c = PRIORITY_COLOR[p.priority]
            const Icon = PIN_ICON[p.type]
            const isSel = sel?.kind === 'pin' && sel.id === p.id
            const done = p.status === 'RESOLVED'
            return (
              <g key={p.id} transform={`translate(${p.x} ${p.y}) scale(${s})`} opacity={done ? 0.45 : 1} style={{ cursor: tool === 'select' ? 'pointer' : undefined }} onPointerDown={(e) => pinDown(e, p)}>
                {p.priority === 'CRITICAL' && !done &&
                  [0, 0.8].map((d) => (
                    <circle key={d} r={12} fill="none" stroke={c} strokeWidth={2} style={{ pointerEvents: 'none' }}>
                      <animate attributeName="r" values="12;44" dur="1.6s" begin={`${d}s`} repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0" dur="1.6s" begin={`${d}s`} repeatCount="indefinite" />
                    </circle>
                  ))}
                <circle r={13} fill="#0B0F14" stroke={c} strokeWidth={2.5} />
                <g transform="translate(-8 -8)"><Icon size={16} color={c} strokeWidth={2.2} /></g>
                {isSel && <circle r={19} fill="none" stroke="#fff" strokeWidth={1.5} strokeDasharray="3 3" />}
                <text y={28} textAnchor="middle" fontSize={10} fill="#CBD5E1" className="font-mono" style={{ pointerEvents: 'none' }}>{p.label}</text>
              </g>
            )
          })}

          {draft && (
            <circle cx={draft.x} cy={draft.y} r={draft.r} fill={zoneKind === 'hazard' ? '#EF4444' : '#10B981'} fillOpacity={0.12} stroke={zoneKind === 'hazard' ? '#EF4444' : '#10B981'} strokeDasharray="6 4" style={{ pointerEvents: 'none' }} />
          )}

          {snap.peers.map((p) => (
            <g key={p.id} style={{ transform: `translate(${p.x}px, ${p.y}px) scale(${1 / view.k})`, transition: 'transform 140ms linear', pointerEvents: 'none' }}>
              <path d="M0 0 L0 16 L4.5 12 L8 19 L10.5 17.8 L7 11 L13 11 Z" fill={p.color} stroke="#090B0E" strokeWidth={1} />
              <rect x={12} y={14} rx={3} width={p.name.length * 6.5 + 10} height={15} fill={p.color} />
              <text x={17} y={25} fontSize={10} fontWeight={700} fill="#090B0E" className="font-mono">{p.name}</text>
            </g>
          ))}
        </g>
      </svg>

      <div className="pointer-events-none absolute bottom-2 left-2 rounded border border-[#1A222C] bg-[#0B0F14]/90 px-2 py-1 font-mono text-[11px] text-slate-400">
        X {clamp(hover.x, WORLD.w).toFixed(0).padStart(3, '0')} · Y {clamp(hover.y, WORLD.h).toFixed(0).padStart(3, '0')} · GRID <span className="text-emerald-400">{cell(hover.x, hover.y)}</span> · ZOOM {view.k.toFixed(2)}×
      </div>
      <div className="absolute bottom-2 right-2 flex flex-col gap-1">
        {[
          { i: <Plus size={14} />, f: () => setView((v) => ({ ...v, k: Math.min(6, v.k * 1.25), x: size.w / 2 - ((size.w / 2 - v.x) / v.k) * Math.min(6, v.k * 1.25), y: size.h / 2 - ((size.h / 2 - v.y) / v.k) * Math.min(6, v.k * 1.25) })) },
          { i: <Minus size={14} />, f: () => setView((v) => ({ ...v, k: Math.max(0.3, v.k / 1.25), x: size.w / 2 - ((size.w / 2 - v.x) / v.k) * Math.max(0.3, v.k / 1.25), y: size.h / 2 - ((size.h / 2 - v.y) / v.k) * Math.max(0.3, v.k / 1.25) })) },
          { i: <Maximize size={14} />, f: () => fitView(size.w, size.h) },
        ].map((b, i) => (
          <button key={i} onClick={b.f} className="rounded border border-[#1A222C] bg-[#0B0F14]/90 p-1.5 text-slate-300 hover:border-emerald-500 hover:text-emerald-400">{b.i}</button>
        ))}
      </div>
    </div>
  )
}

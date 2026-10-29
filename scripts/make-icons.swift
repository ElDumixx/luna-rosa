// Draws the Luna Rosa icon set for Android and legacy targets with a light "glass" look:
// a frosted orb with a lit rim, a pearly moon with a soft shadow and a sparkle, over a pink-lilac gradient.
// usage: swift scripts/make-icons.swift assets   (the iOS 26 icon itself is assets/LunaRosa.icon, from Icon Composer)
import AppKit
import CoreGraphics

let out = CommandLine.arguments[1]
let S: CGFloat = 1024
let cs = CGColorSpace(name: CGColorSpace.sRGB)!

func rgba(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat = 1) -> CGColor { CGColor(colorSpace: cs, components: [r, g, b, a])! }
func hex(_ h: UInt32, _ a: CGFloat = 1) -> CGColor { rgba(CGFloat((h >> 16) & 255) / 255, CGFloat((h >> 8) & 255) / 255, CGFloat(h & 255) / 255, a) }

func canvas(_ draw: (CGContext) -> Void) -> CGImage {
  let ctx = CGContext(data: nil, width: Int(S), height: Int(S), bitsPerComponent: 8, bytesPerRow: 0, space: cs,
                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  // flip so y grows downwards, like the SVG artwork
  ctx.translateBy(x: 0, y: S); ctx.scaleBy(x: 1, y: -1)
  draw(ctx)
  return ctx.makeImage()!
}

func save(_ img: CGImage, _ name: String) {
  let rep = NSBitmapImageRep(cgImage: img)
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(out)/\(name)"))
}

func gradient(_ colors: [CGColor], _ locs: [CGFloat]) -> CGGradient { CGGradient(colorsSpace: cs, colors: colors as CFArray, locations: locs)! }

// --- artwork geometry (same as the Icon Composer layers), in a 1024 box ---
/// Crescent = outer circle O minus cut circle K. Traced as one outline: the part of O outside K,
/// then the part of K inside O, sampled finely enough to be smooth at 1024 px.
func moonPath() -> CGPath {
  let (ox, oy, or) = (CGFloat(468), CGFloat(536), CGFloat(236))
  let (kx, ky, kr) = (CGFloat(580), CGFloat(446), CGFloat(206))
  func inK(_ x: CGFloat, _ y: CGFloat) -> Bool { hypot(x - kx, y - ky) < kr }
  func inO(_ x: CGFloat, _ y: CGFloat) -> Bool { hypot(x - ox, y - oy) < or }
  let n = 1440
  var outer: [CGPoint] = [], inner: [CGPoint] = []
  // walk O from the point nearest K
  let start = atan2(ky - oy, kx - ox) // start inside K, so the kept arc comes out as one run
  for i in 0...n {
    let a = start + CGFloat(i) / CGFloat(n) * 2 * .pi
    let pt = CGPoint(x: ox + or * cos(a), y: oy + or * sin(a))
    if !inK(pt.x, pt.y) { outer.append(pt) }
  }
  // K's arc inside O, walked from the end of the outer arc back to its start
  let kStart = atan2(oy - ky, ox - kx)
  for i in 0...n {
    let a = kStart - .pi + CGFloat(i) / CGFloat(n) * 2 * .pi
    let pt = CGPoint(x: kx + kr * cos(a), y: ky + kr * sin(a))
    if inO(pt.x, pt.y) { inner.append(pt) }
  }
  // split outer into a single run (it may wrap around the start)
  let p = CGMutablePath()
  p.addLines(between: outer)
  // join to whichever end of the inner arc is closer
  let last = outer.last!
  let innerOrdered = hypot(inner.first!.x - last.x, inner.first!.y - last.y) < hypot(inner.last!.x - last.x, inner.last!.y - last.y) ? inner : inner.reversed()
  for pt in innerOrdered { p.addLine(to: pt) }
  p.closeSubpath()
  return p
}
func moonClip(_ ctx: CGContext) {
  ctx.addEllipse(in: CGRect(x: 468 - 236, y: 536 - 236, width: 472, height: 472))
  ctx.clip()
  // remove the cut circle: clip to outside of it using even-odd with a full rect
  let r = CGMutablePath()
  r.addRect(CGRect(x: 0, y: 0, width: S, height: S))
  r.addEllipse(in: CGRect(x: 580 - 206, y: 446 - 206, width: 412, height: 412))
  ctx.addPath(r); ctx.clip(using: .evenOdd)
}
func sparkPath() -> CGPath {
  let p = CGMutablePath(); let cx: CGFloat = 712, cy: CGFloat = 318
  for i in 0..<8 {
    let a = -CGFloat.pi / 2 + CGFloat(i) * .pi / 4, r: CGFloat = i % 2 == 0 ? 64 : 15
    let pt = CGPoint(x: cx + r * cos(a), y: cy + r * sin(a))
    i == 0 ? p.move(to: pt) : p.addLine(to: pt)
  }
  p.closeSubpath(); return p
}

func background(_ ctx: CGContext) {
  ctx.drawLinearGradient(gradient([hex(0xFF9BC2), hex(0xE79BD3), hex(0xB897F5)], [0, 0.5, 1]),
                         start: CGPoint(x: S * 0.3, y: 0), end: CGPoint(x: S * 0.7, y: S), options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
  // soft light from the top left
  ctx.drawRadialGradient(gradient([rgba(1, 1, 1, 0.35), rgba(1, 1, 1, 0)], [0, 1]),
                         startCenter: CGPoint(x: S * 0.25, y: S * 0.12), startRadius: 0, endCenter: CGPoint(x: S * 0.25, y: S * 0.12), endRadius: S * 0.7, options: [])
}

/// How the glass artwork is tinted: the classic look is white glass, other icon styles change the moon and the glow.
struct Look {
  var orb: CGFloat = 0.30, orbTint = rgba(1, 1, 1, 1), shadow = hex(0x6B2A55, 0.28)
  var moon = [rgba(1, 1, 1, 1), hex(0xFFE6F0), hex(0xF7C6DC)], moonShadow = hex(0x8A2D5C, 0.35), spark = rgba(1, 1, 1, 1)
}

/// The glass artwork. `k` scales it around the center (Android's safe zone needs it smaller).
func artwork(_ ctx: CGContext, k: CGFloat, look: Look = Look()) {
  ctx.saveGState()
  ctx.translateBy(x: S / 2, y: S / 2); ctx.scaleBy(x: k, y: k); ctx.translateBy(x: -S / 2, y: -S / 2)
  let orb = CGRect(x: 512 - 352, y: 512 - 352, width: 704, height: 704)

  // orb: cast shadow, frosted body, inner glow and a lit rim
  ctx.saveGState()
  ctx.setShadow(offset: CGSize(width: 0, height: 26), blur: 60, color: look.shadow)
  ctx.addEllipse(in: orb); ctx.setFillColor(look.orbTint.copy(alpha: look.orb)!); ctx.fillPath()
  ctx.restoreGState()
  ctx.saveGState()
  ctx.addEllipse(in: orb); ctx.clip()
  ctx.drawLinearGradient(gradient([rgba(1, 1, 1, 0.42), rgba(1, 1, 1, 0.10), rgba(1, 1, 1, 0.22)], [0, 0.6, 1]),
                         start: CGPoint(x: 512, y: orb.minY), end: CGPoint(x: 512, y: orb.maxY), options: [])
  // specular sheen across the top
  ctx.drawRadialGradient(gradient([rgba(1, 1, 1, 0.55), rgba(1, 1, 1, 0)], [0, 1]),
                         startCenter: CGPoint(x: 420, y: 250), startRadius: 0, endCenter: CGPoint(x: 420, y: 250), endRadius: 330, options: [])
  ctx.restoreGState()
  // rim: bright on top, fading towards the bottom
  ctx.saveGState()
  ctx.setLineWidth(6); ctx.addEllipse(in: orb.insetBy(dx: 3, dy: 3)); ctx.replacePathWithStrokedPath(); ctx.clip()
  ctx.drawLinearGradient(gradient([rgba(1, 1, 1, 0.95), rgba(1, 1, 1, 0.15), rgba(1, 1, 1, 0.55)], [0, 0.55, 1]),
                         start: CGPoint(x: 512, y: orb.minY), end: CGPoint(x: 512, y: orb.maxY), options: [])
  ctx.restoreGState()

  // moon: shadow, pearly gradient body, highlight edge
  ctx.saveGState()
  ctx.setShadow(offset: CGSize(width: 0, height: 18), blur: 36, color: look.moonShadow)
  ctx.addPath(moonPath()); ctx.setFillColor(look.moon[0]); ctx.fillPath(using: .evenOdd)
  ctx.restoreGState()
  ctx.saveGState()
  moonClip(ctx)
  ctx.drawLinearGradient(gradient(look.moon, [0, 0.55, 1]),
                         start: CGPoint(x: 330, y: 300), end: CGPoint(x: 600, y: 770), options: [])
  ctx.restoreGState()

  // sparkle
  ctx.saveGState()
  ctx.setShadow(offset: CGSize(width: 0, height: 6), blur: 14, color: hex(0x8A2D5C, 0.3))
  ctx.addPath(sparkPath()); ctx.setFillColor(look.spark); ctx.fillPath()
  ctx.restoreGState()
  ctx.restoreGState()
}

func silhouette(_ ctx: CGContext, k: CGFloat) {
  ctx.translateBy(x: S / 2, y: S / 2); ctx.scaleBy(x: k, y: k); ctx.translateBy(x: -S / 2, y: -S / 2)
  ctx.setFillColor(rgba(1, 1, 1, 1))
  ctx.addPath(moonPath()); ctx.fillPath(using: .evenOdd)
  ctx.addPath(sparkPath()); ctx.fillPath()
}

// Legacy / Expo Go / store icon: square and opaque (the system rounds it).
save(canvas { background($0); artwork($0, k: 1) }, "icon.png")
// Android adaptive icon: full-bleed background and a foreground kept inside the 66/108 safe circle.
save(canvas { background($0) }, "adaptive-icon-bg.png")
save(canvas { artwork($0, k: 0.62) }, "adaptive-icon.png")
// Android 13+ themed icon: one flat color, the system tints it.
save(canvas { silhouette($0, k: 0.62) }, "adaptive-icon-mono.png")
// Launch screen: a round pearl on a transparent canvas. Android 12+ shows the splash icon inside a circle
// two thirds of the canvas wide, so the pearl fills exactly that circle and nothing gets cut off.
save(canvas { ctx in
  let r = S * 0.32
  ctx.saveGState()
  ctx.addEllipse(in: CGRect(x: S / 2 - r, y: S / 2 - r, width: r * 2, height: r * 2)); ctx.clip()
  background(ctx); artwork(ctx, k: 0.7)
  ctx.restoreGState()
}, "splash-icon.png")

// ---- Android icon styles (Ajustes → Icono de la app). Each one: background, foreground and a round preview. ----
func linear(_ ctx: CGContext, _ colors: [CGColor]) {
  ctx.drawLinearGradient(gradient(colors, colors.count == 3 ? [0, 0.5, 1] : [0, 1]), start: CGPoint(x: S * 0.3, y: 0), end: CGPoint(x: S * 0.7, y: S),
                         options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
}
func glow(_ ctx: CGContext, _ c: CGColor, at p: CGPoint, r: CGFloat) {
  ctx.drawRadialGradient(gradient([c, c.copy(alpha: 0)!], [0, 1]), startCenter: p, startRadius: 0, endCenter: p, endRadius: r, options: [])
}
let styles: [(String, (CGContext) -> Void, Look)] = [
  // frosted glass: an opaque pearly pane with a diagonal glare. Opaque on purpose: Android expects the icon's
  // background layer to be solid, and launchers (Pixel's among them) show leftovers of other icons behind a see-through one.
  ("cristal", { ctx in
    linear(ctx, [hex(0xFBE9F1), hex(0xF1EAFA), hex(0xE7ECFB)])
    ctx.saveGState()
    let band = CGMutablePath()
    band.move(to: CGPoint(x: S * 0.05, y: S)); band.addLine(to: CGPoint(x: S * 0.55, y: 0)); band.addLine(to: CGPoint(x: S * 0.8, y: 0)); band.addLine(to: CGPoint(x: S * 0.3, y: S))
    ctx.addPath(band); ctx.clip()
    ctx.drawLinearGradient(gradient([rgba(1, 1, 1, 0), rgba(1, 1, 1, 0.55), rgba(1, 1, 1, 0)], [0, 0.5, 1]), start: CGPoint(x: S * 0.2, y: S * 0.5), end: CGPoint(x: S * 0.6, y: S * 0.5), options: [])
    ctx.restoreGState()
    glow(ctx, rgba(1, 1, 1, 0.5), at: CGPoint(x: S * 0.25, y: S * 0.1), r: S * 0.6)
  }, Look(orb: 0.35, moon: [rgba(1, 1, 1, 1), hex(0xFFD6E6), hex(0xF29BC0)], moonShadow: hex(0x8A2D5C, 0.3))),
  ("noche", { ctx in
    linear(ctx, [hex(0x3D1A3C), hex(0x241130), hex(0x120A1A)])
    glow(ctx, hex(0xF06B95, 0.35), at: CGPoint(x: S * 0.5, y: S * 0.45), r: S * 0.55)
  }, Look(orb: 0.10, shadow: rgba(0, 0, 0, 0.5), moon: [rgba(1, 1, 1, 1), hex(0xFFD3E4), hex(0xF59BC1)], moonShadow: rgba(0, 0, 0, 0.5), spark: hex(0xFFC2D9))),
  ("perla", { ctx in
    linear(ctx, [hex(0xFFFFFF), hex(0xFFF3F7), hex(0xF8ECFF)])
  }, Look(orb: 0.55, orbTint: hex(0xF9D7E6), shadow: hex(0xC9779F, 0.25), moon: [hex(0xF7A1C3), hex(0xE584B6), hex(0xB98AF0)], moonShadow: hex(0xB0457A, 0.3), spark: hex(0xE58AB5))),
  ("atardecer", { ctx in
    linear(ctx, [hex(0xFFB59A), hex(0xFF7EAF), hex(0x9B6CF0)])
    glow(ctx, rgba(1, 0.95, 0.8, 0.35), at: CGPoint(x: S * 0.3, y: S * 0.15), r: S * 0.6)
  }, Look()),
  ("lavanda", { ctx in
    linear(ctx, [hex(0xD8C8FF), hex(0xB7A2FA), hex(0x8E78EA)])
    glow(ctx, rgba(1, 1, 1, 0.3), at: CGPoint(x: S * 0.25, y: S * 0.12), r: S * 0.6)
  }, Look(shadow: hex(0x3D2A7A, 0.3), moon: [rgba(1, 1, 1, 1), hex(0xF1EAFF), hex(0xD9CCFF)], moonShadow: hex(0x4B3591, 0.35))),
]
/// What the launcher shows: both layers, cut to a circle (the safe zone is 72/108 of the canvas).
func preview(_ bg: (CGContext) -> Void, _ look: Look) -> CGImage {
  canvas { ctx in
    ctx.addEllipse(in: CGRect(x: 0, y: 0, width: S, height: S)); ctx.clip()
    ctx.translateBy(x: S / 2, y: S / 2); ctx.scaleBy(x: 1.5, y: 1.5); ctx.translateBy(x: -S / 2, y: -S / 2) // 108 → 72 dp
    bg(ctx); artwork(ctx, k: 0.62, look: look)
  }
}
for (name, bg, look) in styles {
  save(canvas { bg($0) }, "icons/\(name)-bg.png")
  save(canvas { artwork($0, k: 0.62, look: look) }, "icons/\(name)-fg.png")
  save(preview(bg, look), "icons/\(name)-preview.png")
}
save(preview(background, Look()), "icons/clasico-preview.png")

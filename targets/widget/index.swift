import SwiftUI
import WidgetKit

// Luna Rosa's widgets in the app's "Pétalo" style: blush cards, petal-shaped tiles, pastel phase colors and a soft
// serif for numbers. Home screen (small, medium, large) and lock screen. The data and its date logic are in
// Model.swift. Colors follow light/dark mode; in tinted or clear mode the widgets drop their background and let
// the system color them.

// MARK: - Timeline (one entry now and one at every midnight for the next days, so the day stays right)

struct Entry: TimelineEntry {
  let date: Date
  let model: Model
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry { Entry(date: .now, model: Model(sample, now: .now)) }
  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    // The widget gallery shows an example until the app has data.
    let snap = loadSnapshot()
    completion(Entry(date: .now, model: Model(snap?.lastStart == nil && context.isPreview ? sample : snap, now: .now)))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    let snap = loadSnapshot(), cal = Calendar.current
    var entries = [Entry(date: .now, model: Model(snap, now: .now))]
    var day = cal.startOfDay(for: .now)
    for _ in 0..<3 {
      day = cal.date(byAdding: .day, value: 1, to: day)!
      entries.append(Entry(date: day, model: Model(snap, now: day)))
    }
    completion(Timeline(entries: entries, policy: .after(day)))
  }
}

/// Example data for the widget gallery: a 29-day cycle, day 12.
private let sample: Snapshot = {
  let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"
  let start = Calendar.current.date(byAdding: .day, value: -11, to: .now)!
  return Snapshot(lastStart: f.string(from: start), lastEnd: f.string(from: Calendar.current.date(byAdding: .day, value: 4, to: start)!),
                  typical: 29, lo: 28, hi: 30, dur: 5, paused: false, pain: 1.6, cycles: 3)
}()

// MARK: - Colors and shapes

struct Tone {
  let bg, tile, ink, muted, accent, line, onFill: Color
  let phase: [Phase: Color]
  let deep: [Phase: Color]
  static func of(_ scheme: ColorScheme) -> Tone {
    scheme == .dark
      ? Tone(bg: Color(hex: 0x221820), tile: Color(hex: 0x2E212A), ink: Color(hex: 0xFBEFF4), muted: Color(hex: 0xC7AABA), accent: Color(hex: 0xF49BBE),
             line: Color(hex: 0x3A2A33), onFill: Color(hex: 0x2A1321),
             phase: [.period: Color(hex: 0xE98AAD), .follicular: Color(hex: 0xE3A783), .ovulation: Color(hex: 0xA994EC), .luteal: Color(hex: 0x7FBFA9)],
             deep: [.period: Color(hex: 0xF7B7CC), .follicular: Color(hex: 0xFFCDB2), .ovulation: Color(hex: 0xD9CCFF), .luteal: Color(hex: 0xBDE8D8)])
      : Tone(bg: Color(hex: 0xFFF4F7), tile: .white, ink: Color(hex: 0x3A1F2D), muted: Color(hex: 0x86677A), accent: Color(hex: 0xC2457A),
             line: Color(hex: 0xF1DDE6), onFill: Color(hex: 0x3A1F2D),
             phase: [.period: Color(hex: 0xF4A6C0), .follicular: Color(hex: 0xFFCDB2), .ovulation: Color(hex: 0xCDBBFF), .luteal: Color(hex: 0xB5E3D2)],
             deep: [.period: Color(hex: 0xB23A6A), .follicular: Color(hex: 0xA8542B), .ovulation: Color(hex: 0x5E44B8), .luteal: Color(hex: 0x2C7A61)])
  }
  func fill(_ m: Model) -> Color { phase[m.phase ?? .period]! }
  func dark(_ m: Model) -> Color { m.phase.map { deep[$0]! } ?? accent }
  func color(_ k: Kind) -> Color { k == .period ? phase[.period]! : k == .ovulation ? phase[.ovulation]! : tile }
}

extension Color {
  init(hex: UInt32) { self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255) }
}

/// The petal: two opposite corners round, the other two tighter.
struct Petal: Shape {
  var r: CGFloat
  func path(in rect: CGRect) -> Path {
    UnevenRoundedRectangle(topLeadingRadius: r, bottomLeadingRadius: r * 0.4, bottomTrailingRadius: r, topTrailingRadius: r * 0.4).path(in: rect)
  }
}

private func serif(_ size: CGFloat) -> Font { .system(size: size, weight: .semibold, design: .serif) }

/// Shared frame: the blush background (or nothing in tinted/clear mode) and a tap that opens the app.
struct Card<Content: View>: View {
  @Environment(\.colorScheme) var scheme
  var url = "lunarosa://"
  @ViewBuilder let content: (Tone) -> Content
  var body: some View {
    let t = Tone.of(scheme)
    content(t)
      .containerBackground(for: .widget) { t.bg }
      .widgetURL(URL(string: url))
  }
}

struct PhasePill: View {
  let m: Model, t: Tone
  var body: some View {
    Text(m.empty ? "Luna Rosa" : m.phaseName).font(.caption2.bold())
      .foregroundStyle(t.dark(m)).padding(.horizontal, 8).padding(.vertical, 3)
      .background(Capsule().fill(m.empty ? t.line : t.fill(m).opacity(0.7)))
  }
}

/// The phases as a bar, the lived part full strength, with a marker on today.
struct PhaseBarView: View {
  let m: Model, t: Tone
  var h: CGFloat = 9
  var body: some View {
    GeometryReader { g in
      let segs = m.segs.isEmpty ? [Segment(id: .period, from: 1, to: m.len)] : m.segs
      let day = min(m.day, m.len), x = g.size.width * (Double(day) - 0.5) / Double(m.len)
      ZStack(alignment: .leading) {
        HStack(spacing: 2) {
          ForEach(segs) { s in
            Capsule().fill(t.phase[s.id]!.opacity(s.from <= day ? 1 : 0.4))
              .frame(width: max(2, (g.size.width - CGFloat(segs.count - 1) * 2) * CGFloat(s.to - s.from + 1) / CGFloat(m.len)))
          }
        }
        .frame(height: h).widgetAccentable()
        if !m.empty {
          Circle().fill(.white).overlay(Circle().stroke(t.accent, lineWidth: 3)).frame(width: h + 7, height: h + 7)
            .offset(x: min(max(0, x - (h + 7) / 2), g.size.width - h - 7))
        }
      }
      .frame(height: h + 7)
    }
    .frame(height: h + 7)
  }
}

/// The cycle as four pastel arcs, lived days full strength, with a dot on today.
struct CycleRing: View {
  let m: Model, t: Tone, width: CGFloat
  var body: some View {
    let segs = m.segs.isEmpty ? [Segment(id: .period, from: 1, to: m.len)] : m.segs
    let day = Double(min(m.day, m.len)), len = Double(m.len), gap = 0.014
    ZStack {
      ForEach(segs) { s in
        let a = Double(s.from - 1) / len + gap / 2, b = Double(s.to) / len - gap / 2
        Circle().trim(from: a, to: b).stroke(t.phase[s.id]!.opacity(0.38), style: StrokeStyle(lineWidth: width, lineCap: .round)).rotationEffect(.degrees(-90))
        if !m.empty && day / len > a {
          Circle().trim(from: a, to: min(b, day / len)).stroke(t.phase[s.id]!, style: StrokeStyle(lineWidth: width, lineCap: .round)).rotationEffect(.degrees(-90))
            .widgetAccentable()
        }
      }
      GeometryReader { g in
        let r = min(g.size.width, g.size.height) / 2, ang = ((day - 0.5) / len * 2 - 0.5) * .pi
        Circle().fill(.white).overlay(Circle().stroke(t.accent, lineWidth: width * 0.35)).frame(width: width * 1.5, height: width * 1.5)
          .position(x: g.size.width / 2 + r * cos(ang), y: g.size.height / 2 + r * sin(ang))
          .opacity(m.empty ? 0 : 1)
      }
    }
  }
}

struct Chip: View {
  let text: String, fill: Color, ink: Color
  var body: some View {
    Text(text).font(.caption2.bold()).foregroundStyle(ink).lineLimit(1).minimumScaleFactor(0.8)
      .padding(.horizontal, 8).padding(.vertical, 3).background(Capsule().fill(fill))
  }
}

// MARK: - Day (small / medium / large)

struct DayView: View {
  @Environment(\.widgetFamily) var family
  let m: Model
  var body: some View {
    Card { t in
      switch family {
      case .systemMedium:
        HStack(spacing: 14) {
          VStack(alignment: .leading, spacing: 0) {
            Text("Día").font(.caption.bold())
            Text(m.empty ? "—" : "\(m.day)").font(serif(44))
            Spacer(minLength: 0)
            Text(m.empty ? "" : m.phaseName).font(.caption.bold())
          }
          .foregroundStyle(t.onFill).padding(12).frame(width: 100, alignment: .leading).frame(maxHeight: .infinity)
          .background(Petal(r: 24).fill(t.fill(m)))
          VStack(alignment: .leading, spacing: 3) {
            Text(!m.window.isEmpty ? "Próxima regla" : m.onPeriod ? "Con la regla" : "Tu ciclo").font(.caption.bold()).foregroundStyle(t.accent)
            Text(m.window.isEmpty ? m.status : m.window).font(serif(20)).foregroundStyle(t.ink).minimumScaleFactor(0.7).lineLimit(1)
            Text(m.window.isEmpty ? m.cycleLine : m.status).font(.caption.bold()).foregroundStyle(m.late > 0 ? t.deep[.period]! : t.muted)
            Spacer(minLength: 0)
            HStack(spacing: 6) {
              if !m.ovulation.isEmpty { Chip(text: "Ovulación \(m.ovulation)", fill: t.phase[.ovulation]!, ink: t.onFill) }
              Chip(text: m.segs.isEmpty ? "Aprendiendo" : m.cycleLine.replacingOccurrences(of: "Ciclo de ", with: "Ciclo "), fill: t.line, ink: t.ink)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
      case .systemLarge:
        VStack(alignment: .leading, spacing: 12) {
          HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
              Text("Día del ciclo").font(.caption.bold()).foregroundStyle(t.accent)
              Text(m.empty ? "—" : "\(m.day)").font(serif(54)).foregroundStyle(t.ink).widgetAccentable()
              PhasePill(m: m, t: t)
            }
            Spacer()
            CycleRing(m: m, t: t, width: 9).frame(width: 82, height: 82).padding(6)
          }
          VStack(alignment: .leading, spacing: 4) {
            Text(m.status).font(serif(19)).foregroundStyle(m.late > 0 ? t.deep[.period]! : t.ink)
            Text(m.next.isEmpty ? m.phaseLine : "\(m.next) · \(m.phaseLine)").font(.subheadline).foregroundStyle(t.muted).lineLimit(2)
          }
          WeekStrip(m: m, t: t, disc: 32)
          Spacer(minLength: 0)
          StatsRow(m: m, t: t)
        }
      default:
        VStack(alignment: .leading, spacing: 2) {
          PhasePill(m: m, t: t)
          Spacer(minLength: 0)
          Text(m.empty ? "—" : "\(m.day)").font(serif(48)).foregroundStyle(t.ink).widgetAccentable()
          Text(m.empty ? "Marca tu regla" : m.status).font(.caption.bold()).foregroundStyle(m.late > 0 ? t.deep[.period]! : t.muted).lineLimit(1).minimumScaleFactor(0.8)
          Spacer(minLength: 6)
          PhaseBarView(m: m, t: t, h: 7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
  }
}

/// Four figures in petal tiles: typical cycle, period length, average pain and last period.
struct StatsRow: View {
  let m: Model, t: Tone
  var body: some View {
    let stats = m.stats.isEmpty ? [("Días de ciclo", "—"), ("Días de regla", "—"), ("Dolor medio", "—"), ("Última regla", "—")] : m.stats
    let marks: [Phase] = [.luteal, .period, .follicular, .ovulation]
    HStack(spacing: 6) {
      ForEach(Array(stats.enumerated()), id: \.offset) { i, s in
        VStack(alignment: .leading, spacing: 2) {
          Capsule().fill(t.phase[marks[i]]!).frame(width: 14, height: 4)
          Text(s.1).font(serif(14)).foregroundStyle(t.ink).lineLimit(1).minimumScaleFactor(0.6)
          Text(s.0).font(.system(size: 9, weight: .bold)).foregroundStyle(t.muted).lineLimit(2)
        }
        .padding(8).frame(maxWidth: .infinity, alignment: .leading)
        .background(Petal(r: 16).fill(t.tile))
      }
    }
  }
}

// MARK: - Ring (small, lock screen circle)

struct RingView: View {
  @Environment(\.widgetFamily) var family
  let m: Model
  var body: some View {
    if family == .accessoryCircular {
      Gauge(value: Double(m.empty ? 0 : min(m.day, m.len)), in: 0...Double(m.len)) {
        Image(systemName: "moon.fill")
      } currentValueLabel: {
        Text(m.empty ? "—" : "\(m.day)").font(serif(16))
      }
      .gaugeStyle(.accessoryCircularCapacity)
      .containerBackground(for: .widget) { AccessoryWidgetBackground() }
      .widgetURL(URL(string: "lunarosa://"))
    } else {
      Card { t in
        ZStack {
          CycleRing(m: m, t: t, width: 11).padding(6)
          VStack(spacing: 0) {
            Text(m.empty ? "—" : "\(m.day)").font(serif(36)).foregroundStyle(t.ink).widgetAccentable()
            Text(m.empty ? "Luna Rosa" : m.phaseName.lowercased()).font(.caption2.bold()).foregroundStyle(t.dark(m))
            if !m.nextDate.isEmpty && !m.onPeriod { Text("regla \(m.nextDate)").font(.system(size: 9, weight: .bold)).foregroundStyle(t.muted) }
          }
        }
      }
    }
  }
}

// MARK: - Countdown (small, lock screen)

struct CountdownView: View {
  @Environment(\.widgetFamily) var family
  let m: Model
  var head: String { m.onPeriod ? "Con la regla" : m.late > 0 ? "Retraso" : "Próxima regla" }
  var body: some View {
    switch family {
    case .accessoryInline:
      Text(m.empty ? "Luna Rosa" : "Día \(m.day) · \(m.status)").containerBackground(for: .widget) {}
    case .accessoryCircular:
      VStack(spacing: -2) {
        Image(systemName: m.onPeriod ? "drop.fill" : "calendar").font(.caption2)
        Text(m.countN).font(serif(20)).minimumScaleFactor(0.6)
        Text(m.onPeriod ? "día" : "días").font(.system(size: 9, weight: .bold))
      }
      .containerBackground(for: .widget) { AccessoryWidgetBackground() }
    case .accessoryRectangular:
      VStack(alignment: .leading, spacing: 1) {
        Label("Luna Rosa", systemImage: "moon.fill").font(.caption2.bold()).widgetAccentable()
        Text(m.status).font(.headline).minimumScaleFactor(0.7)
        Text(!m.nextDate.isEmpty ? "\(m.nextDate) · \(m.phaseName)" : (m.empty ? "" : "Día \(m.day) · \(m.phaseName)")).font(.caption2)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .containerBackground(for: .widget) {}
    default:
      Card { t in
        VStack(alignment: .leading, spacing: 2) {
          Text(head).font(.caption.bold()).foregroundStyle(m.late > 0 ? t.deep[.period]! : t.accent)
          Spacer(minLength: 0)
          Text(m.countN).font(serif(m.countN.count > 3 ? 36 : 52)).foregroundStyle(t.ink).widgetAccentable()
          Text(m.countLabel).font(.caption.bold()).foregroundStyle(t.muted).lineLimit(2)
          Spacer(minLength: 4)
          Text(m.onPeriod ? (m.stats.count > 1 ? "Suele durar \(m.stats[1].1) días" : "") : (m.nextDate.isEmpty ? m.cycleLine : m.nextDate))
            .font(.caption2.bold()).foregroundStyle(t.onFill).lineLimit(1).minimumScaleFactor(0.8)
            .padding(.horizontal, 8).padding(.vertical, 3).background(Petal(r: 10).fill(t.phase[.period]!))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
  }
}

// MARK: - Phase (small / medium)

struct PhaseView: View {
  @Environment(\.widgetFamily) var family
  let m: Model
  var body: some View {
    Card { t in
      VStack(alignment: .leading, spacing: 5) {
        HStack {
          Text("Tu fase").font(.caption.bold()).foregroundStyle(t.accent)
          Spacer()
          if !m.empty { Text(family == .systemSmall ? "Día \(m.day)" : "Día \(m.day) de ~\(m.len)").font(.caption.bold()).foregroundStyle(t.muted) }
        }
        Text(m.empty ? "Luna Rosa" : m.phaseName).font(serif(family == .systemSmall ? 24 : 28)).foregroundStyle(t.dark(m)).widgetAccentable()
        Text(m.phaseLine).font(family == .systemSmall ? .caption : .subheadline).foregroundStyle(t.muted).lineLimit(family == .systemSmall ? 2 : 1)
        Spacer(minLength: 0)
        PhaseBarView(m: m, t: t, h: family == .systemSmall ? 7 : 9)
        Text(!m.next.isEmpty ? m.next : !m.ovulation.isEmpty && !m.onPeriod ? "Ovulación \(m.ovulation)" : m.status).font(.caption.bold()).foregroundStyle(t.ink)
      }
    }
  }
}

// MARK: - Week (medium / large)

struct WeekStrip: View {
  let m: Model, t: Tone, disc: CGFloat
  var body: some View {
    HStack(spacing: 0) {
      ForEach(m.week) { d in
        VStack(spacing: 4) {
          Text(d.letter).font(.caption2.bold()).foregroundStyle(d.today ? t.accent : t.muted)
          Text("\(d.date)").font(serif(14))
            .foregroundStyle(d.kind == .period || d.kind == .ovulation ? t.onFill : d.today ? t.accent : t.ink)
            .frame(width: disc, height: disc)
            .background(Petal(r: disc * 0.45).fill(t.color(d.kind)))
            .overlay(Petal(r: disc * 0.45).stroke(d.today ? t.accent : t.phase[.period]!, style: StrokeStyle(lineWidth: d.today ? 2 : d.kind == .predicted ? 1.5 : 0, dash: d.kind == .predicted && !d.today ? [3, 2] : [])))
        }
        .frame(maxWidth: .infinity)
      }
    }
  }
}

struct WeekView: View {
  @Environment(\.widgetFamily) var family
  let m: Model
  var body: some View {
    Card(url: "lunarosa://calendar") { t in
      VStack(alignment: .leading, spacing: 10) {
        HStack {
          Text(m.status).font(.subheadline.bold()).foregroundStyle(m.late > 0 ? t.deep[.period]! : t.ink).widgetAccentable()
          Spacer()
          Text(m.nextDate.isEmpty ? m.window : m.nextDate).font(.caption.bold()).foregroundStyle(t.muted)
        }
        WeekStrip(m: m, t: t, disc: family == .systemLarge ? 36 : 30)
        HStack(spacing: 12) {
          ForEach([(t.phase[.period]!, "Regla"), (t.line, "Prevista"), (t.phase[.ovulation]!, "Ovulación")], id: \.1) { c, l in
            HStack(spacing: 4) { Petal(r: 5).fill(c).frame(width: 9, height: 9); Text(l).font(.caption2.bold()).foregroundStyle(t.muted) }
          }
          Spacer(minLength: 0)
          if family != .systemLarge && !m.todayLog.isEmpty { Text("Hoy: \(m.todayLog)").font(.caption2.bold()).foregroundStyle(t.ink).lineLimit(1) }
        }
        if family == .systemLarge {
          Divider().overlay(t.line)
          HStack(alignment: .firstTextBaseline) {
            Text(m.phaseName).font(serif(22)).foregroundStyle(t.dark(m))
            Spacer()
            if !m.next.isEmpty { Text(m.next).font(.caption.bold()).foregroundStyle(t.muted) }
          }
          Text(m.todayLog.isEmpty ? m.phaseLine : "Hoy: \(m.todayLog)").font(.subheadline).foregroundStyle(t.muted)
          Spacer(minLength: 0)
          StatsRow(m: m, t: t)
        }
      }
    }
  }
}

// MARK: - Summary (medium)

struct SummaryView: View {
  let m: Model
  var body: some View {
    Card { t in
      VStack(alignment: .leading, spacing: 10) {
        HStack {
          Text("Tus datos").font(.system(size: 17, weight: .semibold, design: .serif).italic()).foregroundStyle(t.accent)
          Spacer()
          if !m.empty { Text("Día \(m.day) · \(m.phaseName)").font(.caption.bold()).foregroundStyle(t.muted) }
        }
        Spacer(minLength: 0)
        StatsRow(m: m, t: t)
      }
    }
  }
}

// MARK: - Widgets

struct LunaWidget: Widget { // the original kind: widgets people already placed keep working
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LunaWidget", provider: Provider()) { DayView(m: $0.model) }
      .configurationDisplayName("Día y próxima regla")
      .description("El día de tu ciclo, tu fase, la próxima regla y, en grande, tu semana y tus datos.")
      .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

struct LunaRingWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LunaRingWidget", provider: Provider()) { RingView(m: $0.model) }
      .configurationDisplayName("Anillo del ciclo")
      .description("Tu ciclo en un anillo de fases, con el día de hoy.")
      .supportedFamilies([.systemSmall, .accessoryCircular])
  }
}

struct LunaCountdownWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LunaCountdownWidget", provider: Provider()) { CountdownView(m: $0.model) }
      .configurationDisplayName("Cuenta atrás")
      .description("Los días que faltan para tu regla y su fecha, también en la pantalla de bloqueo.")
      .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

struct LunaPhaseWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LunaPhaseWidget", provider: Provider()) { PhaseView(m: $0.model) }
      .configurationDisplayName("Fase")
      .description("En qué fase estás, qué significa y cuál viene después.")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct LunaWeekWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LunaWeekWidget", provider: Provider()) { WeekView(m: $0.model) }
      .configurationDisplayName("Semana")
      .description("Esta semana: tu regla, la prevista, la ovulación y lo que registraste hoy.")
      .supportedFamilies([.systemMedium, .systemLarge])
  }
}

struct LunaSummaryWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LunaSummaryWidget", provider: Provider()) { SummaryView(m: $0.model) }
      .configurationDisplayName("Tus datos")
      .description("Ciclo típico, duración de la regla, dolor medio y última regla.")
      .supportedFamilies([.systemMedium])
  }
}

@main
struct LunaWidgets: WidgetBundle {
  var body: some Widget {
    LunaWidget()
    LunaRingWidget()
    LunaCountdownWidget()
    LunaPhaseWidget()
    LunaWeekWidget()
    LunaSummaryWidget()
  }
}

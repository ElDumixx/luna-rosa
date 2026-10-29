import Foundation

// Reads the snapshot the app writes to the shared App Group (src/widgets/sync.ts) and computes, for the date being
// drawn, the same things as widgetModel in src/widgets/snapshot.ts: day, phase, countdown, window and week.

struct Snapshot: Codable {
  let lastStart: String?
  /// The day the last period ended, or nil while it's still open.
  let lastEnd: String?
  let typical: Int?
  let lo: Int?
  let hi: Int?
  let dur: Int?
  let paused: Bool
  /// Average logged pain 0–3.
  var pain: Double? = nil
  var cycles: Int? = nil
  /// What was logged on `logDay` (the day the app last synced), shown only while it's still that day.
  var logDay: String? = nil
  var log: DayLog? = nil
}

struct DayLog: Codable {
  let pain: Int?
  let sym: Int
  let mood: String?
}

struct Segment: Identifiable {
  let id: Phase
  let from: Int
  let to: Int
}

/// The phases as day ranges: same split as `phases` in src/cycle.ts (ovulation ~14 days before the next period).
func segmentsOf(_ len: Int, _ dur: Int) -> [Segment] {
  let d = min(dur, len - 6), ov = max(d + 3, len - 14)
  return [Segment(id: .period, from: 1, to: d), Segment(id: .follicular, from: d + 1, to: ov - 2),
          Segment(id: .ovulation, from: ov - 1, to: ov + 1), Segment(id: .luteal, from: ov + 2, to: len)].filter { $0.to >= $0.from }
}

enum Kind { case period, predicted, ovulation, none }
enum Phase: String { case period, follicular, ovulation, luteal }

struct DayCell: Identifiable {
  let id: Int
  let letter: String
  let date: Int
  let kind: Kind
  let today: Bool
}

private let months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
private let painNames = ["Nada", "Poco", "Medio", "Mucho"]
private let letters = ["D", "L", "M", "X", "J", "V", "S"] // Spanish calendar initials, Sunday first
private let cal = Calendar(identifier: .gregorian)

private var appGroup: String {
  // The extension's bundle id is "<app bundle id>.<target>", the group is "group.<app bundle id>".
  let id = Bundle.main.bundleIdentifier ?? ""
  let app = id.split(separator: ".").dropLast().joined(separator: ".")
  return "group.\(app)"
}

func loadSnapshot() -> Snapshot? {
  guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: "snapshot"),
        let data = json.data(using: .utf8) else { return nil }
  return try? JSONDecoder().decode(Snapshot.self, from: data)
}

private func parseDay(_ s: String) -> Date? {
  let f = DateFormatter()
  f.calendar = cal
  f.locale = Locale(identifier: "en_US_POSIX") // fixed format: unaffected by the phone's region or 12/24 h settings
  f.timeZone = .current
  f.dateFormat = "yyyy-MM-dd"
  return f.date(from: s)
}
private func plus(_ d: Date, _ n: Int) -> Date { cal.date(byAdding: .day, value: n, to: d)! }
private func days(_ a: Date, _ b: Date) -> Int { cal.dateComponents([.day], from: cal.startOfDay(for: a), to: cal.startOfDay(for: b)).day ?? 0 }
private func short(_ d: Date) -> String {
  let c = cal.dateComponents([.day, .month], from: d)
  return "\(c.day!) \(months[c.month! - 1])"
}

let phaseNames: [Phase: String] = [.period: "Regla", .follicular: "Folicular", .ovulation: "Ovulación", .luteal: "Lútea"]
private let phaseLines: [Phase: String] = [
  .period: "Cuídate: calor y descanso ayudan.",
  .follicular: "Suben los estrógenos y la energía.",
  .ovulation: "Días de más flujo y energía.",
  .luteal: "Más hambre o sensibilidad es normal.",
]

struct Model {
  var empty = true
  var day = 0
  var len = 28
  var onPeriod = false
  var phase: Phase? = nil
  var phaseName = ""
  var phaseLine = "Marca el inicio de tu regla en la app."
  var countN = "—"
  var countLabel = "marca tu regla"
  var status = "Marca tu regla"
  var window = ""
  var ovulation = ""
  var late = 0
  var week: [DayCell] = []
  /// The most likely day of the next period, "≈ 12 nov".
  var nextDate = ""
  /// The next phase change: "Ovulación en 3 días", "Regla en 9 días"…
  var next = ""
  var cycleLine = "Con 2 reglas aprendo tu ciclo"
  var segs: [Segment] = []
  var stats: [(String, String)] = []
  /// What was logged today, "Dolor medio · 2 síntomas · Tranquila".
  var todayLog = ""
  /// How far through the cycle today is, 0…1 (for the rings).
  var progress: Double { empty ? 0 : min(1, Double(day) / Double(len)) }

  init(_ s: Snapshot?, now: Date) {
    let today = cal.startOfDay(for: now)
    guard let s = s, let ls = s.lastStart, let start = parseDay(ls), start <= today else { return }
    empty = false
    let dur = max(1, s.dur ?? 5)
    day = days(start, today) + 1
    // An open period counts until it's marked as finished, at most 10 days (like the app's calendar).
    let end = s.lastEnd.flatMap(parseDay) ?? plus(start, 9)
    onPeriod = today <= end
    let learned = s.typical != nil && s.lo != nil && s.hi != nil
    if learned { len = s.typical! }

    func phaseOf(_ d: Int) -> Phase { segmentsOf(len, dur).first { d >= $0.from && d <= $0.to }?.id ?? .luteal }
    phase = onPeriod ? .period : learned ? phaseOf(min(day, len)) : nil
    phaseName = phase.map { phaseNames[$0]! } ?? "Aprendiendo"
    phaseLine = phase.map { phaseLines[$0]! } ?? "Con 2 reglas conoceré tus fases."
    countN = "\(day)"; countLabel = "día del ciclo"

    var predicted = Set<Date>(), ovu = Set<Date>()
    if learned && !s.paused, let typ = s.typical, let lo = s.lo, let hi = s.hi {
      let a = plus(start, min(lo, typ - 2)), b = plus(start, max(hi, typ + 2)), mid = plus(start, typ)
      window = "\(short(a)) – \(short(b))"
      nextDate = "≈ \(short(mid))"
      let p = min(dur, typ - 6), ov = max(p + 3, typ - 14)
      ovulation = "≈ \(short(plus(start, ov - 1)))"
      for c in 1...2 { for j in 0..<dur { predicted.insert(plus(start, typ * c + j)) } }
      for j in -1...1 { ovu.insert(plus(start, ov - 1 + j)) }
      let toMid = days(today, mid)
      if onPeriod { status = "Día \(day) de regla"; countLabel = "día de regla" }
      else if today > b { late = days(b, today); status = "\(late) \(late == 1 ? "día" : "días") de retraso"; countN = "\(late)"; countLabel = late == 1 ? "día de retraso" : "días de retraso" }
      else if today >= a { status = "Puede llegar ya"; countN = toMid > 0 ? "\(toMid)" : "Ya"; countLabel = toMid > 0 ? "días, puede llegar ya" : "puede llegar hoy" }
      else { status = toMid == 1 ? "Regla mañana" : "Regla en \(toMid) días"; countN = "\(toMid)"; countLabel = toMid == 1 ? "día para tu regla" : "días para tu regla" }
    } else if onPeriod { status = "Día \(day) de regla"; countLabel = "día de regla" }
    else if s.paused { status = "Previsiones en pausa" }
    else { status = "Aprendiendo tu ciclo" }

    if learned {
      segs = segmentsOf(len, dur)
      cycleLine = "Ciclo de ~\(len) días"
      if !s.paused && late == 0 {
        let up = segs.first { $0.from > day }
        let n = up.map { $0.from - day } ?? (len + 1 - day)
        if n > 0 { next = "\(up.map { phaseNames[$0.id]! } ?? "Regla") \(n == 1 ? "mañana" : "en \(n) días")" }
      }
    } else { cycleLine = "Aprendiendo tu ciclo" }
    // short values: four of them share a widget's width
    let typ = s.typical.map { t in s.lo == s.hi ? "\(t)" : "\(s.lo ?? t)–\(s.hi ?? t)" } ?? "—"
    stats = [("Días de ciclo", typ), ("Días de regla", "\(dur)"),
             ("Dolor medio", s.pain.map { painNames[min(3, max(0, Int($0.rounded())))] } ?? "—"), ("Última regla", short(start))]
    let f = DateFormatter(); f.calendar = cal; f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = .current; f.dateFormat = "yyyy-MM-dd"
    if let l = s.log, s.logDay == f.string(from: today) {
      todayLog = [l.pain.map { "Dolor \(painNames[min(3, max(0, $0))].lowercased())" }, l.sym > 0 ? "\(l.sym) \(l.sym == 1 ? "síntoma" : "síntomas")" : nil, l.mood]
        .compactMap { $0 }.joined(separator: " · ")
    }

    // Today and the next six days: the rest of this period, the predicted one and the ovulation days.
    let periodLeft = onPeriod ? (s.lastEnd.flatMap(parseDay) ?? plus(start, dur - 1)) : .distantPast
    week = (0..<7).map { i in
      let d = plus(today, i)
      let kind: Kind = onPeriod && (d <= periodLeft || i == 0) ? .period : predicted.contains(d) && !onPeriod ? .predicted : ovu.contains(d) ? .ovulation : .none
      return DayCell(id: i, letter: letters[cal.component(.weekday, from: d) - 1], date: cal.component(.day, from: d), kind: kind, today: i == 0)
    }
  }
}

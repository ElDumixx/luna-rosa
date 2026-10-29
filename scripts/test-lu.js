// Lu's on-device brain on realistic questions: `npm run test:lu` (add `-- --full` to see every answer).
// It compiles src/lu/brain.ts to .lu-test/ first, then runs this file on the result; fails if a question or a chip is misunderstood.
const path = require("path");
const out = path.resolve(process.argv[2]);
const full = process.argv.includes("--full");
const { think, suggestions, tokens } = require(path.join(out, "lu/brain.js"));
const { cycleInfo, EMPTY } = require(path.join(out, "cycle.js"));
const { add, today } = require(path.join(out, "dates.js"));

const T = today();
const S = EMPTY();
// four periods ~29 days apart, the last one 12 days ago
for (const back of [99, 70, 41, 12]) S.periods.push({ start: add(T, -back), end: add(T, -back + 4) });
S.days[add(T, -12)] = { pain: 3, sym: ["Cólicos", "Cansancio"], med: { taken: true, name: "Ibuprofeno" }, mood: ["Sensible"], crave: ["Chocolate"] };
S.days[add(T, -11)] = { pain: 2, sym: ["Cólicos", "Hinchazón"], med: { taken: false, name: "" }, mood: ["Irritable"], crave: ["Chocolate"] };
const ci = cycleInfo(S);

// [question, expected topic] — "" = it should say it didn't understand / something general
const Q = [
  ["¿Cuándo me baja?", "proxima"],
  ["cuando me toca la regla", "proxima"],
  ["Cuándo me vendrá el periodo?", "proxima"],
  ["cuanto me queda para la regla", "proxima"],
  ["cuantos dias faltan para mi proxima menstruacion", "proxima"],
  ["qué día me llega la regla este mes", "proxima"],
  ["cuando es mi proxima regla", "proxima"],
  ["en qué fecha me baja", "proxima"],
  ["Q dia me baja", "proxima"],
  ["kuando me baja", "proxima"],
  ["¿En qué fase estoy?", "fase"],
  ["que dia de mi ciclo es hoy", "fase"],
  ["en que dia del ciclo voy", "fase"],
  ["estoy en la fase lutea?", "fase"],
  ["¿Cuándo ovulo?", "ovulacion"],
  ["cuales son mis dias fertiles", "ovulacion"],
  ["puedo quedarme embarazada hoy", "embarazo"],
  ["tengo un retraso de 5 dias", "retraso"],
  ["no me ha bajado todavía y me tocaba ayer", "retraso"],
  ["¿Por qué se retrasa?", "retraso"],
  ["me duele mucho la barriga", "dolor"],
  ["Tengo muchos dolores de regla, qué hago", "dolor"],
  ["me duele la tripa", "dolor"],
  ["cómo alivio el dolor sin pastillas", "dolor"],
  ["¿Cómo alivio el dolor?", "dolor"],
  ["me duele la cabeza", "cabeza"],
  ["tengo migraña con la regla", "cabeza"],
  ["me duelen los pechos", "pecho"],
  ["me duele la espalda", "dolor"],
  ["¿Qué analgésico puedo tomar?", "medicacion"],
  ["puedo tomar ibuprofeno y paracetamol juntos", "medicacion"],
  ["el paracetamol sirve para el dolor de regla?", "medicacion"],
  ["¿Por qué duele más el primer día?", "dolor"],
  ["¿Cuándo es abundante el sangrado?", "abundante"],
  ["sangro un montón es normal", "abundante"],
  ["¿Los coágulos son normales?", "coagulos"],
  ["me salen coagulos grandes", "coagulos"],
  ["la sangre me sale marrón por qué", "color"],
  ["¿Qué significa el color?", "color"],
  ["¿Y el manchado entre reglas?", "manchado"],
  ["he manchado un poco sin tener la regla", "manchado"],
  ["¿Por qué tengo antojos?", "antojos"],
  ["tengo muchas ganas de chocolate", "antojos"],
  ["¿Qué como estos días?", "comida"],
  ["¿Qué como para el hierro?", "comida"],
  ["estoy muy triste", "animo"],
  ["tengo ansiedad antes de la regla", "animo"],
  ["¿Por qué estoy más sensible?", "animo"],
  ["¿Por qué estoy tan cansada?", "cansancio"],
  ["no duermo bien antes de la regla", "cansancio"],
  ["¿Puedo hacer deporte?", "ejercicio"],
  ["puedo ir a la piscina con la regla", "ejercicio"],
  ["¿Por qué me hincho?", "digestivo"],
  ["tengo diarrea con la regla", "digestivo"],
  ["tengo granos", "piel"],
  ["¿Tampón, copa o compresa?", "productos"],
  ["cada cuanto cambio el tampón", "productos"],
  ["¿Los anticonceptivos cambian la regla?", "anticonceptivos"],
  ["tomo la pildora y no me baja", "anticonceptivos"],
  ["Resumen de mis datos", "resumen"],
  ["que sabes de mi", "resumen"],
  ["¿Es normal mi ciclo?", "normal"],
  ["¿Qué es un ciclo normal?", "normal"],
  ["mi ciclo es irregular?", "normal"],
  ["cuanto dura mi ciclo", "normal"],
  ["cuanto me dura la regla", "duracion"],
  ["¿Cuánto me suele durar?", "duracion"],
  ["¿Cuándo consultar?", "consulta"],
  ["cuando tengo que ir al medico", "consulta"],
  ["¿Cómo funciona la app?", "app"],
  ["¿Cómo pauso las previsiones?", "app"],
  ["como añado mi regla", "app"],
  ["hola", "saludo"],
  ["hola lu, cuando me baja?", "proxima"],
  ["gracias", "gracias"],
  ["no me duele nada", "bien"],
  ["tengo fiebre y llevo tampón", "urgente"],
  ["me he desmayado", "urgente"],
  ["qué es la endometriosis", "endometriosis"],
  ["qué es el sop", "sop"],
  ["que es la regla", "regla"],
  ["por que tenemos la regla", "regla"],
  ["cuanta sangre se pierde", "abundante"],
  ["que tiempo hace hoy", ""],
  ["cuentame un chiste", ""],
  ["me bajo hoy", "registrar"],
  ["ya me ha venido la regla", "registrar"],
  ["eres una ia?", "quien"],
  ["quién eres", "quien"],
  ["que puedes hacer", "quien"],
  ["sexo con la regla", "relaciones"],
  ["el flujo blanco es normal", "flujo"],
  ["tengo flujo transparente", "flujo"],
  ["me acaba de bajar", "registrar"],
  ["me ha empezado a doler la tripa", "dolor"],
  ["me duele la cabeza y estoy triste", "cabeza"],
  ["hola, me duele mucho", "dolor"],
  ["necesito ayuda con el dolor", "dolor"],
  ["que puedes decirme del dolor", "dolor"],
  ["ya no me baja desde hace dos meses", "retraso"],
  ["mi regla es muy abundante y tengo coagulos", "coagulos"],
  ["tengo la regla y me duele", "dolor"],
  ["ovualcion", "ovulacion"],
  ["cuando ovlo", "ovulacion"],
  ["me duelen los ovarios", "dolor"],
  ["antojos de dulce", "antojos"],
  ["estoy de mal humor", "animo"],
  ["me siento muy mal", "animo"],
  ["hace cuanto me bajo la regla", "ultima"],
  ["cuando fue mi ultima regla", "ultima"],
  ["no entiendo", ""],
  ["llevo la copa puesta todo el dia", "productos"],
  ["tengo el pelo graso", ""],
  ["mi madre tambien tenia reglas dolorosas", "dolor"],
  ["cada cuanto me viene la regla", "normal"],
  ["puedo bañarme en el mar con la regla", "ejercicio"],
  ["es grave?", "consulta"],
  ["se me ha ido la regla", "registrar"],
  ["me bajó ayer", "registrar"],
  ["quiero morirme", "crisis"],
  ["tengo fiebre", "consulta"],
  ["huele mal", "flujo"],
];

const counts = { ok: 0, bad: 0 };
for (const [q, want] of Q) {
  const r = think(S, ci, q);
  const got = r.topic;
  const ok = got === want;
  counts[ok ? "ok" : "bad"]++;
  if (!ok || full) console.log(`${ok ? "  " : "✗ "}${q.padEnd(52)} → ${got || "(no entiende)"}${ok ? "" : `   [quería ${want || "(no entiende)"}]`}${full ? `\n     ${r.text.split("\n")[0]}` : ""}`);
}
console.log(`\n${counts.ok}/${Q.length} bien`);

// every chip Lu shows must be understood
const chips = new Set([...suggestions(S, ci), ...suggestions(EMPTY(), cycleInfo(EMPTY()))]);
for (const [q] of Q) think(S, ci, q).follow.forEach((f) => chips.add(f));
let lost = 0;
for (const f of chips) { const r = think(S, ci, f); if (!r.topic) { lost++; console.log(`✗ chip sin entender: ${f}`); } else if (full) console.log(`  chip ${f} → ${r.topic}`); }
console.log(`${chips.size - lost}/${chips.size} sugerencias entendidas`);
process.exitCode = counts.bad || lost ? 1 : 0;

// conversation: follow-ups use the previous topic
const talk = (qs) => {
  const h = [];
  for (const q of qs) {
    const r = think(S, ci, q, h);
    console.log(`  ${q.padEnd(30)} → ${(r.topic || "(no entiende)").padEnd(10)} ${r.text.split("\n").slice(0, 2).join(" / ").slice(0, 110)}${r.action ? `  [acción ${r.action.kind} ${r.action.day}]` : ""}`);
    h.push({ r: "u", t: q }, { r: "a", t: r.text, topic: r.topic });
  }
  console.log("");
};
console.log("\nConversaciones:");
talk(["me duele mucho", "¿y qué más puedo hacer?", "y por qué pasa", "¿cuándo me baja?", "¿y si se retrasa?", "vale", "y eso es normal?"]);
talk(["hola", "me duele la cabeza y estoy triste", "es grave?", "gracias", "y eso es normal?"]);
talk(["me salen coagulos", "me preocupa", "vale", "y eso?"]);
talk(["me bajó hoy", "cuanto me suele durar", "se me ha ido"]);
talk(["cuando me baja", "cuando me baja", "y eso?", "y eso?", "y eso?"]);
talk(["que tiempo hace", "cuentame un chiste", "no entiendo"]);

// words that must not be "corrected"
const plain = "pelo dime casa boca mano novio taza llevo tengo una duda sobre mis ciclos llevo varios meses notando cosas raras quiero saber si puedo hacer algo pasado mañana estaba pensando colores verde amarillo siempre trabajo estudio";
const changed = plain.split(" ").filter((w) => tokens(w).join(" ") !== w).map((w) => `${w}→${tokens(w).join(" ")}`);
console.log("Correcciones en texto normal:", changed.join(", ") || "ninguna");

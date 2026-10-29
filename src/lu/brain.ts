// Lu's on-device brain: understands ~40 topics, answers with the user's own data, follows the
// conversation and suggests what to ask next. Used when no server is set up, or when it fails.
// Answer format (also used by the server): first sentence, "- " bullets, optional
// "Consulta si:" (see a professional) or "Urgente:" (seek care now) last line.
import { CycleInfo, Period, periodAt, phases, PHASE_TEXT, State } from "../cycle";
import { add, diff, fmt, today } from "../dates";
import { PAIN } from "../content";

/** `action`: something Lu can do for the user from the chat (mark today as the start or end of the period). */
export type LuAction = { kind: "start" | "end"; day: string };
export type Reply = { text: string; topic: string; follow: string[]; action?: LuAction };
type Past = { r: "u" | "a"; t: string; topic?: string };
type Ctx = { S: State; ci: CycleInfo; T: string; ongoing?: Period; data: boolean; ph: ReturnType<typeof phases>; q: string };
type Intent = {
  id: string;
  /** How a suggestion chip asks for this topic, and how Lu names it when it comes up alongside another one. */
  q?: string; label?: string;
  /**
   * Phrases, written like `norm` output. A word ending in * also matches longer words ("duel*": duele, duelen).
   * Each matched word counts 1; "!phrase" counts 3 more (it names the topic on its own: "ibuprofeno", "cabeza"),
   * "~phrase" counts only 0.5 (it needs other words: "normal").
   */
  keys: string[];
  /** Word groups that must all appear, in any order: [["cuando", "que dia"], ["baja*", "regla"]]. */
  all?: string[][];
  weight?: number;
  /** Uses the user's records: without "Usar mis datos" the answer is general. */
  personal?: boolean;
  /** Greetings and thanks: any real question in the same message wins. */
  social?: boolean;
  /** "no me duele", "sin dolor": a negated symptom isn't a question about it. */
  negatable?: boolean;
  answer: (x: Ctx) => string;
  /** A second, deeper answer for "¿y qué más?" or for asking the same thing again. */
  more?: (x: Ctx) => string;
  action?: (x: Ctx) => LuAction | undefined;
  /** Topics this one already covers: "me duele la cabeza" is about the head, not also about period pain. */
  absorbs?: string[];
  follow: string[];
};

/** Lowercase, no accents or punctuation: "¿Cuándo me baja?" → "cuando me baja". */
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// Chat spelling and synonyms, so the topics only need one way of saying each thing.
const CANON: Record<string, string> = {
  q: "que", k: "que", ke: "que", qe: "que", xq: "por que", pq: "por que", porq: "por que", porque: "por que", xk: "por que", pk: "por que",
  kuando: "cuando", cuado: "cuando", cnd: "cuando", qndo: "cuando", cuantoo: "cuanto", tb: "tambien", tmb: "tambien", xa: "para", pa: "para",
  toy: "estoy", stoy: "estoy", ta: "esta", mu: "muy", d: "de", tngo: "tengo", tmp: "tampoco", porfa: "por favor", plis: "por favor",
  periodo: "regla", periodos: "reglas", menstruacion: "regla", menstruaciones: "reglas", mestruacion: "regla", menstruo: "regla", menstruar: "regla",
  monton: "mucho", montones: "mucho", muchisimo: "mucho", muchisima: "mucho", demasiado: "mucho", demasiada: "mucho", fatal: "mucho",
  ovarios: "ovario", pastis: "pastillas", ibu: "ibuprofeno", gyn: "ginecologo", gine: "ginecologo", medica: "medico",
};
// Common words never "corrected" into a topic word.
const STOP = new Set(["tengo", "tiene", "tienes", "puedo", "puede", "estoy", "estas", "estos", "esta", "quiero", "hacer", "ahora", "antes", "despues", "siempre",
  "nunca", "algun", "alguna", "donde", "porque", "cuantas", "pasar", "pasado", "todos", "todas", "mismo", "misma", "menos", "otra", "otro", "cosas", "mejor",
  "peor", "desde", "hasta", "entre", "sobre", "mucha", "muchas", "muchos", "poco", "pocos", "nada", "tanto", "tanta", "luna", "rosa", "gracias", "tarde",
  "noche", "semana", "meses", "dias", "manana", "ayer", "normalmente", "verdad", "favor", "decir", "dime", "sabes", "saber", "seria", "puedes", "deberia",
  "llevo", "lleva", "llevar", "quiere", "quieres", "hacia", "hecho", "hacen", "haces", "pienso", "pensando", "parece", "pasando", "semanas", "tiempo", "siento",
  "mucho", "mucha", "vida", "casa", "pelo", "dice", "digo", "creo", "cosa", "veces", "solo", "sola", "bien", "algo", "esto", "eso", "aqui", "alli", "mama", "novio"]);

const count = (S: State, f: "sym" | "mood" | "crave") => {
  const n: Record<string, number> = {};
  Object.values(S.days).forEach((d) => d[f].forEach((v) => (n[v] = (n[v] ?? 0) + 1)));
  return Object.entries(n).sort((a, b) => b[1] - a[1]);
};
const days = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;
const needData = "\n- Activa «Usar mis datos» y miraré tus registros para responderte en concreto.";
const noCycle = "Aún no tengo reglas tuyas registradas, así que no puedo calcularlo.\n- Marca el inicio de tu regla tocando el día en el calendario, o dime «me ha bajado hoy».\n- Con 2 reglas aprendo tu ciclo, sin preguntarte nada más.";
const lateCauses = "\n- Estrés, poco sueño, viajes, enfermedad, cambios de peso o ejercicio intenso retrasan la ovulación y alargan el ciclo.\n- Si existe la posibilidad de embarazo, un test de orina es fiable desde el día en que esperabas la regla.\nConsulta si: pasan 3 meses sin regla sin un motivo conocido.";
const ENDED = /(se me ha ido|se me fue|se me va|ya termin|termino hoy|termino ayer|ha terminado|se me ha acabado|se me acabo|ya se acabo|ya no sangro|se me ha cortado|se me corto|fin de la regla)/;
/** "ayer", "anteayer" or today: the day the user says it happened. */
const saidDay = (x: Ctx) => /\b(anteayer|antes de ayer)\b/.test(x.q) ? add(x.T, -2) : /\bayer\b/.test(x.q) ? add(x.T, -1) : x.T;
const dayWord = (x: Ctx, k: string) => (k === x.T ? "hoy" : k === add(x.T, -1) ? "ayer" : "anteayer");

const INTENTS: Intent[] = [
  { id: "crisis", weight: 4,
    keys: ["suicid*", "quitarme la vida", "hacerme dano", "no quiero vivir", "quiero morir*", "matarme", "autolesion*"],
    answer: () => "Siento mucho que estés pasando por esto, y me alegra que lo digas.\n- No tienes que pasarlo sola: habla hoy con alguien de confianza.\nUrgente: llama al 024 (gratis, 24 horas, en España) o al 112 si estás en peligro ahora mismo.",
    follow: [] },
  { id: "urgente", weight: 3,
    keys: ["desmay*", "inconsciente", "no puedo levantarme", "insoportable", "dolor horrible", "dolor muy fuerte", "sangrado muy abundante", "sangro mucho mucho",
      "mareo fuerte", "me mareo mucho", "shock toxico", "empapo una compresa cada hora", "no para de sangrar", "no deja de sangrar"],
    all: [["fiebre", "erupcion"], ["tampon*", "copa", "disco"]],
    answer: () => "Lo que describes merece atención médica pronto, no esperes a ver si pasa.\n- Si te has desmayado, tienes mareo intenso o empapas una compresa cada hora durante 2 horas o más, acude a urgencias.\n- Si usas tampón o copa y tienes fiebre, vómitos o una erupción, retíralo: puede ser un síndrome de shock tóxico (raro, pero urgente).\nUrgente: llama al 112 si el sangrado o el dolor son muy intensos o te encuentras muy mal.",
    follow: ["¿Cuándo es abundante el sangrado?", "¿Cómo alivio el dolor?"] },

  { id: "saludo", social: true, keys: ["hola", "holi", "holaa", "buenas", "buenos dias", "buenas tardes", "buenas noches", "hey", "ey", "que tal", "hello", "hi"],
    answer: (x) => {
      const st = !x.data || !x.ci.last ? "Puedo explicarte tu ciclo, el dolor o lo que notes estos días."
        : x.ongoing ? `Estás en el día ${diff(x.ongoing.start, x.T) + 1} de tu regla.`
        : x.ph ? `Hoy es el día ${x.ph.day} de tu ciclo, en fase ${PHASE_TEXT[x.ph.current].name.toLowerCase().replace(" (aprox.)", "")}.` : `Hoy es el día ${x.ci.dayOf} de tu ciclo.`;
      return `¡Hola! ${st} ¿En qué te ayudo?`;
    },
    follow: ["¿Cuándo me baja?", "¿En qué fase estoy?", "Resumen de mis datos"] },
  { id: "gracias", social: true, keys: ["gracias", "muchas gracias", "mil gracias", "te quiero", "eres la mejor", "eres un amor", "thank*"],
    answer: () => "¡De nada! Aquí estoy cuando lo necesites.", follow: ["Resumen de mis datos", "¿Cómo alivio el dolor?"] },
  { id: "ok", social: true, keys: ["vale", "ok", "okay", "oki", "entendido", "de acuerdo", "perfecto", "genial", "guay", "aja", "ya veo", "ya entiendo", "claro", "bien", "si", "jaja*"],
    answer: () => "¡Genial! Si te surge cualquier otra duda, pregúntame.", follow: ["Resumen de mis datos", "¿En qué fase estoy?"] },
  { id: "adios", social: true, keys: ["adios", "hasta luego", "hasta manana", "hasta pronto", "chao", "chau", "nos vemos", "bye"],
    answer: () => "¡Hasta pronto! Cuídate mucho.", follow: [] },

  { id: "registrar", label: "apuntar tu regla",
    keys: ["me bajo hoy", "me bajo ayer", "me bajo anteayer", "me ha bajado", "me ha venido", "me ha llegado", "me vino hoy", "me vino ayer", "me llego hoy", "me llego ayer",
      "me ha empezado la regla", "me ha empezado hoy", "me empezo la regla", "me empezo hoy", "me empezo ayer", "ya me bajo", "ya me vino", "ya me llego", "me acaba de bajar",
      "me acaba de venir", "empece la regla", "empece hoy", "apuntame", "apunta la regla", "marca la regla", "registra la regla", "se me ha ido", "se me fue", "ya se me fue",
      "ya termine", "se me ha acabado", "se me acabo", "ya no sangro", "termino hoy", "termino ayer", "ha terminado", "se me ha cortado", "se me corto"],
    answer: (x) => {
      const k = saidDay(x), when = dayWord(x, k);
      const p = periodAt(x.S, k) ?? x.ongoing;
      if (ENDED.test(x.q)) {
        if (!p) return "No tengo ninguna regla abierta ahora mismo, así que no hay nada que cerrar.\n- Si terminó otro día, toca ese día en el calendario y elige «Termina».";
        if (p.end === k) return `Ya lo tengo apuntado: ${when} fue el último día de tu regla.`;
        if (k < p.start) return `Tengo apuntada una regla que empezó el ${fmt(p.start)}, después de ${when}.\n- Revísala tocando sus días en el calendario.`;
        return `¿Marco ${when} como el último día? Toca el botón de abajo y lo apunto.\n- Tu regla habrá durado ${days(diff(p.start, k) + 1)}.\n- Si terminó otro día, márcalo tocando ese día en el calendario.`;
      }
      if (p && p.start === k) return `Ya lo tengo apuntado: ${when === "hoy" ? "hoy es el día 1" : `empezó ${when}`} de tu regla.\n- Suele durarte unos ${days(x.ci.dur)}.\n- Si quieres, apunta en el día cómo te encuentras.`;
      if (p) return `Tengo apuntada una regla desde el ${fmt(p.start)}: hoy sería el día ${diff(p.start, x.T) + 1}.\n- Si en realidad empezó ${when}, toca ese día en el calendario y elige «Empieza».`;
      return `¿Lo apunto? Toca el botón de abajo y marco ${when} como el primer día de tu regla.\n- Si empezó otro día, márcalo tocando ese día en el calendario.\n- Con cada regla que marcas, mis previsiones se ajustan a ti.`;
    },
    action: (x) => {
      const k = saidDay(x), p = periodAt(x.S, k) ?? x.ongoing;
      if (ENDED.test(x.q)) return p && p.end !== k && k >= p.start ? { kind: "end", day: k } : undefined;
      return p ? undefined : { kind: "start", day: k };
    },
    absorbs: ["proxima", "retraso"],
    follow: ["¿Cuánto me suele durar?", "¿Cómo alivio el dolor?"] },
  { id: "anticonceptivos", q: "¿Los anticonceptivos cambian la regla?", label: "los anticonceptivos",
    keys: ["!pildora", "!anticonceptiv*", "!diu", "!mirena", "!implante", "!anillo vaginal", "!parche anticonceptivo", "!yasmin", "!pastilla anticonceptiva", "anillo", "metodo"],
    answer: () => "Los anticonceptivos hormonales cambian el patrón de sangrado.\n- Con la píldora, el sangrado del descanso es por la bajada de hormonas, no una regla natural; con la píldora continua puede no haberlo.\n- Con DIU hormonal o implante, la regla puede volverse escasa, irregular o desaparecer, y es normal.\n- Si has olvidado pastillas y no te baja, haz un test de embarazo.\nConsulta si: el sangrado es abundante o persistente tras los primeros meses.",
    absorbs: ["retraso", "manchado", "medicacion"],
    follow: ["¿Y el manchado entre reglas?", "¿Cómo pauso las previsiones?"] },
  { id: "medicacion", personal: true, q: "¿Qué analgésico puedo tomar?", label: "los analgésicos",
    keys: ["!ibuprofeno", "!naproxeno", "!paracetamol", "!metamizol", "!nolotil", "!enantyum", "!dexketoprofeno", "!aspirina", "!buscapina", "!espidifen", "!antiinflamatorio*",
      "!analgesico*", "pastilla para el dolor", "medicament*", "que tomo", "que puedo tomar", "medicacion", "pastilla*", "calmante*"],
    all: [["que", "cual", "puedo"], ["tomo", "tomar", "tomarme"]],
    answer: (x) => {
      if (/\b(juntos|junto|a la vez|combinar|mezclar|alternar|con el|con la)\b/.test(x.q) && /(ibuprofeno|paracetamol|naproxeno|metamizol|nolotil|aspirina)/.test(x.q))
        return "Ibuprofeno y paracetamol actúan de forma distinta y en adultas sanas se pueden alternar, pero no tomes dos antiinflamatorios a la vez (por ejemplo, ibuprofeno con naproxeno o aspirina).\n- Respeta la dosis máxima de cada uno según el prospecto.\n- Pregunta en la farmacia si tomas otros medicamentos o tienes alguna enfermedad.";
      const n = Object.values(x.S.days).filter((d) => d.med.taken).length;
      const mine = x.data && n ? `\n- Has registrado medicación ${n === 1 ? "1 día" : `${n} días`}.` : "";
      return `Los antiinflamatorios (ibuprofeno, naproxeno) frenan las prostaglandinas, por eso alivian mejor el dolor de regla que el paracetamol.\n- Tómalos con comida y sin pasar la dosis del prospecto.\n- Evítalos si tienes úlcera, problemas de riñón, asma que empeora con ellos o estás embarazada; el paracetamol es la alternativa.${mine}\nConsulta si: necesitas analgésicos todos los meses y aun así no te alivian.`;
    },
    more: () => "Cómo sacarles más partido:\n- Empieza al primer aviso de dolor, o el día antes si tu regla es muy previsible.\n- Con una pauta fija durante 1–2 días funcionan mejor que tomándolos solo cuando ya duele mucho.\n- Pregunta en la farmacia antes de combinar medicamentos.",
    absorbs: ["dolor", "cabeza"],
    follow: ["¿Cómo alivio el dolor sin pastillas?", "¿Cuándo consultar?"] },
  { id: "cabeza", negatable: true, q: "¿Por qué me duele la cabeza?", label: "el dolor de cabeza",
    keys: ["!cabeza", "!migran*", "!jaqueca", "!cefalea"],
    answer: () => "La bajada de estrógenos justo antes de la regla puede desencadenar dolor de cabeza o migraña.\n- Dormir y comer a horas regulares y beber agua ayuda.\n- Los antiinflamatorios suelen funcionar si los tomas pronto.\nUrgente: si es un dolor muy intenso y repentino, o con alteraciones de la vista, el habla o la fuerza, llama al 112.",
    absorbs: ["dolor"],
    follow: ["¿Qué analgésico puedo tomar?", "¿En qué fase estoy?"] },
  { id: "pecho", negatable: true, q: "¿Por qué me duele el pecho?", label: "el pecho",
    keys: ["!pecho*", "!senos", "!mamas", "!tetas", "!pezon*"],
    answer: () => "Notar el pecho sensible o hinchado antes de la regla es frecuente: lo causa la progesterona.\n- Un sujetador cómodo y algo de calor o frío local alivian.\n- Suele mejorar al llegar la regla.\nConsulta si: notas un bulto que no desaparece tras la regla, secreción por el pezón o cambios en la piel.",
    absorbs: ["dolor", "etapas"],
    follow: ["¿En qué fase estoy?", "¿Por qué me hincho?"] },
  { id: "endometriosis", q: "¿Qué es la endometriosis?", keys: ["!endometriosis", "!adenomiosis"],
    answer: () => "La endometriosis es una enfermedad en la que un tejido parecido al endometrio crece fuera del útero y causa inflamación.\n- Su síntoma más típico es un dolor de regla intenso que no mejora con analgésicos; a veces también duele en las relaciones o al ir al baño.\n- Se diagnostica en consulta (exploración y ecografía) y tiene tratamiento.\n- Tener dolor de regla no significa tenerla: el dolor de regla es muy común.\nConsulta si: el dolor te impide tu vida diaria aunque tomes analgésicos.",
    absorbs: ["dolor"],
    follow: ["¿Cómo alivio el dolor?", "¿Cuándo consultar?"] },
  { id: "sop", q: "¿Qué es el SOP?", keys: ["!sop", "!ovario poliquistico", "!poliquistic*", "!sindrome de ovario"],
    answer: () => "El síndrome de ovario poliquístico (SOP) es un trastorno hormonal frecuente.\n- Suele dar ciclos irregulares o muy largos, y a veces acné o más vello.\n- Se diagnostica con la historia, una analítica y a veces una ecografía: un solo síntoma no basta.\n- Tiene tratamiento y se puede llevar bien.\nConsulta si: tus ciclos duran más de 35 días de forma repetida o pasas meses sin regla.",
    absorbs: ["normal", "piel", "ovulacion"],
    follow: ["¿Es normal mi ciclo?", "¿Cuándo consultar?"] },
  { id: "embarazo", q: "¿Cuándo hago un test de embarazo?", label: "el embarazo",
    keys: ["!embaraz*", "!test de embarazo", "!prueba de embarazo", "!prenada", "!predictor", "quedarme"],
    answer: () => "Si tienes dudas, un test de orina es fiable desde el día en que esperabas la regla.\n- Hacerlo antes puede dar un falso negativo.\n- La app no sirve para evitar ni para buscar un embarazo.\n- Si lo necesitas, puedes pausar las previsiones en Ajustes, sin dar explicaciones.",
    more: () => "Sobre los tests de embarazo:\n- Si lo haces pronto, usa la primera orina de la mañana.\n- Si da negativo y la regla sigue sin llegar, repítelo a los 3–7 días.\n- Una segunda raya, aunque sea débil, suele indicar positivo: confírmalo en tu centro de salud.",
    absorbs: ["ovulacion"],
    follow: ["¿Por qué se retrasa?", "¿Cuándo ovulo?"] },
  { id: "ovulacion", personal: true, q: "¿Cuándo ovulo?", label: "la ovulación",
    keys: ["!ovula*", "!ovulo", "!fertil*", "dias fertiles", "ventana fertil"],
    answer: (x) => {
      const base = "La ovulación suele ocurrir unos 12–16 días antes de la siguiente regla, así que depende de la longitud de tu ciclo.";
      if (!x.ph || !x.ci.win) return `${base}\n- Con tus ciclos registrados podré darte una fecha aproximada.\n- La app no sirve como método anticonceptivo ni para buscar embarazo.`;
      const ov = x.ph.seg.find((s) => s.id === "ovulation");
      const date = ov && x.ci.last ? add(x.ci.last.start, ov.from) : null;
      return `${base}\n- En tu caso, sería hacia el día ${ov ? ov.from + 1 : "?"} del ciclo${date ? ` (≈ ${fmt(date)})` : ""}.\n- Es una estimación: puede variar varios días o no ocurrir algún ciclo.\n- La app no sirve como método anticonceptivo ni para buscar embarazo.`;
    },
    more: () => "Señales que pueden acompañar a la ovulación:\n- Flujo más abundante, transparente y elástico, como clara de huevo.\n- A veces, un dolor leve en un lado del bajo vientre durante unas horas.\n- Una ligera subida de la temperatura basal después de ovular.",
    follow: ["¿En qué fase estoy?", "¿Cuándo me baja?"] },
  { id: "ultima", personal: true, q: "¿Cuándo empezó mi última regla?", label: "tu última regla",
    keys: ["!ultima regla", "hace cuanto", "cuando me bajo", "cuando me vino", "cuando me llego", "cuando fue la ultima", "ultima vez", "la anterior", "!regla anterior"],
    answer: (x) => {
      if (!x.ci.last) return noCycle;
      const n = diff(x.ci.last.start, x.T);
      const ago = n === 0 ? "hoy" : n === 1 ? "ayer" : `hace ${n} días`;
      const end = x.ci.last.end ? `\n- Terminó el ${fmt(x.ci.last.end)}: duró ${days(diff(x.ci.last.start, x.ci.last.end) + 1)}.` : "";
      return `Tu última regla empezó el ${fmt(x.ci.last.start)}, ${ago}.${end}\n- Hoy es el día ${n + 1} de tu ciclo.`;
    },
    follow: ["¿Cuándo me baja?", "¿En qué fase estoy?"] },
  { id: "proxima", personal: true, q: "¿Cuándo me baja?", label: "tu próxima regla",
    keys: ["cuando me baja", "cuando me viene", "cuando me toca", "cuando me llega", "proxim* regla", "siguiente regla", "cuando llega", "cuando viene", "prevision*",
      "me bajara", "me va a bajar", "me vendra", "me llegara", "cuanto falta", "cuanto queda", "cuantos dias faltan", "cuantos dias quedan", "cuando sera"],
    all: [["cuando", "que dia", "que fecha", "fecha", "falta*", "queda*"], ["baja*", "bajar*", "viene", "vendra", "llega*", "toca", "regla", "proxim*"]],
    answer: (x) => {
      if (!x.ci.last) return noCycle;
      if (x.ongoing) return `Ahora mismo estás en el día ${diff(x.ongoing.start, x.T) + 1} de tu regla.\n- Suele durarte unos ${days(x.ci.dur)}.\n- Cuando termine, calcularé la siguiente con tus ciclos.`;
      if (x.S.settings.paused) return "Tienes las previsiones en pausa, así que no calculo la próxima.\n- Puedes reanudarlas en Ajustes cuando quieras.";
      if (!x.ci.win) return "Con una regla más podré estimarla.\n- Necesito al menos dos inicios de regla para medir tu ciclo.";
      const w = x.ci.win, toMid = diff(x.T, w.mid), basis = `\n- Lo calculo con tus últimos ${x.ci.recent.length} ${x.ci.recent.length === 1 ? "ciclo" : "ciclos"}: lo típico en ti son ${x.ci.typical} días.`;
      if (x.T > w.end) return `Según tus ciclos ya debería haber llegado: vas ${days(diff(w.end, x.T))} más allá de tu ventana habitual.${lateCauses}`;
      if (x.T >= w.start) return `Ya estás en tu ventana: puede llegar cualquier día de aquí al ${fmt(w.end)}${toMid > 0 ? ` (lo más probable, hacia el ${fmt(w.mid)})` : ""}.${basis}\n- Variar unos días entre ciclos es normal.`;
      const when = toMid === 1 ? "mañana" : `en unos ${toMid} días`;
      return `Tu próxima regla probablemente llegue entre el ${fmt(w.start)} y el ${fmt(w.end)} (${when}).${basis}\n- Es una ventana, no una fecha exacta: unos días arriba o abajo es normal.`;
    },
    more: () => "Cómo calculo tu próxima regla:\n- Tomo tus últimos ciclos (hasta 6) y uso la mediana, que no se deja llevar por un ciclo raro.\n- La ventana va de tu ciclo más corto al más largo, con 2 días de margen.\n- Cuantas más reglas marques, más afinada será.",
    follow: ["¿En qué fase estoy?", "¿Es normal mi ciclo?", "¿Por qué se retrasa?"] },
  { id: "retraso", personal: true, q: "¿Por qué se retrasa?", label: "el retraso",
    keys: ["retras*", "no me baja", "no me ha bajado", "no me bajo", "se atrasa", "atrasad*", "no llega", "llega tarde", "no me viene", "no me ha venido", "no me vino",
      "no me llega", "me tocaba", "deberia haberme bajado", "deberia bajarme"],
    answer: (x) => {
      if (!x.data || !x.ci.win) return `Un retraso de unos días es frecuente y casi siempre tiene una causa cotidiana.${lateCauses}`;
      if (x.T <= x.ci.win.end) return `Aún estás dentro de tu ventana habitual, que llega hasta el ${fmt(x.ci.win.end)}.\n- Variar unos días entre ciclos es normal.${lateCauses.replace("\n- Estrés", "\n- Si se alarga: estrés")}`;
      return `Vas ${days(diff(x.ci.win.end, x.T))} más allá de tu ventana habitual.${lateCauses}`;
    },
    more: () => "Qué hacer si se retrasa:\n- Espera unos días: un ciclo más largo de vez en cuando es normal.\n- Si ha habido posibilidad de embarazo, haz un test a partir del día en que esperabas la regla, y repítelo a la semana si sigue sin llegar.\n- Cuando llegue, márcala: así veré si fue un ciclo aislado.\nConsulta si: se repite varios meses o pasan 3 meses sin regla.",
    absorbs: ["proxima"],
    follow: ["¿Es normal mi ciclo?", "¿Cuándo me baja?", "¿Cuándo hago un test de embarazo?"] },
  { id: "fase", personal: true, q: "¿En qué fase estoy?", label: "tu fase",
    keys: ["fase", "fases", "en que fase", "dia del ciclo", "dia de mi ciclo", "dia de ciclo", "en que dia", "!folicular", "!lutea", "en que punto", "que dia del ciclo"],
    answer: (x) => {
      if (!x.ph) return x.ci.last ? `Hoy es el día ${x.ci.dayOf} de tu ciclo.\n- Con una regla más podré situarte en tus fases.` : noCycle;
      const p = PHASE_TEXT[x.ph.current];
      const where = x.ph.current === "period" ? "estás con la regla" : `fase ${p.name.toLowerCase()}`;
      return `Hoy es el día ${x.ph.day} de tu ciclo: ${where}.\n- ${p.text}\n- Las fases son aproximadas: la ovulación se sitúa unos 14 días antes de la siguiente regla, no el día 14.`;
    },
    more: (x) => {
      const seg = x.ph?.seg ?? [];
      const at = (id: string) => { const s = seg.find((v) => v.id === id); return s ? ` (días ${s.from}–${s.to})` : ""; };
      return `Las fases de tu ciclo:\n- Regla${at("period")}: el endometrio se desprende.\n- Folicular${at("follicular")}: suben los estrógenos; mucha gente nota más energía.\n- Ovulación${at("ovulation")}: se libera un óvulo, unos 14 días antes de la siguiente regla.\n- Lútea${at("luteal")}: sube la progesterona; más hambre, sueño o sensibilidad son habituales.`;
    },
    follow: ["¿Cuándo ovulo?", "¿Cuándo me baja?", "¿Por qué tengo antojos?"] },
  { id: "abundante", negatable: true, q: "¿Cuándo es abundante el sangrado?", label: "el sangrado",
    keys: ["abundant*", "mucho sangrado", "sangro mucho", "sangrado fuerte", "empapo", "cada hora", "hemorragia", "mucha sangre", "sangrado excesivo", "cuanta sangre",
      "sangre se pierde", "cuanto sangro", "cuanta cantidad", "mancho mucho", "me traspasa", "traspaso"],
    all: [["sangr*", "regla"], ["mucho", "fuerte", "excesiv*", "cantidad"]],
    answer: () => "Se considera abundante si empapas una compresa o tampón cada 1–2 horas durante varias horas, o si la regla dura más de 7 días.\n- De media se pierden 30–40 ml por regla (unas 6–8 cucharadas).\n- El sangrado abundante puede bajar el hierro: cansancio o mareo son una señal.\nConsulta si: te pasa de forma repetida, tienes coágulos mayores que una moneda de 2 € o te mareas.",
    more: () => "Para llevar mejor un sangrado abundante:\n- Usa productos de más absorción, o combina copa o tampón con compresa por la noche.\n- Come alimentos con hierro y vitamina C.\n- Apunta cuántas veces cambias el producto al día: es el dato que más le sirve a un profesional.",
    absorbs: ["duracion", "productos"],
    follow: ["¿Los coágulos son normales?", "¿Qué como para el hierro?", "¿Por qué estoy tan cansada?"] },
  { id: "coagulos", negatable: true, q: "¿Los coágulos son normales?", label: "los coágulos", keys: ["!coagul*", "grumo*", "trozos de sangre", "trozos", "cuajo*"],
    answer: () => "Los coágulos pequeños son normales, sobre todo en los días de más flujo.\n- Se forman cuando la sangre se acumula antes de salir.\n- Suelen ser rojo oscuro y blandos.\nConsulta si: son mayores que una moneda de 2 € de forma frecuente o vienen con sangrado muy abundante.",
    follow: ["¿Cuándo es abundante el sangrado?", "¿Qué significa el color?"] },
  { id: "color", q: "¿Qué significa el color?", label: "el color",
    keys: ["color*", "marron", "sangre oscura", "sangre negra", "sangre marron", "sangre rosa*", "sangre roja", "rojo vivo", "rojo oscuro"],
    all: [["sangre", "regla", "sangrado", "sale"], ["oscur*", "negr*", "marron", "rosa*", "roj*"]],
    answer: () => "El color cambia según lo rápido que sale la sangre y el tiempo que pasa en el útero.\n- Rojo vivo: flujo activo, los días centrales.\n- Marrón u oscuro: sangre más antigua, típico del principio o del final.\n- Rosado: sangre mezclada con flujo, en días suaves.\nConsulta si: es gris o verdoso, huele mal o tienes fiebre.",
    follow: ["¿Los coágulos son normales?", "¿Y el manchado entre reglas?"] },
  { id: "manchado", q: "¿Y el manchado entre reglas?", label: "el manchado",
    keys: ["manch*", "sangrado entre", "entre regla*", "spotting", "sangro sin regla", "despues de relaciones", "despues del sexo", "sangrado leve"],
    all: [["sangr*", "manch*"], ["sin regla", "sin tener la regla", "entre", "despues"]],
    answer: () => "Un manchado leve entre reglas es bastante frecuente.\n- Puede aparecer alrededor de la ovulación, al empezar o cambiar anticonceptivos, o por estrés.\n- Si tomas anticonceptivos hormonales, es habitual los primeros meses.\nConsulta si: se repite varios ciclos, aparece tras las relaciones sexuales o después de la menopausia.",
    absorbs: ["relaciones"],
    follow: ["¿Cuándo ovulo?", "¿Los anticonceptivos cambian la regla?"] },
  { id: "flujo", q: "¿Cómo cambia el flujo?", label: "el flujo",
    keys: ["!flujo", "flujo blanco", "flujo vaginal", "secrecion*", "moco*", "clara de huevo", "!flujo transparente", "humedad", "huele mal", "mal olor", "picor", "escozor"],
    answer: () => "El flujo cambia a lo largo del ciclo, y es normal.\n- Tras la regla suele ser escaso o pegajoso.\n- Cerca de la ovulación es más abundante, transparente y elástico, como clara de huevo.\n- Antes de la regla se vuelve más espeso y blanquecino.\nConsulta si: huele mal, es verdoso o grisáceo, parece requesón o tienes picor o escozor.",
    follow: ["¿Cuándo ovulo?", "¿En qué fase estoy?"] },
  { id: "digestivo", q: "¿Por qué me hincho?", label: "la tripa",
    keys: ["hinchaz*", "hinchad*", "hincho", "gases", "diarrea", "estrenimiento", "nausea*", "vomit*", "digestion", "retencion de liquidos", "retengo liquidos"],
    answer: () => "Las prostaglandinas también actúan sobre el intestino: diarrea o náuseas en la regla son frecuentes.\n- Antes de la regla, la progesterona y la retención de líquidos dan sensación de hinchazón.\n- Menos sal, más agua y fibra, y moverte suave ayudan.\nConsulta si: los vómitos te impiden beber o comer, o el dolor abdominal es muy intenso.",
    follow: ["¿Qué como estos días?", "¿Cómo alivio el dolor?"] },
  { id: "dolor", personal: true, negatable: true, q: "¿Cómo alivio el dolor?", label: "el dolor",
    keys: ["dolor*", "duel*", "colico*", "calambre*", "retortijon*", "pinchazo*", "dolor de regla", "dolor de ovario", "dolor lumbar", "rinones", "espalda", "alivi*",
      "barriga", "tripa", "vientre", "abdomen", "ovario", "primer dia"],
    answer: (x) => {
      if (/\b(sin pastillas|sin medicamentos|sin medicacion|natural|naturales|remedio*|casero*)/.test(x.q))
        return "Sin pastillas, lo que mejor funciona es el calor y el movimiento.\n- Calor local (bolsa o parche) en el abdomen o la zona lumbar: su efecto se parece al de algunos analgésicos.\n- Moverte suave o estirar (rodillas al pecho, postura del niño) mejora el riego de la pelvis.\n- El TENS (electroestimulación) alivia a muchas personas.\n- El ejercicio regular a lo largo del mes reduce el dolor de los siguientes ciclos.";
      if (/\b(primer dia|primeros dias|al principio|al empezar)\b/.test(x.q))
        return "El primer y el segundo día hay más prostaglandinas, porque es cuando más endometrio se desprende: el útero se contrae más.\n- Por eso los antiinflamatorios funcionan mejor si los tomas al empezar.\n- Después, las prostaglandinas bajan y el dolor suele aflojar.";
      const mine = x.data && x.ci.pain != null && x.ci.pain >= 0.5 ? `\n- Tu dolor medio registrado es «${PAIN[Math.round(x.ci.pain)].toLowerCase()}».` : "";
      return `Lo causan las prostaglandinas, que hacen contraerse al útero; suele ser más fuerte el primer o segundo día.\n- Calor local (bolsa o parche) en el abdomen o la zona lumbar.\n- Ibuprofeno o naproxeno al empezar el dolor, con comida y según el prospecto: funcionan mejor que esperar.\n- Moverte suave y estirar mejora el riego de la pelvis.${mine}\nConsulta si: el dolor te impide tu vida diaria aunque tomes analgésicos, o es cada vez más fuerte.`;
    },
    more: () => "Más opciones para el dolor:\n- Los antiinflamatorios funcionan mejor si los empiezas al primer aviso y los tomas con pauta durante 1–2 días.\n- El TENS (electroestimulación) y el ejercicio regular a lo largo del mes también ayudan.\n- Si cada mes es muy intenso, un profesional puede valorar otras causas y tratamientos hormonales.",
    absorbs: ["medicacion"],
    follow: ["¿Qué analgésico puedo tomar?", "¿Por qué duele más el primer día?", "¿Cómo alivio el dolor sin pastillas?"] },
  { id: "piel", q: "¿Por qué me salen granos?", label: "la piel", keys: ["acne", "grano*", "piel", "espinilla*", "cara grasa", "brote*"],
    answer: () => "En la fase lútea los andrógenos pesan más y la piel produce más grasa: el acné antes de la regla es habitual.\n- Limpieza suave y no tocar los granos evita marcas.\n- Suele mejorar al empezar la regla.\nConsulta si: es intenso, deja cicatriz o viene con mucho vello o ciclos muy irregulares.",
    follow: ["¿En qué fase estoy?"] },
  { id: "antojos", personal: true, q: "¿Por qué tengo antojos?", label: "los antojos",
    keys: ["antojo*", "hambre", "chocolate", "dulce*", "como mucho", "apetito", "ganas de comer", "ansiedad por comer", "picar", "como mas", "comer mucho"],
    answer: (x) => {
      const c = count(x.S, "crave")[0];
      const mine = x.data && c ? `\n- Tu antojo más registrado es «${c[0].toLowerCase()}» (${c[1]} ${c[1] === 1 ? "vez" : "veces"}).` : "";
      return `Tras la ovulación sube la progesterona y el gasto energético aumenta un poco: tener más hambre es fisiológico.\n- La bajada de serotonina antes de la regla aumenta las ganas de dulce y de carbohidratos.\n- Comer con regularidad y con algo de proteína suaviza los picos.${mine}`;
    },
    more: () => "Para llevar mejor los antojos:\n- Comidas regulares con proteína y fibra frenan los picos de hambre.\n- Si te apetece chocolate, el negro aporta además magnesio.\n- No hace falta evitarlos: es una respuesta normal del cuerpo.",
    follow: ["¿Qué como estos días?", "¿Por qué estoy más sensible?"] },
  { id: "comida", q: "¿Qué como estos días?", label: "la comida",
    keys: ["que como", "que comer", "comida*", "alimentacion", "dieta", "!hierro", "alimento*", "cafe", "cafeina", "sal", "beber agua", "beber", "hidrat*", "comer", "infusion*",
      "alcohol", "vitamina*", "magnesio", "suplemento*", "anemia"],
    answer: () => "No hay una dieta especial para la regla, pero algunos detalles ayudan.\n- Hierro: legumbres, carne, pescado, huevo y hojas verdes, con vitamina C (cítricos, pimiento).\n- Menos sal y cafeína puede reducir la hinchazón y la irritabilidad.\n- Agua suficiente y fibra ayudan con la digestión de estos días.",
    follow: ["¿Por qué tengo antojos?", "¿Por qué me hincho?"] },
  { id: "animo", personal: true, q: "¿Por qué estoy más sensible?", label: "el ánimo",
    keys: ["animo", "triste*", "tristeza", "irritable", "ansiedad", "ansios*", "llorar", "lloro", "llorona", "sensible", "spm", "premenstrual", "cambios de humor", "humor",
      "bajon", "deprimid*", "depresion", "enfadad*", "mal humor", "agobiad*", "nervios*", "estres*", "estresad*", "emocion*", "sola", "mal"],
    answer: (x) => {
      const m = count(x.S, "mood")[0];
      const mine = x.data && m ? `\n- Tu ánimo más registrado es «${m[0].toLowerCase()}».` : "";
      return `Antes de la regla bajan los estrógenos y la progesterona, y eso afecta a la serotonina: estar más sensible o irritable es frecuente.\n- Dormir bien, moverte y reducir la cafeína ayuda a muchas personas.\n- Registrar tu ánimo te ayuda a ver si se repite en la misma fase.${mine}\nConsulta si: cada mes afecta a tu trabajo o a tus relaciones (tiene tratamiento), o si tienes pensamientos de hacerte daño: pide ayuda hoy mismo (en España, 024).`;
    },
    more: () => "Lo que más ayuda en los días de bajón:\n- Ejercicio suave, como caminar 20–30 minutos.\n- Horarios de sueño regulares y menos cafeína y alcohol.\n- Anotar cómo te sientes: ver que se repite en la misma fase te ayuda a anticiparte.",
    follow: ["¿En qué fase estoy?", "¿Por qué estoy tan cansada?"] },
  { id: "cansancio", q: "¿Por qué estoy tan cansada?", label: "el cansancio",
    keys: ["cansanci*", "cansad*", "agotad*", "sin energia", "sueno", "dormir", "duermo", "fatiga", "insomnio", "flojera", "mareo*", "mareada", "debil*", "energia"],
    answer: () => "Estar más cansada en la regla es común: el cuerpo gasta más y la progesterona cae de golpe.\n- Si sangras mucho, puedes perder hierro: legumbres, carne, pescado y hojas verdes ayudan; la vitamina C mejora su absorción.\n- Dormir algo más y moverte suave mejora la energía.\nConsulta si: el cansancio viene con mareos, palpitaciones o sangrado abundante: un análisis puede descartar anemia.",
    more: () => "Si el cansancio no mejora:\n- Una analítica puede mirar el hierro (ferritina), sobre todo si sangras mucho.\n- Moverte suave y la luz del día mejoran la energía más que descansar todo el día.\n- Evita la cafeína por la tarde si te cuesta dormir.",
    follow: ["¿Qué como para el hierro?", "¿Cuándo es abundante el sangrado?"] },
  { id: "ejercicio", q: "¿Puedo hacer deporte?", label: "el deporte",
    keys: ["ejercicio", "deporte", "entrenar", "entreno", "correr", "gimnasio", "gym", "yoga", "nadar", "piscina", "pesas", "playa", "banarme", "banar", "caminar", "bici*"],
    answer: () => "Puedes hacer ejercicio con la regla, y a menudo alivia el dolor.\n- Ajusta la intensidad a cómo te sientas: no hay que parar ni forzar.\n- Para nadar, el tampón o la copa funcionan bien.\n- Hidrátate algo más si sangras mucho.",
    follow: ["¿Cómo alivio el dolor?", "¿Tampón, copa o compresa?"] },
  { id: "productos", q: "¿Tampón, copa o compresa?", label: "los productos",
    keys: ["tampon*", "copa", "copa menstrual", "compresa*", "braga menstrual", "bragas menstruales", "disco menstrual", "salvaslip*", "cada cuanto cambio", "cada cuanto lo cambio"],
    answer: () => "Elige lo que te resulte más cómodo; todos son seguros bien usados.\n- Tampón: cámbialo cada 4–8 horas y usa la absorción más baja que te sirva.\n- Copa o disco: hasta 12 horas; lávalos entre usos y hiérvelos entre reglas.\n- Compresas y bragas menstruales: cambia cuando notes humedad.\nUrgente: con tampón o copa, si tienes fiebre alta, vómitos o erupción, retíralo y busca atención.",
    follow: ["¿Cuándo es abundante el sangrado?", "¿Puedo hacer deporte?"] },
  { id: "relaciones", q: "¿Puedo tener relaciones con la regla?", label: "las relaciones",
    keys: ["sexo", "relaciones", "relaciones sexuales", "hacer el amor", "follar", "acostarme con", "orgasmo*", "masturb*", "mi pareja"],
    answer: () => "Tener relaciones con la regla es seguro si os apetece a las dos personas.\n- A algunas personas el orgasmo les alivia los cólicos.\n- Sigue siendo posible un embarazo y las infecciones se transmiten igual: el preservativo protege de ambas cosas.\n- Retira antes el tampón; el disco menstrual se puede llevar puesto.\nConsulta si: sangras o te duele a menudo después de las relaciones.",
    follow: ["¿Y el manchado entre reglas?", "¿Cuándo ovulo?"] },
  { id: "resumen", personal: true, q: "Resumen de mis datos", label: "tus datos",
    keys: ["resumen de mis datos", "mis datos", "como voy", "estadistica*", "historial", "mis registros", "analiza*", "que sabes de mi", "resumen", "mi ciclo en general",
      "resumeme", "informe"],
    answer: (x) => {
      if (!x.data) return `Ahora no estoy usando tus datos.${needData}`;
      if (!x.ci.last && !Object.keys(x.S.days).length) return noCycle;
      const lines: string[] = [];
      lines.push(`- Reglas registradas: ${x.S.periods.length}.`);
      if (x.ci.typical) lines.push(`- Ciclo típico: ${x.ci.typical} días (rango ${x.ci.lo}–${x.ci.hi}).`);
      lines.push(`- Duración habitual de la regla: ${days(x.ci.dur)}.`);
      if (x.ci.pain != null) lines.push(`- Dolor medio: ${PAIN[Math.round(x.ci.pain)].toLowerCase()}.`);
      const s = count(x.S, "sym").slice(0, 3);
      if (s.length) lines.push(`- Síntomas más frecuentes: ${s.map(([k, n]) => `${k.toLowerCase()} (${n})`).join(", ")}.`);
      const m = count(x.S, "mood")[0];
      if (m) lines.push(`- Ánimo más frecuente: ${m[0].toLowerCase()}.`);
      const inRange = x.ci.lo != null && x.ci.hi != null && x.ci.lo >= 21 && x.ci.hi <= 35;
      return `Esto es lo que sé de ti por tus registros:\n${lines.join("\n")}${x.ci.typical ? `\n- ${inRange ? "Tus ciclos están dentro del rango habitual (21–35 días)." : "Algún ciclo sale del rango habitual de 21–35 días; un caso aislado no es preocupante."}` : ""}`;
    },
    follow: ["¿Es normal mi ciclo?", "¿Cuándo me baja?", "¿Cómo alivio el dolor?"] },
  { id: "sintomas", personal: true, q: "¿Qué síntomas tengo más?", label: "tus síntomas", keys: ["sintoma*", "que me pasa", "mas frecuente*", "que noto", "lo que mas"],
    answer: (x) => {
      const s = count(x.S, "sym").slice(0, 4);
      if (!x.data || !s.length) return `Los síntomas más comunes alrededor de la regla son cólicos, hinchazón, cansancio, dolor de cabeza y pecho sensible.\n- Regístralos en el día y verás cuáles se repiten.${x.data ? "" : needData}`;
      return `Tus síntomas más registrados son ${s.map(([k, n]) => `${k.toLowerCase()} (${n})`).join(", ")}.\n- Pregúntame por cualquiera y te explico por qué pasa y qué ayuda.`;
    },
    follow: ["¿Cómo alivio el dolor?", "¿Por qué me hincho?", "Resumen de mis datos"] },
  { id: "app", q: "¿Cómo funciona la app?", label: "la app",
    keys: ["como registro", "como marco", "como uso", "como apunto", "como anado", "como pongo", "como meto", "como cambio", "como quito", "como borro", "la app", "aplicacion",
      "recordatorio*", "notificacion*", "aviso*", "como pauso", "pausar", "pausa", "conectar salud", "salud", "health connect", "widget", "borrar datos", "como funciona",
      "privacidad", "exportar"],
    all: [["como", "donde"], ["registr*", "marc*", "apunt*", "anad*", "pong*", "meto", "guard*", "cambi*", "edit*", "quit*", "borr*", "paus*"]],
    answer: (x) => {
      if (/\b(paus)/.test(x.q)) return "Puedes pausar las previsiones en Ajustes (el engranaje de la pestaña Hoy).\n- Mientras estén en pausa no calculo la próxima regla ni te aviso.\n- Tus registros se quedan como están, y las reanudas cuando quieras.";
      if (/\b(borr|quit|elimin)/.test(x.q)) return "Para quitar una regla, toca uno de sus días en el calendario y elige quitarla.\n- Para borrar todos tus datos, ve a Ajustes (el engranaje de la pestaña Hoy).\n- Borrar es definitivo: la app te lo pregunta antes.";
      return "Así funciona Luna Rosa:\n- Marca el inicio y el fin de la regla tocando un día del calendario, o dímelo aquí («me ha bajado hoy»).\n- En cada día puedes anotar dolor, síntomas, medicación, ánimo y antojos.\n- En Ajustes: recordatorio, pausar previsiones, conectar con Salud o Health Connect y borrar tus datos.\n- La app aprende tu ciclo sola: no te pregunta cada cuánto te viene.";
    },
    follow: ["¿Cuándo me baja?", "Resumen de mis datos"] },
  { id: "etapas", q: "¿Cambia la regla con la edad?", label: "las etapas",
    keys: ["menopausia", "perimenopausia", "sofoco*", "primera regla", "adolescen*", "postparto", "posparto", "lactancia", "!dar el pecho", "despues del parto", "menarquia", "edad"],
    answer: () => "En los extremos de la vida fértil los ciclos son más irregulares, y es esperable.\n- En la adolescencia pueden tardar unos años en asentarse.\n- En la perimenopausia los ciclos se acortan, se alargan o se saltan.\n- Tras el parto y con lactancia, la regla puede tardar meses en volver.\nConsulta si: sangras después de un año sin reglas (menopausia).",
    follow: ["¿Es normal mi ciclo?"] },
  { id: "regla", q: "¿Qué es la regla?", label: "la regla",
    keys: ["que es la regla", "por que tenemos la regla", "por que sangramos", "por que nos baja", "para que sirve la regla",
      "que es el ciclo menstrual", "que es un ciclo menstrual", "como funciona el ciclo", "como funciona la regla", "que pasa en la regla", "explicame la regla"],
    answer: () => "La regla es el desprendimiento del endometrio, la capa que recubre el útero, cuando no hay embarazo.\n- Cada ciclo el cuerpo prepara esa capa; si no hay embarazo, baja la progesterona y se elimina.\n- Un ciclo va del primer día de una regla al primer día de la siguiente.\n- Lo habitual: ciclos de 21–35 días y reglas de 2–7 días.",
    follow: ["¿En qué fase estoy?", "¿Qué es un ciclo normal?"] },
  { id: "normal", personal: true, q: "¿Es normal mi ciclo?", label: "tu ciclo",
    keys: ["es normal mi ciclo", "ciclo normal", "irregular*", "mi ciclo", "ciclos", "ciclo largo", "ciclo corto", "cada cuanto", "~normal", "~regular", "~cambia", "~varia", "~variacion"],
    all: [["cuanto*", "dur*", "largo", "corto"], ["ciclo*"]],
    answer: (x) => {
      const base = "Entre 21 y 35 días es el rango habitual en adultas, y variar hasta 7–9 días de un ciclo a otro es normal.";
      if (!x.data || x.ci.lo == null || x.ci.hi == null) return `${base}\n- Lo útil es mirar la tendencia de varios meses, no un ciclo aislado.\n- Estrés, sueño o viajes pueden alargar un ciclo concreto.${x.data ? "" : needData}`;
      const inRange = x.ci.lo >= 21 && x.ci.hi <= 35, spread = x.ci.hi - x.ci.lo;
      const range = x.ci.lo === x.ci.hi ? `Tus ciclos duran ${x.ci.lo} días` : `Tus ciclos van de ${x.ci.lo} a ${x.ci.hi} días`;
      return `${range}${inRange ? ", dentro de lo habitual" : ""}.\n- ${base}\n- ${spread <= 9 ? `Tu variación (${days(spread)}) es normal.` : `Tu variación (${days(spread)}) es amplia; si se mantiene varios meses, coméntalo en tu próxima revisión.`}\nConsulta si: tus ciclos son de menos de 21 o más de 35 días de forma repetida.`;
    },
    more: () => "Cuándo un ciclo se sale de lo habitual:\n- Si dura menos de 21 o más de 35 días varias veces seguidas.\n- Si varía más de 7–9 días de un ciclo a otro de forma repetida.\n- Si pasan 3 meses sin regla sin un motivo conocido.",
    follow: ["¿Por qué se retrasa?", "¿Cuándo me baja?", "Resumen de mis datos"] },
  { id: "duracion", personal: true, q: "¿Cuánto me suele durar?", label: "la duración",
    keys: ["cuanto dura", "cuantos dias dura", "duracion", "dias de regla", "me dura", "dura la regla", "dura mucho", "dura poco", "suele durar", "durar", "dura"],
    all: [["cuanto*", "cuantos dias"], ["dur*"]],
    answer: (x) => {
      const mine = x.data && x.ci.last ? `Tu regla suele durar unos ${days(x.ci.dur)}.` : "Una regla suele durar entre 2 y 7 días.";
      const now = x.data && x.ongoing ? `\n- Hoy vas por el día ${diff(x.ongoing.start, x.T) + 1}.` : "";
      return `${mine}${now}\n- Entre 2 y 7 días es lo habitual.\n- Los primeros días suelen ser los de más flujo.\nConsulta si: dura más de 7 días de forma repetida.`;
    },
    follow: ["¿Cuándo es abundante el sangrado?", "¿Es normal mi ciclo?"] },
  { id: "consulta", q: "¿Cuándo consultar?", label: "cuándo consultar",
    keys: ["consult*", "cuando consultar", "ir al medico", "medico", "ginecolog*", "matrona", "urgencias", "revision", "fiebre", "~preocup*", "~grave", "~es grave"],
    answer: () => "Pocas cosas de la regla requieren consulta, y casi ninguna es urgente.\n- El dolor te impide tu vida diaria aunque tomes analgésicos.\n- Empapas una compresa o tampón cada 1–2 horas, o la regla dura más de 7 días de forma repetida.\n- Pasan 3 meses sin regla sin un motivo conocido, o sangras tras las relaciones.\nUrgente: desmayo, mareo intenso, sangrado que empapa una compresa cada hora durante 2 horas, o fiebre llevando tampón o copa.",
    follow: ["¿Cómo alivio el dolor?", "¿Cuándo es abundante el sangrado?"] },
  { id: "quien", q: "¿Qué puedes hacer?", label: "lo que hago",
    keys: ["quien eres", "que eres", "eres una ia", "eres un robot", "eres real", "eres humana", "eres una persona", "que puedes hacer", "en que me ayudas", "que sabes hacer",
      "para que sirves", "como te llamas", "ayuda", "ayudame"],
    answer: () => "Soy Lu, la asistente de Luna Rosa: respondo con lo que la app sabe de tu ciclo.\n- Te digo cuándo te toca la regla, en qué fase estás y si tu ciclo va como siempre.\n- Te explico el dolor, el sangrado, el ánimo, los antojos y qué ayuda.\n- Puedo apuntarte la regla: dime «me ha bajado hoy».\n- No sustituyo a un profesional, pero te diré cuándo conviene consultar.",
    follow: ["¿Cuándo me baja?", "¿En qué fase estoy?", "Resumen de mis datos"] },
  { id: "bien", keys: ["estoy bien", "me encuentro bien", "me siento bien", "todo bien", "no me duele", "no me duele nada", "ya no me duele", "no tengo dolor", "sin dolor", "estoy genial"],
    answer: () => "¡Me alegro mucho! Si algún día notas algo, apúntalo en el día y lo tendré en cuenta.", follow: ["¿En qué fase estoy?", "¿Cuándo me baja?"] },
];

// ---- understanding ----
type Pat = { words: string[]; w: number };
const pat = (k: string): Pat => {
  const strong = k.startsWith("!"), weak = k.startsWith("~");
  const words = k.replace(/^[!~]/, "").split(" ");
  return { words, w: weak ? 0.5 : words.length + (strong ? 3 : 0) };
};
const PATS = new Map(INTENTS.map((it) => [it.id, it.keys.map(pat).sort((a, b) => b.w - a.w)]));
const GROUPS = new Map(INTENTS.map((it) => [it.id, it.all ? [it.all.map((g) => g.map(pat))] : []]));
const BY_ID = Object.fromEntries(INTENTS.map((i) => [i.id, i]));

const wordHit = (p: string, t: string) => (p.endsWith("*") ? t.startsWith(p.slice(0, -1)) : t === p);
/** Start positions where the phrase appears in the tokens. */
function spans(tokens: string[], words: string[]) {
  const out: number[] = [];
  for (let i = 0; i + words.length <= tokens.length; i++) if (words.every((w, j) => wordHit(w, tokens[i + j]))) out.push(i);
  return out;
}
const CLITIC = new Set(["me", "te", "le", "les", "lo", "la", "tengo", "noto", "siento", "he", "ha", "hay", "tiene"]);
const negated = (tokens: string[], i: number) => {
  let j = i - 1;
  while (j >= 0 && CLITIC.has(tokens[j])) j--;
  return j >= 0 && (tokens[j] === "no" || tokens[j] === "nunca" || tokens[j] === "ni" || tokens[j] === "sin");
};

// Typos: a word that isn't one Lu knows is replaced by the only known word one letter away (two in long words).
const VOCAB = new Set<string>(), STEMS = new Set<string>();
for (const it of INTENTS) for (const k of [...it.keys, ...(it.all ?? []).flat()]) for (const w of k.replace(/^[!~]/, "").split(" ")) (w.endsWith("*") ? STEMS.add(w.slice(0, -1)) : VOCAB.add(w));
/** Edit distance with swapped letters counting as one ("ovualcion" → "ovulacion"). */
function dist(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
function fix(t: string) {
  if (t.length < 4 || VOCAB.has(t) || STOP.has(t) || /\d/.test(t)) return t;
  for (const s of STEMS) if (t.startsWith(s)) return t;
  const max = t.length >= 8 ? 2 : 1, min = t.length < 5 ? 5 : 4; // a short word only gets a missing letter back ("ovlo" → "ovulo")
  let best = "", bestD = max + 1, tie = false;
  const consider = (cand: string, d: number) => { if (d < bestD) { best = cand; bestD = d; tie = false; } else if (d === bestD && cand !== best) tie = true; };
  for (const w of VOCAB) if (w.length >= min) consider(w, dist(t, w, max));
  for (const s of STEMS) if (s.length >= min) {
    // the typo may be inside the stem ("ovualcion" → "ovula" + "cion"): the closest split for this stem, the exact length on ties
    let d = dist(t.slice(0, s.length), s, max), n = s.length;
    for (const m of [s.length - 1, s.length + 1]) { const e = m <= t.length ? dist(t.slice(0, m), s, max) : max + 1; if (e < d) { d = e; n = m; } }
    if (n <= t.length) consider(s + t.slice(n), d);
  }
  return bestD <= max && !tie ? best : t;
}

/** Words of the question, spelled the way the topics are written. */
export function tokens(question: string) {
  const out: string[] = [];
  for (const raw of norm(question).replace(/([a-z])\1{2,}/g, "$1").split(" ")) {
    if (!raw) continue;
    const c = CANON[raw];
    (c ? c.split(" ") : [fix(raw)]).forEach((w) => out.push(w));
  }
  return out;
}

function score(it: Intent, toks: string[]) {
  let sc = 0, combo = false;
  const used = new Set<number>();
  for (const p of PATS.get(it.id)!) for (const i of spans(toks, p.words)) {
    const r = p.words.map((_, j) => i + j);
    if (r.some((k) => used.has(k)) || (it.negatable && negated(toks, i))) continue;
    r.forEach((k) => used.add(k));
    sc += p.w;
  }
  for (const g of GROUPS.get(it.id)!) if (g.length + 0.5 > sc && g.every((alts) => alts.some((p) => spans(toks, p.words).length))) { sc = g.length + 0.5; combo = true; }
  return { sc: sc * (it.weight ?? 1), used: combo ? null : used };
}

/** Topics the question is about, best first. */
function classify(toks: string[]) {
  return INTENTS.map((it) => ({ it, ...score(it, toks) })).filter((r) => r.sc > 0).sort((a, b) => b.sc - a.sc);
}

// "¿y por qué?", "explícame más", "¿es grave?": about whatever Lu said last.
const FOLLOWUP = /^(y|pero|entonces|vale y|ok y|por que|explica\w*|cuentame|dime mas|mas|algo mas|que mas|como asi|eso|seguro|en serio|que hago|que puedo hacer|y ahora|no entiendo|no lo entiendo|amplia\w*|sigue|continua|es grave|es normal|es malo|y eso|otra cosa mas|alguna cosa mas|algun consejo|consejo)\b/;
const WORRY = /\b(grave|preocup\w*|peligros\w*|malo|mala senal|consult\w*|medico|urgencias?)\b/;
const firstSentence = (t: string) => t.split("\n")[0];
const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
/** Puts an extra point before the closing "Consulta si" / "Urgente" note, which stays last. */
const withPoint = (text: string, point: string) => {
  const lines = text.split("\n"), i = lines.findIndex((l) => /^(consulta si|urgente):/i.test(l));
  lines.splice(i < 0 ? lines.length : i, 0, `- ${point}`);
  return lines.join("\n");
};

/**
 * Lu's answer to `question`. `history` is the conversation so far: a vague follow-up continues the last topic,
 * and an answer Lu just gave isn't repeated word for word (she goes deeper, or says she already told).
 */
export function think(S: State, ci: CycleInfo, question: string, history: Past[] = []): Reply {
  const T = today();
  const toks = tokens(question);
  const x: Ctx = { S, ci, T, ongoing: periodAt(S, T), data: S.settings.useData, ph: phases(ci), q: toks.join(" ") };
  const recent = history.filter((m) => m.r === "a").slice(-6).map((m) => firstSentence(m.t));
  const said = (t: string) => recent.includes(firstSentence(t));
  const lastTopic = [...history].reverse().find((m) => m.r === "a" && m.topic && !BY_ID[m.topic]?.social)?.topic;
  const ranked = classify(toks);
  const topic = ranked.find((r) => !r.it.social && r.sc >= 1);
  const social = ranked.find((r) => r.it.social);
  const weak = ranked.find((r) => !r.it.social);

  const asked = norm(question);
  const reply = (it: Intent, deeper = false): Reply => {
    let text = it.answer(x);
    // "¿y qué más?" about the same topic: the deeper answer, or a short reminder instead of the same block twice.
    if (deeper) {
      const more = it.more?.(x), warn = text.split("\n").find((l) => /^(consulta si|urgente):/i.test(l));
      if (WORRY.test(x.q)) text = warn ? `Casi nunca es grave, pero hay señales que conviene vigilar.\n${warn}` : BY_ID.consulta.answer(x);
      else if (more && !said(more)) text = more;
      else if (said(text)) text = `Lo esencial sobre ${it.label ?? "esto"}: ${lower(firstSentence(text))}\n- Si buscabas otra cosa, pregúntamelo con otras palabras o toca una sugerencia.`;
    }
    if (it.personal && !x.data && !text.includes("Usar mis datos")) text += needData;
    return { text, topic: it.id, follow: it.follow.filter((f) => norm(f) !== asked), action: it.action?.(x) };
  };

  if (topic) {
    const it = topic.it;
    const r = reply(it, it.id === lastTopic && FOLLOWUP.test(x.q) && topic.sc < 2);
    // A second question in the same message ("me duele la cabeza y estoy triste") gets a line and a chip.
    const overlap = (a: Set<number> | null, b: Set<number> | null) => !a || !b || [...a].some((k) => b.has(k));
    const second = it.id === "crisis" || it.id === "urgente" ? undefined : ranked.find((o) => o !== topic && !o.it.social && o.sc >= 1 && o.it.q && o.it.label
      && !it.absorbs?.includes(o.it.id) && !overlap(o.used, topic.used));
    if (second) {
      r.text = withPoint(r.text, `Sobre ${second.it.label}: ${lower(firstSentence(second.it.answer(x)))}`);
      r.follow = [second.it.q!, ...r.follow.filter((f) => f !== second.it.q)].slice(0, 3);
    }
    return r;
  }
  const prev = lastTopic ? BY_ID[lastTopic] : undefined;
  if (prev && !prev.social && (FOLLOWUP.test(x.q) || (weak && !social))) return reply(prev, true);
  if (social) return reply(social.it);
  if (weak) return reply(weak.it);
  return { topic: "", follow: suggestions(S, ci),
    text: "No estoy segura de haberte entendido.\n- Sé de tu ciclo y de tu regla: cuándo te toca, tus fases, el dolor, el sangrado, el ánimo o los antojos.\n- También puedo apuntarte la regla si me dices «me ha bajado hoy».\n- Prueba con una pregunta corta o toca una sugerencia." };
}

/** Starting questions that fit the moment: during the period, when late, or in general. */
export function suggestions(S: State, ci: CycleInfo): string[] {
  const T = today();
  if (!ci.last) return ["¿Cómo funciona la app?", "¿Qué es un ciclo normal?", "¿Cómo alivio el dolor?", "¿Por qué tengo antojos?"];
  if (periodAt(S, T)) return ["¿Cómo alivio el dolor?", "¿Cuánto me suele durar?", "¿Los coágulos son normales?", "¿Por qué estoy tan cansada?"];
  if (ci.win && T > ci.win.end) return ["¿Por qué se retrasa?", "¿Es normal mi ciclo?", "¿Cuándo me baja?", "Resumen de mis datos"];
  return ["¿Cuándo me baja?", "¿En qué fase estoy?", "¿Es normal mi ciclo?", "Resumen de mis datos"];
}

/** Rich, private context for the server version of Lu (only when "Usar mis datos" is on). */
export function contextText(S: State, ci: CycleInfo) {
  if (!S.settings.useData) return "";
  const T = today(), ph = phases(ci), on = periodAt(S, T);
  const top = (f: "sym" | "mood" | "crave") => count(S, f).slice(0, 4).map(([k, n]) => `${k} (${n})`).join(", ") || "sin datos";
  const last = S.periods.slice(-4).map((p) => `${p.start}→${p.end ?? "en curso"}`).join("; ") || "ninguna";
  const medDays = Object.values(S.days).filter((d) => d.med.taken).length;
  return [
    `Hoy: ${T}.`,
    on ? `Está con la regla (día ${diff(on.start, T) + 1}).` : ci.dayOf ? `Día ${ci.dayOf} del ciclo${ph ? `, fase aprox. ${PHASE_TEXT[ph.current].name}` : ""}.` : "Sin ciclo registrado.",
    `Últimas reglas: ${last}.`,
    `Ciclos recientes: ${ci.recent.join(", ") || "sin datos"} días; típico ${ci.typical ?? "?"}; duración de regla ~${ci.dur} días.`,
    ci.win ? `Próxima regla estimada entre ${ci.win.start} y ${ci.win.end}.` : "",
    S.settings.paused ? "Previsiones en pausa (no preguntar por qué)." : "",
    `Dolor medio: ${ci.pain != null ? PAIN[Math.round(ci.pain)] : "sin datos"}; días con medicación: ${medDays}.`,
    `Síntomas frecuentes: ${top("sym")}. Ánimo: ${top("mood")}. Antojos: ${top("crave")}.`,
  ].filter(Boolean).join(" ");
}

/** Local summary of the conversation: one line per topic and every "Consulta si" that came up. */
export function summarize(history: Past[]) {
  const seen = new Set<string>(), lines: string[] = [], consult = new Set<string>();
  for (const m of history) {
    if (m.r !== "a" || !m.topic || BY_ID[m.topic]?.social || seen.has(m.topic)) continue;
    seen.add(m.topic);
    const first = firstSentence(m.t).replace(/\*\*/g, "");
    lines.push(`- ${first}`);
    m.t.split("\n").filter((l) => /^(Consulta si|Urgente):/i.test(l)).forEach((l) => consult.add(l));
  }
  if (!lines.length) return "Aún no hay nada que resumir: pregúntame algo primero.";
  return `Resumen de lo que hemos hablado:\n${lines.slice(0, 5).join("\n")}${[...consult].slice(0, 1).map((l) => `\n${l}`).join("")}`;
}

// Text content: daily quotes, logging options and the guide.
export const QUOTES = [
  "Tu cuerpo no va con retraso. Va a su ritmo.",
  "Descansar también es avanzar.",
  "Hoy basta con hacer lo que puedas.",
  "Escucharte es una forma de cuidarte.",
  "No tienes que rendir al 100% todos los días.",
  "Lo que sientes es válido, aunque nadie lo vea.",
  "Un día difícil no es una semana difícil.",
  "Eres más fuerte que cualquier cólico.",
  "Tu ciclo es información, no un defecto.",
  "Ir despacio sigue siendo ir.",
  "Puedes pedir ayuda y seguir siendo fuerte.",
  "Hoy toca tratarte como tratarías a tu mejor amiga.",
  "Cada cuerpo tiene su propio calendario.",
  "Respira. Esto también pasa.",
  "Conocerte es tu superpoder.",
  "No hay un ciclo perfecto, hay el tuyo.",
  "Mereces sentirte bien, también estos días.",
  "Paso a paso, sin culpa.",
  "Hoy elige lo que te haga sentir mejor.",
  "Tu energía cambia, tu valor no.",
  "Cuidarte no es un premio, es lo básico.",
  "Está bien cancelar planes para estar bien.",
  "Lo estás haciendo mejor de lo que crees.",
  "Tu bienestar va primero.",
  "Dolor no es normal solo porque sea común: mereces alivio.",
  "Cada registro te ayuda a entenderte.",
  "Eres suficiente, hoy y siempre.",
  "Que hoy sea suave contigo.",
  "La calma también se entrena.",
  "Tú decides el ritmo.",
  "Un vaso de agua, una pausa, y adelante.",
];
export function quoteOfDay(d = new Date()) {
  const doy = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 864e5);
  return QUOTES[doy % QUOTES.length];
}

export const PAIN = ["Nada", "Poco", "Medio", "Mucho"];
export const SYM = ["Cólicos", "Hinchazón", "Dolor de cabeza", "Cansancio", "Dolor lumbar", "Pecho sensible", "Náuseas", "Acné", "Diarrea", "Mareo"];
export const MOOD = ["Tranquila", "Sensible", "Irritable", "Triste", "Ansiosa", "Con energía", "Llorona", "Feliz"];
export const CRAVE = ["Chocolate", "Dulce", "Salado", "Picante", "Pasta / pan", "Fruta", "Queso", "Comida rápida"];
export const MEDS = ["Ibuprofeno", "Paracetamol", "Naproxeno", "Metamizol"];

export type Tip = { id: string; t: string; s: string; more: string[]; range?: boolean };
export const TIPS: Tip[] = [
  { id: "normal", t: "¿Qué es normal?", s: "Ciclos de 21 a 35 días y reglas de 2 a 7 días. Variar 7 días de un mes a otro es habitual.", range: true,
    more: ["La ovulación no cae siempre el día 14: suele ocurrir unos 12–16 días antes de la siguiente regla, así que depende de la longitud de tu ciclo.", "En la adolescencia y en la perimenopausia los ciclos son más irregulares; es esperable.", "Se pierden de media 30–40 ml de sangre por regla (unas 6–8 cucharadas)."] },
  { id: "dolor", t: "Dolor de regla", s: "Lo causan las prostaglandinas, que contraen el útero. Suele ser más fuerte el primer o segundo día.",
    more: ["Calor local (bolsa o parche) relaja el músculo uterino; su eficacia es comparable a la de algunos analgésicos.", "Los antiinflamatorios (ibuprofeno, naproxeno) bloquean las prostaglandinas: funcionan mejor tomados al empezar el dolor, con comida y según el prospecto.", "Moverte suavemente mejora el flujo sanguíneo pélvico."] },
  { id: "irreg", t: "Ciclo más largo o corto", s: "Estrés, sueño, viajes, cambios de peso o ejercicio intenso pueden retrasar la ovulación y alargar el ciclo.",
    more: ["Un ciclo aislado diferente no indica un problema por sí solo.", "Lo útil es mirar la tendencia de varios meses, que la app te muestra en el gráfico."] },
  { id: "antojos", t: "Antojos", s: "Tras la ovulación, la progesterona sube y el gasto energético aumenta un poco. Más hambre es fisiológico.",
    more: ["Los cambios en la serotonina pueden aumentar el deseo de carbohidratos y dulce.", "Comer con regularidad evita picos de hambre más intensos."] },
  { id: "hierro", t: "Sangrado abundante", s: "Si cambias de compresa o tampón cada 1–2 horas, pierdes más hierro del habitual.",
    more: ["Puede notarse como cansancio o mareo.", "Legumbres, carne, pescado y hojas verdes aportan hierro; la vitamina C ayuda a absorberlo."] },
  { id: "consulta", t: "Cuándo consultar", s: "Pocas situaciones, y ninguna urgente salvo dolor muy intenso o sangrado muy abundante.",
    more: ["El dolor te impide hacer tu vida aunque tomes analgésicos.", "Empapas una compresa cada hora durante varias horas.", "La regla dura más de 7 días de forma repetida.", "No tienes regla en 3 meses sin un motivo conocido."] },
];

// Lu's server: a Cloudflare Worker that keeps the Claude API key out of the app.
// POST { mode: "answer" | "summary", context: string, messages: [{role, content}] } -> { text }
import Anthropic from "@anthropic-ai/sdk";

const RULES = `Eres Lu, el asistente de una app de registro menstrual. Responde SIEMPRE en español, de tú, con calidez pero sin rodeos.
Formato obligatorio, muy breve (máx. 90 palabras): una frase de respuesta directa; después hasta 3 viñetas que empiecen por "- ".
Si y solo si hay un criterio claro de consulta médica, añade una línea que empiece por "Consulta si:". Si hay una señal de alarma (desmayo, sangrado que empapa una compresa por hora durante 2 h o más, fiebre con tampón o copa, dolor brusco e insoportable, pensamientos de hacerse daño), usa en su lugar una línea que empiece por "Urgente:" con qué hacer (112 en España; 024 para conducta suicida).
Termina SIEMPRE con una última línea "Siguientes: " con 2 o 3 preguntas cortas que la usuaria podría hacerte a continuación, separadas por " | ".
Usa los datos de la usuaria cuando sean relevantes (fechas, días de ciclo, síntomas frecuentes) para concretar; no los repitas sin motivo.
Estilo: explicaciones fisiológicas rigurosas y concretas. Nada de frases motivacionales, consejos paternalistas ni estereotipos ("tómate un té", "sonríe").
No diagnostiques ni sugieras enfermedades (SOP, endometriosis, déficits) a partir de síntomas aislados. No generes alarma.
Respeta la diversidad de ciclos: 21–35 días es habitual en adultas; la ovulación ocurre unos 12–16 días antes de la regla, no siempre el día 14.
No asumas embarazo ni hables de fertilidad salvo que la usuaria lo pregunte. La app no es un método anticonceptivo.`;

const SUMMARY = `Resume la conversación en máximo 4 viñetas que empiecen por "- ", solo con lo esencial y accionable, en español. Si se habló de algún criterio de consulta, termina con una línea "Consulta si:". No añadas la línea "Siguientes:".`;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return json({ error: "POST only" }, 405);
    if (env.APP_TOKEN && request.headers.get("x-app-token") !== env.APP_TOKEN) return json({ error: "unauthorized" }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }

    const history = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .slice(-11)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
    // The API needs the conversation to start with the user.
    while (history.length && history[0].role !== "user") history.shift();

    let messages;
    if (body.mode === "summary") {
      const transcript = history.map((m) => `${m.role === "user" ? "Usuaria" : "Lu"}: ${m.content}`).join("\n");
      if (!transcript) return json({ text: "Aún no hay nada que resumir." });
      messages = [{ role: "user", content: `${SUMMARY}\n\n${transcript}` }];
    } else {
      if (!history.length || history[history.length - 1].role !== "user") return json({ error: "last message must be the question" }, 400);
      messages = history;
    }

    const system = RULES + (body.context ? `\nDatos de la usuaria (no los repitas salvo que sean relevantes): ${String(body.context).slice(0, 1500)}` : "");
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    try {
      const response = await client.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 2000,
        output_config: { effort: "low" }, // short chat answers
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default", // if a request is declined, the API retries it on its recommended fallback model
        system,
        messages,
      });
      if (response.stop_reason === "refusal") {
        return json({ text: "No puedo responder a eso. Prueba a preguntarlo de otra forma." });
      }
      const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      return json({ text: text || "No tengo una respuesta ahora mismo." });
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) return json({ error: "rate_limited" }, 429);
      if (error instanceof Anthropic.AuthenticationError) return json({ error: "server key invalid" }, 500);
      if (error instanceof Anthropic.APIError) return json({ error: `api ${error.status}` }, 502);
      return json({ error: "network" }, 502);
    }
  },
};

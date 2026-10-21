const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CATEGORIAS_VALIDAS = [
  "Alimentación",
  "Transporte",
  "Salud",
  "Entretenimiento",
  "Educación",
  "Hogar",
  "Otros",
];

const URL_OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";
const MODELO_IA =
  process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct";
const TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS) || 30000;

class OpenRouterError extends Error {
  constructor(mensaje, opciones = {}) {
    super(mensaje);
    this.name = "OpenRouterError";
    this.codigo = opciones.codigo ?? "OPENROUTER_ERROR";
    this.status = opciones.status;
    this.statusText = opciones.statusText;
    this.body = opciones.body;
    this.esRateLimit = opciones.esRateLimit ?? false;
    this.esReintentable = opciones.esReintentable ?? false;
  }
}

const extraerMensajeError = (data, textoRespuesta) => {
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === "string") return data.error;
  if (data?.message) return data.message;
  return textoRespuesta?.slice(0, 500) || "Error desconocido de OpenRouter";
};

const extraerCodigoError = (data, status) => {
  return data?.error?.code ?? status ?? "OPENROUTER_ERROR";
};

const llamarIA = async (mensaje, modelo = MODELO_IA) => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error(
      "[OpenRouter] Falta la variable de entorno OPENROUTER_API_KEY.",
    );
    throw new OpenRouterError(
      "OPENROUTER_API_KEY no está configurada en el servidor.",
      {
        codigo: "CONFIGURACION",
        status: 401,
        esReintentable: false,
      },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(URL_OPENROUTER, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
        "X-Title":
          process.env.OPENROUTER_APP_TITLE || "Clasificador de Gastos IA",
      },
      body: JSON.stringify({
        model: modelo,
        messages: [{ role: "user", content: mensaje }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const esTimeout = err.name === "AbortError";
    console.error("[OpenRouter] Error de conexión:", {
      modelo,
      tipo: esTimeout ? "TIMEOUT" : "RED",
      mensaje: err.message,
      causa: err.cause,
    });
    throw new OpenRouterError(
      esTimeout
        ? `OpenRouter no respondió en ${TIMEOUT_MS} ms.`
        : `No se pudo conectar con OpenRouter: ${err.message}`,
      {
        codigo: esTimeout ? "TIMEOUT" : "ERROR_RED",
        esReintentable: true,
      },
    );
  } finally {
    clearTimeout(timeout);
  }

  const requestId = response.headers.get("x-request-id");
  const textoRespuesta = await response.text();
  let data = null;

  try {
    data = textoRespuesta ? JSON.parse(textoRespuesta) : null;
  } catch {
    // La respuesta no era JSON; se conserva el texto para el log.
  }

  if (!response.ok) {
    const motivo = extraerMensajeError(data, textoRespuesta);
    console.error("[OpenRouter] Error HTTP:", {
      status: response.status,
      statusText: response.statusText,
      modelo,
      requestId,
      respuesta: data ?? textoRespuesta,
    });
    throw new OpenRouterError(
      `OpenRouter respondió ${response.status} ${response.statusText}: ${motivo}`,
      {
        codigo: extraerCodigoError(data, response.status),
        status: response.status,
        statusText: response.statusText,
        body: data ?? textoRespuesta,
        esRateLimit: response.status === 429,
        esReintentable: response.status === 429 || response.status >= 500,
      },
    );
  }

  const contenido = data?.choices?.[0]?.message?.content;

  if (!data || data.error || typeof contenido !== "string" || !contenido.trim()) {
    const motivo = extraerMensajeError(data, textoRespuesta);
    const codigo = extraerCodigoError(data, response.status);
    const codigoNumerico = Number(codigo);
    const esRateLimit =
      codigoNumerico === 429 || /rate limit|too many requests/i.test(motivo);
    const esErrorProveedor =
      codigoNumerico >= 500 ||
      /provider returned error|provider error|overloaded/i.test(motivo);

    console.error("[OpenRouter] Respuesta inválida:", {
      status: response.status,
      statusText: response.statusText,
      modelo,
      requestId,
      respuesta: data ?? textoRespuesta,
    });

    throw new OpenRouterError(
      `OpenRouter no devolvió contenido: ${motivo}`,
      {
        codigo,
        status: response.status,
        statusText: response.statusText,
        body: data ?? textoRespuesta,
        esRateLimit,
        esReintentable: esRateLimit || esErrorProveedor,
      },
    );
  }

  return contenido.trim();
};

const esperaConJitter = (baseMs) => baseMs + Math.random() * 1000;

const normalizarTexto = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const ALIAS_CATEGORIAS = {
  alimentacion: "Alimentación",
  alimentos: "Alimentación",
  comida: "Alimentación",
  supermercado: "Alimentación",
  transporte: "Transporte",
  salud: "Salud",
  entretenimiento: "Entretenimiento",
  educacion: "Educación",
  hogar: "Hogar",
  otros: "Otros",
};

const normalizarCategoria = (categoria) => {
  const texto = normalizarTexto(categoria);

  const exacta = CATEGORIAS_VALIDAS.find(
    (valida) => normalizarTexto(valida) === texto,
  );
  if (exacta) return exacta;

  if (ALIAS_CATEGORIAS[texto]) return ALIAS_CATEGORIAS[texto];

  const parcial = CATEGORIAS_VALIDAS.find((valida) =>
    texto.includes(normalizarTexto(valida)),
  );
  return parcial || "Otros";
};

const PALABRAS_CLAVE = {
  fecha: ["fecha", "date", "dia", "periodo", "period"],
  descripcion: [
    "descripcion",
    "description",
    "detalle",
    "detail",
    "concepto",
    "glosa",
    "comercio",
    "establecimiento",
    "movimiento",
    "transaction",
  ],
  monto: [
    "monto",
    "amount",
    "valor",
    "value",
    "importe",
    "total",
    "cargo",
    "debito",
    "debit",
    "gasto",
  ],
};

const mapearColumnasLocal = (encabezados) => {
  const normalizados = encabezados.map(normalizarTexto);
  const usados = new Set();

  const buscar = (palabras) => {
    let indice = normalizados.findIndex(
      (columna, i) => !usados.has(i) && palabras.includes(columna),
    );

    if (indice === -1) {
      indice = normalizados.findIndex(
        (columna, i) =>
          !usados.has(i) &&
          palabras.some((palabra) => columna.includes(palabra)),
      );
    }

    if (indice !== -1) usados.add(indice);
    return indice;
  };

  const indiceFecha = buscar(PALABRAS_CLAVE.fecha);
  const indiceDescripcion = buscar(PALABRAS_CLAVE.descripcion);
  const indiceMonto = buscar(PALABRAS_CLAVE.monto);

  if (indiceFecha === -1 || indiceDescripcion === -1 || indiceMonto === -1) {
    return null;
  }

  return {
    fecha: encabezados[indiceFecha],
    descripcion: encabezados[indiceDescripcion],
    monto: encabezados[indiceMonto],
  };
};

const clasificarGasto = async (descripcion, intento = 1, maxIntentos = 2) => {
  try {
    const contenido = await llamarIA(
      `Clasifica este gasto en UNA sola categoría (responde solo la categoría, sin explicación):
Categorías posibles: ${CATEGORIAS_VALIDAS.join(", ")}
Gasto: "${descripcion}"`,
    );
    return normalizarCategoria(contenido);
  } catch (err) {
    if (err.esReintentable && intento < maxIntentos) {
      const espera = esperaConJitter(1000 * intento);
      console.warn(
        `[clasificarGasto] Reintentando "${descripcion}" en ${Math.round(espera)} ms...`,
      );
      await sleep(espera);
      return clasificarGasto(descripcion, intento + 1, maxIntentos);
    }

    console.error(
      `[clasificarGasto] No se pudo clasificar "${descripcion}":`,
      err,
    );
    throw err;
  }
};

const clasificarLote = async (descripciones, intento = 1) => {
  if (!Array.isArray(descripciones) || descripciones.length === 0) return [];

  const descripcionesSeguras = descripciones.map((desc) =>
    String(desc ?? "Sin descripción"),
  );

  const listaNumerada = descripcionesSeguras
    .map((desc, i) => `${i + 1}. "${desc}"`)
    .join("\n");
  const mensaje = `Clasifica cada uno de estos gastos en UNA sola categoría.
Categorías posibles: ${CATEGORIAS_VALIDAS.join(", ")}
Responde ÚNICAMENTE con un array JSON de strings, en el mismo orden. Ejemplo: ["Hogar", "Alimentación"]
Gastos:
${listaNumerada}`;

  try {
    const contenido = await llamarIA(mensaje);
    const limpio = contenido.replace(/```json|```/g, "").trim();

    let categorias;
    try {
      categorias = JSON.parse(limpio);
    } catch {
      throw new OpenRouterError(
        "La IA no devolvió un array JSON válido para el lote.",
        {
          codigo: "RESPUESTA_INVALIDA",
          body: contenido,
          esReintentable: false,
        },
      );
    }

    if (
      !Array.isArray(categorias) ||
      categorias.length !== descripcionesSeguras.length
    ) {
      throw new OpenRouterError(
        "Formato inválido o cantidad incorrecta de categorías.",
        {
          codigo: "RESPUESTA_INVALIDA",
          body: contenido,
          esReintentable: false,
        },
      );
    }

    return categorias.map(normalizarCategoria);
  } catch (err) {
    if (err.esReintentable && intento < 3) {
      const espera = esperaConJitter(1500 * intento);
      console.warn(
        `[clasificarLote] Reintentando lote en ${Math.round(espera)} ms...`,
      );
      await sleep(espera);
      return clasificarLote(descripcionesSeguras, intento + 1);
    }

    console.error("[clasificarLote] No se pudo clasificar el lote:", err);

    if (err.codigo === "RESPUESTA_INVALIDA") {
      const resultado = [];
      for (const desc of descripcionesSeguras) {
        try {
          resultado.push(await clasificarGasto(desc, 1, 1));
        } catch {
          resultado.push("Otros");
        }
      }
      return resultado;
    }

    console.warn(
      "[clasificarLote] OpenRouter no está disponible; se usará 'Otros' como respaldo para este lote.",
    );
    return descripcionesSeguras.map(() => "Otros");
  }
};

const mapearColumnas = async (encabezados, intento = 1, maxIntentos = 3) => {
  const lista = Array.isArray(encabezados)
    ? encabezados.filter((encabezado) => encabezado != null && encabezado !== "")
    : [];

  if (lista.length === 0) {
    return {
      error: "El CSV no tiene encabezados válidos.",
      codigo: "CSV_SIN_ENCABEZADOS",
    };
  }

  const mensaje = `Actúa como un analizador de datos financieros. 
Tengo un archivo CSV con estas columnas: ${lista.join(", ")}.
Identifica cuál corresponde a la fecha, cuál a la descripción y cuál al monto.

REGLA CRÍTICA: Si las columnas claramente NO corresponden a un estado de cuenta (por ejemplo: recursos humanos, empleados, inventario), responde ÚNICAMENTE con este JSON: 
{"error": "El archivo no parece ser un registro de gastos válido."}

Si es válido, responde ÚNICAMENTE con un JSON con esta estructura exacta usando los nombres originales:
{
  "fecha": "nombre_columna",
  "descripcion": "nombre_columna",
  "monto": "nombre_columna"
}`;

  try {
    const contenido = await llamarIA(mensaje);

    const jsonMatch = contenido.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new OpenRouterError("La IA no devolvió un JSON válido.", {
        codigo: "RESPUESTA_INVALIDA",
        body: contenido,
        esReintentable: false,
      });
    }

    let mapa;
    try {
      mapa = JSON.parse(jsonMatch[0]);
    } catch {
      throw new OpenRouterError("La IA devolvió un JSON mal formado.", {
        codigo: "RESPUESTA_INVALIDA",
        body: contenido,
        esReintentable: false,
      });
    }

    if (mapa.error) return mapa;

    if (!mapa.fecha || !mapa.descripcion || !mapa.monto) {
      throw new OpenRouterError(
        `Mapeo incompleto devuelto por la IA: ${JSON.stringify(mapa)}`,
        {
          codigo: "RESPUESTA_INVALIDA",
          body: mapa,
          esReintentable: false,
        },
      );
    }

    return mapa;
  } catch (err) {
    if (err.esReintentable && intento < maxIntentos) {
      const espera = esperaConJitter(1500 * intento);
      console.warn(
        `[mapearColumnas] Reintentando en ${Math.round(espera)} ms...`,
      );
      await sleep(espera);
      return mapearColumnas(lista, intento + 1, maxIntentos);
    }

    console.error("[mapearColumnas] OpenRouter falló:", err);

    const mapaLocal = mapearColumnasLocal(lista);
    if (mapaLocal) {
      console.warn(
        "[mapearColumnas] Usando mapeo local de respaldo:",
        mapaLocal,
      );
      return mapaLocal;
    }

    return {
      error:
        "No se pudieron identificar las columnas del CSV y el servicio de IA no está disponible. Revisa OPENROUTER_API_KEY, los créditos o el modelo configurado.",
      codigo: err.codigo || "IA_NO_DISPONIBLE",
    };
  }
};

module.exports = { clasificarGasto, clasificarLote, mapearColumnas };

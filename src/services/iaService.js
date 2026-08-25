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

const llamarIA = async (mensaje) => {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-super-120b-a12b:free",
        messages: [{ role: "user", content: mensaje }],
      }),
    },
  );

  const data = await response.json();

  if (!data.choices || !data.choices[0]) {
    const motivo = data?.error?.message || JSON.stringify(data);
    const error = new Error(motivo);
    error.esRateLimit = data?.error?.code === 429 || /rate limit/i.test(motivo);
    throw error;
  }

  return data.choices[0].message.content.trim();
};

const esperaConJitter = (baseMs) => baseMs + Math.random() * 1000;

const clasificarGasto = async (descripcion, intento = 1, maxIntentos = 2) => {
  try {
    const contenido = await llamarIA(
      `Clasifica este gasto en UNA sola categoría (responde solo la categoría, sin explicación):
Categorías posibles: ${CATEGORIAS_VALIDAS.join(", ")}
Gasto: "${descripcion}"`,
    );
    return contenido;
  } catch (err) {
    if (err.esRateLimit && intento < maxIntentos) {
      const espera = esperaConJitter(1000 * intento);
      console.warn(
        `Rate limit al clasificar "${descripcion}". Reintentando...`,
      );
      await sleep(espera);
      return clasificarGasto(descripcion, intento + 1, maxIntentos);
    }
    throw new Error(`La IA no devolvió clasificación. Motivo: ${err.message}`);
  }
};

const clasificarLote = async (descripciones, intento = 1) => {
  const listaNumerada = descripciones
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
    const categorias = JSON.parse(limpio);

    if (
      !Array.isArray(categorias) ||
      categorias.length !== descripciones.length
    ) {
      throw new Error(`Formato inválido o cantidad incorrecta.`);
    }
    return categorias;
  } catch (err) {
    if (err.esRateLimit && intento < 3) {
      const espera = esperaConJitter(1500 * intento);
      console.warn(`Rate limit al clasificar lote. Reintentando...`);
      await sleep(espera);
      return clasificarLote(descripciones, intento + 1);
    }
    const resultado = [];
    for (const desc of descripciones)
      resultado.push(await clasificarGasto(desc, 1, 1));
    return resultado;
  }
};

// NUEVA FUNCIÓN PARA MAPEO DINÁMICO
const mapearColumnas = async (encabezados, intento = 1, maxIntentos = 3) => {
  const mensaje = `Actúa como un analizador de datos financieros. 
Tengo un archivo CSV con estas columnas: ${encabezados.join(", ")}.
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

    // EXTRACCIÓN ROBUSTA: Ignora texto basura y busca solo el JSON
    const jsonMatch = contenido.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("La IA no devolvió un JSON válido.");
    }

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    if (err.esRateLimit && intento < maxIntentos) {
      const espera = esperaConJitter(1500 * intento);
      console.warn(`Rate limit mapeando columnas. Reintentando...`);
      await sleep(espera);
      return mapearColumnas(encabezados, intento + 1, maxIntentos);
    }
    throw new Error(`Error en IA: ${err.message}`);
  }
};

// EXPORTACIÓN ACTUALIZADA
module.exports = { clasificarGasto, clasificarLote, mapearColumnas };

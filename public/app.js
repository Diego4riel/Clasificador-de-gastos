const inputArchivo = document.getElementById("adjuntar");
const nombreArchivo = document.getElementById("nombre-archivo");
const tbody = document.getElementById("cuerpo-tabla");
const progressBar = document.getElementById("progress-bar");
const progressFill = document.getElementById("progress-fill");
const tagCount = document.getElementById("tag-count");
const statTotal = document.getElementById("stat-total");
const statMonto = document.getElementById("stat-monto");
const statCats = document.getElementById("stat-cats");
const btnBorrar = document.getElementById("btn-borrar");
const btnDescargar = document.getElementById("btn-descargar");

let gastosActuales = [];

const catClass = (cat) => {
  const map = {
    alimentación: "cat-alimentacion",
    alimentos: "cat-alimentacion",
    transporte: "cat-transporte",
    salud: "cat-salud",
    entretenimiento: "cat-entretenimiento",
    educación: "cat-educacion",
    hogar: "cat-hogar",
    otros: "cat-otros",
  };
  return map[(cat || "").toLowerCase()] || "cat-otros";
};

const actualizarStats = (gastos) => {
  const total = gastos.length;
  const monto = gastos.reduce((sum, g) => sum + g.monto, 0);
  const cats = new Set(gastos.map((g) => g.categoria)).size;

  statTotal.textContent = total;
  statMonto.textContent = "$" + monto.toLocaleString("es-CL");
  statCats.textContent = cats;
  tagCount.textContent = total + " registros";
};

const cargarGastos = async () => {
  const res = await fetch("/api/gastos");
  const gastos = await res.json();
  gastosActuales = gastos;
  btnDescargar.disabled = gastos.length === 0;

  tbody.innerHTML = "";

  if (!gastos.length) {
    tbody.innerHTML =
      '<tr class="empty-row"><td colspan="4">Sube un CSV para ver tus gastos</td></tr>';
    actualizarStats(gastos);
    return;
  }

  gastos.forEach((g, i) => {
    const tr = document.createElement("tr");
    tr.style.animationDelay = `${i * 40}ms`;
    tr.innerHTML = `
      <td>${g.fecha}</td>
      <td>${g.descripcion}</td>
      <td class="monto-cell">$${g.monto.toLocaleString("es-CL")}</td>
      <td><span class="cat-badge ${catClass(g.categoria)}">${g.categoria}</span></td>
    `;
    tbody.appendChild(tr);
  });

  actualizarStats(gastos);
};

// Necesitamos referenciar el label y el texto para cambiar su estado visual
const uploadLabel = document.getElementById("upload-label");
const uploadText = document.getElementById("upload-text");

inputArchivo.addEventListener("change", async () => {
  const archivo = inputArchivo.files[0];
  if (!archivo) return;

  // 1. Iniciar Estado de Carga (Loading State)
  nombreArchivo.textContent = `Analizando estructura del archivo...`;
  nombreArchivo.style.color = "var(--text-muted)";

  // Deshabilitar input y cambiar estilos del botón
  inputArchivo.disabled = true;
  uploadLabel.style.pointerEvents = "none";
  uploadLabel.style.opacity = "0.5";
  uploadText.textContent = "CLASIFICANDO CON IA...";

  progressBar.classList.add("active");
  progressFill.style.width = "40%"; // Avance inicial

  const formData = new FormData();
  formData.append("archivo", archivo);

  try {
    const res = await fetch("/api/gastos/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    progressFill.style.width = "100%"; // Completar barra

    // 2. Manejo de Errores (Feedback de Archivo Inválido)
    if (!res.ok) {
      // La IA determinó que no es un registro de gastos
      nombreArchivo.textContent = `❌ Error: ${data.error || "Archivo inválido."}`;
      nombreArchivo.style.color = "#ff6464"; // Usando el rojo de tu paleta cat-salud
      return;
    }

    // 3. Éxito
    setTimeout(() => {
      progressBar.classList.remove("active");
      progressFill.style.width = "0%";
    }, 800);

    nombreArchivo.textContent = `✓ ${data.total} gastos procesados — ${data.errores} errores`;
    nombreArchivo.style.color = "var(--accent)"; // Usando tu verde neón

    cargarGastos();
  } catch (error) {
    console.error("Error en la subida:", error);
    nombreArchivo.textContent = "❌ Ocurrió un problema de conexión.";
    nombreArchivo.style.color = "#ff6464";
  } finally {
    // 4. Restaurar estado (independiente de si hubo éxito o error)
    inputArchivo.disabled = false;
    uploadLabel.style.pointerEvents = "auto";
    uploadLabel.style.opacity = "1";
    uploadText.textContent = "Seleccionar archivo CSV";
    inputArchivo.value = ""; // Limpiar el input para permitir subir el mismo archivo de nuevo
  }
});

btnBorrar.addEventListener("click", async () => {
  const confirmado = confirm(
    "¿Borrar todo el historial de gastos? Esta acción no se puede deshacer.",
  );
  if (!confirmado) return;

  btnBorrar.disabled = true;
  btnBorrar.textContent = "Borrando...";

  try {
    const res = await fetch("/api/gastos", { method: "DELETE" });
    if (!res.ok) throw new Error("No se pudo borrar el historial");
    await cargarGastos();
  } catch (err) {
    alert(err.message);
  } finally {
    btnBorrar.disabled = false;
    btnBorrar.textContent = "🗑 Borrar historial";
  }
});

// Envuelve un valor en comillas dobles si contiene coma, comillas o salto de línea
const escaparCSV = (valor) => {
  const texto = String(valor ?? "");
  if (/[",\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
};

const descargarCSV = () => {
  const encabezado = ["fecha", "descripcion", "monto", "categoria"];
  const filas = gastosActuales.map((g) => [
    g.fecha,
    g.descripcion,
    g.monto,
    g.categoria,
  ]);

  const contenido = [encabezado, ...filas]
    .map((fila) => fila.map(escaparCSV).join(","))
    .join("\n");

  // BOM al inicio para que Excel reconozca tildes/ñ correctamente
  const blob = new Blob(["\uFEFF" + contenido], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement("a");
  enlace.href = url;
  const fechaHoy = new Date().toISOString().slice(0, 10);
  enlace.download = `gastos-clasificados-${fechaHoy}.csv`;
  enlace.click();

  URL.revokeObjectURL(url);
};

btnDescargar.addEventListener("click", descargarCSV);

cargarGastos();

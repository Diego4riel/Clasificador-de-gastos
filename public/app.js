const inputArchivo = document.getElementById("adjuntar");
const uploadZone = document.getElementById("upload-zone");
const uploadLabel = document.getElementById("upload-label");
const uploadText = document.getElementById("upload-text");
const nombreArchivo = document.getElementById("nombre-archivo");
const fileState = document.getElementById("file-state");
const progressBar = document.getElementById("progress-bar");
const progressFill = document.getElementById("progress-fill");
const tbody = document.getElementById("cuerpo-tabla");
const tabla = document.getElementById("tabla-gastos");
const tablaEstado = document.getElementById("tabla-estado");
const tableCard = document.getElementById("table-card");
const tagCount = document.getElementById("tag-count");
const historySub = document.getElementById("history-sub");
const statTotal = document.getElementById("stat-total");
const statMonto = document.getElementById("stat-monto");
const statCats = document.getElementById("stat-cats");
const btnBorrar = document.getElementById("btn-borrar");
const btnDescargar = document.getElementById("btn-descargar");
const buscarInput = document.getElementById("buscar");
const limpiarBusqueda = document.getElementById("limpiar-busqueda");
const filtroBtn = document.getElementById("filtro-btn");
const filtroLabel = document.getElementById("filtro-label");
const filtroMenu = document.getElementById("filtro-menu");
const themeToggle = document.getElementById("theme-toggle");
const modal = document.getElementById("confirm-dialog");
const modalDesc = document.getElementById("confirm-desc");
const cancelarBorrar = document.getElementById("cancelar-borrar");
const confirmarBorrar = document.getElementById("confirmar-borrar");
const toastRegion = document.getElementById("toast-region");

const SESSION_KEY = "clasificador-gastos-session";
const THEME_KEY = "cg-theme";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_FILE_SIZE = 4 * 1024 * 1024;

const crearSessionId = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const obtenerSessionId = () => {
  const guardado = localStorage.getItem(SESSION_KEY);
  if (guardado && UUID_RE.test(guardado)) return guardado;

  const id = crearSessionId();
  localStorage.setItem(SESSION_KEY, id);
  return id;
};

const sessionId = obtenerSessionId();

const apiFetch = (url, opciones = {}) =>
  fetch(url, {
    ...opciones,
    headers: {
      ...(opciones.headers || {}),
      "x-session-id": sessionId,
    },
  });

const normalizar = (valor) =>
  String(valor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const capitalizar = (valor) => {
  const texto = String(valor ?? "").trim();
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "Otros";
};

const catClass = (cat) => {
  const map = {
    alimentación: "cat-alimentacion",
    alimentacion: "cat-alimentacion",
    alimentos: "cat-alimentacion",
    transporte: "cat-transporte",
    salud: "cat-salud",
    entretenimiento: "cat-entretenimiento",
    educación: "cat-educacion",
    educacion: "cat-educacion",
    hogar: "cat-hogar",
    otros: "cat-otros",
  };
  return map[normalizar(cat)] || "cat-otros";
};

const formatearMonto = (monto) => {
  const numero = Number(monto) || 0;
  const signo = numero < 0 ? "-" : "";
  return `${signo}$${Math.abs(numero).toLocaleString("es-CL", {
    maximumFractionDigits: 0,
  })}`;
};

const formateadorFecha = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const formatearFecha = (valor) => {
  const texto = String(valor ?? "").trim();
  const coincidencia = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);

  if (!coincidencia) return texto || "Sin fecha";

  const fecha = new Date(
    Number(coincidencia[1]),
    Number(coincidencia[2]) - 1,
    Number(coincidencia[3]),
  );

  if (Number.isNaN(fecha.getTime())) return texto;

  return formateadorFecha.format(fecha).replace(/\./g, "");
};

const normalizarGasto = (gasto = {}) => ({
  fecha: gasto.fecha ?? "Sin fecha",
  descripcion:
    String(gasto.descripcion ?? "").trim() || "Sin descripción",
  monto: Number(gasto.monto) || 0,
  categoria: capitalizar(gasto.categoria ?? "Otros"),
});

let gastosActuales = [];
let gastosFiltrados = [];
let filtroCategoria = "all";
let busqueda = "";
let archivoEnProceso = false;
let borrando = false;
let menuAbierto = false;
let menuCierreTimer = null;
let modalCierreTimer = null;
let progresoTimer = null;
let progresoOcultarTimer = null;

const ESTADO_BOTONES = () => {
  const hayGastos = gastosActuales.length > 0;
  btnDescargar.disabled = !hayGastos;
  btnBorrar.disabled = !hayGastos;
  filtroBtn.disabled = !hayGastos;
};

const actualizarStats = () => {
  const total = gastosActuales.length;
  const monto = gastosActuales.reduce((suma, gasto) => suma + gasto.monto, 0);
  const categorias = new Set(
    gastosActuales.map((gasto) => gasto.categoria),
  ).size;

  statTotal.textContent = total ? total.toLocaleString("es-CL") : "—";
  statMonto.textContent = total ? formatearMonto(monto) : "—";
  statCats.textContent = total ? categorias.toLocaleString("es-CL") : "—";
};

const actualizarContadores = () => {
  tagCount.textContent = gastosActuales.length.toLocaleString("es-CL");

  const filtrando = filtroCategoria !== "all" || Boolean(busqueda);

  if (!gastosActuales.length) {
    historySub.textContent = "Aún no hay movimientos";
  } else if (!gastosFiltrados.length) {
    historySub.textContent = "Sin resultados para tu búsqueda";
  } else if (filtrando) {
    historySub.textContent = `Mostrando ${gastosFiltrados.length} de ${gastosActuales.length} movimientos`;
  } else {
    historySub.textContent =
      gastosActuales.length === 1
        ? "1 movimiento clasificado"
        : `${gastosActuales.length} movimientos clasificados`;
  }
};

const ICONO_VACIO = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8v-17Z" />
    <path d="M9 8h6M9 12h4" />
  </svg>`;

const ICONO_BUSQUEDA = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>`;

const ICONO_ERROR = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 8.5v4.5" />
    <circle cx="12" cy="16.4" r=".7" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="8.5" />
  </svg>`;

const ICONO_CHECK = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>`;

const ICONO_ALERTA = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 8v5" />
    <circle cx="12" cy="16.2" r=".8" fill="currentColor" stroke="none" />
    <path d="M10.3 4.4 2.8 17.2A1.9 1.9 0 0 0 4.5 20h15a1.9 1.9 0 0 0 1.7-2.8L13.7 4.4a1.9 1.9 0 0 0-3.4 0Z" />
  </svg>`;

const ICONO_CERRAR = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
    <path d="m7 7 10 10M17 7 7 17" />
  </svg>`;

const mostrarToast = ({
  title,
  description = "",
  variant = "success",
  duration = 4600,
}) => {
  while (toastRegion.children.length >= 3) {
    toastRegion.firstElementChild?.remove();
  }

  const toast = document.createElement("div");
  toast.className = `toast toast--${variant}`;

  const icono = document.createElement("div");
  icono.className = "toast-icon";
  icono.setAttribute("aria-hidden", "true");
  icono.innerHTML = variant === "error" ? ICONO_ALERTA : ICONO_CHECK;

  const contenido = document.createElement("div");
  contenido.className = "toast-content";

  const titulo = document.createElement("p");
  titulo.className = "toast-title";
  titulo.textContent = title;
  contenido.appendChild(titulo);

  if (description) {
    const texto = document.createElement("p");
    texto.className = "toast-desc";
    texto.textContent = description;
    contenido.appendChild(texto);
  }

  const cerrarBoton = document.createElement("button");
  cerrarBoton.type = "button";
  cerrarBoton.className = "toast-close";
  cerrarBoton.setAttribute("aria-label", "Cerrar notificación");
  cerrarBoton.innerHTML = ICONO_CERRAR;

  toast.append(icono, contenido, cerrarBoton);
  toastRegion.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("is-visible"));

  let temporizador;
  let saliendo = false;

  const cerrar = () => {
    if (saliendo) return;
    saliendo = true;
    clearTimeout(temporizador);
    toast.classList.remove("is-visible");
    toast.classList.add("is-leaving");
    setTimeout(() => toast.remove(), 180);
  };

  const programar = (ms) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(cerrar, ms);
  };

  cerrarBoton.addEventListener("click", cerrar);

  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    toast.addEventListener("pointerenter", () => clearTimeout(temporizador));
    toast.addEventListener("pointerleave", () => programar(2000));
  }

  programar(duration);
};

const renderEstado = ({
  icono = ICONO_VACIO,
  titulo,
  texto,
  accionTexto,
  accion,
}) => {
  tabla.hidden = true;
  tablaEstado.hidden = false;
  tableCard.setAttribute("aria-busy", "false");
  tablaEstado.replaceChildren();

  const iconWrap = document.createElement("div");
  iconWrap.className = "state-icon";
  iconWrap.setAttribute("aria-hidden", "true");
  iconWrap.innerHTML = icono;

  const title = document.createElement("h3");
  title.className = "state-title";
  title.textContent = titulo;

  const text = document.createElement("p");
  text.className = "state-text";
  text.textContent = texto;

  tablaEstado.append(iconWrap, title, text);

  if (accionTexto && typeof accion === "function") {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn btn-secondary state-action";
    boton.textContent = accionTexto;
    boton.addEventListener("click", accion);
    tablaEstado.appendChild(boton);
  }
};

const crearFila = (gasto, indice, animar) => {
  const tr = document.createElement("tr");

  if (animar) {
    tr.classList.add("row-enter");
    tr.style.setProperty("--row-delay", `${Math.min(indice * 32, 288)}ms`);
  }

  const tdFecha = document.createElement("td");
  tdFecha.className = "cell-fecha";
  const time = document.createElement("time");
  const fechaTexto = formatearFecha(gasto.fecha);
  const iso = String(gasto.fecha ?? "").match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/,
  );
  if (iso) {
    time.dateTime = `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  time.textContent = fechaTexto;
  tdFecha.appendChild(time);

  const tdDescripcion = document.createElement("td");
  tdDescripcion.className = "cell-descripcion";
  tdDescripcion.textContent = gasto.descripcion;
  tdDescripcion.title = gasto.descripcion;

  const tdMonto = document.createElement("td");
  tdMonto.className = "cell-monto num";
  tdMonto.textContent = formatearMonto(gasto.monto);

  const tdCategoria = document.createElement("td");
  tdCategoria.className = "cell-categoria";
  const badge = document.createElement("span");
  badge.className = `cat-badge ${catClass(gasto.categoria)}`;
  const dot = document.createElement("span");
  dot.className = "badge-dot";
  dot.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.className = "badge-label";
  label.textContent = gasto.categoria;
  badge.append(dot, label);
  tdCategoria.appendChild(badge);

  tr.append(tdFecha, tdDescripcion, tdMonto, tdCategoria);
  return tr;
};

const renderFilas = (lista, { animar = false } = {}) => {
  tbody.replaceChildren();

  if (!lista.length) {
    const filtrando = filtroCategoria !== "all" || Boolean(busqueda);

    if (!gastosActuales.length) {
      renderEstado({
        icono: ICONO_VACIO,
        titulo: "Aún no hay movimientos",
        texto:
          "Sube tu primera cartola en CSV. La IA se encargará de clasificar cada gasto por ti.",
        accionTexto: "Importar un CSV",
        accion: abrirImportador,
      });
    } else if (filtrando) {
      renderEstado({
        icono: ICONO_BUSQUEDA,
        titulo: "Sin coincidencias",
        texto:
          "Prueba con otra palabra o quita el filtro de categoría para ver todos tus movimientos.",
        accionTexto: "Limpiar filtros",
        accion: () => limpiarFiltros({ enfocarBuscador: true }),
      });
    } else {
      renderEstado({
        icono: ICONO_VACIO,
        titulo: "Aún no hay movimientos",
        texto:
          "Sube tu primera cartola en CSV. La IA se encargará de clasificar cada gasto por ti.",
        accionTexto: "Importar un CSV",
        accion: abrirImportador,
      });
    }

    actualizarContadores();
    return;
  }

  tablaEstado.hidden = true;
  tabla.hidden = false;
  tableCard.setAttribute("aria-busy", "false");

  const fragmento = document.createDocumentFragment();
  lista.forEach((gasto, indice) => {
    fragmento.appendChild(crearFila(gasto, indice, animar));
  });
  tbody.appendChild(fragmento);
  actualizarContadores();
};

const renderSkeleton = () => {
  const fragmento = document.createDocumentFragment();

  for (let i = 0; i < 4; i += 1) {
    const fila = document.createElement("tr");
    fila.className = "skeleton-row";
    fila.setAttribute("aria-hidden", "true");

    const celdas = [
      { clase: "cell-fecha", linea: "skeleton-line--date" },
      { clase: "cell-descripcion", linea: "skeleton-line--desc" },
      { clase: "cell-monto num", linea: "skeleton-line--amount" },
      { clase: "cell-categoria", linea: "skeleton-line--badge" },
    ];

    celdas.forEach(({ clase, linea }) => {
      const td = document.createElement("td");
      td.className = clase;
      const span = document.createElement("span");
      span.className = `skeleton-line ${linea}`;
      td.appendChild(span);
      fila.appendChild(td);
    });

    fragmento.appendChild(fila);
  }

  tbody.replaceChildren(fragmento);
  tabla.hidden = false;
  tablaEstado.hidden = true;
  tableCard.setAttribute("aria-busy", "true");
  historySub.textContent = "Cargando movimientos…";
  tagCount.textContent = "—";
};

const aplicarFiltros = ({ animar = false } = {}) => {
  const consulta = normalizar(busqueda);

  gastosFiltrados = gastosActuales.filter((gasto) => {
    const coincideCategoria =
      filtroCategoria === "all" || gasto.categoria === filtroCategoria;
    const coincideBusqueda =
      !consulta ||
      normalizar(gasto.descripcion).includes(consulta) ||
      normalizar(gasto.categoria).includes(consulta);

    return coincideCategoria && coincideBusqueda;
  });

  renderFilas(gastosFiltrados, { animar });
};

const limpiarFiltros = ({ enfocarBuscador = false } = {}) => {
  busqueda = "";
  buscarInput.value = "";
  limpiarBusqueda.hidden = true;
  filtroCategoria = "all";
  actualizarSeleccionFiltro();
  aplicarFiltros();

  if (enfocarBuscador) {
    buscarInput.focus({ preventScroll: true });
  }
};

const construirFiltro = () => {
  if (menuAbierto) cerrarMenu();

  const conteos = new Map();
  gastosActuales.forEach((gasto) => {
    conteos.set(gasto.categoria, (conteos.get(gasto.categoria) || 0) + 1);
  });

  const categorias = [...conteos.keys()].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  const opciones = [
    {
      valor: "all",
      etiqueta: "Todas las categorías",
      total: gastosActuales.length,
      clase: "filter-dot--all",
    },
    ...categorias.map((categoria) => ({
      valor: categoria,
      etiqueta: categoria,
      total: conteos.get(categoria),
      clase: catClass(categoria),
    })),
  ];

  const fragmento = document.createDocumentFragment();

  opciones.forEach(({ valor, etiqueta, total, clase }) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "filter-option";
    boton.setAttribute("role", "option");
    boton.setAttribute("aria-selected", "false");
    boton.tabIndex = -1;
    boton.dataset.value = valor;

    const dot = document.createElement("span");
    dot.className = `filter-dot ${clase}`;
    dot.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "filter-option-label";
    label.textContent = etiqueta;

    const count = document.createElement("span");
    count.className = "filter-option-count";
    count.textContent = total.toLocaleString("es-CL");

    const check = document.createElement("span");
    check.innerHTML = ICONO_CHECK;

    boton.append(dot, label, count);
    const checkSvg = check.firstElementChild;
    if (checkSvg) {
      checkSvg.classList.add("filter-check");
      boton.appendChild(checkSvg);
    }

    boton.addEventListener("click", () => seleccionarFiltro(valor));
    fragmento.appendChild(boton);
  });

  filtroMenu.replaceChildren(fragmento);
  actualizarSeleccionFiltro();
  ESTADO_BOTONES();
};

const actualizarSeleccionFiltro = () => {
  filtroMenu.querySelectorAll(".filter-option").forEach((boton) => {
    boton.setAttribute(
      "aria-selected",
      String(boton.dataset.value === filtroCategoria),
    );
  });

  filtroLabel.textContent = filtroCategoria === "all" ? "Todas" : filtroCategoria;
  filtroBtn.classList.toggle("is-filtered", filtroCategoria !== "all");
};

const seleccionarFiltro = (valor) => {
  filtroCategoria = valor;
  actualizarSeleccionFiltro();
  aplicarFiltros();
  cerrarMenu({ restaurarFoco: true });
};

const opcionesFiltro = () => [
  ...filtroMenu.querySelectorAll(".filter-option"),
];

const abrirMenu = () => {
  if (menuAbierto || !opcionesFiltro().length) return;

  clearTimeout(menuCierreTimer);
  filtroMenu.hidden = false;
  filtroMenu.classList.remove("opens-up");

  const botonRect = filtroBtn.getBoundingClientRect();
  const alturaMenu = filtroMenu.offsetHeight;
  const espacioAbajo = window.innerHeight - botonRect.bottom - 12;
  const espacioArriba = botonRect.top - 12;

  filtroMenu.classList.toggle(
    "opens-up",
    espacioAbajo < alturaMenu && espacioArriba > espacioAbajo,
  );

  void filtroMenu.offsetWidth;
  filtroMenu.classList.add("is-open");
  menuAbierto = true;
  filtroBtn.setAttribute("aria-expanded", "true");

  const seleccionada =
    filtroMenu.querySelector('[aria-selected="true"]') || opcionesFiltro()[0];

  requestAnimationFrame(() => {
    if (menuAbierto) seleccionada?.focus({ preventScroll: true });
  });
};

const cerrarMenu = ({ restaurarFoco = false } = {}) => {
  if (!menuAbierto) return;

  menuAbierto = false;
  filtroBtn.setAttribute("aria-expanded", "false");
  filtroMenu.classList.remove("is-open");

  clearTimeout(menuCierreTimer);
  menuCierreTimer = setTimeout(() => {
    filtroMenu.hidden = true;
  }, 170);

  if (restaurarFoco) {
    filtroBtn.focus({ preventScroll: true });
  }
};

const cargarGastos = async ({ animar = false } = {}) => {
  try {
    const res = await apiFetch("/api/gastos");

    if (!res.ok) {
      throw new Error("No pudimos cargar tu historial.");
    }

    const datos = await res.json();

    if (!Array.isArray(datos)) {
      throw new Error("El servidor devolvió una respuesta inesperada.");
    }

    gastosActuales = datos.map(normalizarGasto);

    if (
      filtroCategoria !== "all" &&
      !gastosActuales.some((gasto) => gasto.categoria === filtroCategoria)
    ) {
      filtroCategoria = "all";
    }

    actualizarStats();
    construirFiltro();
    aplicarFiltros({ animar });
  } catch (error) {
    gastosActuales = [];
    gastosFiltrados = [];
    actualizarStats();
    construirFiltro();
    ESTADO_BOTONES();

    renderEstado({
      icono: ICONO_ERROR,
      titulo: "No pudimos cargar tu historial",
      texto: "Revisa tu conexión e inténtalo de nuevo en unos segundos.",
      accionTexto: "Reintentar",
      accion: () => {
        renderSkeleton();
        cargarGastos({ animar: true });
      },
    });

    historySub.textContent = "Error de conexión";

    mostrarToast({
      variant: "error",
      title: "No pudimos cargar el historial",
      description: error.message,
    });
  }
};

const abrirImportador = () => {
  if (archivoEnProceso) return;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  document.querySelector(".upload-card")?.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "center",
  });
  inputArchivo.click();
};

const setFileState = (estado, texto) => {
  fileState.dataset.state = estado;
  nombreArchivo.textContent = texto;
};

const setProgreso = (valor, { error = false } = {}) => {
  const porcentaje = Math.min(100, Math.max(0, valor));
  progressFill.style.transform = `scaleX(${porcentaje / 100})`;
  progressBar.setAttribute("aria-valuenow", String(Math.round(porcentaje)));
  progressBar.classList.toggle("is-error", error);
};

const iniciarProgreso = () => {
  clearInterval(progresoTimer);
  clearTimeout(progresoOcultarTimer);

  progressBar.classList.remove("is-error");
  progressBar.classList.add("is-active");
  progressBar.setAttribute("aria-hidden", "false");

  let valor = 8;
  setProgreso(valor);

  progresoTimer = setInterval(() => {
    valor = Math.min(valor + 7 + Math.random() * 9, 92);
    setProgreso(valor);
  }, 380);
};

const ocultarProgreso = () => {
  progressBar.classList.remove("is-active", "is-error");
  progressBar.setAttribute("aria-hidden", "true");
  setProgreso(0);
};

const completarProgreso = ({ error = false } = {}) => {
  clearInterval(progresoTimer);
  progresoTimer = null;
  setProgreso(100, { error });

  clearTimeout(progresoOcultarTimer);
  progresoOcultarTimer = setTimeout(ocultarProgreso, error ? 1100 : 650);
};

const subirArchivo = async (archivo) => {
  if (!archivo || archivoEnProceso) return;

  if (!/\.csv$/i.test(archivo.name)) {
    setFileState("error", "Solo puedes subir archivos con formato CSV.");
    mostrarToast({
      variant: "error",
      title: "Formato no compatible",
      description: "Selecciona un archivo .csv para poder clasificarlo.",
    });
    inputArchivo.value = "";
    return;
  }

  if (archivo.size > MAX_FILE_SIZE) {
    setFileState("error", "El archivo supera el límite de 4 MB.");
    mostrarToast({
      variant: "error",
      title: "El archivo es demasiado grande",
      description: "El tamaño máximo permitido es de 4 MB.",
    });
    inputArchivo.value = "";
    return;
  }

  archivoEnProceso = true;
  inputArchivo.disabled = true;
  uploadLabel.setAttribute("aria-disabled", "true");
  uploadLabel.tabIndex = -1;
  uploadZone.classList.add("is-uploading");
  uploadZone.classList.remove("is-dragover");
  uploadText.textContent = "Clasificando movimientos…";
  setFileState("loading", `Procesando ${archivo.name}…`);
  iniciarProgreso();

  const formData = new FormData();
  formData.append("archivo", archivo);

  try {
    const res = await apiFetch("/api/gastos/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "No pudimos procesar el archivo.");
    }

    completarProgreso();

    const total = Number(data.total) || 0;
    const errores = Number(data.errores) || 0;
    const detalle =
      total === 1 ? "1 movimiento clasificado" : `${total} movimientos clasificados`;

    setFileState(
      "success",
      errores
        ? `${detalle} · ${errores} con errores`
        : detalle,
    );

    mostrarToast({
      title: "Importación completa",
      description: errores
        ? `${detalle}. ${errores} filas necesitan revisión.`
        : `${detalle}. Revisa el historial actualizado.`,
    });

    await cargarGastos({ animar: true });
  } catch (error) {
    completarProgreso({ error: true });
    setFileState("error", error.message);
    mostrarToast({
      variant: "error",
      title: "No pudimos importar el archivo",
      description: error.message,
    });
  } finally {
    archivoEnProceso = false;
    inputArchivo.disabled = false;
    uploadLabel.removeAttribute("aria-disabled");
    uploadLabel.tabIndex = 0;
    uploadZone.classList.remove("is-uploading");
    uploadText.textContent = "Arrastra tu CSV aquí";
    inputArchivo.value = "";
  }
};

const escaparCSV = (valor) => {
  const texto = String(valor ?? "");
  if (/[",\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
};

const descargarCSV = () => {
  if (!gastosActuales.length) return;

  const encabezado = ["fecha", "descripcion", "monto", "categoria"];
  const filas = gastosActuales.map((gasto) => [
    gasto.fecha,
    gasto.descripcion,
    gasto.monto,
    gasto.categoria,
  ]);

  const contenido = [encabezado, ...filas]
    .map((fila) => fila.map(escaparCSV).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + contenido], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement("a");
  enlace.href = url;
  const fechaHoy = new Date().toISOString().slice(0, 10);
  enlace.download = `gastos-clasificados-${fechaHoy}.csv`;
  enlace.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);

  mostrarToast({
    title: "Exportación lista",
    description:
      gastosActuales.length === 1
        ? "Se descargó tu movimiento clasificado."
        : `Se descargaron ${gastosActuales.length} movimientos clasificados.`,
  });
};

const aplicarTema = (tema) => {
  document.documentElement.dataset.theme = tema;
  themeToggle.setAttribute(
    "aria-label",
    tema === "dark" ? "Activar tema claro" : "Activar tema oscuro",
  );

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", tema === "dark" ? "#121310" : "#f7f5f1");
};

const abrirModal = () => {
  if (!gastosActuales.length) return;

  clearTimeout(modalCierreTimer);
  modal.classList.remove("is-closing", "is-open");
  modal.removeAttribute("aria-busy");
  borrando = false;
  confirmarBorrar.disabled = false;
  cancelarBorrar.disabled = false;
  confirmarBorrar.textContent = "Sí, borrar todo";

  const total = gastosActuales.length;
  const strong = document.createElement("strong");
  strong.textContent = `${total} ${
    total === 1 ? "movimiento" : "movimientos"
  }`;

  modalDesc.replaceChildren(
    document.createTextNode(
      total === 1 ? "Se eliminará " : "Se eliminarán ",
    ),
    strong,
    document.createTextNode(
      " del historial de este dispositivo. Esta acción no se puede deshacer.",
    ),
  );

  if (!modal.open) {
    modal.showModal();
    requestAnimationFrame(() => modal.classList.add("is-open"));
  } else {
    modal.classList.add("is-open");
  }

  cancelarBorrar.focus({ preventScroll: true });
};

const cerrarModal = () => {
  if (!modal.open) return;

  modal.classList.remove("is-open");
  modal.classList.add("is-closing");

  clearTimeout(modalCierreTimer);
  modalCierreTimer = setTimeout(() => {
    modal.classList.remove("is-closing");
    if (modal.open) modal.close();
  }, 160);
};

const eliminarHistorial = async () => {
  if (borrando || !gastosActuales.length) return;

  const total = gastosActuales.length;
  borrando = true;
  confirmarBorrar.disabled = true;
  cancelarBorrar.disabled = true;
  confirmarBorrar.textContent = "Borrando…";
  modal.setAttribute("aria-busy", "true");

  try {
    const res = await apiFetch("/api/gastos", { method: "DELETE" });

    if (!res.ok) {
      throw new Error("No se pudo borrar el historial.");
    }

    filtroCategoria = "all";
    busqueda = "";
    buscarInput.value = "";
    limpiarBusqueda.hidden = true;
    actualizarSeleccionFiltro();
    setFileState("idle", "Aún no has subido ningún archivo");
    cerrarModal();

    mostrarToast({
      title: "Historial eliminado",
      description:
        total === 1
          ? "Se eliminó el único movimiento de tu historial."
          : `Se eliminaron ${total} movimientos de tu historial.`,
    });

    await cargarGastos({ animar: true });
  } catch (error) {
    mostrarToast({
      variant: "error",
      title: "No pudimos borrar el historial",
      description: error.message,
    });
    cerrarModal();
  } finally {
    borrando = false;
    confirmarBorrar.disabled = false;
    cancelarBorrar.disabled = false;
    confirmarBorrar.textContent = "Sí, borrar todo";
    modal.removeAttribute("aria-busy");
  }
};

themeToggle.addEventListener("click", () => {
  const nuevoTema =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  aplicarTema(nuevoTema);

  try {
    localStorage.setItem(THEME_KEY, nuevoTema);
  } catch {
    
  }
});

const mediaOscuro = window.matchMedia("(prefers-color-scheme: dark)");
mediaOscuro.addEventListener?.("change", (event) => {
  let guardado = null;
  try {
    guardado = localStorage.getItem(THEME_KEY);
  } catch {
    
  }
  if (!guardado) aplicarTema(event.matches ? "dark" : "light");
});

inputArchivo.addEventListener("change", () => {
  const archivo = inputArchivo.files?.[0];
  if (archivo) subirArchivo(archivo);
});

uploadLabel.addEventListener("keydown", (event) => {
  if (archivoEnProceso) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    inputArchivo.click();
  }
});

let dragProfundidad = 0;

const arrastreConArchivos = (event) =>
  Array.from(event.dataTransfer?.types || []).includes("Files");

uploadZone.addEventListener("dragenter", (event) => {
  if (!arrastreConArchivos(event) || archivoEnProceso) return;
  event.preventDefault();
  dragProfundidad += 1;
  uploadZone.classList.add("is-dragover");
});

uploadZone.addEventListener("dragover", (event) => {
  if (!arrastreConArchivos(event) || archivoEnProceso) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});

uploadZone.addEventListener("dragleave", () => {
  dragProfundidad = Math.max(0, dragProfundidad - 1);
  if (dragProfundidad === 0) {
    uploadZone.classList.remove("is-dragover");
  }
});

uploadZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dragProfundidad = 0;
  uploadZone.classList.remove("is-dragover");

  if (archivoEnProceso) return;

  const archivo = event.dataTransfer?.files?.[0];
  if (archivo) subirArchivo(archivo);
});

window.addEventListener("dragover", (event) => {
  if (arrastreConArchivos(event)) event.preventDefault();
});

window.addEventListener("drop", (event) => {
  if (arrastreConArchivos(event) && !uploadZone.contains(event.target)) {
    event.preventDefault();
  }
});

buscarInput.addEventListener("input", () => {
  busqueda = buscarInput.value.trim();
  limpiarBusqueda.hidden = busqueda.length === 0;
  aplicarFiltros();
});

limpiarBusqueda.addEventListener("click", () => {
  buscarInput.value = "";
  busqueda = "";
  limpiarBusqueda.hidden = true;
  aplicarFiltros();
  buscarInput.focus({ preventScroll: true });
});

filtroBtn.addEventListener("click", () => {
  if (filtroBtn.disabled) return;
  if (menuAbierto) {
    cerrarMenu({ restaurarFoco: true });
  } else {
    abrirMenu();
  }
});

filtroBtn.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" && !menuAbierto) {
    event.preventDefault();
    abrirMenu();
  }
});

filtroMenu.addEventListener("keydown", (event) => {
  const items = opcionesFiltro();
  const indice = items.indexOf(document.activeElement);

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direccion = event.key === "ArrowDown" ? 1 : -1;
    const siguiente = (indice + direccion + items.length) % items.length;
    items[siguiente]?.focus();
    return;
  }

  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    const destino = event.key === "Home" ? 0 : items.length - 1;
    items[destino]?.focus();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    cerrarMenu({ restaurarFoco: true });
    return;
  }

  if (event.key === "Tab") {
    cerrarMenu();
  }
});

document.addEventListener("pointerdown", (event) => {
  if (!menuAbierto) return;
  if (
    filtroMenu.contains(event.target) ||
    filtroBtn.contains(event.target)
  ) {
    return;
  }
  cerrarMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuAbierto) {
    cerrarMenu({ restaurarFoco: true });
  }
});

btnDescargar.addEventListener("click", descargarCSV);

btnBorrar.addEventListener("click", abrirModal);

cancelarBorrar.addEventListener("click", () => {
  if (!borrando) cerrarModal();
});

confirmarBorrar.addEventListener("click", eliminarHistorial);

modal.addEventListener("cancel", (event) => {
  event.preventDefault();
  if (!borrando) cerrarModal();
});

modal.addEventListener("click", (event) => {
  if (borrando || event.target !== modal) return;

  const rect = modal.getBoundingClientRect();
  const fuera =
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom;

  if (fuera) cerrarModal();
});

modal.addEventListener("close", () => {
  modal.classList.remove("is-open", "is-closing");
  modal.removeAttribute("aria-busy");
  borrando = false;
  confirmarBorrar.disabled = false;
  cancelarBorrar.disabled = false;
  confirmarBorrar.textContent = "Sí, borrar todo";
});

aplicarTema(
  document.documentElement.dataset.theme === "dark" ? "dark" : "light",
);

renderSkeleton();
ESTADO_BOTONES();
cargarGastos({ animar: true });

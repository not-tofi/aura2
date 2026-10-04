const DB_NOMBRE = "turnosDB";
const DB_VERSION = 1;
const HORARIOS_INICIO = 7;
const HORARIOS_FIN = 19;
const DURACION_TURNO_HORAS = 2;
const MAX_TURNOS_POR_DIA = 10;
let calendarioMesActual = new Date();

let db = null;
const $ = (id) => document.getElementById(id);

const ESTRUCTURA_RESPALDO = {
  version: 1,
  tipo: "turnos-nails",
  provider: "google-drive",
  headers: ["Fecha", "Hora", "Nombre", "Teléfono", "Tipo", "Precio", "Estado", "Notas"],
  drive: {
    fileId: null,
    url: "",
    compartido: false,
    ultimaSincronizacion: null
  }
};

const NOMBRE_ESTADO = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  realizado: "Realizado",
  cancelado: "Cancelado"
};

function toast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("visible");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("visible"), 2200);
}

function abrirDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NOMBRE, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains("tipos")) {
        const tipos = database.createObjectStore("tipos", { keyPath: "id", autoIncrement: true });
        tipos.createIndex("nombre", "nombre", { unique: true });
      }

      if (!database.objectStoreNames.contains("turnos")) {
        const turnos = database.createObjectStore("turnos", { keyPath: "id", autoIncrement: true });
        turnos.createIndex("fecha", "fecha", { unique: false });
      }
    };

    req.onsuccess = (event) => {
      db = event.target.result;
      res(db);
    };

    req.onerror = (event) => {
      rej(event.target.error || new Error("No se pudo abrir la base de datos"));
    };
  });
}

function guardar(store, dato) {
  if (!db) return Promise.reject(new Error("La base de datos no está abierta"));

  return new Promise((res, rej) => {
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).put(dato);
    req.onsuccess = () => res(req.result);
    req.onerror = (event) => rej(event.target.error || new Error(`Error guardando en ${store}`));
  });
}

function listar(store) {
  if (!db) return Promise.resolve([]);

  return new Promise((res, rej) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = (event) => rej(event.target.error || new Error(`Error listando ${store}`));
  });
}

function borrar(store, id) {
  if (!db) return Promise.reject(new Error("La base de datos no está abierta"));

  return new Promise((res, rej) => {
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => res(true);
    req.onerror = (event) => rej(event.target.error || new Error(`Error borrando de ${store}`));
  });
}

function hoyISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function formatearFecha(iso) {
  if (!iso || !iso.includes("-")) return "--";
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

async function cargarSelectTipos() {
  const sel = $("tipo");
  if (!sel) return;

  const tipos = await listar("tipos");
  sel.innerHTML = '<option value="">— Elegí un tipo —</option>';

  for (const tipo of tipos) {
    const option = document.createElement("option");
    option.value = String(tipo.id);
    option.textContent = `${tipo.nombre} — $${Number(tipo.precio).toFixed(2)}`;
    option.dataset.precio = String(Number(tipo.precio) || 0);
    option.dataset.nombre = tipo.nombre || "";
    sel.appendChild(option);
  }
}

async function renderTipos() {
  const cont = $("listaTipos");
  if (!cont) return;

  const tipos = await listar("tipos");

  if (tipos.length === 0) {
    cont.innerHTML = '<p class="vacio">Todavía no cargaste ningún tipo de uña.</p>';
    cont.className = "";
    return;
  }

  cont.innerHTML = "";
  cont.className = "tipo-lista";

  for (const tipo of tipos) {
    const item = document.createElement("div");
    item.className = "tipo-item";

    const nombre = document.createElement("strong");
    nombre.textContent = tipo.nombre;

    const precio = document.createElement("span");
    precio.textContent = `$${Number(tipo.precio).toFixed(2)}`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Borrar";
    btn.className = "secundario";
    btn.onclick = async () => {
      try {
        await borrar("tipos", tipo.id);
        toast("Tipo eliminado");
        await renderTipos();
        await cargarSelectTipos();
      } catch (error) {
        console.error(error);
        toast("No se pudo eliminar el tipo");
      }
    };

    item.append(nombre, precio, btn);
    cont.appendChild(item);
  }
}

async function agregarTipo() {
  const nombreInput = $("nuevoTipoNombre");
  const precioInput = $("nuevoTipoPrecio");

  if (!nombreInput || !precioInput) return;

  const nombre = nombreInput.value.trim();
  const precio = Number(precioInput.value);

  if (!nombre || Number.isNaN(precio) || precio <= 0) {
    toast("Ingresá un nombre y precio válido");
    return;
  }

  try {
    await guardar("tipos", { nombre, precio });
    nombreInput.value = "";
    precioInput.value = "";
    toast("Tipo agregado");
    await renderTipos();
    await cargarSelectTipos();
  } catch (error) {
    console.error(error);
    toast("Ese tipo ya existe o hubo un error");
  }
}

async function renderTurnos() {
  const cont = $("listaTurnos");
  if (!cont) return;

  const turnos = await listar("turnos");

  if (turnos.length === 0) {
    cont.innerHTML = '<p class="vacio">Todavía no tenés turnos agendados.</p>';
    return;
  }

  turnos.sort((a, b) => `${a.fecha || ""}T${a.hora || "00:00"}`.localeCompare(`${b.fecha || ""}T${b.hora || "00:00"}`));
  cont.innerHTML = "";

  for (const turno of turnos) {
    const card = document.createElement("div");
    card.className = "turno";

    const estado = document.createElement("div");
    estado.className = `estado ${turno.estado || "pendiente"}`;
    estado.textContent = NOMBRE_ESTADO[turno.estado || "pendiente"] || "Pendiente";

    const nombre = document.createElement("div");
    nombre.className = "nombre";
    nombre.textContent = turno.nombre || "Sin nombre";

    const detalle = document.createElement("div");
    detalle.className = "detalle";
    detalle.innerHTML = `
      <span><strong>Tipo:</strong> ${turno.tipoNombre || "Sin tipo"}</span>
      <span><strong>Fecha:</strong> ${formatearFecha(turno.fecha)}</span>
      <span><strong>Horario:</strong> ${turno.hora || "--:--"}</span>
      <span><strong>Teléfono:</strong> ${turno.telefono || "Sin teléfono"}</span>
      ${turno.notas ? `<span><strong>Notas:</strong> ${turno.notas}</span>` : ""}
    `;

    const precio = document.createElement("div");
    precio.className = "precio";
    precio.textContent = `$${Number(turno.precio || 0).toFixed(2)}`;

    const acciones = document.createElement("div");
    acciones.className = "acciones";

    const pasos = [
      ["Pendiente", "pendiente"],
      ["Confirmado", "confirmado"],
      ["Realizado", "realizado"],
      ["Cancelado", "cancelado"]
    ];

    for (const [label, estadoKey] of pasos) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.onclick = async () => {
        try {
          turno.estado = estadoKey;
          await guardar("turnos", turno);
          await renderTurnos();
        } catch (error) {
          console.error(error);
          toast("No se pudo actualizar el turno");
        }
      };
      acciones.appendChild(btn);
    }

    const borrarBtn = document.createElement("button");
    borrarBtn.type = "button";
    borrarBtn.textContent = "Borrar";
    borrarBtn.className = "borrar";
    borrarBtn.onclick = async () => {
      try {
        await borrar("turnos", turno.id);
        toast("Turno eliminado");
        await renderTurnos();
      } catch (error) {
        console.error(error);
        toast("No se pudo eliminar el turno");
      }
    };
    acciones.appendChild(borrarBtn);

    card.append(estado, nombre, detalle, precio, acciones);
    cont.appendChild(card);
  }
}

function generarSlotsHorarios() {
  const slots = [];

  for (let hora = HORARIOS_INICIO; hora <= HORARIOS_FIN; hora += DURACION_TURNO_HORAS) {
    const hh = String(hora).padStart(2, "0");
    slots.push(`${hh}:00`);
  }

  return slots;
}

function isoDesdeFecha(date) {
  const anio = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function formatFechaBoton(fechaISO) {
  if (!fechaISO) return "Elegí una fecha";
  const fecha = new Date(`${fechaISO}T12:00:00`);
  return fecha.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });
}

async function obtenerTurnosPorFecha() {
  const turnos = await listar("turnos");
  const mapa = {};

  for (const turno of turnos) {
    if (!turno.fecha) continue;
    mapa[turno.fecha] = (mapa[turno.fecha] || 0) + 1;
  }

  return mapa;
}

async function renderCalendar() {
  const popover = $("calendarPopover");
  const mesActual = $("mesActual");
  const calendarDays = $("calendarDays");
  const fechaInput = $("fecha");
  const fechaTrigger = $("fechaTrigger");

  if (!popover || !mesActual || !calendarDays || !fechaInput || !fechaTrigger) return;

  const mesReferencia = new Date(calendarioMesActual.getFullYear(), calendarioMesActual.getMonth(), 1);
  const primerDia = new Date(mesReferencia.getFullYear(), mesReferencia.getMonth(), 1);
  const ultimoDia = new Date(mesReferencia.getFullYear(), mesReferencia.getMonth() + 1, 0);
  const diasMes = ultimoDia.getDate();
  const inicioSemana = (primerDia.getDay() + 6) % 7;
  const turnosPorFecha = await obtenerTurnosPorFecha();

  mesActual.textContent = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric"
  }).format(mesReferencia);

  calendarDays.innerHTML = "";

  for (let i = 0; i < inicioSemana; i++) {
    const vacio = document.createElement("div");
    vacio.className = "calendar-cell empty";
    calendarDays.appendChild(vacio);
  }

  for (let dia = 1; dia <= diasMes; dia++) {
    const fecha = new Date(mesReferencia.getFullYear(), mesReferencia.getMonth(), dia);
    const iso = isoDesdeFecha(fecha);
    const turnosDia = turnosPorFecha[iso] || 0;
    const lleno = turnosDia >= MAX_TURNOS_POR_DIA;
    const esHoy = iso === hoyISO();
    const esSeleccionado = iso === fechaInput.value;

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "calendar-day";
    if (lleno) boton.classList.add("full");
    if (esHoy) boton.classList.add("today");
    if (esSeleccionado) boton.classList.add("selected");
    if (lleno) boton.disabled = true;
    boton.textContent = String(dia);
    boton.title = lleno ? "Día completo" : `Disponibles: ${MAX_TURNOS_POR_DIA - turnosDia}`;

    boton.addEventListener("click", async () => {
      const seleccion = iso;
      calendarioMesActual = new Date(`${seleccion}T12:00:00`);
      fechaInput.value = seleccion;
      fechaTrigger.textContent = formatFechaBoton(seleccion);
      fechaTrigger.setAttribute("aria-expanded", "false");
      popover.setAttribute("hidden", "hidden");
      await actualizarHorariosDisponibles();
      await renderCalendar();
    });

    calendarDays.appendChild(boton);
  }

  if (fechaInput.value) {
    fechaTrigger.textContent = formatFechaBoton(fechaInput.value);
  }
}

async function poblarFechasDisponibles() {
  const fechaInput = $("fecha");
  if (!fechaInput) return;

  const fechaInicial = hoyISO();
  fechaInput.value = fechaInicial;
  calendarioMesActual = new Date(`${fechaInicial}T12:00:00`);

  const fechaTrigger = $("fechaTrigger");
  if (fechaTrigger) {
    fechaTrigger.textContent = formatFechaBoton(fechaInicial);
  }

  const popover = $("calendarPopover");
  if (popover) {
    popover.setAttribute("hidden", "hidden");
  }

  renderCalendar();
}

async function obtenerHorariosOcupados(fecha) {
  if (!fecha) return new Set();

  const turnos = await listar("turnos");
  return new Set(
    turnos
      .filter((turno) => turno.fecha === fecha && turno.hora)
      .map((turno) => turno.hora)
  );
}

async function actualizarHorariosDisponibles() {
  const fechaInput = $("fecha");
  const horaInput = $("hora");

  if (!fechaInput || !horaInput) return;

  const fecha = fechaInput.value;
  const horariosDisponibles = generarSlotsHorarios();

  if (!fecha) {
    horaInput.disabled = true;
    horaInput.innerHTML = '<option value="">Elegí una fecha</option>';
    return;
  }

  const turnosPorFecha = await obtenerTurnosPorFecha();
  const ocupados = await obtenerHorariosOcupados(fecha);
  const horariosLibres = horariosDisponibles.filter((slot) => !ocupados.has(slot));

  horaInput.innerHTML = '<option value="">Elegí un horario</option>';

  const diaLleno = (turnosPorFecha[fecha] || 0) >= MAX_TURNOS_POR_DIA;

  if (diaLleno || horariosLibres.length === 0) {
    horaInput.disabled = true;
    const sinHorario = document.createElement("option");
    sinHorario.value = "";
    sinHorario.textContent = diaLleno ? "Día completo" : "Sin disponibilidad";
    horaInput.appendChild(sinHorario);
    return;
  }

  for (const horario of horariosLibres) {
    const option = document.createElement("option");
    option.value = horario;
    option.textContent = `${horario} hs`;
    horaInput.appendChild(option);
  }

  horaInput.disabled = false;
}

async function guardarTurno() {
  const nombreInput = $("nombre");
  const telefonoInput = $("telefono");
  const tipoSelect = $("tipo");
  const fechaInput = $("fecha");
  const horaInput = $("hora");
  const notasInput = $("notas");

  if (!nombreInput || !telefonoInput || !tipoSelect || !fechaInput || !horaInput || !notasInput) return;

  const nombre = nombreInput.value.trim();
  const telefono = telefonoInput.value.trim();
  const tipoId = tipoSelect.value;
  const fecha = fechaInput.value;
  const hora = horaInput.value;
  const notas = notasInput.value.trim();
  const tipoSel = tipoSelect.selectedOptions[0];

  if (!nombre || !telefono || !tipoId || !fecha || !hora) {
    toast("Completá nombre, teléfono, tipo, fecha y horario");
    return;
  }

  const turnos = await listar("turnos");
  const horarioDuplicado = turnos.some((turno) => turno.fecha === fecha && turno.hora === hora);

  if (horarioDuplicado) {
    toast("Ese horario ya está ocupado para esa fecha");
    return;
  }

  const turno = {
    nombre,
    telefono,
    tipoId: Number(tipoId),
    tipoNombre: tipoSel?.dataset?.nombre || "",
    precio: Number(tipoSel?.dataset?.precio || 0),
    fecha,
    hora,
    notas,
    estado: "pendiente"
  };

  try {
    await guardar("turnos", turno);
    toast("Turno guardado");

    nombreInput.value = "";
    telefonoInput.value = "";
    tipoSelect.value = "";
    fechaInput.value = hoyISO();
    horaInput.value = "";
    notasInput.value = "";

    await actualizarHorariosDisponibles();
    await renderTurnos();
  } catch (error) {
    console.error(error);
    toast("No se pudo guardar el turno");
  }
}

function mostrarAviso(texto) {
  const aviso = $("avisoRespaldo");
  const avisoTexto = $("avisoTexto");
  if (!aviso || !avisoTexto) return;
  avisoTexto.textContent = texto;
  aviso.classList.add("visible");
}

function cerrarAviso() {
  const aviso = $("avisoRespaldo");
  if (aviso) aviso.classList.remove("visible");
}

function aCSV(filas) {
  return filas
    .map((fila) => fila.map((valor) => `"${String(valor ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
}

const NOMBRE_CARPETA_HISTORIAL = "Historial de Aura";

function descargarCSV(nombreArchivo, contenido) {
  const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function guardarCSVEnArchivos(nombreArchivo, contenido) {
  const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8;" });
  const file = new File([blob], nombreArchivo, { type: "text/csv" });

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: NOMBRE_CARPETA_HISTORIAL,
        text: "CSV de turnos",
        files: [file]
      });
      return true;
    } catch (error) {
      console.error(error);
    }
  }

  descargarCSV(nombreArchivo, contenido);
  return false;
}

async function exportarCSVConDestino(nombreArchivo, contenido, textoAviso) {
  const guardado = await guardarCSVEnArchivos(nombreArchivo, contenido);

  if (guardado) {
    mostrarAviso(`${textoAviso} Elegí guardar en Archivos.`);
    return;
  }

  mostrarAviso(textoAviso);
}

function crearMetaDrive(nombreArchivo, total, fecha = hoyISO()) {
  return {
    ...ESTRUCTURA_RESPALDO,
    nombreArchivo,
    fecha,
    total,
    drive: {
      ...ESTRUCTURA_RESPALDO.drive,
      ultimaSincronizacion: new Date().toISOString()
    }
  };
}

function parsearCSVLinea(linea, separador) {
  const campos = [];
  let valorActual = "";
  let enComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];

    if (ch === '"') {
      if (enComillas && linea[i + 1] === '"') {
        valorActual += '"';
        i++;
      } else {
        enComillas = !enComillas;
      }
    } else if (ch === separador && !enComillas) {
      campos.push(valorActual);
      valorActual = "";
    } else {
      valorActual += ch;
    }
  }

  campos.push(valorActual);
  return campos.map((valor) => valor.replace(/\r$/, "").trim());
}

function normalizarFecha(valor) {
  const text = String(valor || "").trim();
  if (!text) return hoyISO();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const conBarra = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (conBarra) {
    const [, dia, mes, anio] = conBarra;
    const anioCompleto = anio.length === 2 ? `20${anio}` : anio;
    return `${anioCompleto}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }

  return hoyISO();
}

function normalizarEstado(valor) {
  const estado = String(valor || "").trim().toLowerCase();
  const mapa = {
    pendiente: "pendiente",
    pending: "pendiente",
    "sin confirmar": "pendiente",
    confirmado: "confirmado",
    confirmed: "confirmado",
    realizado: "realizado",
    done: "realizado",
    asistio: "realizado",
    cancelado: "cancelado",
    cancelled: "cancelado",
    noasistio: "cancelado"
  };

  return mapa[estado] || "pendiente";
}

async function exportarDia() {
  const fecha = $("fecha")?.value || hoyISO();
  const turnos = await listar("turnos");
  const delDia = turnos.filter((turno) => turno.fecha === fecha);

  if (delDia.length === 0) {
    toast("No hay turnos para esa fecha");
    return;
  }

  const filas = [
    ["Fecha", "Hora", "Nombre", "Teléfono", "Tipo", "Precio", "Estado", "Notas"],
    ...delDia.map((turno) => [
      formatearFecha(turno.fecha),
      turno.hora || "",
      turno.nombre || "",
      turno.telefono || "",
      turno.tipoNombre || "",
      Number(turno.precio || 0).toFixed(2),
      NOMBRE_ESTADO[turno.estado || "pendiente"] || "Pendiente",
      turno.notas || ""
    ])
  ];

  const nombreArchivo = `turnos_${fecha}.csv`;
  const meta = crearMetaDrive(nombreArchivo, delDia.length, fecha);
  const contenido = aCSV(filas);

  await exportarCSVConDestino(nombreArchivo, contenido, `Respaldo del ${formatearFecha(fecha)} descargado (${delDia.length} turnos).`);
  console.log("Meta CSV para Drive:", meta);
}

async function exportarTodo() {
  const turnos = await listar("turnos");

  if (turnos.length === 0) {
    toast("No hay turnos para exportar");
    return;
  }

  turnos.sort((a, b) => `${a.fecha || ""}T${a.hora || "00:00"}`.localeCompare(`${b.fecha || ""}T${b.hora || "00:00"}`));

  const filas = [
    ["Fecha", "Hora", "Nombre", "Teléfono", "Tipo", "Precio", "Estado", "Notas"],
    ...turnos.map((turno) => [
      formatearFecha(turno.fecha),
      turno.hora || "",
      turno.nombre || "",
      turno.telefono || "",
      turno.tipoNombre || "",
      Number(turno.precio || 0).toFixed(2),
      NOMBRE_ESTADO[turno.estado || "pendiente"] || "Pendiente",
      turno.notas || ""
    ])
  ];

  const nombreArchivo = `turnos_todos_${hoyISO()}.csv`;
  const meta = crearMetaDrive(nombreArchivo, turnos.length, hoyISO());
  const contenido = aCSV(filas);

  await exportarCSVConDestino(nombreArchivo, contenido, `Se exportaron todos los turnos (${turnos.length}).`);
  console.log("Meta CSV para Drive:", meta);
}

async function importarCSV(archivo) {
  const texto = await archivo.text();
  const lineas = texto.split(/\r?\n/).filter((linea) => linea.trim() !== "");

  if (lineas.length < 2) {
    toast("El archivo está vacío o no tiene turnos");
    return;
  }

  const separador = lineas[0].includes(";") ? ";" : ",";
  const tipos = await listar("tipos");
  const tiposMap = new Map((tipos || []).map((tipo) => [(tipo.nombre || "").toLowerCase(), tipo]));

  let importados = 0;

  for (let i = 1; i < lineas.length; i++) {
    const fila = parsearCSVLinea(lineas[i], separador);
    if (fila.length < 8) continue;

    const [fechaStr, hora, nombre, telefono, tipoNombre, precioStr, estadoStr, notas] = fila;

    const fecha = normalizarFecha(fechaStr);
    const tipoNombreLimpio = (tipoNombre || "").trim();
    const precio = Number(String(precioStr || "0").replace(",", ".").replace(/[^0-9.-]/g, "")) || 0;
    const estado = normalizarEstado(estadoStr);

    let tipo = tiposMap.get(tipoNombreLimpio.toLowerCase());

    if (!tipo && tipoNombreLimpio) {
      tipo = { nombre: tipoNombreLimpio, precio };
      const creado = await guardar("tipos", tipo);
      tipo.id = creado;
      tiposMap.set(tipoNombreLimpio.toLowerCase(), tipo);
    }

    const turno = {
      nombre: (nombre || "").trim(),
      telefono: (telefono || "").trim(),
      tipoId: tipo?.id ?? null,
      tipoNombre: tipo?.nombre || tipoNombreLimpio,
      precio: tipo?.precio ?? precio,
      fecha,
      hora: (hora || "").trim(),
      notas: (notas || "").trim(),
      estado
    };

    await guardar("turnos", turno);
    importados++;
  }

  if (importados === 0) {
    toast("No se pudieron importar turnos desde el CSV");
    return;
  }

  toast(`${importados} turno${importados === 1 ? "" : "s"} importado${importados === 1 ? "" : "s"} correctamente.`);
  mostrarAviso(`Se importaron ${importados} turno${importados === 1 ? "" : "s"} desde el archivo CSV.`);
  await renderTurnos();
  await renderTipos();
  await cargarSelectTipos();
}

async function abrirEnDrive() {
  const turnos = await listar("turnos");

  if (turnos.length === 0) {
    toast("No hay turnos para exportar a Drive");
    return;
  }

  const nombreArchivo = `turnos_drive_${hoyISO()}.csv`;
  const filas = [
    ["Fecha", "Hora", "Nombre", "Teléfono", "Tipo", "Precio", "Estado", "Notas"],
    ...turnos.map((turno) => [
      formatearFecha(turno.fecha),
      turno.hora || "",
      turno.nombre || "",
      turno.telefono || "",
      turno.tipoNombre || "",
      Number(turno.precio || 0).toFixed(2),
      NOMBRE_ESTADO[turno.estado || "pendiente"] || "Pendiente",
      turno.notas || ""
    ])
  ];

  const blob = new Blob(["\uFEFF" + aCSV(filas)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  setTimeout(() => {
    const driveWindow = window.open("https://drive.google.com/", "_blank", "noopener,noreferrer");
    if (!driveWindow) {
      toast("Se descargó el CSV. Permití los pop-ups para abrir Drive.");
      return;
    }
    mostrarAviso(`Se descargó ${nombreArchivo} y se abrió Drive.`);
  }, 250);
}

async function compartirRespaldo() {
  const turnos = await listar("turnos");
  const nombreArchivo = `turnos_${hoyISO()}.csv`;
  const filas = [
    ["Fecha", "Hora", "Nombre", "Teléfono", "Tipo", "Precio", "Estado", "Notas"],
    ...turnos.map((turno) => [
      formatearFecha(turno.fecha),
      turno.hora || "",
      turno.nombre || "",
      turno.telefono || "",
      turno.tipoNombre || "",
      Number(turno.precio || 0).toFixed(2),
      NOMBRE_ESTADO[turno.estado || "pendiente"] || "Pendiente",
      turno.notas || ""
    ])
  ];

  const blob = new Blob(["\uFEFF" + aCSV(filas)], { type: "text/csv;charset=utf-8;" });
  const file = new File([blob], nombreArchivo, { type: "text/csv" });

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: "Respaldo de turnos",
        text: "Archivo CSV con los turnos",
        files: [file]
      });
      toast("Respaldo compartido");
      return;
    } catch (error) {
      console.error(error);
    }
  }

  toast("Tu navegador no soporta compartir archivos");
}

function bindTurnosPage() {
  const fechaInput = $("fecha");
  if (fechaInput) fechaInput.value = hoyISO();

  const btnExportarDia = $("btnExportarDia");
  const btnExportarTodo = $("btnExportarTodo");
  const btnAbrirSheets = $("btnAbrirSheets");
  const btnCompartir = $("btnCompartir");
  const btnCerrarAviso = $("btnCerrarAviso");
  const btnGuardarEnArchivos = $("btnGuardarEnArchivos");

  if (btnExportarDia) btnExportarDia.addEventListener("click", exportarDia);
  if (btnExportarTodo) btnExportarTodo.addEventListener("click", exportarTodo);
  if (btnAbrirSheets) btnAbrirSheets.addEventListener("click", abrirEnDrive);
  if (btnCompartir) btnCompartir.addEventListener("click", compartirRespaldo);
  if (btnCerrarAviso) btnCerrarAviso.addEventListener("click", cerrarAviso);
  if (btnGuardarEnArchivos) btnGuardarEnArchivos.addEventListener("click", () => exportarTodo());

  window.guardarTurno = guardarTurno;
  window.agregarTipo = agregarTipo;
  window.exportarDia = exportarDia;
  window.exportarTodo = exportarTodo;
  window.abrirEnDrive = abrirEnDrive;
  window.compartirRespaldo = compartirRespaldo;
  window.cerrarAviso = cerrarAviso;
}

async function renderCuenta() {
  const cont = $("listaCuenta");
  const totalEl = $("totalCuenta");
  if (!cont || !totalEl) return;

  const turnos = await listar("turnos");
  const total = turnos.reduce((sum, turno) => sum + Number(turno.precio || 0), 0);

  totalEl.textContent = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS"
  }).format(total);

  if (turnos.length === 0) {
    cont.innerHTML = '<p class="vacio">Todavía no hay cobros registrados.</p>';
    return;
  }

  const ordenados = [...turnos].sort((a, b) => `${a.fecha || ""}T${a.hora || "00:00"}`.localeCompare(`${b.fecha || ""}T${b.hora || "00:00"}`));

  cont.innerHTML = ordenados.map((turno) => `
    <div class="turno">
      <div class="nombre">${turno.nombre || "Sin nombre"}</div>
      <div class="detalle">
        <span><strong>Tipo:</strong> ${turno.tipoNombre || "Sin tipo"}</span>
        <span><strong>Fecha:</strong> ${formatearFecha(turno.fecha)}</span>
        <span><strong>Horario:</strong> ${turno.hora || "--:--"}</span>
      </div>
      <div class="precio">$${Number(turno.precio || 0).toFixed(2)}</div>
    </div>
  `).join("");
}

async function renderHome() {
  const resumen = $("homeResumen");
  if (!resumen) return;

  const turnos = await listar("turnos");
  const tipos = await listar("tipos");
  const hoy = hoyISO();
  const turnosHoy = turnos.filter((turno) => turno.fecha === hoy).length;
  const pendientes = turnos.filter((turno) => (turno.estado || "pendiente") === "pendiente").length;

  resumen.innerHTML = `
    <div class="summary-grid">
      <div class="summary-card">
        <strong>Servicios</strong>
        <span>${tipos.length}</span>
      </div>
      <div class="summary-card">
        <strong>Turnos hoy</strong>
        <span>${turnosHoy}</span>
      </div>
      <div class="summary-card">
        <strong>Pendientes</strong>
        <span>${pendientes}</span>
      </div>
    </div>
  `;

  const lista = $("listaTiposHome");
  if (!lista) return;

  if (tipos.length === 0) {
    lista.innerHTML = '<p class="vacio">Todavía no agregaste tipos de uña.</p>';
    return;
  }

  lista.innerHTML = "";
  lista.className = "tipo-lista";

  for (const tipo of tipos) {
    const item = document.createElement("div");
    item.className = "tipo-item";

    const nombre = document.createElement("strong");
    nombre.textContent = tipo.nombre;

    const precio = document.createElement("span");
    precio.textContent = `$${Number(tipo.precio).toFixed(2)}`;

    item.append(nombre, precio);
    lista.appendChild(item);
  }
}

async function renderClientes() {
  const cont = $("listaClientes");
  if (!cont) return;

  const turnos = await listar("turnos");

  if (turnos.length === 0) {
    cont.innerHTML = '<p class="vacio">Todavía no hay clientes cargados.</p>';
    return;
  }

  const clientesMap = new Map();

  for (const turno of turnos) {
    const nombre = (turno.nombre || "Sin nombre").trim();
    if (!nombre) continue;

    if (!clientesMap.has(nombre)) {
      clientesMap.set(nombre, {
        nombre,
        telefono: turno.telefono || "Sin teléfono",
        tipo: turno.tipoNombre || "Sin tipo",
        fecha: turno.fecha || "",
        hora: turno.hora || "",
        estado: turno.estado || "pendiente",
        notas: turno.notas || ""
      });
    }
  }

  const clientes = [...clientesMap.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  cont.innerHTML = "";

  for (const cliente of clientes) {
    const card = document.createElement("div");
    card.className = "turno";

    const estado = document.createElement("div");
    estado.className = `estado ${cliente.estado}`;
    estado.textContent = NOMBRE_ESTADO[cliente.estado] || "Pendiente";

    const nombre = document.createElement("div");
    nombre.className = "nombre";
    nombre.textContent = cliente.nombre;

    const detalle = document.createElement("div");
    detalle.className = "detalle";
    detalle.innerHTML = `
      <span><strong>Teléfono:</strong> ${cliente.telefono}</span>
      <span><strong>Tipo:</strong> ${cliente.tipo}</span>
      <span><strong>Próximo turno:</strong> ${cliente.fecha ? formatearFecha(cliente.fecha) : "Sin fecha"} ${cliente.hora ? `- ${cliente.hora}` : ""}</span>
      ${cliente.notas ? `<span><strong>Notas:</strong> ${cliente.notas}</span>` : ""}
    `;

    card.append(estado, nombre, detalle);
    cont.appendChild(card);
  }
}

function initMenuLateral() {
  const abrirMenu = document.getElementById("abrir-menu");
  const menuLateral = document.getElementById("menu-lateral");
  const overlay = document.getElementById("menu-overlay");

  if (!abrirMenu || !menuLateral) return;

  const toggleMenu = (isOpen) => {
    menuLateral.classList.toggle("open", isOpen);
    if (overlay) {
      overlay.classList.remove("visible");
      overlay.style.display = "none";
      overlay.style.opacity = "0";
      overlay.style.visibility = "hidden";
      overlay.style.pointerEvents = "none";
    }
    abrirMenu.setAttribute("aria-expanded", String(isOpen));
    menuLateral.setAttribute("aria-hidden", String(!isOpen));
    document.body.classList.toggle("menu-open", isOpen);
  };

  abrirMenu.addEventListener("click", () => {
    const isOpen = menuLateral.classList.contains("open");
    toggleMenu(!isOpen);
  });

  overlay?.addEventListener("click", () => toggleMenu(false));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") toggleMenu(false);
  });
}

async function iniciarApp() {
  initMenuLateral();
  await abrirDB();

  if (document.body.dataset.page === "home") {
    await renderHome();
    return;
  }

  if (document.body.dataset.page === "cuenta") {
    await renderCuenta();
    return;
  }

  if (document.body.dataset.page === "turnos") {
    await renderTurnos();
    bindTurnosPage();
    return;
  }

  if (document.body.dataset.page === "clientes") {
    await renderClientes();
    return;
  }

  if (document.body.dataset.page === "generarturno") {
    poblarFechasDisponibles();
    await renderTipos();
    await cargarSelectTipos();

    const fechaInput = $("fecha");
    const horaInput = $("hora");

    if (fechaInput) {
      fechaInput.addEventListener("change", actualizarHorariosDisponibles);
      fechaInput.value = hoyISO();
    }

    if (horaInput) {
      horaInput.addEventListener("change", () => {
        if (!horaInput.value) {
          toast("Elegí un horario disponible");
        }
      });
    }

    await actualizarHorariosDisponibles();
    bindTurnosPage();
    return;
  }

  if (document.body.dataset.page === "tipos") {
    await renderTipos();
    await cargarSelectTipos();
    return;
  }

  if (document.body.dataset.page === "historial") {
    await renderTurnos();
    bindTurnosPage();
  }
}

document.addEventListener("DOMContentLoaded", iniciarApp);

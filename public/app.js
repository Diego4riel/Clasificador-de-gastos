const inputArchivo = document.getElementById('adjuntar');
const nombreArchivo = document.getElementById('nombre-archivo');
const tbody = document.getElementById('cuerpo-tabla');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');
const tagCount = document.getElementById('tag-count');
const statTotal = document.getElementById('stat-total');
const statMonto = document.getElementById('stat-monto');
const statCats = document.getElementById('stat-cats');

const catClass = (cat) => {
  const map = {
    'alimentación': 'cat-alimentacion',
    'alimentos': 'cat-alimentacion',
    'transporte': 'cat-transporte',
    'salud': 'cat-salud',
    'entretenimiento': 'cat-entretenimiento',
    'educación': 'cat-educacion',
    'hogar': 'cat-hogar',
    'otros': 'cat-otros'
  };
  return map[(cat || '').toLowerCase()] || 'cat-otros';
};

const actualizarStats = (gastos) => {
  const total = gastos.length;
  const monto = gastos.reduce((sum, g) => sum + g.monto, 0);
  const cats = new Set(gastos.map(g => g.categoria)).size;

  statTotal.textContent = total;
  statMonto.textContent = '$' + monto.toLocaleString('es-CL');
  statCats.textContent = cats;
  tagCount.textContent = total + ' registros';
};

const cargarGastos = async () => {
  const res = await fetch('/api/gastos');
  const gastos = await res.json();

  tbody.innerHTML = '';

  if (!gastos.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Sube un CSV para ver tus gastos</td></tr>';
    return;
  }

  gastos.forEach((g, i) => {
    const tr = document.createElement('tr');
    tr.style.animationDelay = `${i * 40}ms`;
    tr.innerHTML = `
      <td>${g.fecha}</td>
      <td>${g.descripcion}</td>
      <td class="monto-cell">$${g.monto.toLocaleString('es-CL')}</td>
      <td><span class="cat-badge ${catClass(g.categoria)}">${g.categoria}</span></td>
    `;
    tbody.appendChild(tr);
  });

  actualizarStats(gastos);
};

inputArchivo.addEventListener('change', async () => {
  const archivo = inputArchivo.files[0];
  if (!archivo) return;

  nombreArchivo.textContent = archivo.name;
  progressBar.classList.add('active');
  progressFill.style.width = '70%';

  const formData = new FormData();
  formData.append('archivo', archivo);

  const res = await fetch('/api/gastos/upload', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  progressFill.style.width = '100%';

  setTimeout(() => {
    progressBar.classList.remove('active');
    progressFill.style.width = '0%';
  }, 800);

  nombreArchivo.textContent = `✓ ${data.total} gastos procesados — ${data.errores} errores`;

  cargarGastos();
});

cargarGastos();
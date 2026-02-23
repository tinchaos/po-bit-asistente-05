const rowsEl = document.getElementById('rows');
const loadBtn = document.getElementById('loadBtn');
const adminTokenEl = document.getElementById('adminToken');

function renderRows(items) {
  rowsEl.innerHTML = '';

  if (!items.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="3">No hay registros todavía.</td>';
    rowsEl.appendChild(tr);
    return;
  }

  items.forEach((item) => {
    const tr = document.createElement('tr');
    const date = new Date(item.createdAt).toLocaleString('es-AR');
    tr.innerHTML = `
      <td>${date}</td>
      <td>${item.userName || 'visitante'}</td>
      <td>${item.question}</td>
    `;
    rowsEl.appendChild(tr);
  });
}

async function loadInteractions() {
  const headers = {};
  if (adminTokenEl.value.trim()) {
    headers['x-admin-token'] = adminTokenEl.value.trim();
  }

  const res = await fetch('/api/interactions', { headers });
  const data = await res.json();

  if (!res.ok) {
    rowsEl.innerHTML = `<tr><td colspan="3">Error: ${data.error || 'No se pudo cargar.'}</td></tr>`;
    return;
  }

  renderRows(data.items || []);
}

loadBtn.addEventListener('click', loadInteractions);
loadInteractions();

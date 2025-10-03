// Espera a que el DOM esté cargado
document.addEventListener("DOMContentLoaded", function() {
    // Asumimos que en el HTML se han insertado dos elementos ocultos con los datos JSON:
    // <div id="chartLabels" style="display: none;">[...json...]</div>
    // <div id="chartValues" style="display: none;">[...json...]</div>
    var labelsEl = document.getElementById('chartLabels');
    var valuesEl = document.getElementById('chartValues');
    var canvasEl = document.getElementById('yearChart');

    if (!labelsEl || !valuesEl || !canvasEl || typeof Chart === 'undefined') {
        // No hay datos o Chart.js no cargó; salir sin romper la página
        return;
    }

    var chartLabels = [];
    var chartValues = [];
    try {
        chartLabels = JSON.parse(labelsEl.textContent || '[]');
        chartValues = JSON.parse(valuesEl.textContent || '[]');
    } catch (e) {
        // Datos inválidos; no renderizar
        return;
    }

    const ctx = canvasEl.getContext('2d');
    const yearChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Documentos por Año',
                data: chartValues,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            }
        }
    });
  });
  
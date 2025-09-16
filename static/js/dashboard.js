// Espera a que el DOM esté cargado
document.addEventListener("DOMContentLoaded", function() {
    // Asumimos que en el HTML se han insertado dos elementos ocultos con los datos JSON:
    // <div id="chartLabels" style="display: none;">[...json...]</div>
    // <div id="chartValues" style="display: none;">[...json...]</div>
    var chartLabels = JSON.parse(document.getElementById('chartLabels').textContent);
    var chartValues = JSON.parse(document.getElementById('chartValues').textContent);
  
    const ctx = document.getElementById('yearChart').getContext('2d');
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
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            }
        }
    });
  });
  
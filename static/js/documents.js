document.addEventListener("DOMContentLoaded", function() {
    // Función para convertir a entero de forma segura
    function safeParseInt(val) {
      var n = parseInt(val);
      return isNaN(n) ? 0 : n;
    }
  
    // Función para ordenar las entradas por año
    function sortEntries(asc) {
      var container = document.querySelector(".list-group");
      var entries = Array.from(container.getElementsByClassName("doc-entry"));
      entries.sort(function(a, b) {
        var yearA = safeParseInt(a.querySelector(".doc-year").textContent.trim());
        var yearB = safeParseInt(b.querySelector(".doc-year").textContent.trim());
        return asc ? (yearA - yearB) : (yearB - yearA);
      });
      container.innerHTML = "";
      entries.forEach(function(entry) {
        container.appendChild(entry);
      });
    }
  
    document.getElementById("sortAsc").addEventListener("click", function(e) {
      e.preventDefault();
      sortEntries(true);
    });
    document.getElementById("sortDesc").addEventListener("click", function(e) {
      e.preventDefault();
      sortEntries(false);
    });
  
    // Checkbox "Seleccionar todos"
    document.getElementById("select-all").addEventListener("change", function() {
      var checked = this.checked;
      var checkboxes = document.querySelectorAll(".select-doc");
      checkboxes.forEach(function(cb) {
        cb.checked = checked;
      });
    });
  
    // Guardar configuración de campos requeridos
    document.getElementById("saveRequiredFields").addEventListener("click", function() {
      var form = document.getElementById("requiredFieldsForm");
      var checkboxes = form.querySelectorAll("input[type='checkbox']");
      var requiredFields = [];
      checkboxes.forEach(function(checkbox) {
        if (checkbox.checked) {
          requiredFields.push(checkbox.value);
        }
      });
      
      fetch(saveConfigUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ required_fields: requiredFields })
      })
      .then(response => response.json())
      .then(data => {
        if (data.status === "success") {
          alert("Configuración guardada correctamente");
        } else {
          alert("Error guardando la configuración");
        }
        // Cerrar el modal (Bootstrap 5)
        var modalEl = document.getElementById("requiredFieldsModal");
        var modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
      })
      .catch(error => {
        console.error("Error:", error);
        alert("Error en la petición");
      });
    });
  });
  
document.addEventListener('DOMContentLoaded', () => {
    const fabBtn = document.getElementById('fab-btn');
    const overlay = document.getElementById('upload-overlay');
    const modal = document.getElementById('upload-modal');
    const closeBtn = document.querySelector('.upload-close');
    const tabs = document.querySelectorAll('.upload-tab');
    const dropZone = document.getElementById('drop-zone');
    const dropHint = document.getElementById('drop-hint');
    const fileInput = document.getElementById('upload-input');
    const form = document.getElementById('upload-form');
    const selectFilesBtn = document.getElementById('select-files-btn');
    const uploadBtn = document.querySelector('.btn-upload');
    const selectedFilesDiv = document.getElementById('selected-files');

    // --- Abrir / cerrar modal ---
    const openModal = () => { 
      overlay.classList.remove('hidden'); 
      modal.classList.remove('hidden'); 
    };
    const closeModal = () => { 
      overlay.classList.add('hidden'); 
      modal.classList.add('hidden'); 
    };

    fabBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });

    // --- Tabs ---
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const type = tab.dataset.type;
        if (type === 'pdf') {
          dropHint.textContent = "Solo PDF (.pdf)";
          fileInput.accept = ".pdf,application/pdf";
          fileInput.removeAttribute('webkitdirectory');
          fileInput.removeAttribute('directory');
          form.action = window.uploadRoutes.pdf;
        } else if (type === 'excel') {
          dropHint.textContent = "Solo Excel (.xls, .xlsx)";
          fileInput.accept = ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          fileInput.removeAttribute('webkitdirectory');
          fileInput.removeAttribute('directory');
          form.action = window.uploadRoutes.excel;
        } else if (type === 'folder') {
          dropHint.textContent = "Solo Carpeta";
          fileInput.accept = "";
          fileInput.setAttribute('webkitdirectory', "");
          fileInput.setAttribute('directory', "");
          form.action = window.uploadRoutes.folder;
        }

        // Limpiar archivos previos al cambiar de pestaña
        fileInput.value = "";
        selectedFilesDiv.innerHTML = "";
        uploadBtn.classList.add('hidden');
      });
    });

    // --- Botón seleccionar archivo ---
    selectFilesBtn.addEventListener('click', e => {
      e.preventDefault();
      fileInput.click();
    });

    // --- Drag & drop ---
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', e => {
      dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      fileInput.files = e.dataTransfer.files;
      handleFiles(e.dataTransfer.files);
    });

    // --- Mostrar archivos seleccionados ---
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));

    function handleFiles(files) {
      if (!files || files.length === 0) {
        selectedFilesDiv.innerHTML = "";
        uploadBtn.classList.add('hidden');
        return;
      }

      // Mostrar preview moderna
      selectedFilesDiv.innerHTML = "";
      Array.from(files).forEach(file => {
        const fileEl = document.createElement('div');
        fileEl.classList.add('file-preview');
        fileEl.innerHTML = `
          <i class="fa-solid ${file.type.includes('pdf') ? 'fa-file-pdf' : file.type.includes('sheet') ? 'fa-file-excel' : 'fa-folder'}"></i>
          <span>${file.name}</span>
        `;
        selectedFilesDiv.appendChild(fileEl);
      });

      uploadBtn.classList.remove('hidden');
    }
  });
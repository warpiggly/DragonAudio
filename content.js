// Content script para detectar nuevos elementos de audio
(function() {
  'use strict';
  
  // Observar cambios en el DOM para detectar nuevos elementos de audio/video
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Buscar elementos audio/video en el nodo añadido
            const audioElements = node.querySelectorAll ? 
              node.querySelectorAll('audio, video') : [];
            
            // Si el nodo en sí es un elemento de audio/video
            if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
              console.log('Nuevo elemento de audio/video detectado:', node.tagName);
            }
            
            // Si contiene elementos de audio/video
            if (audioElements.length > 0) {
              console.log(`${audioElements.length} nuevos elementos de audio/video detectados`);
            }
          }
        });
      }
    });
  });
  
  // Iniciar observación
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Limpiar al cerrar la página
  window.addEventListener('beforeunload', function() {
    observer.disconnect();
  });
  
  console.log('Extension de control de audio inicializada');
})();
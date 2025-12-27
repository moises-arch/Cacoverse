(function(){
  var open = document.getElementById('mobile-menu-open');
  var drawer = document.getElementById('mobile-drawer');

  if(open && drawer){
    open.addEventListener('click', function(e){
      e.stopPropagation();
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden','false');
    });

    // Close when clicking outside
    document.addEventListener('click', function(e){
      if(!drawer.contains(e.target) && e.target !== open){
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden','true');
      }
    });

    document.addEventListener('keydown', function(e){
      if(e.key==='Escape'){
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden','true');
      }
    });
  }

  // accordion toggles
  Array.prototype.forEach.call(document.querySelectorAll('.acc-toggle'), function(btn){
    btn.addEventListener('click', function(){
      var idx = btn.getAttribute('data-acc-index');
      var panel = document.querySelector('[data-acc-panel="'+idx+'"]');
      if(panel) panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
    });
  });
})();
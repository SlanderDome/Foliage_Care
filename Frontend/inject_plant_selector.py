import re

PLANT_SELECTOR_BLOCK = r"""
  <!-- PLANT SELECTOR STYLES + LOGIC (Phase 1 - Garden Dashboard) -->
  <style>
    .plant-selector-wrap{margin:0 0 16px;padding:14px 16px;background:rgba(124,179,66,.06);border:1px solid rgba(124,179,66,.18);border-radius:12px;animation:fadeInDown .4s ease}
    .plant-selector-label{display:flex;align-items:center;gap:8px;font-size:12px;color:#9a9a7a;font-family:'DM Sans',sans-serif;font-weight:600;letter-spacing:.05em;text-transform:uppercase;margin-bottom:10px}
    .plant-select-dropdown{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);color:#e0e0d0;border-radius:8px;padding:9px 12px;font-size:13px;outline:none;cursor:pointer;transition:border-color .2s}
    .plant-select-dropdown:focus{border-color:#7cb342}
    .new-plant-input-row{display:flex;gap:8px;margin-top:10px}
    .new-plant-input{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);color:#e0e0d0;border-radius:8px;padding:9px 12px;font-size:13px;outline:none}
    .new-plant-icon-select{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);color:#e0e0d0;border-radius:8px;padding:9px 10px;font-size:16px;cursor:pointer}
    @keyframes fadeInDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
  </style>
  <script>
    (function initPlantSelector() {
      var form = document.getElementById('form');
      if (!form) return;
      var html = '<div class="plant-selector-wrap" id="plant-selector-wrap" style="display:none;">'
        + '<div class="plant-selector-label"><i class="fas fa-seedling"></i> Which plant are you scanning?</div>'
        + '<select id="plant-select" class="plant-select-dropdown">'
          + '<option value="">Select a plant\u2026</option>'
          + '<option value="__new__">+ Add New Plant</option>'
        + '</select>'
        + '<div id="new-plant-input-wrap" style="display:none;" class="new-plant-input-row">'
          + '<input id="new-plant-name" type="text" placeholder="Nickname (e.g. Balcony Tomato)" class="new-plant-input" />'
          + '<select id="new-plant-icon" class="new-plant-icon-select">'
            + '<option>\uD83C\uDF3F</option><option>\uD83C\uDF45</option><option>\uD83C\uDF39</option>'
            + '<option>\uD83C\uDF3B</option><option>\uD83C\uDF40</option><option>\uD83C\uDF35</option>'
            + '<option>\uD83E\uDEB4</option><option>\uD83C\uDF3E</option>'
          + '</select>'
        + '</div>'
        + '</div>';
      var dropZone = document.getElementById('drop-zone');
      if (dropZone) form.insertAdjacentHTML('afterbegin', html);

      document.addEventListener('change', function(e) {
        if (e.target.id !== 'plant-select') return;
        var val = e.target.value;
        var newWrap = document.getElementById('new-plant-input-wrap');
        if (val === '__new__') {
          if (newWrap) newWrap.style.display = 'flex';
          if (window.setSelectedPlant) window.setSelectedPlant(null, '');
        } else if (val) {
          if (newWrap) newWrap.style.display = 'none';
          var opt = e.target.options[e.target.selectedIndex];
          if (window.setSelectedPlant) window.setSelectedPlant(val, opt.text);
        } else {
          if (newWrap) newWrap.style.display = 'none';
          if (window.setSelectedPlant) window.setSelectedPlant(null, '');
        }
      });
      document.addEventListener('input', function(e) {
        if (e.target.id !== 'new-plant-name') return;
        if (window.setSelectedPlant) window.setSelectedPlant(null, e.target.value.trim());
      });

      function waitAndPopulate(attempts) {
        if (attempts > 30) return;
        if (!window.firebaseAuth || !window.db || !window.onAuthStateChanged) {
          return setTimeout(function(){ waitAndPopulate(attempts + 1); }, 400);
        }
        window.onAuthStateChanged(window.firebaseAuth, function(user) {
          if (!user) return;
          var wrap = document.getElementById('plant-selector-wrap');
          if (wrap) wrap.style.display = 'block';
          try {
            var q = window.query(
              window.collection(window.db, 'plants'),
              window.where('userId', '==', user.uid),
              window.orderBy('lastScannedAt', 'desc')
            );
            window.getDocs(q).then(function(snap) {
              var sel = document.getElementById('plant-select');
              if (!sel) return;
              while (sel.options.length > 1) sel.remove(1);
              var newOpt = document.createElement('option');
              newOpt.value = '__new__'; newOpt.text = '+ Add New Plant';
              sel.appendChild(newOpt);
              if (!snap.empty) {
                var divider = document.createElement('option');
                divider.disabled = true; divider.text = '\u2500\u2500\u2500\u2500\u2500\u2500\u2500';
                sel.insertBefore(divider, sel.options[1]);
                snap.forEach(function(docSnap) {
                  var d = docSnap.data();
                  var opt = document.createElement('option');
                  opt.value = docSnap.id;
                  opt.text = (d.icon || '\uD83C\uDF3F') + ' ' + (d.nickname || 'Unnamed Plant');
                  sel.insertBefore(opt, sel.options[1]);
                });
                var urlPlant = new URLSearchParams(location.search).get('plantId');
                if (urlPlant) { sel.value = urlPlant; sel.dispatchEvent(new Event('change')); }
              }
            }).catch(function(err){ console.warn('Plant query failed:', err); });
          } catch(err){ console.warn('Plant selector error:', err); }
        });
      }
      waitAndPopulate(0);
    })();
  </script>
"""

with open('start.html', 'r', encoding='utf-8') as f:
    src = f.read()

marker = '  </script>\n</body>'
if marker not in src:
    print('ERROR: marker not found')
else:
    new_src = src.replace(marker, '  </script>' + PLANT_SELECTOR_BLOCK + '\n</body>', 1)
    with open('start.html', 'w', encoding='utf-8') as f:
        f.write(new_src)
    print('SUCCESS: plant selector injected into start.html')

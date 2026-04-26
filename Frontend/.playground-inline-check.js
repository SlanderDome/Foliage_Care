const body = document.body;
    const anchor = document.getElementById('leaf-anchor');
    const statusTitle = document.getElementById('status-title');
    const statusCopy = document.getElementById('status-copy');
    const statusTime = document.getElementById('status-time');
    const statusPill = document.getElementById('status-pill');
    const infectionLoadEl = document.getElementById('infection-load');
    const confidenceValueEl = document.getElementById('confidence-value');
    const pulseRateEl = document.getElementById('pulse-rate');
    const timeline = document.getElementById('timeline');

    const mouse = { x: 0, y: 0 };
    const isMobile = window.innerWidth < 768;
    const PARTICLE_COUNT = isMobile ? 1200 : 4000;
    const cardAnimations = [];
    let diseaseInterval = null;
    let infectionIntensity = 0;
    let outbreakPulse = 12;
    let confidenceValue = 92;
    let hoverInfectionBoost = 0;
    let isRendering = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('bg-canvas'),
      antialias: true,
      alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x050f08, 1);

    const ambient = new THREE.AmbientLight(0x1a4731, 0.4);
    const mainLight = new THREE.DirectionalLight(0x4ade80, 0.8);
    mainLight.position.set(-3, 4, 2);
    const underLight = new THREE.PointLight(0x2dd4bf, 1.2, 8);
    underLight.position.set(0, -2, 1);
    scene.add(ambient, mainLight, underLight);

    function createParticleSystem() {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const sizes = new Float32Array(PARTICLE_COUNT);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 20;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 15;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
        sizes[i] = Math.random() * 3 + 1;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uMouse: { value: new THREE.Vector2(0, 0) },
          uColor: { value: new THREE.Color(0x4ade80) },
          uOpacity: { value: 0 }
        },
        vertexShader: `
          attribute float size;
          uniform float uTime;
          uniform vec2 uMouse;
          varying float vOpacity;

          void main() {
            vec3 pos = position;
            pos.y = mod(pos.y + uTime * 0.3, 15.0) - 7.5;

            vec2 mouseWorld = uMouse * vec2(10.0, 7.5);
            vec2 diff = pos.xy - mouseWorld;
            float dist = length(diff);
            if (dist < 2.0) {
              pos.xy += normalize(diff) * (2.0 - dist) * 0.3;
            }

            vOpacity = (pos.z + 4.0) / 8.0 * 0.3 + 0.05;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = size * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying float vOpacity;

          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);
            if (d > 0.5) discard;

            float alpha = (0.5 - d) / 0.5;
            alpha = pow(alpha, 2.0) * vOpacity * uOpacity;
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

      return new THREE.Points(geometry, material);
    }

    function createOrb(color, radius, position) {
      const geometry = new THREE.SphereGeometry(radius, 32, 32);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.06
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(position[0], position[1], position[2]);
      return mesh;
    }

    function createLeafTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#183d27';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const grad = ctx.createLinearGradient(40, 40, 470, 470);
      grad.addColorStop(0, '#2c6f47');
      grad.addColorStop(0.55, '#1d5134');
      grad.addColorStop(1, '#0e2418');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(74,222,128,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(255, 80);
      ctx.bezierCurveTo(265, 180, 272, 260, 258, 430);
      ctx.stroke();

      for (let i = 0; i < 8; i++) {
        const y = 140 + i * 35;
        ctx.beginPath();
        ctx.moveTo(256, y);
        ctx.quadraticCurveTo(175, y - 26, 110, y - 58);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(256, y + 5);
        ctx.quadraticCurveTo(340, y - 20, 400, y - 52);
        ctx.stroke();
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    }

    function createLeaf() {
      const geometry = new THREE.PlaneGeometry(2.5, 3.5, 64, 64);
      const positions = geometry.attributes.position;

      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const normalizedX = x / 1.25;
        const normalizedY = (y + 1.75) / 3.5;
        const distFromCenter = Math.abs(normalizedX);
        const curvature = distFromCenter * distFromCenter * 0.3;

        positions.setZ(i, -curvature + Math.sin(normalizedY * Math.PI) * 0.1);

        if (Math.abs(x) < 0.08) {
          positions.setZ(i, positions.getZ(i) + 0.05);
        }
      }

      geometry.computeVertexNormals();

      const alphaCanvas = document.createElement('canvas');
      alphaCanvas.width = 512;
      alphaCanvas.height = 512;
      const alphaCtx = alphaCanvas.getContext('2d');
      alphaCtx.fillStyle = 'black';
      alphaCtx.fillRect(0, 0, 512, 512);
      alphaCtx.fillStyle = 'white';
      alphaCtx.beginPath();
      alphaCtx.moveTo(256, 480);
      alphaCtx.bezierCurveTo(200, 400, 80, 320, 60, 200);
      alphaCtx.bezierCurveTo(40, 100, 150, 20, 256, 10);
      alphaCtx.bezierCurveTo(362, 20, 472, 100, 452, 200);
      alphaCtx.bezierCurveTo(432, 320, 312, 400, 256, 480);
      alphaCtx.fill();
      const alphaTexture = new THREE.CanvasTexture(alphaCanvas);

      const diseaseCanvas = document.createElement('canvas');
      diseaseCanvas.width = 256;
      diseaseCanvas.height = 256;
      const diseaseCtx = diseaseCanvas.getContext('2d');
      diseaseCtx.fillStyle = 'rgba(0,0,0,0)';
      diseaseCtx.fillRect(0, 0, 256, 256);
      const diseaseTexture = new THREE.CanvasTexture(diseaseCanvas);

      window.diseaseCtx = diseaseCtx;
      window.diseaseTexture = diseaseTexture;

      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: createLeafTexture(),
        roughness: 0.75,
        metalness: 0,
        alphaMap: alphaTexture,
        transparent: true,
        side: THREE.DoubleSide,
        emissive: 0x0a2a18,
        emissiveIntensity: 0.3,
        emissiveMap: diseaseTexture
      });

      const leaf = new THREE.Mesh(geometry, material);
      const midribPoints = [];
      for (let t = 0; t <= 1; t += 0.05) {
        midribPoints.push(new THREE.Vector3(
          Math.sin(t * 0.3) * 0.1,
          t * 3.2 - 1.6,
          0.06
        ));
      }

      const branchSegments = [];
      for (let t = 0.18; t <= 0.82; t += 0.14) {
        const y = t * 3.2 - 1.6;
        const offset = Math.sin(t * Math.PI) * 0.95;
        branchSegments.push(new THREE.Vector3(0.04, y, 0.055), new THREE.Vector3(offset * 0.65, y + 0.28, -0.03));
        branchSegments.push(new THREE.Vector3(-0.04, y + 0.02, 0.055), new THREE.Vector3(-offset * 0.65, y + 0.3, -0.03));
      }

      const midribGeo = new THREE.BufferGeometry().setFromPoints(midribPoints);
      const veinGeo = new THREE.BufferGeometry().setFromPoints(branchSegments);
      const veinMat = new THREE.LineBasicMaterial({
        color: 0x4ade80,
        transparent: true,
        opacity: 0.25
      });
      const midrib = new THREE.Line(midribGeo, veinMat);
      const veins = new THREE.LineSegments(veinGeo, veinMat);

      const group = new THREE.Group();
      group.add(leaf, midrib, veins);
      group.position.set(0, 0.5, 0);
      group.scale.setScalar(0.95);

      return { group, material };
    }

    const particleSystem = createParticleSystem();
    const orb1 = createOrb(0x22c55e, 4, [-6, 3, -3]);
    const orb2 = createOrb(0x2dd4bf, 3, [5, -3, -4]);
    scene.add(particleSystem, orb1, orb2);

    const leafBundle = createLeaf();
    const leafGroup = leafBundle.group;
    scene.add(leafGroup);

    function seedDiseaseCluster(cx, cy, radius, strength) {
      const ctx = window.diseaseCtx;
      if (!ctx) return;

      const gradient = ctx.createRadialGradient(cx, cy, 4, cx, cy, radius);
      gradient.addColorStop(0, `rgba(${Math.round(220 + strength * 20)}, ${Math.round(90 - strength * 30)}, 20, 0.88)`);
      gradient.addColorStop(0.4, 'rgba(249,115,22,0.45)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      window.diseaseTexture.needsUpdate = true;
    }

    function calculateInfectionLoad() {
      const ctx = window.diseaseCtx;
      if (!ctx) return 0;
      const imageData = ctx.getImageData(0, 0, 256, 256).data;
      let infectedPixels = 0;
      const totalPixels = imageData.length / 4;

      for (let i = 0; i < imageData.length; i += 4) {
        if (imageData[i] > 45 || imageData[i + 1] > 25) {
          infectedPixels++;
        }
      }

      return Math.min(100, Math.round((infectedPixels / totalPixels) * 100 * 1.65));
    }

    function updateInfectionUI() {
      infectionIntensity = calculateInfectionLoad();
      infectionLoadEl.textContent = Math.round(infectionIntensity) + '%';
      confidenceValueEl.textContent = Math.round(confidenceValue) + '%';
      pulseRateEl.textContent = Math.round(outbreakPulse).toString();
    }

    function spreadDisease() {
      const ctx = window.diseaseCtx;
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, 256, 256);
      const data = imageData.data;
      const infected = [];

      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 80) infected.push(i);
      }

      if (infected.length === 0) {
        const seedX = 120 + Math.floor(Math.random() * 18);
        const seedY = 86 + Math.floor(Math.random() * 20);
        seedDiseaseCluster(seedX, seedY, 18, 1);
        updateInfectionUI();
        return;
      }

      infected.forEach((idx) => {
        if (Math.random() > 0.72 - hoverInfectionBoost) return;
        const pixel = idx / 4;
        const x = pixel % 256;
        const y = Math.floor(pixel / 256);
        const offsets = [
          [-1, 0], [1, 0], [0, -1], [0, 1],
          [-1, -1], [1, 1], [-1, 1], [1, -1]
        ];
        const chosen = offsets[Math.floor(Math.random() * offsets.length)];
        const nx = Math.min(255, Math.max(0, x + chosen[0]));
        const ny = Math.min(255, Math.max(0, y + chosen[1]));
        const n = (ny * 256 + nx) * 4;

        data[n] = Math.min(255, data[n] + 26);
        data[n + 1] = Math.min(190, data[n + 1] + 9);
        data[n + 2] = Math.min(50, data[n + 2] + 2);
        data[n + 3] = Math.min(255, data[n + 3] + 20);
      });

      ctx.putImageData(imageData, 0, 0);

      if (Math.random() > 0.55) {
        seedDiseaseCluster(105 + Math.random() * 40, 78 + Math.random() * 42, 9 + Math.random() * 16, Math.random());
      }

      window.diseaseTexture.needsUpdate = true;
      updateInfectionUI();
    }

    function startDiseaseSimulation() {
      if (diseaseInterval) return;
      diseaseInterval = window.setInterval(spreadDisease, 80);
    }

    function stopDiseaseSimulation() {
      if (!diseaseInterval) return;
      window.clearInterval(diseaseInterval);
      diseaseInterval = null;
    }

    function updateTimeline(step) {
      timeline.querySelectorAll('.timeline-item').forEach((item) => {
        item.classList.toggle('active', item.dataset.step === step);
      });
    }

    function setStatus(mode) {
      if (mode === 'diagnose') {
        statusTitle.textContent = 'Vision model isolating suspicious lesion structures';
        statusCopy.innerHTML = 'The detector has entered <strong>symptom analysis mode</strong>. Watch for rising confidence and a soft amber warning signature as the AI highlights likely stress clusters.';
        statusPill.textContent = 'Diagnostic Scan';
        statusPill.style.color = '#4ade80';
        statusPill.style.background = 'rgba(74,222,128,0.08)';
        statusPill.style.borderColor = 'rgba(74,222,128,0.2)';
        confidenceValue = 94;
        outbreakPulse = 18;
        updateTimeline('diagnose');
      } else if (mode === 'simulate') {
        statusTitle.textContent = 'Forecast engine projecting untreated disease spread';
        statusCopy.innerHTML = 'Simulation mode expands infected zones using a <strong>cellular growth model</strong>. This helps growers visualize what a seven-day delay in treatment might cost.';
        statusPill.textContent = 'Forecast Active';
        statusPill.style.color = '#fbbf24';
        statusPill.style.background = 'rgba(251,191,36,0.08)';
        statusPill.style.borderColor = 'rgba(251,191,36,0.2)';
        confidenceValue = 88;
        outbreakPulse = 26;
        updateTimeline('simulate');
      } else if (mode === 'map') {
        statusTitle.textContent = 'Community telemetry syncing into outbreak surveillance';
        statusCopy.innerHTML = 'The intelligence layer is now emphasizing <strong>regional outbreak correlation</strong>, showing how individual diagnoses turn into a national awareness surface for farmers and extension teams.';
        statusPill.textContent = 'Telemetry Sync';
        statusPill.style.color = '#2dd4bf';
        statusPill.style.background = 'rgba(45,212,191,0.08)';
        statusPill.style.borderColor = 'rgba(45,212,191,0.2)';
        confidenceValue = 91;
        outbreakPulse = 34;
        updateTimeline('map');
      } else {
        statusTitle.textContent = 'Leaf stable and ready for interaction';
        statusCopy.innerHTML = 'The specimen is currently showing a <strong>healthy spectral signature</strong>. Move your cursor to tilt the leaf, then trigger a module to see how the diagnosis and forecasting stack reacts in real time.';
        statusPill.textContent = 'Healthy Signal';
        statusPill.style.color = '#4ade80';
        statusPill.style.background = 'rgba(74,222,128,0.08)';
        statusPill.style.borderColor = 'rgba(74,222,128,0.2)';
        confidenceValue = 92;
        outbreakPulse = 12;
        updateTimeline('diagnose');
      }

      updateInfectionUI();
    }

    function resetDiseaseField() {
      const ctx = window.diseaseCtx;
      if (!ctx) return;
      ctx.clearRect(0, 0, 256, 256);
      seedDiseaseCluster(124, 86, 12, 0.75);
      seedDiseaseCluster(142, 100, 8, 0.3);
      updateInfectionUI();
    }

    window.triggerDiagnose = function triggerDiagnose() {
      stopDiseaseSimulation();
      resetDiseaseField();
      hoverInfectionBoost = 0.08;
      setStatus('diagnose');
    };

    window.triggerSimulate = function triggerSimulate() {
      if (infectionIntensity < 4) {
        resetDiseaseField();
      }
      hoverInfectionBoost = 0.16;
      setStatus('simulate');
      startDiseaseSimulation();
    };

    window.triggerMap = function triggerMap() {
      stopDiseaseSimulation();
      hoverInfectionBoost = 0;
      setStatus('map');
    };

    function countUp(elementId, target, duration, suffix = '') {
      const el = document.getElementById(elementId);
      const start = performance.now();

      function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target) + suffix;
        if (progress < 1) {
          requestAnimationFrame(update);
        }
      }

      requestAnimationFrame(update);
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        countUp('stat-accuracy', 90, 1800);
        countUp('stat-diseases', 38, 1500);
        countUp('stat-crops', 7, 1000);
        countUp('stat-speed', 500, 2000);
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(document.getElementById('stats-bar'));

    function createCanvasController(id, draw) {
      const canvas = document.getElementById(id);
      const ctx = canvas.getContext('2d');
      const state = { width: 0, height: 160 };

      function resize() {
        const width = Math.max(10, Math.round(canvas.getBoundingClientRect().width));
        canvas.width = width;
        canvas.height = 160;
        state.width = width;
        state.height = 160;
      }

      resize();
      cardAnimations.push({ resize });

      const animation = { active: true };
      const intersection = new IntersectionObserver((entries) => {
        animation.active = entries[0].isIntersecting;
      }, { threshold: 0.1 });
      intersection.observe(canvas);

      function frame(time) {
        if (animation.active) {
          draw(ctx, state, time);
        }
        requestAnimationFrame(frame);
      }

      requestAnimationFrame(frame);
    }

    const diagnoseParticles = [];
    function initDiseaseCanvas() {
      createCanvasController('canvas-diagnose', (ctx, state) => {
        ctx.clearRect(0, 0, state.width, state.height);

        if (diagnoseParticles.length < 60 && Math.random() > 0.85) {
          diagnoseParticles.push({
            x: Math.random() * state.width,
            y: Math.random() * state.height,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            r: Math.random() * 4 + 2,
            life: 1,
            decay: Math.random() * 0.008 + 0.004,
            color: Math.random() > 0.5 ? '#f97316' : '#dc2626'
          });
        }

        for (let i = diagnoseParticles.length - 1; i >= 0; i--) {
          const p = diagnoseParticles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= p.decay;

          if (p.life <= 0) {
            diagnoseParticles.splice(i, 1);
            continue;
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life * 0.7;
          ctx.shadowBlur = 18;
          ctx.shadowColor = p.color;
          ctx.fill();
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      });
    }

    function initRecoveryCanvas() {
      createCanvasController('canvas-simulate', (ctx, state, time) => {
        const t = time * 0.0016;
        ctx.clearRect(0, 0, state.width, state.height);

        const progress = (Math.sin(t) + 1) / 2;
        const splitX = progress * state.width;

        ctx.fillStyle = 'rgba(220,38,38,0.15)';
        ctx.fillRect(0, 0, splitX, state.height);

        ctx.fillStyle = 'rgba(74,222,128,0.12)';
        ctx.fillRect(splitX, 0, state.width - splitX, state.height);

        ctx.beginPath();
        ctx.moveTo(splitX, 0);
        for (let y = 0; y <= state.height; y += 2) {
          const waviness = Math.sin(y * 0.05 + t * 3) * 15;
          ctx.lineTo(splitX + waviness, y);
        }
        ctx.strokeStyle = 'rgba(251,191,36,0.5)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(251,191,36,0.38)';
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
    }

    function drawIndiaSilhouette(ctx, width, height) {
      ctx.save();
      ctx.translate(width * 0.08, height * 0.06);
      ctx.scale(width / 210, height / 170);
      ctx.beginPath();
      ctx.moveTo(86, 9);
      ctx.lineTo(118, 13);
      ctx.lineTo(136, 27);
      ctx.lineTo(149, 44);
      ctx.lineTo(160, 68);
      ctx.lineTo(151, 87);
      ctx.lineTo(142, 95);
      ctx.lineTo(136, 114);
      ctx.lineTo(124, 125);
      ctx.lineTo(118, 144);
      ctx.lineTo(106, 158);
      ctx.lineTo(99, 146);
      ctx.lineTo(92, 126);
      ctx.lineTo(78, 110);
      ctx.lineTo(65, 96);
      ctx.lineTo(54, 79);
      ctx.lineTo(47, 57);
      ctx.lineTo(52, 42);
      ctx.lineTo(67, 35);
      ctx.lineTo(74, 23);
      ctx.closePath();
      ctx.fillStyle = 'rgba(45,212,191,0.06)';
      ctx.strokeStyle = 'rgba(45,212,191,0.18)';
      ctx.lineWidth = 1.2;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    function initMapCanvas() {
      const hotspots = [
        { x: 0.45, y: 0.35, color: '#f97316' },
        { x: 0.38, y: 0.65, color: '#4ade80' },
        { x: 0.52, y: 0.72, color: '#dc2626' },
        { x: 0.58, y: 0.82, color: '#fbbf24' },
        { x: 0.62, y: 0.58, color: '#4ade80' },
        { x: 0.30, y: 0.45, color: '#f97316' },
        { x: 0.48, y: 0.55, color: '#fbbf24' }
      ];

      const pulses = hotspots.map((hotspot) => ({
        x: hotspot.x,
        y: hotspot.y,
        color: hotspot.color,
        r: 0,
        maxR: 20 + Math.random() * 15,
        speed: 0.3 + Math.random() * 0.3
      }));

      createCanvasController('canvas-map', (ctx, state) => {
        ctx.clearRect(0, 0, state.width, state.height);
        drawIndiaSilhouette(ctx, state.width, state.height);

        pulses.forEach((pulse) => {
          pulse.r += pulse.speed;
          if (pulse.r > pulse.maxR) {
            pulse.r = 0;
          }

          const cx = pulse.x * state.width;
          const cy = pulse.y * state.height;
          const alpha = (1 - pulse.r / pulse.maxR) * 0.6;

          ctx.beginPath();
          ctx.arc(cx, cy, pulse.r, 0, Math.PI * 2);
          ctx.strokeStyle = pulse.color;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 14;
          ctx.shadowColor = pulse.color;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cx, cy, 3, 0, Math.PI * 2);
          ctx.fillStyle = pulse.color;
          ctx.globalAlpha = 0.9;
          ctx.fill();
        });

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      });
    }

    function gsapLike(obj, prop, from, to, duration) {
      const start = performance.now();
      obj[prop] = from;

      function update(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        obj[prop] = from + (to - from) * eased;
        if (t < 1) {
          requestAnimationFrame(update);
        }
      }

      requestAnimationFrame(update);
    }

    function debounce(fn, delay) {
      let timer = null;
      return function debounced() {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, arguments), delay);
      };
    }

    function syncLeafToAnchor() {
      const rect = anchor.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const normalizedX = (centerX / window.innerWidth) * 2 - 1;
      const normalizedY = -(centerY / window.innerHeight) * 2 + 1;
      const distance = camera.position.z;
      const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance;
      const visibleWidth = visibleHeight * camera.aspect;
      return {
        x: normalizedX * visibleWidth * 0.5,
        y: normalizedY * visibleHeight * 0.5
      };
    }

    window.addEventListener('mousemove', (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      particleSystem.material.uniforms.uMouse.value.set(mouse.x, mouse.y);
    });

    document.addEventListener('visibilitychange', () => {
      isRendering = !document.hidden;
    });

    window.addEventListener('resize', debounce(() => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      syncLeafToAnchor();
      cardAnimations.forEach((entry) => entry.resize());
    }, 200));

    if (!CSS.supports('backdrop-filter', 'blur(1px)')) {
      document.querySelectorAll('.feat-card, .hero-panel, .status-panel, .lab-card, .topbar').forEach((card) => {
        card.style.background = 'rgba(5,20,10,0.92)';
      });
    }

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      if (!isRendering) return;

      const time = clock.getElapsedTime();
      statusTime.textContent = Math.round(time).toString().padStart(2, '0') + ':00';
      const anchorPos = syncLeafToAnchor();

      particleSystem.material.uniforms.uTime.value = time;
      orb1.material.opacity = 0.06 + Math.sin(time * 0.5) * 0.02;
      orb2.material.opacity = 0.04 + Math.sin(time * 0.4 + 2) * 0.015;
      orb1.scale.setScalar(1 + Math.sin(time * 0.3) * 0.05);
      orb2.scale.setScalar(1 + Math.sin(time * 0.35 + 1) * 0.06);

      leafGroup.position.x += (anchorPos.x - leafGroup.position.x) * 0.08;
      leafGroup.position.y += (anchorPos.y + Math.sin(time * 0.8) * 0.12 - leafGroup.position.y) * 0.08;
      leafGroup.rotation.z = Math.sin(time * 0.5) * 0.04;
      const targetX = -mouse.y * 0.3;
      const targetY = mouse.x * 0.4;
      leafGroup.rotation.x += (targetX - leafGroup.rotation.x) * 0.05;
      leafGroup.rotation.y += (targetY - leafGroup.rotation.y) * 0.05;
      leafBundle.material.emissiveIntensity = 0.26 + Math.sin(time * 0.6) * 0.03 + Math.min(infectionIntensity / 200, 0.12);

      renderer.render(scene, camera);
    }

    window.addEventListener('load', () => {
      body.classList.add('loaded');
      setStatus('idle');
      initDiseaseCanvas();
      initRecoveryCanvas();
      initMapCanvas();
      resetDiseaseField();
      const initialAnchor = syncLeafToAnchor();
      leafGroup.position.set(initialAnchor.x, initialAnchor.y, 0);

      setTimeout(() => {
        gsapLike(particleSystem.material.uniforms.uOpacity, 'value', 0, 1, 800);
      }, 300);

      setTimeout(() => {
        gsapLike(orb1.material, 'opacity', 0, 0.06, 900);
        gsapLike(orb2.material, 'opacity', 0, 0.04, 900);
      }, 600);

      setTimeout(() => {
        leafGroup.scale.setScalar(0.68);
        gsapLike(leafGroup.scale, 'x', 0.68, 0.95, 900);
        gsapLike(leafGroup.scale, 'y', 0.68, 0.95, 900);
        gsapLike(leafGroup.scale, 'z', 0.68, 0.95, 900);
      }, 900);

      animate();
    });
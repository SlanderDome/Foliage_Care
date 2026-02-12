/**
 * Foliage Care — Three.js Floating Leaf Particles
 * Creates a beautiful 3D particle field with leaf-like shapes
 * that gently float and rotate behind the page content.
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

(function initLeafParticles() {
    // ── Config ──
    const LEAF_COUNT = 120;
    const FIELD_WIDTH = 30;
    const FIELD_HEIGHT = 40;
    const FIELD_DEPTH = 18;
    const DRIFT_SPEED = 0.0012;
    const SWAY_AMOUNT = 0.4;
    const FALL_SPEED = 0.008;

    // ── Setup ──
    const canvas = document.getElementById('leaf-canvas');
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 15;

    // ── Soft ambient lighting ──
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0x9ec06a, 0.8);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // ── Leaf geometry (simple diamond shape) ──
    function createLeafGeometry() {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0.5);
        shape.quadraticCurveTo(0.25, 0.3, 0.12, 0);
        shape.quadraticCurveTo(0, -0.15, -0.12, 0);
        shape.quadraticCurveTo(-0.25, 0.3, 0, 0.5);
        const geom = new THREE.ShapeGeometry(shape);
        return geom;
    }

    // ── Leaf materials (Deep Canopy palette) ──
    const leafColors = [
        0x3d4a2a,  // dark moss
        0x4e6634,  // canopy
        0x6a8c46,  // fern
        0x7cb342,  // accent green
        0x5a8a2f,  // accent dim
        0x8f9467,  // lichen
        0x6b4226,  // earth
        0xc9a84c   // gold accent
    ];

    // ── Create leaves ──
    const leafGeo = createLeafGeometry();
    const leaves = [];

    for (let i = 0; i < LEAF_COUNT; i++) {
        const color = leafColors[Math.floor(Math.random() * leafColors.length)];
        const mat = new THREE.MeshStandardMaterial({
            color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.45 + Math.random() * 0.4,
            roughness: 0.8,
            metalness: 0.05,
        });

        const leaf = new THREE.Mesh(leafGeo, mat);
        const scale = 0.4 + Math.random() * 0.8;
        leaf.scale.set(scale, scale, scale);

        // Random initial position
        leaf.position.set(
            (Math.random() - 0.5) * FIELD_WIDTH,
            (Math.random() - 0.5) * FIELD_HEIGHT,
            (Math.random() - 0.5) * FIELD_DEPTH
        );

        // Random rotation offsets
        leaf.rotation.x = Math.random() * Math.PI;
        leaf.rotation.y = Math.random() * Math.PI;
        leaf.rotation.z = Math.random() * Math.PI;

        // Per-leaf animation data
        leaf.userData = {
            phaseX: Math.random() * Math.PI * 2,
            phaseY: Math.random() * Math.PI * 2,
            phaseZ: Math.random() * Math.PI * 2,
            speedMul: 0.5 + Math.random() * 1.0,
            swayMul: 0.5 + Math.random() * 1.0,
            fallSpeed: FALL_SPEED * (0.5 + Math.random() * 1.0),
        };

        scene.add(leaf);
        leaves.push(leaf);
    }

    // ── Animation loop ──
    let time = 0;

    function animate() {
        requestAnimationFrame(animate);
        time += DRIFT_SPEED;

        for (const leaf of leaves) {
            const d = leaf.userData;

            // Gentle falling
            leaf.position.y -= d.fallSpeed;

            // Sway side-to-side
            leaf.position.x += Math.sin(time * d.speedMul + d.phaseX) * SWAY_AMOUNT * 0.01;

            // Gentle rotation
            leaf.rotation.x += 0.002 * d.speedMul;
            leaf.rotation.y += 0.003 * d.speedMul;
            leaf.rotation.z += Math.sin(time + d.phaseZ) * 0.002;

            // Reset when fallen below view
            if (leaf.position.y < -FIELD_HEIGHT / 2 - 2) {
                leaf.position.y = FIELD_HEIGHT / 2 + 2;
                leaf.position.x = (Math.random() - 0.5) * FIELD_WIDTH;
                leaf.position.z = (Math.random() - 0.5) * FIELD_DEPTH;
            }
        }

        renderer.render(scene, camera);
    }

    animate();

    // ── Resize handler ──
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
})();

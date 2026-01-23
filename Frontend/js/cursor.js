document.addEventListener("DOMContentLoaded", () => {
    // 1. Create the layer to hold our particles
    const cursorLayer = document.createElement("div");
    cursorLayer.id = "cursor-layer";
    document.body.appendChild(cursorLayer);

    // --- FLOWER CLICK EFFECT (Bloom) ---
    const flowers = ['🌸', '🌼', '🌻', '🌷', '🌺', '🌹', '🪷'];

    document.addEventListener("click", (e) => {
        // Spawn 3 flowers per click for a "burst" effect
        for(let i = 0; i < 3; i++) {
            createFlower(e.clientX, e.clientY);
        }
    });

    function createFlower(x, y) {
        const flower = document.createElement("div");
        flower.classList.add("click-flower");
        
        // Pick a random flower emoji
        flower.innerText = flowers[Math.floor(Math.random() * flowers.length)];

        // Spread them out slightly around the click center
        const spreadX = (Math.random() - 0.5) * 50; 
        const spreadY = (Math.random() - 0.5) * 50;

        flower.style.left = `${x + spreadX}px`;
        flower.style.top = `${y + spreadY}px`;
        
        // Randomize size slightly for variety
        const scale = 0.8 + Math.random() * 0.6;
        flower.style.fontSize = `${scale}rem`;

        // Randomize rotation slightly
        const rotate = (Math.random() - 0.5) * 30;
        flower.style.transform = `rotate(${rotate}deg)`;

        cursorLayer.appendChild(flower);

        // Remove element after animation ends (0.8s)
        setTimeout(() => {
            flower.remove();
        }, 800);
    }
});
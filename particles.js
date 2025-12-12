const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let particles = [];
let width, height;

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

class Particle {
    constructor() {
        this.reset();
        this.y = Math.random() * height; // Start anywhere
        this.fadeDelay = Math.random() * 100;
    }

    reset() {
        this.x = Math.random() * width;
        this.y = height + 10;
        this.speed = Math.random() * 0.5 + 0.2;
        this.size = Math.random() * 2 + 0.5;
        this.opacity = 0;
        this.fadeState = 'in'; // in, hold, out
        this.maxOpacity = Math.random() * 0.5 + 0.1;
        this.wobble = Math.random() * Math.PI * 2;
        this.wobbleSpeed = Math.random() * 0.02 + 0.005;
    }

    update() {
        this.y -= this.speed;
        this.wobble += this.wobbleSpeed;
        this.x += Math.sin(this.wobble) * 0.5;

        // Fade Logic
        if (this.fadeState === 'in') {
            this.opacity += 0.005;
            if (this.opacity >= this.maxOpacity) {
                this.opacity = this.maxOpacity;
                this.fadeState = 'hold';
            }
        } else if (this.fadeState === 'hold') {
            if (this.y < height * 0.2 || Math.random() < 0.001) { // Fade out near top or randomly
                this.fadeState = 'out';
            }
        } else if (this.fadeState === 'out') {
            this.opacity -= 0.005;
            if (this.opacity <= 0) {
                this.reset();
            }
        }

        if (this.y < -10) this.reset();
    }

    draw() {
        ctx.fillStyle = `rgba(88, 166, 255, ${this.opacity})`; // Aether Blue
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow effect (expensive, maybe skip for performance or limit count)
        // ctx.shadowBlur = 10;
        // ctx.shadowColor = "rgba(88, 166, 255, 0.5)";
    }
}

function init() {
    resize();
    // Create particles based on screen area
    const count = Math.floor((width * height) / 10000); 
    for (let i = 0; i < count; i++) {
        particles.push(new Particle());
    }
    animate();
}

function animate() {
    ctx.clearRect(0, 0, width, height);
    particles.forEach(p => {
        p.update();
        p.draw();
    });
    requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
    resize();
    particles = [];
    init();
});

init();

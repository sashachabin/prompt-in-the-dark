interface ConfettiParams {
  count?: number;
  spread?: number;
  gravity?: number;
  colors?: string[];
}

export function triggerConfetti({
  count = 1500,
  spread = 120,
  gravity = 0.2,
  colors = [
    "#f44336",
    "#e91e63",
    "#9c27b0",
    "#673ab7",
    "#3f51b5",
    "#2196f3",
    "#4caf50",
    "#ffeb3b",
    "#ff9800",
  ],
}: ConfettiParams = {}): void {
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d")!;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    rotation: number;
    vRot: number;
  }

  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const angle = ((Math.random() - 0.5) * spread * Math.PI) / 180;
    const speed = Math.random() * 8 + 4;
    particles.push({
      x: canvas.width / 2,
      y: canvas.height + 20,
      vx: Math.sin(angle) * speed,
      vy: -Math.cos(angle) * speed - Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)] || "",
      size: Math.random() * 8 + 6,
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10,
    });
  }

  function update(): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let activeCount = 0;
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += gravity;
      p.vx *= 0.99;
      p.rotation += p.vRot;

      if (p.y < canvas.height + 50) {
        activeCount++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
    });

    if (activeCount > 0) {
      requestAnimationFrame(update);
    } else {
      canvas.remove();
    }
  }

  update();
}

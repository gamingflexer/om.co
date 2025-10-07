import React, { useEffect, useRef, useState } from "react";

const LegoBackground = () => {
  const canvasRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setCanvasSize();

    // ASCII characters for lego blocks
    const legoChars = ["█", "▓", "▒", "░", "■", "▪", "▫"];
    const structureChars = ["┌", "┐", "└", "┘", "│", "─", "├", "┤", "┬", "┴", "┼"];

    // Particle class for floating blocks
    class LegoBlock {
      constructor() {
        this.reset();
        this.y = Math.random() * canvas.height;
      }

      reset() {
        this.x = Math.random() * canvas.width;
        this.y = -20;
        this.speedY = 0.3 + Math.random() * 0.8;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.char = legoChars[Math.floor(Math.random() * legoChars.length)];
        this.opacity = 0.1 + Math.random() * 0.3;
        this.size = 12 + Math.random() * 8;
      }

      update() {
        this.y += this.speedY;
        this.x += this.speedX;

        if (this.y > canvas.height + 20) {
          this.reset();
        }
        if (this.x < -20 || this.x > canvas.width + 20) {
          this.x = Math.random() * canvas.width;
        }
      }

      draw(context, color) {
        context.save();
        context.font = `${this.size}px monospace`;
        context.fillStyle = color;
        context.globalAlpha = this.opacity;
        context.fillText(this.char, this.x, this.y);
        context.restore();
      }
    }

    // Structure class for complex formations
    class LegoStructure {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * (canvas.width - 200) + 100;
        this.y = Math.random() * (canvas.height - 200) + 100;
        this.width = 40 + Math.random() * 80;
        this.height = 40 + Math.random() * 80;
        this.lifetime = 0;
        this.maxLifetime = 180 + Math.random() * 120; // 3-5 seconds at 60fps
        this.buildPhase = 0;
        this.maxBuildPhase = 30;
        this.destroying = false;
        this.opacity = 0;
        this.type = Math.floor(Math.random() * 3); // Different structure types
      }

      update() {
        this.lifetime++;

        // Building phase
        if (this.buildPhase < this.maxBuildPhase && !this.destroying) {
          this.buildPhase++;
          this.opacity = this.buildPhase / this.maxBuildPhase;
        }

        // Start destroying after lifetime
        if (this.lifetime > this.maxLifetime) {
          this.destroying = true;
          this.opacity -= 0.02;
        }

        // Reset when fully destroyed
        if (this.opacity <= 0 && this.destroying) {
          this.reset();
        }
      }

      drawTower(context, color) {
        const rows = Math.floor(this.height / 15);
        const cols = Math.floor(this.width / 10);

        for (let i = 0; i <= rows; i++) {
          for (let j = 0; j <= cols; j++) {
            if (i < (this.buildPhase / this.maxBuildPhase) * rows) {
              const char = i === 0 ? "▀" : i === rows ? "▄" : "█";
              context.fillText(char, this.x + j * 10, this.y + i * 15);
            }
          }
        }
      }

      drawGrid(context, color) {
        const rows = Math.floor(this.height / 20);
        const cols = Math.floor(this.width / 15);

        for (let i = 0; i <= rows; i++) {
          for (let j = 0; j <= cols; j++) {
            if (i + j < (this.buildPhase / this.maxBuildPhase) * (rows + cols)) {
              let char = "┼";
              if (i === 0 && j === 0) char = "┌";
              else if (i === 0 && j === cols) char = "┐";
              else if (i === rows && j === 0) char = "└";
              else if (i === rows && j === cols) char = "┘";
              else if (i === 0) char = "┬";
              else if (i === rows) char = "┴";
              else if (j === 0) char = "├";
              else if (j === cols) char = "┤";

              context.fillText(char, this.x + j * 15, this.y + i * 20);
            }
          }
        }
      }

      drawPyramid(context, color) {
        const rows = Math.floor(this.height / 15);

        for (let i = 0; i <= rows; i++) {
          if (i < (this.buildPhase / this.maxBuildPhase) * rows) {
            const cols = rows - i;
            for (let j = 0; j <= cols; j++) {
              context.fillText("▓", this.x + j * 10 + i * 5, this.y + i * 15);
            }
          }
        }
      }

      draw(context, color) {
        context.save();
        context.font = "14px monospace";
        context.fillStyle = color;
        context.globalAlpha = this.opacity * 0.6;

        if (this.type === 0) {
          this.drawTower(context, color);
        } else if (this.type === 1) {
          this.drawGrid(context, color);
        } else {
          this.drawPyramid(context, color);
        }

        context.restore();
      }
    }

    // Initialize particles and structures
    const blocks = [];
    const structures = [];
    const numBlocks = 150;
    const numStructures = 3;

    for (let i = 0; i < numBlocks; i++) {
      blocks.push(new LegoBlock());
    }

    for (let i = 0; i < numStructures; i++) {
      structures.push(new LegoStructure());
    }

    // Animation loop
    let animationId;
    const animate = () => {
      const bgColor = "rgba(255, 255, 255, 0.05)";
      const fgColor = "#0066cc";

      // Clear with trail effect
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw floating blocks
      blocks.forEach(block => {
        block.update();
        block.draw(ctx, fgColor);
      });

      // Update and draw structures
      structures.forEach(structure => {
        structure.update();
        structure.draw(ctx, fgColor);
      });

      // Scan line effect
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = fgColor;
      const scanLineY = (Date.now() * 0.1) % canvas.height;
      ctx.fillRect(0, scanLineY, canvas.width, 2);
      ctx.restore();

      animationId = requestAnimationFrame(animate);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      setCanvasSize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none z-0"
      style={{
        opacity: 0.4,
        mixBlendMode: "multiply",
      }}
    />
  );
};

export default LegoBackground;

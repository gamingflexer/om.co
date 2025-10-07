import React, { useState } from "react";

const WorkCard = ({ img, name, description, onClick, tech = [] }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="group relative overflow-hidden rounded-2xl p-1 laptop:p-1 first:ml-0 link cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        perspective: "1000px",
      }}
    >
      {/* Animated gradient border */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 animate-gradient-xy" />

      {/* Glass morphism card */}
      <div
        className="relative rounded-2xl overflow-hidden backdrop-blur-md transition-all duration-500 bg-white/80 hover:bg-white/90 border border-slate-200/50 hover:border-cyan-500/50"
        style={{
          transform: isHovered ? "translateY(-8px) rotateX(2deg)" : "none",
          boxShadow: isHovered
            ? "0 20px 60px -15px rgba(6, 182, 212, 0.3), 0 0 40px -10px rgba(168, 85, 247, 0.2)"
            : "none",
        }}
      >
        {/* Image container */}
        <div
          className="relative rounded-lg overflow-hidden transition-all ease-out duration-500 h-64 mob:h-48 laptop:h-80"
        >
          <img
            alt={name}
            className="h-full w-full object-cover group-hover:scale-110 transition-all ease-out duration-700"
            src={img}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />

          {/* Tech badges on image */}
          {tech && tech.length > 0 && (
            <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
              {tech.map((t, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full text-xs font-mono backdrop-blur-md bg-cyan-500/30 text-cyan-700 border border-cyan-500/50"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Terminal prompt indicator */}
          <div
            className={`absolute top-4 right-4 font-mono text-sm transition-all duration-500 ${
              isHovered ? "opacity-100 scale-110" : "opacity-60"
            } text-green-600`}
          >
            <span className="animate-pulse">&gt;_</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <h1
            className="text-2xl laptop:text-3xl font-bold mb-3 transition-all duration-300 text-slate-900 group-hover:text-cyan-600"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {name ? `> ${name}` : "> Project Name"}
          </h1>

          <p
            className="text-base laptop:text-lg leading-relaxed text-slate-600 group-hover:text-slate-700 transition-colors duration-300"
          >
            {description ? description : "Description"}
          </p>

          {/* Hover indicator */}
          <div
            className={`mt-4 flex items-center gap-2 font-mono text-sm transition-all duration-300 ${
              isHovered ? "translate-x-2 opacity-100" : "translate-x-0 opacity-0"
            } text-cyan-600`}
          >
            <span>View Project</span>
            <span className="animate-pulse">→</span>
          </div>
        </div>

        {/* Glow effect */}
        <div
          className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 -z-10"
        />
      </div>
    </div>
  );
};

export default WorkCard;

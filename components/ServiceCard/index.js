import React, { useState } from "react";

const ServiceCard = ({ name, description, dates, location, logo }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="relative group">
      {/* Timeline connector line */}
      <div
        className="absolute left-6 top-0 w-0.5 h-full bg-slate-300 group-hover:bg-gradient-to-b group-hover:from-cyan-500 group-hover:to-purple-500 transition-all duration-500"
      />

      {/* Timeline dot */}
      <div className="absolute left-3.5 top-8 w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 border-4 border-white z-10 group-hover:scale-125 group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-all duration-300" />

      {/* Card */}
      <div
        className="relative ml-16 mb-8 p-6 rounded-2xl transition-all ease-out duration-500 link cursor-pointer backdrop-blur-md bg-white/80 hover:bg-white/90 border-slate-200/50 border hover:border-cyan-500/50 hover:shadow-2xl"
        style={{
          transform: isHovered ? "translateX(10px)" : "none",
          boxShadow: isHovered
            ? "0 10px 40px -10px rgba(6, 182, 212, 0.2)"
            : "none",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Logo/Icon */}
        <div className="flex items-start gap-4 mb-4">
          {logo && (
            <div
              className={`text-4xl transition-all duration-300 ${
                isHovered ? "scale-125 rotate-12" : ""
              }`}
            >
              {logo}
            </div>
          )}

          <div className="flex-1">
            {/* Company name with terminal prompt */}
            <h1
              className="text-2xl laptop:text-3xl font-bold transition-all duration-300 text-slate-900 group-hover:text-cyan-600"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {name ? `$ ${name}` : "$ Company"}
            </h1>

            {/* Date and location */}
            {(dates || location) && (
              <div className="mt-2 flex flex-wrap gap-3 text-sm font-mono text-slate-600">
                {dates && (
                  <span className="px-3 py-1 rounded-full backdrop-blur-sm bg-cyan-500/10 text-cyan-600 border border-cyan-500/30">
                    📅 {dates}
                  </span>
                )}
                {location && (
                  <span className="px-3 py-1 rounded-full backdrop-blur-sm bg-purple-500/10 text-purple-600 border border-purple-500/30">
                    📍 {location}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-base laptop:text-lg leading-relaxed transition-colors duration-300 text-slate-600 group-hover:text-slate-700">
          {description
            ? description
            : "Description of experience and achievements..."}
        </p>

        {/* Terminal cursor indicator */}
        <div
          className={`mt-4 font-mono text-sm transition-all duration-300 ${
            isHovered ? "opacity-100" : "opacity-0"
          } text-green-600`}
        >
          <span className="animate-pulse">&gt;_</span>
        </div>

        {/* Hover glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-2xl blur-xl opacity-0 group-hover:opacity-10 transition-opacity duration-500 -z-10" />

        {/* Animated gradient border on hover */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-10 animate-gradient-xy" />
        </div>
      </div>
    </div>
  );
};

export default ServiceCard;

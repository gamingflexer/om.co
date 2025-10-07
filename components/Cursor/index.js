import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const Cursor = () => {
  const theme = useTheme();
  const [mount, setMount] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const getCusomColor = () => {
    return "#0891b2"; // Cyan-600 for light theme
  };

  useEffect(() => {
    setMount(true);

    const updatePosition = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseOver = (e) => {
      if (e.target.closest('.link')) {
        setIsHovering(true);
      }
    };

    const handleMouseOut = (e) => {
      if (!e.target.closest('.link')) {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', updatePosition);
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);

    return () => {
      window.removeEventListener('mousemove', updatePosition);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
    };
  }, []);

  if (!mount) return null;

  return (
    <div
      className="custom-cursor"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: isHovering ? '60px' : '30px',
        height: isHovering ? '60px' : '30px',
        borderRadius: '50%',
        backgroundColor: getCusomColor(),
        opacity: isHovering ? 0.5 : 0.3,
        pointerEvents: 'none',
        transform: 'translate(-50%, -50%)',
        transition: 'width 0.1s, height 0.1s, opacity 0.2s',
        zIndex: 9999,
        mixBlendMode: 'difference'
      }}
    />
  );
};

export default Cursor;

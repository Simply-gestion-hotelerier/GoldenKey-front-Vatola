// LoadingScreen.jsx
import React, { useEffect, useState } from "react";
import logo from "/logo_s.png";

const LoadingScreen = ({ onLoaded }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Durée totale du chargement
    const duration = 100; // 6 secondes
    const steps = 100;
    const intervalTime = duration / steps;
    let current = 0;

    const interval = setInterval(() => {
      current += 1;
      setProgress(current);

      if (current >= 100) {
        clearInterval(interval);
        if (onLoaded) onLoaded(); // appel quand terminé
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [onLoaded]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-900 text-white z-50">
      <div className="flex flex-col items-center justify-center leading-none">
        <img
          src={logo}
          alt="Logo"
          className="w-[300px] h-[300px] object-contain"
        />

        <div className="w-72 h-4 bg-gray-700 rounded-full overflow-hidden shadow-inner mt-2">
          <div
            className="h-full transition-all duration-75"
            style={{
              width: `${progress}%`,
              backgroundColor: "#b45714", // couleur or/marron
            }}
          ></div>
        </div>
      </div>

      <p className="mt-3 text-gray-400 text-sm animate-pulse">
        Chargement en cours...
      </p>
    </div>
  );
};

export default LoadingScreen;

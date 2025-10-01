// src/pages/InstrumentPage.jsx
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import LogoWithText from "./LogoWithText"; // Import the logo component

const levels = ["beginner", "intermediate", "advanced"];

const InstrumentPage = () => {
  const { instrument } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-200 via-pink-100 to-yellow-50 p-6 font-sans">
      {/* Fixed Logo at Top Left like HomePage */}
      <div className="fixed top-4 left-4 z-50">
        <LogoWithText />
      </div>

      <div className="bg-white/30 backdrop-blur-lg rounded-2xl shadow-xl p-10 max-w-lg w-full border border-white/40 mt-10">
        <h2 className="text-4xl font-extrabold text-fuchsia-700 mb-6 drop-shadow-md tracking-wide">
          {instrument.charAt(0).toUpperCase() + instrument.slice(1)}
        </h2>
        <h3 className="text-xl font-semibold text-purple-800 mb-4">Select Your Level 🎧</h3>

        <div className="flex flex-col gap-4">
          {levels.map((lvl) => (
            <button
              key={lvl}
              onClick={() => navigate(`/instrument/${instrument}/${lvl}`)}
              className="relative px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-green-400 via-blue-400 to-purple-500 hover:from-purple-400 hover:to-pink-500 shadow-md transition-all duration-300 ease-in-out transform hover:scale-105"
            >
              <span className="drop-shadow-sm text-lg tracking-wider">
                {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
              </span>
              <span className="absolute top-0 right-0 w-3 h-3 bg-white rounded-full shadow-lg animate-ping opacity-70" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InstrumentPage;

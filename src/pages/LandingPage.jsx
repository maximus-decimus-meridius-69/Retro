import React from "react";
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-700 text-white px-4">
      <div className="text-center space-y-6">
        <h1 className="text-6xl md:text-7xl font-extrabold drop-shadow-lg animate-fade-in-up">
          🎶 Welcome to <span className="text-yellow-300">InstruMentor</span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-200 max-w-xl mx-auto animate-fade-in-up delay-200">
          Your personal guide to mastering musical instruments — one note at a time 🎸🥁🎹
        </p>

        <div className="flex justify-center gap-6 mt-8 animate-fade-in-up delay-400">
          <button
            className="bg-yellow-400 hover:bg-yellow-300 text-black font-semibold px-6 py-3 rounded-lg shadow-md transition-transform transform hover:scale-105"
            onClick={() => navigate("/login")}
          >
            Login
          </button>
          <button
            className="bg-white hover:bg-gray-200 text-indigo-900 font-semibold px-6 py-3 rounded-lg shadow-md transition-transform transform hover:scale-105"
            onClick={() => navigate("/signup")}
          >
            Sign Up
          </button>
        </div>

        <p className="mt-12 text-sm text-gray-300 italic">
          🎧 Learn. Play. Grow. — With InstruMentor
        </p>
      </div>
    </div>
  );
};

export default LandingPage;

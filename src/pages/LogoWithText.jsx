// src/components/LogoWithText.jsx
import React from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png"; // adjust if you put it elsewhere

const LogoWithText = () => {
  return (
    <Link to="/" className="flex items-center gap-2 group">
      <img src={logo} alt="InstruMentor Logo" className="h-16 w-16" />
      <h1 className="text-3xl font-extrabold tracking-wide text-purple-800 group-hover:text-indigo-600 transition duration-200">
        InstruMentor
      </h1>
    </Link>
  );
};

export default LogoWithText;

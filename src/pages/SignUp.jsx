import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, googleProvider } from "../firebase";
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";

const SignUp = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const q = query(collection(db, "users"), where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setError("This account is already registered. Please log in.");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      await addDoc(collection(db, "users"), {
        uid: userCredential.user.uid,
        email,
      });

      navigate("/home");
    } catch {
      setError("Failed to create an account. Try again.");
    }
  };

  const handleGoogleSignUp = async () => {
    setError("");

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userEmail = result.user.email;

      const q = query(collection(db, "users"), where("email", "==", userEmail));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setError("This account is already registered. Please log in.");
        return;
      }

      await addDoc(collection(db, "users"), {
        uid: result.user.uid,
        email: userEmail,
      });

      navigate("/home");
    } catch {
      setError("Google Sign-Up failed. Try again.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-100 to-purple-200">
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-center mb-6 text-indigo-700">Create an Account</h2>

        {error && <p className="text-red-500 mb-4 text-sm text-center">{error}</p>}

        <form onSubmit={handleSignUp} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full p-2 border rounded focus:outline-none focus:ring focus:border-indigo-400"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full p-2 border rounded focus:outline-none focus:ring focus:border-indigo-400"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition duration-200"
          >
            Sign Up
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-500">or</div>

        <button
          onClick={handleGoogleSignUp}
          className="mt-4 w-full bg-red-500 text-white py-2 rounded hover:bg-red-600 transition duration-200"
        >
          Sign Up with Google
        </button>

        <p className="mt-6 text-sm text-center text-gray-600">
          Already have an account?{" "}
          <a href="/login" className="text-indigo-600 hover:underline">
            Login
          </a>
        </p>
      </div>
    </div>
  );
};

export default SignUp;

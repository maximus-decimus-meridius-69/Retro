import React, { useLayoutEffect, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import LogoWithText from "../pages/LogoWithText";

// Import instrument images
import drumsImg from "../assets/photos/drums.png";
import fluteImg from "../assets/photos/flute.png";
import guitarImg from "../assets/photos/guitar.png";
import tablaImg from "../assets/photos/tabla.png";
import harmoniumImg from "../assets/photos/harmonium.png";
import saxophoneImg from "../assets/photos/saxophone.png";
import keyboardImg from "../assets/photos/keyboard.png";
import violinImg from "../assets/photos/violin.png";

// Import audio files
import drumsAudio from "../assets/audio/drums.mp3";
import fluteAudio from "../assets/audio/flute.mp3";
import guitarAudio from "../assets/audio/guitar.mp3";
import tablaAudio from "../assets/audio/tabla.wav";
import harmoniumAudio from "../assets/audio/harmonium.wav";
import saxophoneAudio from "../assets/audio/saxophone.wav";
import keyboardAudio from "../assets/audio/keyboard.wav";
import violinAudio from "../assets/audio/violin.mp3";

// Array of instruments with images and audio paths
const instruments = [
  {
    name: "drums",
    image: drumsImg,
    virtualLink:
      "https://www.sessiontown.com/en/music-games-apps/virtual-instrument-play-drums-online",
    audio: drumsAudio,
  },
  {
    name: "flute",
    image: fluteImg,
    virtualLink: "https://www.virtualmusicalinstruments.com/flute",
    audio: fluteAudio,
  },
  {
    name: "guitar",
    image: guitarImg,
    virtualLink: "https://www.musicca.com/guitar",
    audio: guitarAudio,
  },
  {
    name: "tabla",
    image: tablaImg,
    virtualLink: "https://artiumacademy.com/tools/tabla",
    audio: tablaAudio,
  },
  {
    name: "harmonium",
    image: harmoniumImg,
    virtualLink: "https://music-tools.spardhaschoolofmusic.com/harmonium",
    audio: harmoniumAudio,
  },
  {
    name: "saxophone",
    image: saxophoneImg,
    virtualLink: "https://www.trumpetfingering.com/virtual-saxophone",
    audio: saxophoneAudio,
  },
  {
    name: "keyboard",
    image: keyboardImg,
    virtualLink:
      "https://www.sessiontown.com/en/music-games-apps/online-virtual-keyboard-piano",
    audio: keyboardAudio,
  },
  {
    name: "violin",
    image: violinImg,
    virtualLink: "https://www.ecarddesignanimation.com/home/violin_html5.php",
    audio: violinAudio,
  },
];

const HomePage = () => {
  const navigate = useNavigate();
  const headerRef = useRef(null);
  const cardRefs = useRef([]);
  const audioRefs = useRef({}); // Lazily created audio elements

  useLayoutEffect(() => {
    cardRefs.current = cardRefs.current.slice(0, instruments.length);

    const ctx = gsap.context(() => {
      gsap.fromTo(
        headerRef.current,
        { autoAlpha: 0, y: -20 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
          force3D: true,
        }
      );

      gsap.fromTo(
        cardRefs.current,
        { autoAlpha: 0, y: 24 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.1,
          ease: "power2.out",
          force3D: true,
        }
      );
    });

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    // Stop all audio on component unmount
    return () => {
      const currentAudioRefs = audioRefs.current;
      Object.values(currentAudioRefs).forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
    };
  }, []);

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-yellow-50 via-pink-100 to-purple-200 font-sans">
      {/* Header */}
      <div
        ref={headerRef}
        className="flex justify-between items-center mb-10 opacity-0 -translate-y-10 w-full"
      >
        <div className="cursor-pointer" onClick={() => navigate("/")}>
          <LogoWithText />
        </div>

        {/* Desktop Buttons */}
        <div className="hidden sm:flex gap-4 flex-wrap justify-end items-center">
          <button
            onClick={() => navigate("/audio-rooms")}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg shadow transition"
          >
            🎤 Audio Rooms
          </button>
          <button
            onClick={() => navigate("/social-feed")}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow transition"
          >
            🌟 Social Feed
          </button>
          <button
            onClick={() => navigate("/courses")}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg shadow transition"
          >
            📚 Courses
          </button>
          <button
            onClick={() => navigate("/add-resource")}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-lg shadow transition"
          >
            + Add Resource
          </button>
          <button
            onClick={() => navigate("/manage-resources")}
            className="bg-white border border-purple-600 text-purple-700 hover:bg-purple-50 font-medium px-4 py-2 rounded-lg shadow"
          >
            Manage Resources
          </button>
          <button
            onClick={() => navigate("/profile")}
            className="bg-white border border-purple-600 text-purple-700 hover:bg-purple-50 font-medium px-4 py-2 rounded-lg shadow"
          >
            Profile
          </button>

        </div>
      </div>

      {/* Mobile Buttons */}
      <div className="flex gap-4 flex-wrap justify-center mb-6 sm:hidden">
        <button
          onClick={() => navigate("/audio-rooms")}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg shadow transition w-full"
        >
          🎤 Audio Rooms
        </button>
        <button
          onClick={() => navigate("/social-feed")}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow transition w-full"
        >
          🌟 Social Feed
        </button>
        <button
          onClick={() => navigate("/courses")}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg shadow transition w-full"
        >
          📚 Courses
        </button>
        <button
          onClick={() => navigate("/add-resource")}
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-lg shadow transition w-full"
        >
          + Add Resource
        </button>
        <button
          onClick={() => navigate("/manage-resources")}
          className="bg-white border border-purple-600 text-purple-700 hover:bg-purple-50 font-medium px-4 py-2 rounded-lg shadow w-full"
        >
          Manage Resources
        </button>
        <button
          onClick={() => navigate("/profile")}
          className="bg-white border border-purple-600 text-purple-700 hover:bg-purple-50 font-medium px-4 py-2 rounded-lg shadow w-full"
        >
          Profile
        </button>

      </div>

      {/* Instrument Grid */}
      <div>
        <h2 className="text-3xl font-extrabold text-purple-700 mb-6">
          🎵 Choose Your Instrument
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {instruments.map((instrument, index) => {
            const handleMouseEnter = () => {
              if (!audioRefs.current[instrument.name]) {
                const audio = new Audio(instrument.audio);
                audio.preload = "auto";
                audioRefs.current[instrument.name] = audio;
              }
              const audio = audioRefs.current[instrument.name];
              audio.currentTime = 0;
              audio.play().catch(() => {});
            };

            const handleMouseLeave = () => {
              const audio = audioRefs.current[instrument.name];
              if (audio) {
                audio.pause();
                audio.currentTime = 0;
              }
            };

            return (
              <div
                key={instrument.name}
                ref={(el) => (cardRefs.current[index] = el)}
                className="opacity-0 translate-y-6 bg-white bg-opacity-70 backdrop-blur-md rounded-2xl shadow-md hover:shadow-lg transition duration-300 cursor-pointer transform hover:scale-[1.02]"
                onClick={() => navigate(`/instrument/${instrument.name}`)}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <div className="bg-purple-100 h-40 sm:h-48 md:h-56 lg:h-64 flex items-center justify-center rounded-t-2xl overflow-hidden">
                  <img
                    src={instrument.image}
                    alt={instrument.name}
                    className="h-full object-contain p-4"
                  />
                </div>
                <div className="p-5" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold capitalize text-gray-800 mb-2">
                    {instrument.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Explore resources and start learning
                  </p>
                  <button
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-lg shadow transition"
                    onClick={() =>
                      window.open(
                        instrument.virtualLink,
                        "_blank"
                      )
                    }
                  >
                    Try Virtual {instrument.name.charAt(0).toUpperCase() + instrument.name.slice(1)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HomePage;

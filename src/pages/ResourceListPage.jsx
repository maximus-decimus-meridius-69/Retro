import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db, rtdb, auth } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { ref, onValue, push } from "firebase/database";
import { toggleField } from "../lib/userInteractions";
import {
  FaThumbsUp,
  FaThumbsDown,
  FaBookmark,
  FaRegBookmark,
} from "react-icons/fa";
import { BsFillCheckCircleFill } from "react-icons/bs";
import { MdComment } from "react-icons/md";
import { Link } from "react-router-dom";
import LogoWithText from "./LogoWithText";

const types = ["video", "journal", "pdf", "course"];

const ResourceListPage = () => {
  const { instrument, level } = useParams();
  const [resources, setResources] = useState([]);
  const [interactions, setInteractions] = useState({});
  const [allInteractions, setAllInteractions] = useState({});
  const [commentsMap, setCommentsMap] = useState({});
  const [filterType, setFilterType] = useState("all");
  const [commentText, setCommentText] = useState({});
  const [showComments, setShowComments] = useState({});

  // Fetching resources from Firestore
  useEffect(() => {
    const fetchResources = async () => {
      try {
        // Ensure instrument and level are valid strings
        const instrumentKey = instrument?.toLowerCase();
        const levelKey = level?.toLowerCase();

        if (!instrumentKey || !levelKey) {
          console.error("Invalid instrument or level parameters.");
          return;
        }

        console.log("Querying resources with:", instrumentKey, levelKey);

        const q = query(
          collection(db, "resources"),
          where("instrument", "==", instrumentKey),
          where("level", "==", levelKey)
        );

        const snap = await getDocs(q);

        if (snap.empty) {
          console.warn("No matching resources found for:", instrumentKey, levelKey);
          setResources([]);
          return;
        }

        const sorted = snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) =>
            a.title.localeCompare(b.title, undefined, {
              numeric: true,
              sensitivity: "base",
            })
          );

        setResources(sorted);
      } catch (err) {
        console.error("Error fetching resources:", err);
      }
    };

    fetchResources();
  }, [instrument, level]);

  // Fetch user interactions
  useEffect(() => {
    const path = `userInteractions/${auth.currentUser.uid}/${instrument}`;
    const unsub = onValue(ref(rtdb, path), (snap) => {
      setInteractions(snap.val() || {});
    });
    return () => unsub();
  }, [instrument]);

  // Fetch all user interactions
  useEffect(() => {
    const unsubAll = onValue(ref(rtdb, "userInteractions"), (snap) => {
      setAllInteractions(snap.val() || {});
    });
    return () => unsubAll();
  }, []);

  // Fetch comments for each resource
  useEffect(() => {
    const unsubs = [];
    resources.forEach((res) => {
      const cRef = ref(rtdb, `comments/${instrument}/${res.id}`);
      const unsub = onValue(cRef, (snap) => {
        const val = snap.val();
        setCommentsMap((prev) => ({
          ...prev,
          [res.id]: val
            ? Object.entries(val).map(([id, data]) => ({ id, ...data }))
            : [],
        }));
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach((u) => u());
  }, [resources, instrument]);

  // Toggle interactions (upvote/downvote/bookmark)
  const handleToggle = (resId, field) => {
    const resInter = interactions[resId] || {};
    if (field === "upvoted" && resInter.downvoted) {
      toggleField(instrument, resId, "downvoted");
    } else if (field === "downvoted" && resInter.upvoted) {
      toggleField(instrument, resId, "upvoted");
    }
    toggleField(instrument, resId, field);
  };

  // Post a new comment
  const handlePostComment = (resId) => {
    const text = commentText[resId];
    if (!text) return;
    const cRef = ref(rtdb, `comments/${instrument}/${resId}`);
    push(cRef, {
      userName: auth.currentUser.displayName || auth.currentUser.email,
      text,
      timestamp: Date.now(),
    });
    setCommentText((m) => ({ ...m, [resId]: "" }));
  };

  // Toggle comments visibility for a resource
  const toggleCommentsForResource = (resId) => {
    setShowComments((prev) => ({ ...prev, [resId]: !prev[resId] }));
  };

  // Count upvotes, downvotes, or bookmarks for a resource
  const countField = (resId, field) => {
    let count = 0;
    Object.values(allInteractions).forEach((userMap) => {
      const instrMap = userMap[instrument] || {};
      if (instrMap[resId]?.[field]) count++;
    });
    return count;
  };

  // Filter resources based on selected filter type
  const filtered =
    filterType === "all"
      ? resources
      : resources.filter((r) => r.resourceType === filterType);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-8 font-sans">
      <div className="mb-6 w-fit">
        <Link to="/" className="inline-block">
          <LogoWithText />
        </Link>
      </div>

      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-purple-700 drop-shadow-md mb-2">
          {instrument.charAt(0).toUpperCase() + instrument.slice(1)} —{" "}
          {level.charAt(0).toUpperCase() + level.slice(1)}
        </h2>
        <p className="text-lg text-gray-700">Pick your vibe and dive in 🎶</p>
      </div>

      <div className="mb-6 flex justify-center">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="p-3 rounded-lg shadow-md border bg-white text-purple-600 focus:ring-2 focus:ring-purple-300"
        >
          <option value="all">All Types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 max-w-4xl mx-auto">
        {filtered.map((res) => {
          const inter = interactions[res.id] || {};
          const comments = commentsMap[res.id] || [];
          const isVisible = showComments[res.id] || false;

          return (
            <div
              key={res.id}
              className="bg-white/60 backdrop-blur-lg p-6 rounded-3xl shadow-xl border border-purple-200 hover:shadow-2xl transition duration-300 will-change-transform"
            >
              <a
                href={res.link}
                target="_blank"
                rel="noreferrer"
                className="text-2xl font-semibold text-blue-700 hover:underline"
              >
                {res.title}
              </a>
              <p className="text-sm text-gray-600 mt-1">
                Type: {res.resourceType}
              </p>

              <div className="flex flex-wrap items-center gap-4 mt-4 text-lg">
                <button
                  onClick={() => handleToggle(res.id, "upvoted")}
                  className={`transition transform hover:scale-110 duration-150 flex items-center gap-1 will-change-transform ${
                    inter.upvoted ? "text-blue-600" : "text-gray-700"
                  }`}
                >
                  <FaThumbsUp size={18} />
                  <span className="text-sm">{countField(res.id, "upvoted")}</span>
                </button>

                <button
                  onClick={() => handleToggle(res.id, "downvoted")}
                  className={`transition transform hover:scale-110 duration-150 flex items-center gap-1 will-change-transform ${
                    inter.downvoted ? "text-red-600" : "text-gray-700"
                  }`}
                >
                  <FaThumbsDown size={18} />
                  <span className="text-sm">
                    {countField(res.id, "downvoted")}
                  </span>
                </button>

                <button
                  onClick={() => handleToggle(res.id, "bookmarked")}
                  className={`transition transform hover:scale-110 duration-150 flex items-center gap-1 will-change-transform ${
                    inter.bookmarked ? "text-yellow-500" : "text-gray-700"
                  }`}
                >
                  {inter.bookmarked ? (
                    <FaBookmark size={18} />
                  ) : (
                    <FaRegBookmark size={18} />
                  )}
                  <span className="text-sm">
                    {countField(res.id, "bookmarked")}
                  </span>
                </button>

                <label className="inline-flex items-center gap-1 cursor-pointer text-gray-700 hover:scale-105 transition-transform will-change-transform">
                  <BsFillCheckCircleFill
                    className={`${
                      inter.progress ? "text-green-500" : "text-gray-400"
                    } transition-colors`}
                    size={18}
                  />
                  <input
                    type="checkbox"
                    checked={!!inter.progress}
                    onChange={() => handleToggle(res.id, "progress")}
                    className="hidden"
                  />
                  <span className="text-sm">Done</span>
                </label>

                <button
                  onClick={() => toggleCommentsForResource(res.id)}
                  className="transition transform hover:scale-110 duration-150 text-blue-500 hover:text-blue-700 flex items-center gap-1 will-change-transform"
                >
                  <MdComment size={20} />
                  <span className="text-sm">{comments.length}</span>
                </button>
              </div>

              {isVisible && (
                <div className="mt-5">
                  {comments.length > 0 ? (
                    <ul className="space-y-2 text-gray-800 mb-2">
                      {comments.map((c) => (
                        <li key={c.id}>
                          <span className="font-semibold">{c.userName}:</span>{" "}
                          {c.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 mb-2">No comments yet.</p>
                  )}

                  <textarea
                    className="w-full p-2 border rounded-lg mb-2 bg-white shadow-inner focus:ring-2 focus:ring-purple-300"
                    placeholder="Write something soulful..."
                    value={commentText[res.id] || ""}
                    onChange={(e) =>
                      setCommentText((m) => ({
                        ...m,
                        [res.id]: e.target.value,
                      }))
                    }
                  />
                  <button
                    onClick={() => handlePostComment(res.id)}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg shadow hover:scale-105 transition-transform"
                  >
                    Post Comment
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResourceListPage;

import React, { useEffect, useState, useRef } from "react";
import { ref, onValue, remove } from "firebase/database";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { auth, db, rtdb, storage } from "../firebase";
import { signOut, updateProfile } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  Bookmark,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  Music,
  Clock,
  BarChart2,
  MessageCircle,
  Camera,
  User,
  Home,
} from "lucide-react";

const instruments = [
  "drums",
  "flute",
  "guitar",
  "tabla",
  "harmonium",
  "saxophone",
  "keyboard",
  "violin",
];

const ProfilePage = () => {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;
  const [interactions, setInteractions] = useState({});
  const [resourcesById, setResourcesById] = useState({});
  const [allResources, setAllResources] = useState({});
  const [userComments, setUserComments] = useState([]);
  const [activeTab, setActiveTab] = useState("bookmarked");
  const [profilePic, setProfilePic] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setTimeout(() => {
        navigate("/");
      }, 100);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  useEffect(() => {
    if (!uid) return;
    const unsub = onValue(ref(rtdb, "userInteractions/" + uid), (snap) => {
      setInteractions(snap.val() || {});
    });
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (auth.currentUser?.photoURL) {
      setProfilePic(auth.currentUser.photoURL);
    } else {
      const fetchProfilePic = async () => {
        try {
          const userDoc = await getDoc(doc(db, "users", uid));
          if (userDoc.exists() && userDoc.data().profilePic) {
            setProfilePic(userDoc.data().profilePic);
          }
        } catch (error) {
          console.error("Error fetching profile pic:", error);
        }
      };
      if (uid) fetchProfilePic();
    }
  }, [uid]);

  useEffect(() => {
    const fetchAll = async () => {
      const grouped = {};
      for (const inst of instruments) {
        const q = query(
          collection(db, "resources"),
          where("instrument", "==", inst)
        );
        const snap = await getDocs(q);
        const byLevel = { beginner: [], intermediate: [], advanced: [] };
        snap.forEach((d) => {
          const data = d.data();
          const lvl = data.level.toLowerCase();
          if (byLevel[lvl])
            byLevel[lvl].push({ id: d.id, ...data });
        });
        grouped[inst] = byLevel;
      }
      setAllResources(grouped);
    };
    fetchAll();
  }, []);

  useEffect(() => {
    const fetchById = async () => {
      const fetched = {};
      for (const inst of Object.keys(interactions)) {
        for (const resId of Object.keys(interactions[inst] || {})) {
          if (!fetched[resId]) {
            const snap = await getDoc(doc(db, "resources", resId));
            if (snap.exists()) fetched[resId] = { id: resId, ...snap.data() };
          }
        }
      }
      setResourcesById(fetched);
    };
    if (Object.keys(interactions).length) fetchById();
  }, [interactions]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const fetchComments = async () => {
      const comments = [];
      for (const inst of Object.keys(interactions)) {
        for (const resId of Object.keys(interactions[inst] || {})) {
          await new Promise((resolve) => {
            const commentRef = ref(rtdb, "comments/" + inst + "/" + resId);
            onValue(
              commentRef,
              (snap) => {
                const data = snap.val() || {};
                Object.entries(data).forEach(([commentId, c]) => {
                  if (
                    c.userName === auth.currentUser.displayName ||
                    c.userName === auth.currentUser.email
                  ) {
                    comments.push({
                      ...c,
                      commentId,
                      resId,
                      instrument: inst,
                      level: resourcesById[resId]?.level?.toLowerCase(),
                    });
                  }
                });
                resolve();
              },
              { onlyOnce: true }
            );
          });
        }
      }
      setUserComments(comments);
    };
    fetchComments();
  }, [interactions, resourcesById]);

  const handleProfilePicClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      alert("Please select an image file (JPEG, PNG, or GIF)");
      return;
    }

    try {
      setUploading(true);
      const imageRef = storageRef(storage, "profilePics/" + uid);
      await uploadBytes(imageRef, file);
      const downloadUrl = await getDownloadURL(imageRef);
      await updateProfile(auth.currentUser, {
        photoURL: downloadUrl,
      });
      await updateDoc(doc(db, "users", uid), {
        profilePic: downloadUrl,
      });
      setProfilePic(downloadUrl);
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const getFiltered = (field) => {
    const grouped = {};
    Object.entries(interactions).forEach(([inst, resMap]) => {
      Object.entries(resMap).forEach(([resId, data]) => {
        if (data[field] && resourcesById[resId]) {
          grouped[inst] = grouped[inst] || [];
          grouped[inst].push(resourcesById[resId]);
        }
      });
    });
    return grouped;
  };

  const renderResourceCard = (resource) => (
    <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-full">
      <div className="p-4 pb-2 flex-grow">
        <h3 className="font-medium mb-1 text-gray-800">{resource.title}</h3>
        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
          {resource.resourceType}
        </span>
      </div>
      <div className="p-4 pt-0">
        <a
          href={resource.link}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-purple-600 hover:text-purple-800 font-medium hover:underline"
        >
          View Resource →
        </a>
      </div>
    </div>
  );

  const renderResourceSection = (title, data, icon) => {
    const isEmpty = Object.keys(data).length === 0;
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          {icon}
          <span className="ml-2">{title}</span>
        </h2>
        {isEmpty ? (
          <p className="text-gray-500 italic">No resources found.</p>
        ) : (
          Object.entries(data).map(([inst, items]) => (
            <div key={inst} className="mb-5">
              <h3 className="text-lg text-purple-700 font-medium capitalize mb-3">
                {inst}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((res) => (
                  <div key={res.id}>{renderResourceCard(res)}</div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderProgress = () => {
    const completedCounts = instruments
      .map((inst) => {
        const resMap = interactions[inst] || {};
        const total = Object.values(allResources[inst] || {}).reduce(
          (sum, arr) => sum + arr.length,
          0
        );
        const completedIds = Object.entries(resMap)
          .filter(([, d]) => d.progress)
          .map(([resId]) => resId);
        const completedCount = completedIds.length;
        const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

        return {
          instrument: inst,
          completed: completedCount,
          total,
          percent,
        };
      })
      .filter((item) => item.total > 0);

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          <span>Learning Progress</span>
        </h2>
        <div className="space-y-5">
          {completedCounts.map((item) => (
            <div key={item.instrument} className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="capitalize text-gray-700 font-medium">
                  {item.instrument}
                </span>
                <span className="text-gray-600">{item.percent}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full">
                <div
                  className="h-2 bg-purple-600 rounded-full"
                  style={{ width: item.percent + "%" }}
                ></div>
              </div>
              <p className="mt-1 text-xs text-gray-500 text-right">
                {item.completed} of {item.total} resources completed
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderComments = () => {
    const grouped = {};
    userComments.forEach((c) => {
      const res = resourcesById[c.resId];
      if (!res) return;
      grouped[c.instrument] = grouped[c.instrument] || {};
      const lvl = res.level.toLowerCase();
      grouped[c.instrument][lvl] = grouped[c.instrument][lvl] || [];
      grouped[c.instrument][lvl].push(c);
    });

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <MessageCircle className="w-5 h-5 mr-2" />
          <span>Your Comments</span>
        </h2>
        {userComments.length === 0 ? (
          <p className="text-gray-500 italic">No comments yet.</p>
        ) : (
          Object.entries(grouped).map(([inst, levelsMap]) => (
            <div key={inst} className="mb-6">
              <h3 className="text-lg text-purple-700 capitalize mb-3">{inst}</h3>
              {Object.entries(levelsMap).map(([lvl, comments]) => (
                <div key={lvl} className="mb-4">
                  <h4 className="capitalize text-gray-600 font-medium mb-2">
                    {lvl}
                  </h4>
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <div
                        key={c.commentId}
                        className="bg-gray-50 p-3 rounded-lg border border-gray-100"
                      >
                        <div className="flex justify-between">
                          <div className="text-gray-800">{c.text}</div>
                          <button
                            onClick={() =>
                              remove(
                                ref(
                                  rtdb,
                                  "comments/" +
                                    c.instrument +
                                    "/" +
                                    c.resId +
                                    "/" +
                                    c.commentId
                                )
                              )
                            }
                            className="text-red-500 text-sm hover:text-red-700 ml-3"
                          >
                            Delete
                          </button>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          On: {resourcesById[c.resId]?.title || c.resId}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-800 py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="relative">
                <div
                  className="bg-white h-20 w-20 rounded-full flex items-center justify-center mr-5 overflow-hidden cursor-pointer group relative"
                  onClick={handleProfilePicClick}
                >
                  {profilePic ? (
                    <img
                      src={profilePic}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-10 w-10 text-purple-300" />
                  )}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all">
                    <Camera className="text-white opacity-0 group-hover:opacity-100 h-8 w-8" />
                  </div>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {auth.currentUser?.displayName ||
                    auth.currentUser?.email ||
                    "Music Enthusiast"}
                </h1>
                <p className="text-purple-200">
                  Joined{" "}
                  {new Date(
                    auth.currentUser?.metadata?.creationTime
                  ).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Back + Sign Out Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate("/")}
                className="bg-white text-purple-700 hover:bg-gray-100 px-4 py-2 rounded-lg shadow font-medium flex items-center"
              >
                <Home className="h-4 w-4 mr-2" />
                Back to Home
              </button>
              <button
                onClick={handleSignOut}
                className="bg-white text-purple-700 hover:bg-gray-100 px-4 py-2 rounded-lg shadow font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and Content */}
      <div className="max-w-6xl mx-auto py-8 px-6">
        <div className="flex mb-6 overflow-x-auto">
          {[
            {
              key: "bookmarked",
              label: "Bookmarked",
              icon: <Bookmark className="w-4 h-4 mr-2" />,
            },
            {
              key: "upvoted",
              label: "Upvoted",
              icon: <ThumbsUp className="w-4 h-4 mr-2" />,
            },
            {
              key: "downvoted",
              label: "Downvoted",
              icon: <ThumbsDown className="w-4 h-4 mr-2" />,
            },
            {
              key: "progress",
              label: "Progress",
              icon: <BarChart2 className="w-4 h-4 mr-2" />,
            },
            {
              key: "comments",
              label: "Comments",
              icon: <MessageCircle className="w-4 h-4 mr-2" />,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={
                activeTab === tab.key
                  ? "flex items-center px-4 py-2 mr-2 font-medium rounded-lg bg-purple-600 text-white"
                  : "flex items-center px-4 py-2 mr-2 font-medium rounded-lg bg-white text-gray-600 hover:bg-gray-50"
              }
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "bookmarked" &&
          renderResourceSection(
            "Bookmarked Resources",
            getFiltered("bookmarked"),
            <Bookmark className="w-5 h-5" />
          )}
        {activeTab === "upvoted" &&
          renderResourceSection(
            "Upvoted Resources",
            getFiltered("upvoted"),
            <ThumbsUp className="w-5 h-5" />
          )}
        {activeTab === "downvoted" &&
          renderResourceSection(
            "Downvoted Resources",
            getFiltered("downvoted"),
            <ThumbsDown className="w-5 h-5" />
          )}
        {activeTab === "progress" && renderProgress()}
        {activeTab === "comments" && renderComments()}
      </div>
    </div>
  );
};

export default ProfilePage;

// src/firebase.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  writeBatch
} from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getDatabase } from "firebase/database"; // ✅ Import Realtime Database

// Firebase config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const rtdb = getDatabase(app); // ✅ Initialize RTDB

// Auth providers
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Auth functions
const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
const signInWithEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
const signUpWithEmail = (email, password) => createUserWithEmailAndPassword(auth, email, password);
const logout = () => signOut(auth);

// Firestore helper functions
const addResource = async (data) => {
  const docRef = await addDoc(collection(db, "resources"), data);
  return docRef.id;
};

const updateResource = async (id, updatedData) => {
  const resourceRef = doc(db, "resources", id);
  await updateDoc(resourceRef, updatedData);
};

const deleteResource = async (id) => {
  const resourceRef = doc(db, "resources", id);
  await deleteDoc(resourceRef);
};

const getResourcesByInstrumentAndLevel = async (instrument, level) => {
  const q = query(
    collection(db, "resources"),
    where("instrument", "==", instrument),
    where("level", "==", level)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Social Network helper functions
const createUserProfile = async (userId, userData) => {
  const userRef = doc(db, "users", userId);
  await setDoc(userRef, {
    ...userData,
    following: [],
    followers: [],
    createdAt: new Date()
  }, { merge: true });
};

const getUserProfile = async (userId) => {
  const userDoc = await getDoc(doc(db, "users", userId));
  return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
};

const followUser = async (currentUserId, targetUserId) => {
  const batch = writeBatch(db);
  
  // Add target to current user's following
  const currentUserRef = doc(db, "users", currentUserId);
  batch.update(currentUserRef, {
    following: arrayUnion(targetUserId)
  });
  
  // Add current user to target's followers
  const targetUserRef = doc(db, "users", targetUserId);
  batch.update(targetUserRef, {
    followers: arrayUnion(currentUserId)
  });
  
  await batch.commit();
};

const unfollowUser = async (currentUserId, targetUserId) => {
  const batch = writeBatch(db);
  
  // Remove target from current user's following
  const currentUserRef = doc(db, "users", currentUserId);
  batch.update(currentUserRef, {
    following: arrayRemove(targetUserId)
  });
  
  // Remove current user from target's followers
  const targetUserRef = doc(db, "users", targetUserId);
  batch.update(targetUserRef, {
    followers: arrayRemove(currentUserId)
  });
  
  await batch.commit();
};

// Posts helper functions
const createPost = async (postData) => {
  const docRef = await addDoc(collection(db, "posts"), {
    ...postData,
    timestamp: serverTimestamp(),
    likes: [],
    comments: []
  });
  return docRef.id;
};

const getPosts = async (userId = null) => {
  let q;
  if (userId) {
    q = query(collection(db, "posts"), where("userId", "==", userId), orderBy("timestamp", "desc"));
  } else {
    q = query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(50));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const getFeedPosts = async (followingList) => {
  if (!followingList || followingList.length === 0) return [];
  const q = query(
    collection(db, "posts"),
    where("userId", "in", followingList),
    orderBy("timestamp", "desc"),
    limit(50)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Messages helper functions
const sendMessageRequest = async (messageData) => {
  // If there is any accepted conversation between these two users, mark as accepted
  try {
    const { senderId, receiverId } = messageData;
    const acceptedQuery = query(
      collection(db, "messages"),
      where("participants", "array-contains", senderId),
      where("status", "==", "accepted"),
      limit(25)
    );
    const snap = await getDocs(acceptedQuery);
    const hasAccepted = snap.docs.some((d) => {
      const data = d.data();
      const participants = data.participants || [];
      return participants.includes(receiverId);
    });

    const docRef = await addDoc(collection(db, "messages"), {
      ...messageData,
      status: hasAccepted ? "accepted" : "pending",
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (e) {
    const docRef = await addDoc(collection(db, "messages"), {
      ...messageData,
      status: "pending",
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  }
};

const acceptMessageRequest = async (messageId) => {
  const messageRef = doc(db, "messages", messageId);
  await updateDoc(messageRef, {
    status: "accepted"
  });
};

const rejectMessageRequest = async (messageId) => {
  const messageRef = doc(db, "messages", messageId);
  await updateDoc(messageRef, {
    status: "rejected",
  });
};

const getMessages = async (userId) => {
  const q = query(
    collection(db, "messages"),
    where("participants", "array-contains", userId),
    orderBy("timestamp", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Courses helper functions
const createCourse = async (courseData) => {
  const docRef = await addDoc(collection(db, "courses"), {
    ...courseData,
    enrolledUsers: [],
    createdAt: serverTimestamp()
  });
  return docRef.id;
};

const enrollInCourse = async (courseId, userId) => {
  const courseRef = doc(db, "courses", courseId);
  await updateDoc(courseRef, {
    enrolledUsers: arrayUnion(userId)
  });
};

const getCourses = async (creatorId = null) => {
  let q;
  if (creatorId) {
    q = query(collection(db, "courses"), where("creatorId", "==", creatorId));
  } else {
    q = query(collection(db, "courses"), limit(50));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const getEnrolledCourses = async (userId) => {
  const q = query(
    collection(db, "courses"),
    where("enrolledUsers", "array-contains", userId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

  // Single course fetch
  const getCourseById = async (courseId) => {
    const courseDoc = await getDoc(doc(db, "courses", courseId));
    return courseDoc.exists() ? { id: courseDoc.id, ...courseDoc.data() } : null;
  };

  // Unenroll a user from a course
  const unenrollFromCourse = async (courseId, userId) => {
    const courseRef = doc(db, "courses", courseId);
    await updateDoc(courseRef, {
      enrolledUsers: arrayRemove(userId)
    });
  };

// Meetings helper functions
const createMeeting = async (meetingData) => {
  const docRef = await addDoc(collection(db, "meetings"), {
    ...meetingData,
    createdAt: serverTimestamp()
  });
  return docRef.id;
};

const getMeetings = async (courseId) => {
  const q = query(
    collection(db, "meetings"),
    where("courseId", "==", courseId)
  );
  const querySnapshot = await getDocs(q);
  const meetings = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Sort on the client side to avoid index requirement
  return meetings.sort((a, b) => {
    const dateA = a.scheduledTime?.toDate ? a.scheduledTime.toDate() : new Date(a.scheduledTime);
    const dateB = b.scheduledTime?.toDate ? b.scheduledTime.toDate() : new Date(b.scheduledTime);
    return dateA - dateB;
  });
};

// Single meeting
const getMeetingById = async (meetingId) => {
  const snap = await getDoc(doc(db, "meetings", meetingId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// Course materials helpers
const addCourseMaterial = async (courseId, file, title, uploaderId) => {
  const filePath = `courseMaterials/${courseId}/${Date.now()}-${file.name}`;
  const fileRef = storageRef(storage, filePath);
  await uploadBytes(fileRef, file);
  const fileUrl = await getDownloadURL(fileRef);
  const docRef = await addDoc(collection(db, "courseMaterials"), {
    courseId,
    title,
    fileUrl,
    filePath,
    uploaderId,
    createdAt: serverTimestamp(),
  });
  return { id: docRef.id, fileUrl };
};

const getCourseMaterials = async (courseId) => {
  const q = query(
    collection(db, "courseMaterials"),
    where("courseId", "==", courseId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

const deleteCourseMaterial = async (materialId) => {
  const materialDoc = await getDoc(doc(db, "courseMaterials", materialId));
  if (materialDoc.exists()) {
    const data = materialDoc.data();
    if (data.filePath) {
      try { await deleteObject(storageRef(storage, data.filePath)); } catch (_) {}
    }
  }
  await deleteDoc(doc(db, "courseMaterials", materialId));
};

// Stories helper functions
const createStory = async (storyData, imageFile) => {
  let mediaUrl = null;
  
  if (imageFile) {
    const imagePath = `stories/${storyData.userId}/${Date.now()}-${imageFile.name}`;
    const imageRef = storageRef(storage, imagePath);
    await uploadBytes(imageRef, imageFile);
    mediaUrl = await getDownloadURL(imageRef);
  }
  
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
  
  const docRef = await addDoc(collection(db, "stories"), {
    ...storyData,
    mediaUrl,
    timestamp: serverTimestamp(),
    expiresAt,
    views: []
  });
  return docRef.id;
};

const getActiveStories = async () => {
  const now = new Date();
  const q = query(
    collection(db, "stories"),
    where("expiresAt", ">", now),
    orderBy("expiresAt", "desc"),
    orderBy("timestamp", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const getUserStories = async (userId) => {
  const now = new Date();
  const q = query(
    collection(db, "stories"),
    where("userId", "==", userId),
    where("expiresAt", ">", now),
    orderBy("expiresAt", "desc"),
    orderBy("timestamp", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const getStoriesGroupedByUser = async (followingList = []) => {
  const now = new Date();
  let q;
  
  if (followingList.length > 0) {
    // Get stories from followed users + own stories
    const allUserIds = [...followingList];
    q = query(
      collection(db, "stories"),
      where("userId", "in", allUserIds.slice(0, 10)), // Firestore limit
      where("expiresAt", ">", now),
      orderBy("expiresAt", "desc")
    );
  } else {
    // Get all active stories
    q = query(
      collection(db, "stories"),
      where("expiresAt", ">", now),
      orderBy("expiresAt", "desc"),
      limit(50)
    );
  }
  
  const querySnapshot = await getDocs(q);
  const stories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Group stories by user
  const groupedStories = {};
  stories.forEach(story => {
    if (!groupedStories[story.userId]) {
      groupedStories[story.userId] = [];
    }
    groupedStories[story.userId].push(story);
  });
  
  return groupedStories;
};

const markStoryAsViewed = async (storyId, userId) => {
  const storyRef = doc(db, "stories", storyId);
  await updateDoc(storyRef, {
    views: arrayUnion(userId)
  });
};

const deleteExpiredStories = async () => {
  const now = new Date();
  const q = query(
    collection(db, "stories"),
    where("expiresAt", "<=", now)
  );
  const querySnapshot = await getDocs(q);
  
  const batch = writeBatch(db);
  querySnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  return querySnapshot.docs.length;
};

// ✅ Export RTDB as well
export {
  auth,
  db,
  storage,
  rtdb,
  googleProvider,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  logout,
  addResource,
  updateResource,
  deleteResource,
  getResourcesByInstrumentAndLevel,
  // Social Network exports
  createUserProfile,
  getUserProfile,
  followUser,
  unfollowUser,
  createPost,
  getPosts,
  getFeedPosts,
  sendMessageRequest,
  acceptMessageRequest,
  rejectMessageRequest,
  getMessages,
  createCourse,
  enrollInCourse,
  getCourses,
  getEnrolledCourses,
  getCourseById,
  unenrollFromCourse,
  createMeeting,
  getMeetings,
  getMeetingById,
  addCourseMaterial,
  getCourseMaterials,
  deleteCourseMaterial,
  // Stories exports
  createStory,
  getActiveStories,
  getUserStories,
  getStoriesGroupedByUser,
  markStoryAsViewed,
  deleteExpiredStories
};

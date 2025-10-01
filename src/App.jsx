import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

// Pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignUp from "./pages/SignUp";
import HomePage from "./pages/HomePage";
import SocialHomePage from "./pages/SocialHomePage";
import UserProfilePage from "./pages/UserProfilePage";
import AddResource from "./pages/AddResource";
import ManageResources from "./pages/ManageResources";
import UsersPage from "./pages/UsersPage";
import MessagesPage from "./pages/MessagesPage";
import CoursesPage from "./pages/CoursesPage";
import CoursePage from "./pages/CoursePage";
import InstrumentPage from "./pages/InstrumentPage";
import ResourceListPage from "./pages/ResourceListPage";
import AudioRoomsListPage from "./pages/AudioRoomsListPage";
import AudioRoomPage from "./pages/AudioRoomPage";
import CourseDetailPage from "./pages/CourseDetailPage";
import MeetingPage from "./pages/MeetingPage";
import FirebaseTestPage from "./pages/FirebaseTestPage";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        {/* Root route */}
        <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/home" />} />

        {/* Public routes */}
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/home" />} />
        <Route path="/signup" element={!user ? <SignUp /> : <Navigate to="/home" />} />

        {/* Protected routes */}
        <Route path="/home" element={user ? <SocialHomePage /> : <Navigate to="/login" />} />
        <Route path="/original-home" element={user ? <HomePage /> : <Navigate to="/login" />} />
        <Route path="/profile" element={user ? <UserProfilePage /> : <Navigate to="/login" />} />
        <Route path="/user-profile/:userId" element={user ? <UserProfilePage /> : <Navigate to="/login" />} />
        <Route path="/add-resource" element={user ? <AddResource /> : <Navigate to="/login" />} />
        <Route path="/manage-resources" element={user ? <ManageResources /> : <Navigate to="/login" />} />
        <Route path="/instrument/:instrument" element={user ? <InstrumentPage /> : <Navigate to="/login" />} />
        <Route path="/instrument/:instrument/:level" element={user ? <ResourceListPage /> : <Navigate to="/login" />} />



        {/* Audio Rooms Routes */}
        <Route path="/audio-rooms" element={<AudioRoomsListPage />} />
        <Route path="/audio-room/:roomId" element={user ? <AudioRoomPage /> : <Navigate to="/login" />} />

        {/* Social Network Routes */}
        <Route path="/users" element={user ? <UsersPage /> : <Navigate to="/login" />} />
        <Route path="/messages" element={user ? <MessagesPage /> : <Navigate to="/login" />} />
        
        {/* Course Routes */}
        <Route path="/courses" element={user ? <CoursesPage /> : <Navigate to="/login" />} />
        <Route path="/course/:courseId" element={user ? <CourseDetailPage /> : <Navigate to="/login" />} />
        <Route path="/course/:courseId/manage" element={user ? <CoursePage /> : <Navigate to="/login" />} />
        <Route path="/meeting/:meetingId" element={user ? <MeetingPage /> : <Navigate to="/login" />} />
        <Route path="/test-firebase" element={user ? <FirebaseTestPage /> : <Navigate to="/login" />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

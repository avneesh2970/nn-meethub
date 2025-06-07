import React, { Suspense, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Loader } from "lucide-react";

const Navbar = React.lazy(() => import("./components/Navbar"));
const HomePage = React.lazy(() => import("./pages/HomePage"));
const LoginPage = React.lazy(() => import("./pages/LoginPage"));
const SignupPage = React.lazy(() => import("./pages/SignupPage"));

const PreMeetingScreen = React.lazy(() => import("./pages/PreMeetingScreen"));
const AskForJoin = React.lazy(() => import("./pages/AskForJoin"));
const MeetingLive = React.lazy(() => import("./pages/MeetingLive"));

import { useAuthStore } from "./store/useAuthStore";
import { useMeetingStore } from "./store/useMeetingStore";

const App = () => {
  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();
  const location = useLocation();
  const hasCheckedAuth = useRef(false); // Track if checkAuth ran
  const { joinMeeting } = useMeetingStore();

  useEffect(() => {
    if (hasCheckedAuth.current) {
      console.log("App.js: Skipping duplicate checkAuth");
      return;
    }

    console.log("App.js: Running checkAuth");
    hasCheckedAuth.current = true;
    checkAuth().catch((err) => {
      console.log("App.js: checkAuth failed:", err.response?.status);
    });
  }, [checkAuth]);

  useEffect(() => {
    const code = window.location.pathname.split("/")[2];
    const { meetingCode, myStatus } = useMeetingStore.getState();
    if (code && !meetingCode && myStatus !== "joined") {
      console.log("Joining meeting from route:", code);
      joinMeeting(code);
    }
  }, [joinMeeting]);

  if (isCheckingAuth && !authUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="size-10 animate-spin" />
      </div>
    );
  }

  const hideNavbar = location.pathname.startsWith("/Meeting-live");

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <Loader className="size-10 animate-spin" />
        </div>
      }
    >
      <div className="bg-[#282525] bg-opacity-35 min-h-screen w-full overflow-x-hidden">
        {!hideNavbar && <Navbar />}
        <Routes>
          <Route
            path="/"
            element={authUser ? <HomePage /> : <Navigate to="/login" />}
          />
          <Route
            path="/signup"
            element={!authUser ? <SignupPage /> : <Navigate to="/" />}
          ></Route>
          <Route
            path="/login"
            element={!authUser ? <LoginPage /> : <Navigate to="/" />}
          />
          <Route
            path="/pre-meeting-screen"
            element={authUser ? <PreMeetingScreen /> : <Navigate to="/login" />}
          />
          <Route
            path="/Ask-for-join"
            element={authUser ? <AskForJoin /> : <Navigate to="/login" />}
          />
          <Route
            path="/Meeting-live/:meetingCode"
            element={authUser ? <MeetingLive /> : <Navigate to="/login" />}
          />
        </Routes>
        <Toaster />
      </div>
    </Suspense>
  );
};

export default App;

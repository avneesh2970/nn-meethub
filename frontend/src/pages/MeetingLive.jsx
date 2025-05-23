import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assests/logo.svg";
import Frame1 from "../assests/Frame 1424.png";
import Frame2 from "../assests/Frame 1414.png";
import Frame3 from "../assests/Frame 1415.png";
import Frame4 from "../assests/Frame 1413.png";
import ChatSection from "../components/ChatSection";
import PeopleSection from "../components/PeopleSection";
import SettingModal from "../components/SettingModal";
import LeaveModal from "../components/LeaveModal";
import LowerSection from "../components/LowerSection";
import ParticipantView from "../components/ParticipantView";
import { Loader, ClipboardCheck, Copy } from "lucide-react";
import { toast } from "react-hot-toast";

import { useAuthStore } from "../store/useAuthStore";
import { useMeetingStore } from "../store/useMeetingStore";

const MeetingLive = () => {
  const { socket, authUser } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  const navigate = useNavigate();
  const {
    selectedMeeting,
    participants,
    streams,
    setParticipants,
    waitingToJoin,
    allowParticipant,
    denyParticipant,
    myStatus,
    meetingCode,
    setMyStatus,
    setActiveScreenSharer,
    activeScreenSharer,
    renegotiatePeerConnection,
    count,
    setCount,
  } = useMeetingStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState("Sidebar");
  const [activeItem, setActiveItem] = useState("Change Layout");
  const [screenStream, setScreenStream] = useState(null);

  const tools = ["Share Screen", "Unmute", "Video", "Chat", "Emoji"];
  const [toggleStates, setToggleStates] = useState(
    tools.reduce((acc, tool) => ({ ...acc, [tool]: true }), {})
  );

  const [localStream, setLocalStream] = useState(null);
  const videoRef = React.useRef(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isPeopleOpen, setIsPeopleOpen] = useState(false);

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false); // Add state for LeaveModal
  const [isScreenSharing, setIsScreenSharing] = useState(false); // Add state for screen sharing
  const [isMicOn, setIsMicOn] = useState(true); // Default to true to match getUserMedia
  const [isVideoOn, setIsVideoOn] = useState(true);
  const HostId = selectedMeeting?.host;
  const isHost = authUser._id === HostId;

  const layouts = [
    { name: "Auto", img: Frame1 },
    { name: "Sidebar", img: Frame2 },
    { name: "Spotlight", img: Frame3 },
    { name: "Tiled", img: Frame4 },
  ];

  {
    /*useEffect(() => {
    const code = window.location.pathname.split("/")[2];
    const { meetingCode, myStatus } = useMeetingStore.getState();
    if (code && !meetingCode && myStatus !== "joined") {
      console.log("Attempting to join meeting from route:", code);
      joinMeeting(code);
    }
  }, [joinMeeting]);*/
  }

  useEffect(() => {
    if (myStatus === "joined" && !localStream) {
      console.log("Requesting media for joined user:", authUser._id);
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          setLocalStream(stream);

          // Add stream to useMeetingStore
          useMeetingStore.getState().setLocalStream(authUser._id, stream);

          // Sync track enabled states with UI
          const audioTrack = stream.getAudioTracks()[0];
          const videoTrack = stream.getVideoTracks()[0];
          audioTrack.enabled = isMicOn;
          videoTrack.enabled = isVideoOn;

          socket.emit("updateParticipantState", {
            participantId: authUser._id,
            mic: isMicOn,
            video: isVideoOn,
            screenSharing: isScreenSharing,
          });
          // Initialize WebRTC connections with all participants
          useMeetingStore.getState().initializeConnections();
        })
        .catch((err) => {
          console.error("Error accessing media devices:", err);
          alert("Please allow access to your camera and microphone.");
        });
    }
    return () => {
      if (localStream && myStatus !== "joined") {
        localStream.getTracks().forEach((track) => track.stop());
        setLocalStream(null);
        useMeetingStore.getState().setLocalStream(authUser._id, null);
      }
      if (screenStream && myStatus !== "joined") {
        screenStream.getTracks().forEach((track) => track.stop());
        setScreenStream(null);
        useMeetingStore.getState().setScreenStream(authUser._id, null);
      }
    };
  }, [
    myStatus,
    localStream,
    authUser,
    socket,
    screenStream,
    isMicOn,
    isVideoOn,
    isScreenSharing,
  ]);

  useEffect(() => {
    if (!socket?.connected) return;
    console.log("requesting participant states");

    socket.on("requestParticipantStates", () => {
      if (localStream) {
        //const audioTrack = localStream.getAudioTracks()[0];
        //const videoTrack = localStream.getVideoTracks()[0];

        socket.emit("shareParticipantState", {
          participantId: authUser._id,
          mic: isMicOn,
          video: isVideoOn,
          screenSharing: isScreenSharing,
        });
      }
    });

    return () => {
      socket.off("requestParticipantStates");
    };
  }, [socket, localStream, authUser, isScreenSharing, isMicOn, isVideoOn]);

  useEffect(() => {
    socket.on("init", (state) => {
      setParticipants(state.participants);
      setSelected(state.layout);
      setToggleStates(state.hostTools);
    });

    socket.on("participantUpdate", (participants) => {
      console.log("MEETING LIVE PARTICIPANT UPDATE: ", participants);
      setMyStatus(participants);
    });

    socket.on("updateLayout", (layout) => {
      setSelected(layout);
    });

    socket.on("updateHostTools", (tool) => {
      const obj = tool;
      const newTool = obj.tool;
      const newState = !toggleStates[newTool];

      setToggleStates((prev) => ({ ...prev, [newTool]: newState }));
    });

    socket.on("disableMedia", (data) => {
      const { mediaType } = data;
      console.log("DISABLE MEDIA:", mediaType);
      console.log("isHost:", isHost);
      if (isHost) {
        return;
      }
      console.log("MIC ON:", isMicOn);
      console.log("VIDEO ON:", isVideoOn);
      console.log("SCREEN SHARING:", isScreenSharing);
      console.log("CHAT OPEN:", isChatOpen);
      if (mediaType === "video" && isVideoOn) {
        console.log("DISABLE VIDEO");
        toggleCamera();
      }
      if (mediaType === "mic" && isMicOn) {
        console.log("DISABLE MIC");
        toggleMic();
      }
      if (mediaType === "Share Screen" && isScreenSharing) {
        console.log("DISABLE SCREEN SHARE");
        stopScreenShare();
      }
      if (mediaType === "Chat" && isChatOpen) {
        console.log("DISABLE CHAT");
        toggleChat();
      }
    });

    socket.on("activeScreenSharer", ({ userId }) => {
      console.log("ACTIVE SCREEN SHARER UPDATE:", userId);
      setActiveScreenSharer(userId);
    });

    return () => {
      socket.off("init");
      socket.off("updateLayout");
      socket.off("updateHostTools");
      socket.off("disableMedia");
      socket.off("activeScreenSharer");
    };
  }, [
    socket,
    setParticipants,
    setMyStatus,
    toggleStates,
    isMicOn,
    isVideoOn,
    isScreenSharing,
    isChatOpen,
    setActiveScreenSharer,
  ]);

  useEffect(() => {
    if (
      activeScreenSharer &&
      streams[activeScreenSharer]?.video &&
      videoRef.current
    ) {
      setCount(count + 1);

      console.log(
        "Setting screen stream for active sharer:",
        activeScreenSharer
      );
      videoRef.current.srcObject =
        streams[activeScreenSharer].screen || streams[activeScreenSharer].video;
      videoRef.current.play().catch((err) => {
        console.error("Error playing screen stream:", err);
      });

      if (count > 0) {
        return;
      }

      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((cameraStream) => {
          const cameraVideoRef = document.getElementById("camera-thumbnail");
          if (cameraVideoRef) {
            cameraVideoRef.srcObject = cameraStream; // Assign the camera stream to the thumbnail
            console.log("camera stream set:", cameraStream);
            cameraVideoRef.onloadedmetadata = () => {
              console.log("Camera stream metadata loaded:", cameraVideoRef);
              cameraVideoRef.play().catch((err) => {
                console.error("Error playing camera video:", err);
              }); // Ensure the video starts playing
            };
          }
        })
        .catch((err) => {
          console.error("Error accessing camera for thumbnail:", err);
        });
    }
  }, [streams, activeScreenSharer]);

  useEffect(() => {
    if (
      localStream &&
      videoRef.current &&
      !isScreenSharing &&
      !activeScreenSharer
    ) {
      console.log("Setting localStream to videoRef:", localStream);
      videoRef.current.srcObject = localStream;
      videoRef.current.play().catch((err) => {
        console.error("Error playing localStream:", err);
      });
    }
  }, [localStream, isScreenSharing, activeScreenSharer]);

  useEffect(() => {
    if (screenStream && videoRef.current && isScreenSharing) {
      console.log("Setting ScreenStream to videoRef:", screenStream);
      videoRef.current.srcObject = screenStream;
      videoRef.current.play().catch((err) => {
        console.error("Error playing localStream:", err);
      });
    }
  }, [screenStream, isScreenSharing]);

  useEffect(() => {
    let interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket?.connected) return;
    socket.on("startScreenShare", ({ userId }) => {
      console.log("START SCREEN SHARE EVENT:", userId);
      setParticipants((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], isScreenSharing: true },
      }));
      toast(
        `${
          participants[userId]?.name || "A participant"
        } started screen sharing.`
      );
    });

    socket.on("stopScreenShare", ({ userId }) => {
      setParticipants((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], isScreenSharing: false },
      }));
      toast(
        `${
          participants[userId]?.name || "A participant"
        } stopped screen sharing.`
      );
    });

    return () => {
      socket.off("startScreenShare");
      socket.off("stopScreenShare");
    };
  }, [participants, setParticipants, socket]);

  useEffect(() => {
    if (!socket?.connected) return;

    // Setup WebRTC signaling event handlers
    socket.on("webrtc-offer", (data) => {
      console.log("OFFER in Meeting Live:", data);
      useMeetingStore.getState().handleOffer(data);
    });

    socket.on("webrtc-answer", (data) => {
      console.log("ANSWER in Meeting Live:", data);
      useMeetingStore.getState().handleAnswer(data);
    });

    socket.on("ice-candidate", (data) => {
      console.log("ICE CANDIDATE in Meeting Live:", data);

      useMeetingStore.getState().handleIceCandidate(data);
    });

    socket.on("participant-left", ({ userId }) => {
      console.log("PARTICIPANT LEFT in Meeting Live:", userId);
      useMeetingStore.getState().cleanupPeerConnection(userId);
    });

    return () => {
      socket.off("webrtc-offer");
      socket.off("webrtc-answer");
      socket.off("ice-candidate");
      socket.off("participant-left");
    };
  }, [socket]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(meetingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleToggle = (tool) => {
    if (!isHost) {
      toast.error("Only the host can change this setting.");
      return;
    }

    socket.emit("updateHostTools", { tool });
  };

  const toggleMic = () => {
    console.log("TOGGLE MIC:", authUser._id);
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      console.log("Audio Track:", audioTrack);
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
      socket.emit("toggleMic", {
        participantId: authUser._id,
        mic: audioTrack.enabled,
      });
    } else {
      console.error("No localStream available to toggle mic");
    }
  };

  const toggleCamera = () => {
    console.log("TOGGLE CAMERA:", authUser._id);
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOn(videoTrack.enabled);
      socket.emit("toggleVideo", {
        participantId: authUser._id,
        video: videoTrack.enabled,
      });
    } else {
      console.error("No localStream available to toggle camera");
    }
  };

  const startScreenShare = async () => {
    try {
      if (activeScreenSharer) {
        toast.error("Another user is already sharing their screen.");
        return;
      }
      const newScreenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      setIsScreenSharing(true); // Set screen sharing state to true
      setScreenStream(newScreenStream);
      const userId = authUser._id;
      setActiveScreenSharer(userId);
      socket.emit("activeScreenSharer", { userId }); // Notify others about the active screen sharer

      // Add screen stream to useMeetingStore
      useMeetingStore.getState().setScreenStream(authUser._id, newScreenStream);

      console.log("Start screen share UserId:", authUser._id);
      socket.emit("startScreenShare", { userId: authUser._id }); // Notify others about screen sharing

      // Assign the screen stream to the video element
      if (videoRef.current) {
        videoRef.current.srcObject = newScreenStream; // Assign the screen stream
        console.log(
          "Screen stream set:",
          newScreenStream.getVideoTracks()[0],
          videoRef.current.srcObject
        );
        videoRef.current.onloadedmetadata = () => {
          console.log("Screen stream metadata loaded:", videoRef.current);
          videoRef.current.play().catch((err) => {
            console.log("Error playing screen video:", err);
            console.error("Error playing shared screen video:", err);
          }); // Ensure the video starts playing
        };

        // Handle when the user stops sharing
        const screenTrack = newScreenStream.getVideoTracks()[0];
        screenTrack.onended = () => stopScreenShare(); // Stop screen sharing when the user stops it
      }

      // Show the user's camera feed in a smaller thumbnail
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((cameraStream) => {
          const cameraVideoRef = document.getElementById("camera-thumbnail");
          if (cameraVideoRef) {
            cameraVideoRef.srcObject = cameraStream; // Assign the camera stream to the thumbnail
            console.log("camera stream set:", cameraStream);
            cameraVideoRef.onloadedmetadata = () => {
              console.log("Camera stream metadata loaded:", cameraVideoRef);
              cameraVideoRef.play().catch((err) => {
                console.error("Error playing camera video:", err);
              }); // Ensure the video starts playing
            };
          }
        })
        .catch((err) => {
          console.error("Error accessing camera for thumbnail:", err);
        });
    } catch (err) {
      console.error("Error starting screen share:", err);
      console.log("Error starting screen share:", err);
      setIsScreenSharing(false); // Reset screen sharing state on error
      setScreenStream(null);
      useMeetingStore.getState().setScreenStream(authUser._id, null);
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }
    setIsScreenSharing(false); // Reset screen sharing state
    setScreenStream(null);
    setActiveScreenSharer(null); // Reset active screen sharer
    setCount(0); // Reset count to 0

    // Remove screen stream from useMeetingStore
    useMeetingStore.getState().setScreenStream(authUser._id, null);
    socket.emit("stopScreenShare", { userId: authUser._id }); // Notify others that screen sharing has stopped

    socket.emit("activeScreenSharer", { userId: null }); // Notify others that no one is sharing

    Object.keys(useMeetingStore.getState().peerConnections).forEach(
      (participantId) => {
        renegotiatePeerConnection(participantId);
      }
    );

    // Revert to the camera feed
    if (localStream && videoRef.current) {
      videoRef.current.srcObject = localStream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play().catch((err) => {
          console.error("Error reverting to camera feed:", err);
        });
      };
    }
  };

  const changeLayout = (layout) => {
    setSelected(layout);
    socket.emit("changeLayout", layout);
  };

  const closeSidebar = () => {
    setIsModalOpen(false);
  };

  const handleSignOut = async () => {
    try {
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
      }
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      console.log("Handle Sign Out:", selectedMeeting.meetingCode);
      await useMeetingStore.getState().leaveMeeting();
      setLocalStream(null);
      setParticipants({});
      setTimer(0);
      navigate("/");
    } catch (err) {
      console.error("Error during signing out of meeting:", err);
    }
  };

  const toggleChat = () => {
    setIsChatOpen((prev) => {
      if (!prev) setIsPeopleOpen(false);
      return !prev;
    });
  };

  const togglePeople = () => {
    setIsPeopleOpen((prev) => {
      if (!prev) setIsChatOpen(false);
      return !prev;
    });
  };

  const handleAllow = (id) => {
    allowParticipant(id);
  };

  const handleDeny = (id) => {
    denyParticipant(id);
  };

  const toggleParticipantMic = (participantId) => {
    console.log("TOGGLE PARTICIPANT MIC:", participantId);

    socket.emit("toggleMic", {
      participantId,
      mic: !participants[participantId].mic,
    }); // Notify the server
  };

  if (myStatus === "waiting") {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="size-10 animate-spin text-amber-50" />
        <div className="text-white">Waiting for host approval...</div>;
      </div>
    );
  }
  return (
    <>
      <div className={`relative ${isModalOpen ? "blur-sm" : ""}`}>
        <div className="bg-black text-white flex flex-wrap items-center justify-between px-4 py-2 w-full h-14">
          <nav className="flex items-center p-2 sm:p-4">
            <img src={logo} alt="Company Logo" className="h-6 w-auto" />
          </nav>
          <div className="flex items-center gap-2 text-sm justify-center flex-1">
            <span className="text-gray-400 truncate max-w-[100px] sm:max-w-none">
              {meetingCode}
            </span>{" "}
            <button
              onClick={copyToClipboard}
              className="text-gray-300 hover:text-white"
            >
              {copied ? <ClipboardCheck size={18} /> : <Copy size={18} />}
            </button>
            {/* Meeting link */}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 animate-spin border-2 border-blue-500 border-t-white rounded-full"></div>
            <span className="text-gray-400">Live</span>
            <span className="ml-2 text-gray-400">{formatTime(timer)}</span>{" "}
            {/* Timer */}
            {isScreenSharing && (
              <span className="ml-2 text-green-500">Screen Sharing</span>
            )}{" "}
            {/* Indicate screen sharing */}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row w-full h-[83vh]">
          {" "}
          {/* Adjusted for responsiveness */}
          {/* Video Section */}
          <div
            className={`flex-1 transition-all duration-300 ${
              selected === "Sidebar" ? "lg:w-[80%]" : "w-full"
            } flex justify-center items-center relative`}
          >
            {activeScreenSharer && streams[activeScreenSharer]?.video ? (
              <div className="flex w-full h-full">
                {/* Shared Screen on the Left */}
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className={`flex-1 h-[75vh] object-cover rounded-lg lg:h-[90%] `}
                ></video>

                {/* Camera Feed on the Right */}
                <video
                  id="camera-thumbnail"
                  autoPlay
                  muted
                  className={`w-1/3 h-[75vh] object-cover border-2 border-white rounded-lg lg:h-[90%] ml-4 ${
                    isChatOpen || isPeopleOpen ? "hidden" : "block"
                  } transform scale-x-[-1]`}
                ></video>
              </div>
            ) : localStream ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                className="w-full h-[75vh] object-cover rounded-lg lg:w-[90%] lg:h-[90%] transform scale-x-[-1]"
              ></video>
            ) : (
              <div className="w-full h-[75vh] flex items-center justify-center bg-gray-800 text-white text-9xl font-bold rounded-lg lg:w-[90%] lg:h-[90%]">
                {authUser.fullName[0].toUpperCase()}
              </div>
            )}
          </div>
          {/* Participant View */}
          <ParticipantView
            selected={selected}
            participants={participants}
            toggleParticipantMic={toggleParticipantMic}
            isChatOpen={isChatOpen}
            isPeopleOpen={isPeopleOpen}
          />
          {/* Chat Section */}
          <ChatSection
            isChatOpen={isChatOpen}
            setIsChatOpen={setIsChatOpen}
            socket={socket}
            selected={selected}
            setHasNewMessage={setHasNewMessage}
          />
          {/* People Section */}
          <PeopleSection
            isPeopleOpen={isPeopleOpen}
            setIsPeopleOpen={setIsPeopleOpen}
            participants={participants}
            waitingToJoin={waitingToJoin}
            handleAllow={handleAllow}
            handleDeny={handleDeny}
          />
        </div>
        {/* Lower Section */}
        <LowerSection
          socket={socket}
          toggleMic={toggleMic}
          toggleCamera={toggleCamera}
          startScreenShare={startScreenShare}
          stopScreenShare={stopScreenShare} // Add stopScreenShare to LowerSection
          togglePeople={togglePeople}
          toggleChat={toggleChat}
          setIsModalOpen={setIsModalOpen}
          isMicOn={isMicOn}
          isVideoOn={isVideoOn}
          isScreenSharing={isScreenSharing}
          waitingToJoin={waitingToJoin}
          openLeaveModal={() => setIsLeaveModalOpen(true)} // Correctly pass function to open LeaveModal
          isHost={isHost}
          toggleStates={toggleStates}
          hasNewMessage={hasNewMessage}
        />
      </div>

      {/* Setting Modal */}
      <SettingModal
        isModalOpen={isModalOpen}
        closeSidebar={closeSidebar}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        layouts={layouts}
        selected={selected}
        changeLayout={changeLayout}
        tools={tools}
        toggleStates={toggleStates}
        handleToggle={handleToggle}
      />

      <LeaveModal
        isLeaveModalOpen={isLeaveModalOpen} // Pass state to LeaveModal
        handleSignOut={handleSignOut}
        closeLeaveModal={() => setIsLeaveModalOpen(false)} // Pass function to close LeaveModal
      />
    </>
  );
};

export default MeetingLive;

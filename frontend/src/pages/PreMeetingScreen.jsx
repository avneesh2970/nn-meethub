import { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ClipboardCheck,
  Copy,
} from "lucide-react";
import { useMeetingStore } from "../store/useMeetingStore";
import { useAuthStore } from "../store/useAuthStore";
import { useNavigate } from "react-router-dom";
const PreMeetingScreen = () => {
  const navigate = useNavigate();

  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const { selectedMeeting, joinMeeting } = useMeetingStore();
  const { socket } = useAuthStore();

  useEffect(() => {
    socket.emit("join-lobby");

    return () => {
      socket.emit("leave-lobby");
      stopMediaStream();
    };
  }, []);

  useEffect(() => {
    socket.emit("toggle-media", { micOn, videoOn });
  }, [micOn, videoOn]);

  useEffect(() => {
    getMedia(); // Get media on initial load
    return () => stopMediaStream(); // Cleanup on unmount
  }, []);

  const copyToClipboardCode = () => {
    navigator.clipboard.writeText(selectedMeeting.meetingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  };

  const copyToClipboardUrl = () => {
    navigator.clipboard.writeText(selectedMeeting.meetingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  };

  const getMedia = async () => {
    if (loading) return;
    setLoading(true);

    try {
      if (!streamRef.current) {
        // If no existing stream, request a new one
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
        }
      }

      // Handle video toggle (enable/disable instead of stopping stream)
      const videoTrack = streamRef.current?.getVideoTracks()[0];
      if (videoTrack) {
        if (videoOn) {
          videoTrack.enabled = true;
        } else {
          videoTrack.stop(); // Fully stop video track
          streamRef.current.removeTrack(videoTrack);
        }
      }

      const audioTrack = streamRef.current?.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = micOn; // Ensure correct mute/unmute behavior
      }
    } catch (error) {
      console.error("Error accessing media devices:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleVideo = async () => {
    if (videoOn) {
      setVideoOn(false);
      stopVideoStream(); // Stop video properly
    } else {
      setVideoOn(true);
      await restartVideoStream(); // Restart video properly
    }
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micOn; // ✅ FIX: Toggle correctly
      }
    }
    setMicOn((prev) => !prev);
  };

  const stopVideoStream = () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.stop();
      streamRef.current.removeTrack(videoTrack);
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const restartVideoStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];

      if (streamRef.current) {
        streamRef.current.addTrack(videoTrack);
      } else {
        streamRef.current = stream;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
    } catch (error) {
      console.error("Error restarting video:", error);
    }
  };

  const stopMediaStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const handleJoin = async () => {
    console.log("pre-meeting-screen socket:", socket);
    joinMeeting(selectedMeeting.meetingCode);
    navigate(`/Meeting-live/${selectedMeeting.meetingCode}`);
  };

  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="bg-[#181818] p-6 rounded-lg shadow-lg flex flex-col items-center">
        {/* Video Preview */}
        <div className="w-[500px] h-[300px] bg-gray-700 rounded-lg relative flex items-center justify-center">
          {videoOn && streamRef.current ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <div className="absolute text-white">Camera is Off</div>
          )}
        </div>

        {/* Controls */}
        <div className="flex space-x-4 mt-4">
          <button
            onClick={toggleMic}
            className="p-2 bg-gray-800 text-white rounded-full"
          >
            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button
            onClick={toggleVideo}
            className="p-2 bg-gray-800 text-white rounded-full"
          >
            {videoOn ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
        </div>

        <div className="flex items-center justify-center gap-2  p-2 w-full mt-4">
          <button
            onClick={copyToClipboardCode}
            className="text-gray-300 hover:text-white"
          >
            {copied ? <ClipboardCheck size={18} /> : <Copy size={18} />}
          </button>
          <span className="text-sm font-mono text-gray-300">
            {selectedMeeting.meetingCode}
          </span>
        </div>
        <div className="flex items-center justify-center gap-2  p-2 w-full mt-4">
          <button
            onClick={copyToClipboardUrl}
            className="text-gray-300 hover:text-white"
          >
            {copied ? <ClipboardCheck size={18} /> : <Copy size={18} />}
          </button>
          <span className="text-sm font-mono text-gray-300">
            {selectedMeeting.meetingUrl}
          </span>
        </div>

        {/* Join Button */}
        <button
          className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
          onClick={handleJoin}
        >
          Join Now ➝
        </button>
      </div>
    </div>
  );
};

export default PreMeetingScreen;

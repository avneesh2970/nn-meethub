import { useState } from "react";
import {
  FaMicrophone,
  FaVideo,
  FaDesktop,
  FaSmile,
  FaUser,
  FaCommentDots,
  FaEllipsisH,
  FaSignOutAlt,
} from "react-icons/fa";
import { MdOutlineScreenShare } from "react-icons/md";
import { PiMicrophoneSlashLight } from "react-icons/pi";
import { CiVideoOff } from "react-icons/ci";
import Picker from "emoji-picker-react";
import { useAuthStore } from "../store/useAuthStore";
import { toast } from "react-hot-toast";

const LowerSection = ({
  toggleMic,
  toggleCamera,
  startScreenShare,
  stopScreenShare,
  togglePeople,
  toggleChat,
  setIsModalOpen,
  openLeaveModal,
  isMicOn,
  isVideoOn,
  isScreenSharing,
  socket,
  waitingToJoin,
  toggleStates,
  isHost,
  hasNewMessage,
}) => {
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const { authUser } = useAuthStore();

  const toggleEmojiPicker = () => {
    if (!isHost && !toggleStates["Emoji"]) {
      toast.error("The host has disabled emojis.");
      return;
    }
    setIsEmojiPickerOpen((prev) => !prev);
  };

  const onEmojiClick = (emojiObject, event) => {
    if (!isHost && !toggleStates["Emoji"]) {
      toast.error("The host has disabled emojis.");
      return;
    }
    console.log(
      "Selected Emoji:",
      emojiObject.emoji,
      "name:",
      authUser.fullName
    );
    const emoji = emojiObject.emoji;
    const name = authUser.fullName;
    socket.emit("sendEmoji", { name: name, emoji: emoji });

    setIsEmojiPickerOpen(false);
  };

  return (
    <div className="bg-black p-4 flex items-center justify-between w-full fixed bottom-0 left-0">
      <div className="flex gap-2">
        {isHost || toggleStates["Unmute"] ? (
          <button
            className={`p-2 rounded-lg text-white ${
              isMicOn ? "bg-green-500" : "bg-gray-600"
            } ${
              !isHost && !toggleStates["Unmute"]
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
            onClick={toggleMic}
            disabled={!isHost && !toggleStates["Unmute"]}
          >
            {isMicOn ? <FaMicrophone /> : <PiMicrophoneSlashLight size={18} />}
          </button>
        ) : (
          <div className="relative">
            <button
              className="p-2 rounded-lg text-white bg-gray-600 opacity-50 cursor-not-allowed"
              onClick={() =>
                toast.error("The host has disabled microphone access.")
              }
            >
              <PiMicrophoneSlashLight size={18} />
            </button>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
              !
            </span>
          </div>
        )}
        {isHost || toggleStates["Video"] ? (
          <button
            className={`p-2 rounded-lg text-white ${
              isVideoOn ? "bg-green-500" : "bg-gray-600"
            } ${
              !isHost && !toggleStates["Video"]
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
            onClick={toggleCamera}
            disabled={!isHost && !toggleStates["Video"]}
          >
            {isVideoOn ? <FaVideo /> : <CiVideoOff size={18} />}
          </button>
        ) : (
          <div className="relative">
            <button
              className="p-2 rounded-lg text-white bg-gray-600 opacity-50 cursor-not-allowed"
              onClick={() =>
                toast.error("The host has disabled camera access.")
              }
            >
              <CiVideoOff size={18} />
            </button>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
              !
            </span>
          </div>
        )}
        <button className="bg-gray-600 p-2 rounded-lg text-white">
          <FaDesktop />
        </button>
        {isHost || toggleStates["Share Screen"] ? (
          <button
            className={`p-2 rounded-lg text-white ${
              isScreenSharing ? "bg-green-500" : "bg-gray-600"
            } ${
              !isHost && !toggleStates["Share Screen"]
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            disabled={!isHost && !toggleStates["Share Screen"]}
          >
            <MdOutlineScreenShare />
          </button>
        ) : (
          <div className="relative">
            <button
              className="p-2 rounded-lg text-white bg-gray-600 opacity-50 cursor-not-allowed"
              onClick={() =>
                toast.error("The host has disabled screen sharing.")
              }
            >
              <MdOutlineScreenShare />
            </button>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
              !
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {isHost || toggleStates["Emoji"] ? (
          <div className="relative">
            <button
              className="bg-gray-600 p-2 rounded-lg text-white"
              onClick={toggleEmojiPicker}
              disabled={!isHost && !toggleStates["Emoji"]}
            >
              <FaSmile />
            </button>
            {isEmojiPickerOpen && (
              <div className="absolute bottom-12">
                <Picker onEmojiClick={onEmojiClick} />
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            <button
              className="bg-gray-600 p-2 rounded-lg text-white opacity-50 cursor-not-allowed"
              onClick={() => toast.error("The host has disabled emojis.")}
            >
              <FaSmile />
            </button>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
              !
            </span>
          </div>
        )}
        <div className="relative">
          <button
            className="bg-gray-600 p-2 rounded-lg text-white"
            onClick={togglePeople}
          >
            <FaUser />
          </button>
          {waitingToJoin.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
              {waitingToJoin.length}
            </span>
          )}
        </div>
        {isHost || toggleStates["Chat"] ? (
          <div className="relative">
            <button
              className="bg-gray-600 p-2 rounded-lg text-white"
              onClick={toggleChat}
              disabled={!isHost && !toggleStates["Chat"]}
            >
              <FaCommentDots />
            </button>
            {hasNewMessage && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
                !
              </span>
            )}
          </div>
        ) : (
          <div className="relative">
            <button
              className="bg-gray-600 p-2 rounded-lg text-white opacity-50 cursor-not-allowed"
              onClick={() => toast.error("The host has disabled chat.")}
            >
              <FaCommentDots />
            </button>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
              !
            </span>
          </div>
        )}
        <button
          className="bg-gray-600 p-2 rounded-lg text-white"
          onClick={() => setIsModalOpen(true)}
        >
          <FaEllipsisH />
        </button>
      </div>

      <button
        className="bg-red-500 p-2 rounded-lg text-white leave-button bottom-122 right-3 md:static md:bottom-auto md:right-auto"
        onClick={openLeaveModal}
      >
        <FaSignOutAlt />
      </button>
    </div>
  );
};

export default LowerSection;

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
}) => {
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const { authUser } = useAuthStore();

  const toggleEmojiPicker = () => {
    setIsEmojiPickerOpen((prev) => !prev);
  };

  const onEmojiClick = (emojiObject, event) => {
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
        <button
          className={`p-2 rounded-lg text-white ${
            isMicOn ? "bg-green-500" : "bg-gray-600"
          }`}
          onClick={toggleMic}
        >
          {isMicOn ? <FaMicrophone /> : <PiMicrophoneSlashLight size={18} />}
        </button>
        <button
          className={`p-2 rounded-lg text-white ${
            isVideoOn ? "bg-green-500" : "bg-gray-600"
          }`}
          onClick={toggleCamera}
        >
          {isVideoOn ? <FaVideo /> : <CiVideoOff size={18} />}
        </button>
        <button className="bg-gray-600 p-2 rounded-lg text-white">
          <FaDesktop />
        </button>
        <button
          className={`p-2 rounded-lg text-white ${
            isScreenSharing ? "bg-green-500" : "bg-gray-600"
          }`}
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
        >
          <MdOutlineScreenShare />
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative">
          <button
            className="bg-gray-600 p-2 rounded-lg text-white"
            onClick={toggleEmojiPicker}
          >
            <FaSmile />
          </button>
          {isEmojiPickerOpen && (
            <div className="absolute bottom-12">
              <Picker onEmojiClick={onEmojiClick} />
            </div>
          )}
        </div>
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
        <button
          className="bg-gray-600 p-2 rounded-lg text-white"
          onClick={toggleChat}
        >
          <FaCommentDots />
        </button>
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

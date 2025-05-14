import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";

const Popup = ({ isOpen, onClose, onJoin }) => {
  const [code, setCode] = useState("");
  const { authUser } = useAuthStore();

  const handleJoin = () => {
    onJoin(code);
  };

  if (!isOpen) return null; // Don't render the popup if it's closed

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-gray-900 border-2 border-gray-400 rounded-lg p-6 w-full max-w-sm">
        <h2 className="text-white text-xl font-bold text-center mb-2">
          Get Started
        </h2>
        <p className="text-gray-400 text-sm text-center mb-4">
          Enter Meeting Code before joining
        </p>
        <div className="flex flex-col gap-3 mb-5">
          <input
            type="text"
            value={authUser.fullName}
            className="bg-gray-800 border border-gray-400 rounded-md p-2 text-white placeholder-gray-500 placeholder:uppercase focus:outline-none"
          />
          <input
            type="text"
            placeholder="ENTER CODE"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="bg-gray-800 border border-gray-400 rounded-md p-2 text-white placeholder-gray-500 placeholder:uppercase focus:outline-none"
          />
        </div>
        <div className="flex justify-between gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-transparent border border-gray-400 text-white rounded-md py-2 uppercase text-sm hover:bg-blue-500/10 transition"
          >
            Dismiss
          </button>
          <button
            onClick={handleJoin}
            className="flex-1 bg-blue-500 text-white rounded-md py-2 uppercase text-sm hover:bg-blue-600 transition"
          >
            Join Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default Popup;

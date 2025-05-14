import React from "react";
import { X } from "lucide-react";
import { FaMicrophone, FaVideo } from "react-icons/fa";
import { PiMicrophoneSlashLight } from "react-icons/pi";
import { CiVideoOff } from "react-icons/ci";

const PeopleSection = ({
  isPeopleOpen,
  setIsPeopleOpen,
  participants, // Ensure participants is always an object
  waitingToJoin, // Ensure waitingToJoin is always an array
  handleAllow,
  handleDeny,
}) => {
  if (!isPeopleOpen) return null;

  return (
    <div
      className /*"w-full h-[100%] sm:w-[90%] lg:w-[25%] bg-white text-black shadow-lg flex flex-col lg:overflow-hidden fixed bottom-50% sm:bottom-auto sm:right-0 sm:rounded-t-lg lg:static"*/={`absolute top-0 right-0 w-full sm:w-[50%] lg:w-[20%] h-full bg-gray-900 text-white shadow-lg flex flex-col overflow-hidden transition-transform duration-300 transform ${
        isPeopleOpen ? "translate-x-0" : "translate-x-full"
      } z-10`}
    >
      <div className="flex justify-between items-center p-4 border-b border-gray-300">
        <h2 className="text-lg font-semibold">People</h2>
        <button
          onClick={() => setIsPeopleOpen(false)}
          className="text-gray-500 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Waiting to Join Section */}
        {waitingToJoin.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">
              Waiting to Join
            </h3>
            {waitingToJoin.map((user) => (
              <div key={user.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-600 text-white text-xl">
                    {user.name[0].toUpperCase()}
                  </div>
                  <span className="font-medium text-sm">{user.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleDeny(user.id)}
                    className="text-red-500 hover:underline"
                  >
                    Deny
                  </button>
                  <button
                    onClick={() => handleAllow(user.id)}
                    className="text-green-500 hover:underline"
                  >
                    Allow
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* In This Meeting Section */}
        <h3 className="text-sm font-semibold text-gray-300 mt-4 mb-2">
          In this meeting
        </h3>
        {Object.keys(participants).length > 0 ? (
          Object.entries(participants).map(([id, participant]) => (
            <div key={id} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-600 text-white text-xl">
                  {participant.name[0].toUpperCase()}
                </div>
                <span className="font-medium text-sm">
                  {participant.name || "Unknown"}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {participant.mic ? (
                  <FaMicrophone className="text-green-500" />
                ) : (
                  <PiMicrophoneSlashLight className="text-gray-400" />
                )}
                {participant.video ? (
                  <FaVideo className="text-green-500" />
                ) : (
                  <CiVideoOff className="text-gray-400" />
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500">No participants yet.</p>
        )}
      </div>
    </div>
  );
};

export default PeopleSection;

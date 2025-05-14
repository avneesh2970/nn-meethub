import React from "react";

const LeaveModal = ({ isLeaveModalOpen, closeLeaveModal, handleSignOut }) => {
  if (!isLeaveModalOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg text-center">
        <p className="text-red-500 font-semibold mb-4">
          <span className="text-xl">⚠️</span> Are you sure you want to leave?
        </p>
        <p className="text-gray-600 mb-6">
          Other participants will remain in the meeting.
        </p>
        <div className="flex justify-center gap-4">
          <button
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
            onClick={closeLeaveModal}
          >
            Cancel
          </button>
          <button
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
            onClick={handleSignOut}
          >
            Leave Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveModal;

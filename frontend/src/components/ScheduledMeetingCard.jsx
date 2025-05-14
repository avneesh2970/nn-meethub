import React from "react";
import { Calendar, Clock, Video, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMeetingStore } from "../store/useMeetingStore";

const ScheduledMeetingCard = ({ meetings, onDelete }) => {
  const navigate = useNavigate();
  const { setSelectedMeeting } = useMeetingStore();

  const handleMeetingClick = (meeting) => {
    setSelectedMeeting(meeting);
    navigate("/pre-meeting-screen");
  };

  const handleDeleteClick = (e, meetingId) => {
    e.stopPropagation();
    console.log("Delete button clicked for meeting ID:", meetingId);
    onDelete(meetingId);
  };

  return (
    <div className="self-start ml-22">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-260">
        {meetings.map((meeting, index) => {
          return (
            <div
              key={index}
              className="relative bg-[#1E1C1C] p-4 rounded-lg shadow-lg hover:text-xl cursor-pointer sm:w-60 max-sm:w-58 max-sm:p-2 "
              onClick={() => handleMeetingClick(meeting)}
            >
              <div className="w-8 h-8 bg-[#232C4D] flex items-center justify-center rounded-lg mb-3 ">
                <Video color="white" />
              </div>
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
                onClick={(e) => handleDeleteClick(e, meeting._id)}
              >
                <X size={16} />
              </button>
              <div>
                <div className="flex justify-between">
                  <h3 className="text-white font-medium">{meeting.title}</h3>
                </div>
                <p className="text-gray-400 text-sm">{meeting.description}</p>
                <div className="flex justify-between ">
                  <div className="flex items-center text-gray-300 text-sm mt-1">
                    <Calendar size={12} className="mr-1" />
                    <span>{meeting.date}</span>
                  </div>
                  <div className="flex items-center text-gray-300 text-sm mt-1">
                    <Clock size={12} className="mt-1 mr-1" />
                    <span>{meeting.time}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScheduledMeetingCard;

import React, { useState, useEffect } from "react";
import { Video, Monitor, Calendar, Plus } from "lucide-react";

import calendarHolder from "../assests/calendarHolder.png";
import MeetingCard from "../components/MeetingCard";
import Modal from "../components/Modal";
import ScheduleMeetingForm from "../components/ScheduleMeetingForm";
import ScheduledMeetingCard from "../components/ScheduledMeetingCard";
import { useMeetingStore } from "../store/useMeetingStore";
import { useNavigate } from "react-router-dom";

const HomePage = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    meetings,
    fetchMeetings,
    addMeeting,
    removeMeeting,
    instantMeeting,
    joinMeeting,
  } = useMeetingStore();

  useEffect(() => {
    fetchMeetings(); // Fetch meetings from the backend on mount
  }, []);

  const handleSaveMeeting = async (newMeeting) => {
    await addMeeting(newMeeting);
  };

  const handleJoinMeeting = () => {
    navigate("/Ask-for-join");
  };

  const handleInstantMeeting = async () => {
    const meeting = await instantMeeting();
    if (meeting) {
      joinMeeting(meeting.meetingCode);
      navigate(`/Meeting-live/${meeting.meetingCode}`);
    } else {
      console.error("Failed to create instant meeting");
    }
  };

  return (
    <div className="min-h-screen bg-base-200 mt-20">
      {/* Meeting Options */}
      <div className="flex justify-center gap-6">
        <MeetingCard
          icon={<Plus />}
          title="Instant Meeting"
          onClick={handleInstantMeeting}
        />
        <MeetingCard
          icon={<Video />}
          title="Join Meeting"
          onClick={handleJoinMeeting}
        />
        <MeetingCard icon={<Monitor />} title="Later Meeting" />
        <MeetingCard
          icon={<Calendar />}
          title="Schedule Meeting"
          onClick={() => setIsModalOpen(true)}
        />
      </div>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <ScheduleMeetingForm
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveMeeting}
        />
      </Modal>

      <div className="mt-16 flex flex-col items-center">
        <h2 className="text-2xl font-semibold mb-4 text-white max-sm:self-start sm:self-start md:self-start lg:self-start lg:ml-23">
          Schedule Meeting
        </h2>
        {meetings.length === 0 ? (
          <div className="relative w-80 h-80 mt-20 flex justify-start items-center">
            <img
              src={calendarHolder}
              alt="Person Holding Calendar"
              className="w-full h-auto  rounded-lg "
            />
          </div>
        ) : (
          <ScheduledMeetingCard meetings={meetings} onDelete={removeMeeting} />
        )}
      </div>
    </div>
  );
};

export default HomePage;

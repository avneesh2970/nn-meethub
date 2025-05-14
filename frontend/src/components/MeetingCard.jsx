import React from "react";

const MeetingCard = ({ icon, title, onClick }) => {
  // Mapping for mobile-friendly titles
  const titleMapping = {
    "Instant Meeting": "Meeting",
    "Join Meeting": "Join",
    "Later Meeting": "Later",
    "Schedule Meeting": "Schedule",
  };
  return (
    <div
      className="bg-[#1E1C1C] text-white w-60 flex flex-col items-center lg:p-8 lg:bg-[#1E1C1C] lg:rounded-lg md:p-4 md:bg-[#1E1C1C] md:rounded-md max-sm:p-0 max-sm:bg-transparent hover:w-62 hover:text-xl group cursor-pointer transition-all duration-300"
      onClick={onClick}
    >
      <div className="w-10 h-10 bg-[#538DFF] flex items-center justify-center rounded-lg mb-3 transition-all duration-300 group-hover:shadow-[0_0_20px_5px_rgba(255,255,255,0.8)]">
        {icon}
      </div>
      <div />
      {/* Show full title on large screens, short title on small screens */}
      <p className="text-center text-white sm:block hidden">{title}</p>
      <p className="text-center text-white sm:hidden">
        {titleMapping[title] || title}
      </p>
    </div>
  );
};

export default MeetingCard;

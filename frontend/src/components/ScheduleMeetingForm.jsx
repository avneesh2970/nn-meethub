import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { ClipboardCheck, Timer, Calendar, Copy } from "lucide-react";
import toast from "react-hot-toast";

const ScheduleMeetingForm = ({ isOpen, onClose, onSave }) => {
  const [meetingCode, setMeetingCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    time: "",
    description: "",
  });

  useEffect(() => {
    if (isOpen) {
      setMeetingCode(uuidv4().slice(0, 12)); // Generate a short meeting ID
      setCopied(false); // Reset copy state when modal opens
    }
  }, [isOpen]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(meetingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.time) {
      toast.error("Please fill all required fields!");
      return;
    }

    const baseUrl = window.location.origin;
    const meetingUrl = `${baseUrl}/api/meetings/Meeting-live/${meetingCode}`;

    // Pass meeting data to parent
    let formattedDate = "";
    let formattedTime = "";

    if (formData.date) {
      formattedDate = new Date(formData.date).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }

    if (formData.time) {
      formattedTime = new Date(
        `1970-01-01T${formData.time}`
      ).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
    onSave({
      ...formData,
      meetingCode,
      meetingUrl,
      time: formattedTime,
      date: formattedDate,
    });

    // Reset form
    setFormData({ title: "", date: "", time: "", description: "" });

    // Close modal
    onClose();
  };

  if (!isOpen) return null;
  return (
    <div>
      <h2 className="text-xl font-semibold text-white">Schedule Meeting</h2>
      <p className="text-gray-400">Create a meeting</p>

      {/* Meeting Form */}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Meeting Name"
          className="w-full p-2 mt-3 bg-transparent text-white border border-gray-600 rounded"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
        {/* Time Input */}
        <div className="relative w-full">
          <span className="absolute left-3 top-1/2  -translate-y-1/2 mt-2 text-gray-400 ">
            <Timer size={20} />
          </span>
          <input
            type="text"
            placeholder="Time"
            className="w-full p-2 pl-10 mt-3 bg-transparent text-white border border-gray-600 rounded cursor-pointer"
            value={formData.time}
            onFocus={(e) => (e.target.type = "time")}
            onBlur={(e) => (e.target.type = "text")}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
          />
        </div>

        {/* Date Input */}
        <div className="relative w-full">
          <span className="absolute left-3 top-1/2 mt-2 -translate-y-1/2 text-gray-400 ">
            <Calendar size={20} />
          </span>
          <input
            type="text"
            placeholder="Date"
            className="w-full p-2 pl-10 mt-3 bg-transparent text-white border border-gray-600 rounded cursor-pointer"
            value={formData.date}
            onFocus={(e) => (e.target.type = "date")}
            onBlur={(e) => (e.target.type = "text")}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />
        </div>
        <textarea
          placeholder="Description"
          className="w-full p-2 mt-3 bg-transparent text-white border border-gray-600 rounded"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
        />

        <div className="flex items-center justify-center gap-2  p-2 w-full mt-4">
          <button
            type="button"
            onClick={copyToClipboard}
            className="text-gray-300 hover:text-white"
          >
            {copied ? <ClipboardCheck size={18} /> : <Copy size={18} />}
          </button>
          <span className="text-sm font-mono">{meetingCode}</span>
        </div>

        {/* Buttons */}
        <div className="flex justify-between mt-4">
          <button
            className="bg-transparent hover:bg-gray-700 text-white border border-gray-600  py-1 px-11 rounded"
            onClick={onClose}
          >
            Discard
          </button>
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-13 rounded"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

export default ScheduleMeetingForm;

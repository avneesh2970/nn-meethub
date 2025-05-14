import React, { useEffect, useRef } from "react";
import { PiMicrophoneSlashLight } from "react-icons/pi";
import { FaMicrophone } from "react-icons/fa";
import { useMeetingStore } from "../store/useMeetingStore";
import { useAuthStore } from "../store/useAuthStore";

const ParticipantView = ({
  selected,
  participants,
  toggleParticipantMic,
  isChatOpen,
  isPeopleOpen,
}) => {
  const videoRefs = useRef({});
  // AUDIO CHANGE: Add audioRefs to manage audio elements for each participant
  const audioRefs = useRef({});
  // Access streams directly from store if needed
  const streams = useMeetingStore((state) => state.streams);

  // NEW: Get the local user's ID to exclude them from rendering
  const { authUser } = useAuthStore();

  // Assign streams to video elements when streams change
  useEffect(() => {
    Object.entries(participants).forEach(([id, participant]) => {
      // FEEDBACK LOOP FIX: Skip the local user
      if (id === authUser?._id) {
        console.log(`Skipping local user ${id} in ParticipantView`);
        return;
      }
      let videoStream = streams[id]?.screen || streams[id]?.video;
      const videoElement = videoRefs.current[id];

      if (
        videoStream &&
        videoElement &&
        videoElement.srcObject !== videoStream
      ) {
        console.log(`Assigning stream for ${id}:`, videoStream);
        videoElement.pause();
        videoElement.srcObject = videoStream;
        videoRefs.current[id].muted = true; // 11-05-2025 NEW CHANGE FOR UNMUTE
        videoElement.load();
        videoElement.play().catch((err) => {
          console.error(`Error playing video for ${id}:`, err);
        });
      } else if (!videoStream && videoElement && videoElement.srcObject) {
        videoElement.pause();
        // Clear srcObject if stream is removed
        videoElement.srcObject = null;
        console.log(`Clearing stream for ${id}`);
      }

      // AUDIO CHANGE: Handle audio stream independently
      const audioStream = streams[id]?.video; // Audio is part of the video stream
      const audioElement = audioRefs.current[id];

      if (audioStream && audioElement) {
        const audioTracks = audioStream.getAudioTracks();
        if (audioTracks.length > 0) {
          // Create a new MediaStream with only audio tracks
          const audioOnlyStream = new MediaStream(audioTracks);
          if (audioElement.srcObject !== audioOnlyStream) {
            console.log(`Assigning audio stream for ${id}:`, audioOnlyStream);
            audioElement.srcObject = audioOnlyStream;
            // Ensure the audio element is not muted
            audioElement.muted = false;
            audioElement.play().catch((err) => {
              console.error(`Error playing audio for ${id}:`, err);
            });
          }
        } else {
          console.log(`No audio tracks found for ${id}`);
        }
      } else if (!audioStream && audioElement && audioElement.srcObject) {
        audioElement.pause();
        audioElement.srcObject = null;
        console.log(`Clearing audio stream for ${id}`);
      }
    });
  }, [streams, participants, selected]);

  useEffect(() => {
    if (Object.keys(participants).length > 0) {
      console.log("ParticipantView, participants:", participants);
    }
    Object.entries(participants).forEach(([id, participant]) => {
      // FEEDBACK LOOP FIX: Skip the local user in logging as well
      if (id === authUser?._id) return;
      // Access the stream from the store
      const stream = streams?.[id]?.video || participant.stream;
      console.log("ParticipantView, stream:", stream);
      console.log("ParticipantView, streams:", streams);
    });
  }, [participants, streams]);

  return (
    <>
      {/* Sidebar for Mobile */}
      {selected === "Sidebar" && (
        <div className="absolute bottom-4 right-4 w-[34%] h-[30%] bg-gray-800 rounded-lg overflow-hidden lg:hidden">
          {Object.entries(participants)
            .filter(([id]) => id !== authUser?._id)
            .map(([id, participant]) => (
              <div key={id} className="relative w-full h-full">
                {participant?.video ? (
                  <video
                    ref={(video) => {
                      if (video) {
                        videoRefs.current[id] = video;
                      }
                    }}
                    autoPlay
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  ></video>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white text-4xl font-semibold rounded-md">
                    {participant.name[0].toUpperCase()}
                  </div>
                )}
                {/* AUDIO CHANGE: Add audio element for each participant */}
                <audio
                  ref={(audio) => {
                    if (audio) {
                      audioRefs.current[id] = audio;
                    }
                  }}
                  autoPlay
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2 flex justify-between items-center">
                  <span className="text-sm font-semibold text-white">
                    {participant.name}
                  </span>
                  <button
                    className="text-xs bg-gray-700 text-white px-2 py-1 rounded"
                    onClick={() => toggleParticipantMic(id)}
                  >
                    {participant.mic ? (
                      <FaMicrophone />
                    ) : (
                      <PiMicrophoneSlashLight />
                    )}
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Sidebar for Desktop */}
      {selected === "Sidebar" && (
        <div
          className={`absolute hidden  lg:flex flex-col w-[20%] text-white p-4 overflow-y-auto gap-4 transition-all duration-300 ${
            isChatOpen || isPeopleOpen ? "left-[60%]" : "left-[80%]"
          }`}
        >
          {Object.entries(participants)
            .filter(([id]) => id !== authUser?._id)
            .map(([id, participant]) => (
              <div
                key={id}
                className="relative bg-gray-800 rounded-lg overflow-hidden"
              >
                {participant?.video ? (
                  <video
                    ref={(video) => {
                      if (video) {
                        videoRefs.current[id] = video;
                      }
                    }}
                    autoPlay
                    muted
                    className="w-full h-32 object-cover transform scale-x-[-1]"
                  ></video>
                ) : (
                  <div className="w-full h-32 flex items-center justify-center bg-gray-800 text-white text-4xl font-semibold rounded-md">
                    {participant.name[0].toUpperCase()}
                  </div>
                )}
                {/* AUDIO CHANGE: Add audio element for each participant */}
                <audio
                  ref={(audio) => {
                    if (audio) {
                      audioRefs.current[id] = audio;
                    }
                  }}
                  autoPlay
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2 flex justify-between items-center">
                  <span className="text-sm font-semibold">
                    {participant.name}
                  </span>
                  <button
                    className="text-xs bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-600 transition"
                    onClick={() => toggleParticipantMic(id)}
                  >
                    {participant.mic ? (
                      <FaMicrophone />
                    ) : (
                      <PiMicrophoneSlashLight />
                    )}
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Tiled Layout Section */}
      {selected === "Tiled" && (
        <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(participants)
            .filter(([id]) => id !== authUser?._id)
            .map(([id, participant]) => (
              <div
                key={id}
                className="relative bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center"
              >
                {participant?.video ? (
                  <video
                    ref={(video) => {
                      if (video) {
                        videoRefs.current[id] = video;
                      }
                    }}
                    autoPlay
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  ></video>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white text-7xl font-semibold rounded-md">
                    {participant.name[0].toUpperCase()}
                  </div>
                )}
                {/* AUDIO CHANGE: Add audio element for each participant */}
                <audio
                  ref={(audio) => {
                    if (audio) {
                      audioRefs.current[id] = audio;
                    }
                  }}
                  autoPlay
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2 flex justify-between items-center">
                  <span className="text-sm font-semibold text-white">
                    {participant.name}
                  </span>
                  <button
                    className="text-xs bg-gray-700 text-white px-2 py-1 rounded"
                    onClick={() => toggleParticipantMic(id)}
                  >
                    {participant.mic ? (
                      <FaMicrophone />
                    ) : (
                      <PiMicrophoneSlashLight />
                    )}
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </>
  );
};

export default ParticipantView;

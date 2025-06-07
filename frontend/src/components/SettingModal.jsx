import { useState, useRef, useEffect } from "react";
import { Bell, Settings, X } from "lucide-react";
import { IoVideocamOutline, IoMicOutline } from "react-icons/io5";
import { HiOutlineSpeakerWave } from "react-icons/hi2";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuthStore } from "../store/useAuthStore";
import { useMeetingStore } from "../store/useMeetingStore";

const useDeviceStore = create(
  persist(
    (set) => ({
      selectedVideoDevice: "",
      selectedMicDevice: "",
      selectedSpeakerDevice: "",
      setSelectedVideoDevice: (deviceId) =>
        set({ selectedVideoDevice: deviceId }),
      setSelectedMicDevice: (deviceId) => set({ selectedMicDevice: deviceId }),
      setSelectedSpeakerDevice: (deviceId) =>
        set({ selectedSpeakerDevice: deviceId }),
    }),
    {
      name: "device-settings",
      getStorage: () => localStorage,
    }
  )
);

const SettingModal = ({
  isModalOpen,
  closeSidebar,
  activeItem,
  setActiveItem,
  layouts,
  selected,
  changeLayout,
  tools,
  toggleStates,
  handleToggle,
  switchDevice, // New prop to call useMeetingStore.switchDevice
}) => {
  const [isSidebarVisible, setIsSidebarVisible] = useState(true); // State to toggle sidebar visibility on mobile
  const modalContentRef = useRef(null);

  const { authUser } = useAuthStore();
  const { streams } = useMeetingStore();

  const {
    selectedVideoDevice,
    setSelectedVideoDevice,
    selectedMicDevice,
    setSelectedMicDevice,
    selectedSpeakerDevice,
    setSelectedSpeakerDevice,
  } = useDeviceStore();
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isTestingSpeaker, setIsTestingSpeaker] = useState(false);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const enumerateDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        console.log("Enumerated devices:", devices);

        const video = devices.filter((device) => device.kind === "videoinput");
        const audioInputs = devices.filter(
          (device) => device.kind === "audioinput"
        );
        const audioOutputs = devices.filter(
          (device) => device.kind === "audiooutput"
        );

        setVideoDevices(video);
        setAudioInputDevices(audioInputs);
        setAudioOutputDevices(audioOutputs);

        if (!selectedVideoDevice && video.length > 0) {
          setSelectedVideoDevice(video[0].deviceId);
        }
        if (!selectedMicDevice && audioInputs.length > 0) {
          setSelectedMicDevice(audioInputs[0].deviceId);
        }
        if (!selectedSpeakerDevice && audioOutputs.length > 0) {
          setSelectedSpeakerDevice(audioOutputs[0].deviceId);
        }
      } catch (error) {
        console.error("Error enumerating devices:", error);
      }
    };

    if (isModalOpen && activeItem === "Device Settings") {
      enumerateDevices();
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    isModalOpen,
    activeItem,
    selectedVideoDevice,
    selectedMicDevice,
    selectedSpeakerDevice,
    setSelectedVideoDevice,
    setSelectedMicDevice,
    setSelectedSpeakerDevice,
  ]);

  useEffect(() => {
    const setupMicVisualizer = () => {
      const stream = streams[authUser._id]?.video;
      if (!stream || stream.getAudioTracks().length === 0) {
        console.warn("No audio stream available for visualizer");
        return;
      }

      try {
        audioContextRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
        const source = audioContextRef.current.createMediaStreamSource(stream);

        // Create AnalyserNode for audio visualization
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256; // Smaller FFT size for faster response
        source.connect(analyserRef.current);

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Function to calculate audio level and update state
        const updateAudioLevel = () => {
          analyserRef.current.getByteFrequencyData(dataArray);

          // Calculate average frequency (RMS-like approximation)
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;

          // Map the average (0-255) to a percentage (0-100)
          const level = Math.min((average / 255) * 100, 100);
          setAudioLevel(level);

          // Continue animation
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        };

        // Start the visualization loop
        updateAudioLevel();

        console.log("Audio visualizer setup for user:", authUser._id);
      } catch (error) {
        console.error("Error setting up audio visualizer:", error);
      }
    };

    if (
      isModalOpen &&
      activeItem === "Device Settings" &&
      streams[authUser._id]?.video
    ) {
      setupMicVisualizer();
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isModalOpen, activeItem, streams, authUser._id]);

  const handleVideoDeviceChange = async (deviceId) => {
    setSelectedVideoDevice(deviceId);
    if (switchDevice) {
      try {
        await switchDevice("video", deviceId);
        // Removed onStreamUpdate(newStream) since preview isn't needed
      } catch (err) {
        console.error("Error switching video device:", err);
      }
    }
  };

  const handleMicDeviceChange = async (deviceId) => {
    setSelectedMicDevice(deviceId);
    if (switchDevice) {
      try {
        await switchDevice("audio", deviceId);
      } catch (err) {
        console.error("Error switching audio device:", err);
      }
    }
  };

  const testSpeaker = () => {
    setIsTestingSpeaker(true);
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);

    if (selectedSpeakerDevice && oscillator.setSinkId) {
      oscillator.setSinkId(selectedSpeakerDevice).catch((err) => {
        console.error("Error setting speaker device:", err);
      });
    }

    oscillator.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 1);

    oscillator.onended = () => {
      setIsTestingSpeaker(false);
      audioContext.close();
      console.log("Speaker test completed");
    };
  };

  // Handle outside click to close modal
  const handleOutsideClick = (e) => {
    if (
      modalContentRef.current &&
      !modalContentRef.current.contains(e.target)
    ) {
      closeSidebar();
    } else {
      e.stopPropagation();
    }
  };

  if (!isModalOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-opacity-1"
      onClick={handleOutsideClick}
    >
      <div
        ref={modalContentRef}
        className="flex flex-col md:flex-row items-center justify-center mt-8 w-full md:w-[50%]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar: Always visible on desktop, toggled on mobile */}
        <div
          className={`w-full md:w-64 bg-gray-900 text-white p-4 rounded-tl-lg md:rounded-bl-lg ${
            isSidebarVisible || "hidden md:block"
          }`}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Settings</h2>
            <button
              onClick={closeSidebar} // Close the modal
              className="text-gray-400 hover:text-white md:hidden" // Hide button on desktop
            >
              <X size={20} />
            </button>
          </div>
          <ul className="space-y-2 h-85">
            <li
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-800 rounded-lg"
              onClick={() => {
                setActiveItem("Change Layout");
                setIsSidebarVisible(false); // Hide sidebar on mobile
              }}
            >
              <Bell size={18} />
              <span>Change Layout</span>
            </li>
            <li
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-800 rounded-lg"
              onClick={() => {
                setActiveItem("Device Settings");
                setIsSidebarVisible(false); // Hide sidebar on mobile
              }}
            >
              <Settings size={18} />
              <span>Device Settings</span>
            </li>
            <li
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-800 rounded-lg"
              onClick={() => {
                setActiveItem("Host Tools");
                setIsSidebarVisible(false); // Hide sidebar on mobile
              }}
            >
              <Bell size={18} />
              <span>Host Tools</span>
            </li>
          </ul>
        </div>

        {/* Content: Always visible on desktop, toggled on mobile */}
        <div
          className={`w-full md:w-96 h-auto bg-gray-900 text-white p-6 rounded-b-lg md:rounded-tr-lg md:rounded-br-lg ${
            isSidebarVisible && "hidden md:block"
          }`}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">{activeItem}</h2>
            <button
              onClick={() => {
                if (isSidebarVisible) {
                  closeSidebar(); // Close the modal
                } else {
                  setIsSidebarVisible(true); // Show sidebar on mobile
                }
              }}
              className="text-gray-400 hover:text-white " // Hide button on desktop
            >
              <X size={20} />
            </button>
          </div>

          {activeItem === "Change Layout" && (
            <div className="space-y-3 h-85 w-full overflow-x-auto">
              {layouts.map((layout) => (
                <label
                  key={layout.name}
                  className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-800"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="layout"
                      value={layout.name}
                      checked={selected === layout.name}
                      onChange={() => changeLayout(layout.name)}
                      className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500"
                    />
                    <span>{layout.name}</span>
                  </div>
                  <img src={layout.img} alt="" className="w-12 h-8" />
                </label>
              ))}
            </div>
          )}

          {activeItem === "Device Settings" && (
            <div className="space-y-6 h-85 w-full overflow-x-auto">
              <div>
                <h3 className="text-sm font-medium mb-2">Video</h3>
                <div className="flex items-center gap-2 bg-gray-800 text-white p-2 rounded-lg min-w-0">
                  <IoVideocamOutline size={20} />
                  <select
                    className="flex-1 max-w-[calc(100%-4rem)] bg-gray-800 text-white p-2 rounded-lg truncate"
                    value={selectedVideoDevice}
                    onChange={(e) => handleVideoDeviceChange(e.target.value)}
                  >
                    {videoDevices.length > 0 ? (
                      videoDevices.map((device) => (
                        <option
                          key={device.deviceId}
                          value={device.deviceId}
                          className="truncate"
                        >
                          {device.label ||
                            `Camera ${device.deviceId.slice(0, 5)}`}
                        </option>
                      ))
                    ) : (
                      <option>No video devices found</option>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">Microphone</h3>
                <div className="flex items-center gap-2 bg-gray-800 text-white p-2 rounded-lg mb-2 min-w-0">
                  <IoMicOutline size={20} />
                  <select
                    className="flex-1 max-w-[calc(100%-3rem)] bg-gray-800 text-white p-2 rounded-lg truncate"
                    value={selectedMicDevice}
                    onChange={(e) => handleMicDeviceChange(e.target.value)}
                  >
                    {audioInputDevices.length > 0 ? (
                      audioInputDevices.map((device) => (
                        <option
                          key={device.deviceId}
                          value={device.deviceId}
                          className="truncate"
                        >
                          {device.label ||
                            `Microphone ${device.deviceId.slice(0, 5)}`}
                        </option>
                      ))
                    ) : (
                      <option>No microphones found</option>
                    )}
                  </select>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <IoMicOutline size={20} />
                  <div className="flex-1 h-4 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-50"
                      style={{ width: `${audioLevel}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">Speakers</h3>
                <div className="flex flex-col sm:flex-row items-center gap-2 bg-gray-800 text-white p-2 rounded-lg w-full min-w-0">
                  <div className="flex items-center gap-2 w-full min-w-0">
                    <HiOutlineSpeakerWave size={20} />
                    <select
                      className="flex-1 max-w-[calc(100%-3rem)] bg-gray-800 text-white p-2 rounded-lg truncate"
                      value={selectedSpeakerDevice}
                      onChange={(e) => setSelectedSpeakerDevice(e.target.value)}
                    >
                      {audioOutputDevices.length > 0 ? (
                        audioOutputDevices.map((device) => (
                          <option
                            key={device.deviceId}
                            value={device.deviceId}
                            className="truncate"
                          >
                            {device.label ||
                              `Speaker ${device.deviceId.slice(0, 5)}`}
                          </option>
                        ))
                      ) : (
                        <option>No speakers found</option>
                      )}
                    </select>
                  </div>

                  <button
                    className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 flex items-center gap-2 w-full sm:w-auto"
                    onClick={testSpeaker}
                    disabled={isTestingSpeaker}
                  >
                    <HiOutlineSpeakerWave size={20} />
                    {isTestingSpeaker ? "Testing..." : "Test"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeItem === "Host Tools" && (
            <div className="space-y-6 h-85 w-full overflow-x-auto">
              <p className="text-sm text-gray-400">
                Allow all participants to:
              </p>
              <ul className="space-y-4">
                {tools.map((tool) => (
                  <li key={tool} className="flex items-center justify-between">
                    <span>{tool}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={toggleStates[tool]}
                        onChange={() => handleToggle(tool)}
                      />
                      <div
                        className={`w-13 h-6 rounded-full transition-all duration-300 ${
                          toggleStates[tool] ? "bg-blue-600" : "bg-gray-400"
                        }`}
                      >
                        <div
                          className={`absolute w-6 h-6 bg-white rounded-full shadow-md transform transition-all duration-300 ${
                            toggleStates[tool]
                              ? "translate-x-8"
                              : "translate-x-1"
                          }`}
                        ></div>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingModal;

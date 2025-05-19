import React, { useRef, useState, useEffect } from "react";
import { X } from "lucide-react";
import { FaPaperPlane } from "react-icons/fa";
import { useAuthStore } from "../store/useAuthStore";

const ChatSection = ({
  isChatOpen,
  setIsChatOpen,
  socket,
  selected,
  setHasNewMessage,
}) => {
  const chatContainerRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const { authUser } = useAuthStore();
  const userName = authUser?.fullName || "Guest"; // Fallback to "Guest" if authUser is null

  useEffect(() => {
    socket.on("newMessage", (message) => {
      console.log("newMessage received:", message); // Debug
      setMessages((prev) => [...prev, message]);
      if (!isChatOpen || isScrolledUp) {
        setHasNewMessage(true);
      }
    });

    return () => {
      socket.off("newMessage");
    };
  }, [socket, isChatOpen, isScrolledUp, setHasNewMessage]);

  useEffect(() => {
    // Reset new message alert when chat is opened
    if (isChatOpen) {
      setHasNewMessage(false);
      scrollToBottom();
    }
  }, [isChatOpen, setHasNewMessage]);

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        chatContainerRef.current;
      const atBottom = scrollTop + clientHeight < scrollHeight - 10;
      setIsScrolledUp(atBottom);

      if (atBottom) {
        setHasNewMessage(false);
      }
    }
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      const message = { sender: userName, text: newMessage };
      //setMessages((prev) => [...prev, message]);
      socket.emit("sendMessage", message);
      setNewMessage("");
      scrollToBottom();
    }
  };

  if (!isChatOpen) return null;

  return (
    <div
      className /*{`w-full h-[100%] sm:w-[90%] lg:w-[25%] bg-white text-black shadow-lg flex flex-col lg:overflow-hidden fixed bottom-50% sm:bottom-auto sm:right-0 sm:rounded-t-lg lg:static`}*/={`absolute top-0 right-0 w-full sm:w-[50%] lg:w-[20%] h-full bg-gray-900 text-white shadow-lg flex flex-col overflow-hidden transition-transform duration-300 transform ${
        isChatOpen ? "translate-x-0" : "translate-x-full"
      } z-10`}
    >
      <div className="flex justify-between items-center p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold">Chat</h2>
        <button
          onClick={() => setIsChatOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4"
      >
        {messages.length > 0 ? (
          messages.map((msg, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-600 text-white text-xl">
                {msg.sender[0].toUpperCase()}
              </div>
              <div className="message-content flex-1 overflow-x-hidden">
                <p className="font-semibold text-sm">
                  {msg.sender || "unknown"}
                </p>
                <p className="text-sm text-gray-300 break-all bg-gray-800 rounded-lg p-2">
                  {msg.text || "F"}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-400">No messages yet.</p>
        )}
      </div>
      {isScrolledUp && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-16 right-6 bg-blue-500 h-9 w-9 text-white p-2 rounded-full shadow-lg hover:bg-blue-600 sm:relative sm:bottom-auto sm:right-auto"
        >
          ↓
        </button>
      )}
      <div className="p-4 border-t border-gray-300">
        <div className="flex items-center space-x-3">
          <input
            type="text"
            placeholder="Send a message to everyone"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // prevents newline if form wrapped
                sendMessage();
              }
            }}
          />
          <button
            onClick={sendMessage}
            className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600"
          >
            <FaPaperPlane />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatSection;

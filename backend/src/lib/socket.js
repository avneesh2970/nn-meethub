import express from "express";
import http from "http";
import { Server } from "socket.io";
import Meeting from "../models/meeting-model.js"

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "http://localhost:5173" }, // Adjust for production
});

// Map to store socket IDs for users in meetings: { meetingCode: { userId: socketId } }
const meetingSocketMap = {};

// Utility to get socket IDs of participants in a meeting
export function getMeetingParticipantsSocketIds(meetingCode) {
    return meetingSocketMap[meetingCode] ? Object.values(meetingSocketMap[meetingCode]) : [];
}

// Utility to get a specific user's socket ID in a meeting
export function getParticipantSocketId(meetingCode, userId) {
    return meetingSocketMap[meetingCode]?.[userId] || null;
}

io.on("connection", (socket) => {
    if (socket.connected) {
        console.log("User connected (backend connection)", socket.id);
    }
    if (!socket?.connected) {
        console.error("Socket not connected (backend connection)");
    }

    // User joins a meeting
    socket.on("joinMeeting", async ({ meetingCode, userId }) => {
        if (!meetingCode || !userId) {
            socket.emit("error", "Meeting code and user ID are required");
            return;
        }
        console.log("Join meeting of code : ", meetingCode)

        // Join the meeting room
        socket.join(meetingCode);

        // Initialize meetingSocketMap for this meeting if it doesn’t exist
        if (!meetingSocketMap[meetingCode]) {
            meetingSocketMap[meetingCode] = {};
        }

        // Store the user’s socket ID
        meetingSocketMap[meetingCode][userId] = socket.id;

        // Fetch meeting from DB to validate and get participants
        const meeting = await Meeting.findOne({ meetingCode });
        const meetingId = meeting._id.toString()
        if (!meeting) {
            socket.emit("error", "Meeting not found");
            return;
        }
        console.log(" Join Meeting event (backend) userId: ", userId);

        {/*const participant = meeting.participants.find((p) => p.user.toString() === userId.toString());
        if (!participant || participant.status !== "joined") {
            console.log("not allowed to join yet (backend)")

            socket.emit("error", "Not allowed to join yet");
            return;
        }*/}

        // Notify all in the meeting about updated participants
        // io.to(meetingCode).emit("participantUpdate", meeting.participants);

        // Request existing users to send their media states    
        socket.to(meetingCode).emit("requestParticipantStates");

        socket.on("shareParticipantState", ({ participantId, mic, video, screenSharing }) => {
            io.to(meetingCode).emit("updateParticipantState", { participantId, mic, video, screenSharing });
        });

        // Toggle Mic
        socket.on("toggleMic", ({ participantId, mic }) => {
            console.log("toggleMic received:", { participantId, mic });
            io.to(meetingCode).emit("toggleMic", { participantId, mic });
            io.to(meetingCode).emit("streamUpdate", { userId: participantId, mic });
        });

        // Toggle Video
        socket.on("toggleVideo", ({ participantId, video }) => {
            console.log("toggleVideo received:", { participantId, video });
            io.to(meetingCode).emit("toggleVideo", { participantId, video });
            io.to(meetingCode).emit("streamUpdate", { userId: participantId, video });
        });

        socket.on("streamUpdate", ({ userId, meetingCode, mic, video, screenSharing }) => {
            socket.to(meetingCode).emit("streamUpdate", { userId, mic, video, screenSharing });
        });

        { /*
        // WebRTC signaling
        socket.on("signal", (data) => {
            io.to(meetingCode).emit("signal", { userId, signal: data.signal });
        });
        */}

        socket.on("webrtc-offer", ({ to, from, offer, meetingCode }) => {
            console.log("webrtc-offer from", from, "to", to);
            const socketId = getParticipantSocketId(meetingCode, to);
            if (socketId) {
                io.to(socketId).emit("webrtc-offer", { from, to, offer });
            } else {
                console.error("No socket found for user:", to);
            }
        });

        socket.on("webrtc-answer", ({ to, from, answer, meetingCode }) => {
            console.log("webrtc-answer from", from, "to", to);
            const socketId = getParticipantSocketId(meetingCode, to);
            if (socketId) {
                io.to(socketId).emit("webrtc-answer", { from, to, answer });
            } else {
                console.error("No socket found for user:", to);
            }
        });

        socket.on("ice-candidate", ({ to, from, candidate, meetingCode }) => {
            console.log("ice-candidate from", from, "to", to);
            const socketId = getParticipantSocketId(meetingCode, to);
            if (socketId) {
                io.to(socketId).emit("ice-candidate", { from, to, candidate });
            } else {
                console.error("No socket found for user:", to);
            }
        });

        // Chat
        socket.on("sendMessage", (message) => {
            console.log("sendMessage received:", message);
            io.to(meetingCode).emit("newMessage", {
                sender: message.sender, // Use sender name directly
                text: message.text,     // Use text directly
                userId: userId,         // Optional: keep userId for reference
                timestamp: new Date(),
            });
        });

        // Raise Hand
        socket.on("raiseHand", () => {
            io.to(meetingCode).emit("handRaised", { userId });
        });


        socket.on("activeScreenSharer", ({ userId }) => {
            console.log("ActiveScreenSharer received (Socket.lib):", { userId });
            io.to(meetingCode).emit("activeScreenSharer", { userId });
        });

        socket.on("updateHostTools", async ({ tool }) => {
            console.log("updateHostTools received (Socket.lib):", tool);
            const meeting = await Meeting.findOne({ meetingCode });
            if (meeting) {
                let backendTool = tool;

                if (tool === "Share Screen") {
                    backendTool = "ScreenShare";
                }
                meeting.settings[backendTool] = !meeting.settings[backendTool];
                await meeting.save();
                console.log("Meeting settings updated:", meeting.settings);
            }

            io.to(meetingCode).emit("updateHostTools", { tool });
        });

        socket.on("sendEmoji", ({ name, emoji }) => {
            console.log("sendEmoji received:", { name, emoji });
            io.to(meetingCode).emit("sendEmoji", { name, emoji });
        });

        // Screen Share Toggle
        socket.on("screenShareToggled", (userId, isSharing) => {
            console.log("screenShareToggled received (Socket.lib):", { userId, isSharing });
            io.to(meetingCode).emit("screenShareToggled", { userId, isSharing });
            io.to(meetingCode).emit("streamUpdate", { userId, screenSharing: isSharing });
        });

        socket.on("startScreenShare", async ({ userId }) => {

            const meeting = await Meeting.findOne({ meetingCode });
            if (meeting) {
                console.log("startScreenShare received in backend(participants):", meeting.participants);
                const participant = meeting.participants.find((p) => p.user.toString() === userId.toString());
                console.log("startScreenShare received in backend(participant):", participant);
                if (participant) {
                    participant.screenSharing = true;
                    io.to(meetingCode).emit("screenShareToggled", {
                        userId: participant.user,
                        isSharing: true,
                    });
                    io.to(meetingCode).emit("streamUpdate", { userId, screenSharing: true });
                    {/*io.to(meetingCode).emit("participantUpdate", {
                        userId: participant.user,
                        name: participant.name,
                        status: participant.status,
                        mic: participant.mic,
                        video: participant.video,
                        screenSharing: true,
                    });*/}
                }
            }
        });

        socket.on("stopScreenShare", async ({ userId }) => {
            const meeting = await Meeting.findOne({ meetingCode });

            if (meeting) {
                const participant = meeting.participants.find((p) => p.user.toString() === userId.toString());
                if (participant) {
                    participant.screenSharing = false;
                    io.to(meetingCode).emit("screenShareToggled", {
                        userId: participant.user,
                        isSharing: false,
                    });

                    io.to(meetingCode).emit("streamUpdate", { userId, screenSharing: false });
                    {/*io.to(meetingCode).emit("participantUpdate", {
                        userId: participant.user,
                        name: participant.name,
                        status: participant.status,
                        mic: participant.mic,
                        video: participant.video,
                        screenSharing: false,
                    });*/}
                }
            }
        });

        socket.on("leaveMeeting", async (data) => {
            console.log("leaveMeeting received:", data);

            if (!data || typeof data !== "object" || !data.meetingCode || !data.userId) {
                console.error("Invalid leaveMeeting payload:", data);
                socket.emit("error", "Invalid leaveMeeting data");
                return;
            }

            const { meetingCode, userId } = data;



            if (meetingSocketMap[meetingCode] && meetingSocketMap[meetingCode][userId]) {
                delete meetingSocketMap[meetingCode][userId];

                // Clean up if no participants remain in the meeting
                if (Object.keys(meetingSocketMap[meetingCode]).length === 0) {
                    delete meetingSocketMap[meetingCode];
                }

                const meeting = await Meeting.findOne({ meetingCode });
                if (meeting) {
                    const participantIdx = meeting.participants.findIndex(
                        (p) => p.user.toString() === userId.toString()
                    );
                    if (participantIdx !== -1) {
                        meeting.participants.splice(participantIdx, 1);
                        await meeting.save();
                    }
                    io.to(meetingCode).emit("participantUpdate", meeting.participants);

                    // If host leaves, end the meeting
                    if (meeting.host.toString() === userId.toString()) {
                        console.log("Host leaving, ending meeting:", meetingCode);
                        io.to(meetingCode).emit("meetingEnded", { meetingId });
                        delete meetingSocketMap[meetingCode];
                    }
                }
            }
        });

        // Handle meeting end
        socket.on("endMeeting", ({ meetingCode }) => {
            io.to(meetingCode).emit("meetingEnded", { meetingId });
            if (meetingSocketMap[meetingCode]) {
                delete meetingSocketMap[meetingCode];
            }
        });

        // Handle disconnect
        socket.on("disconnect", async () => {
            console.log("A user disconnected", socket.id);
        });
    });


});

export { io, app, server };
import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore.js";

const debounce = (func, wait) => {
    const timeouts = {};
    return (...args) => {
        const key = args[0]; // Use participantId as key
        clearTimeout(timeouts[key]);
        timeouts[key] = setTimeout(() => func(...args), wait);
    };
};

export const useMeetingStore = create((set, get) => ({
    meetings: [],
    selectedMeeting: null,
    loading: false,
    participants: {},
    waitingToJoin: [],
    hostId: null,
    myStatus: null,
    meetingCode: null,
    isLeaving: false,
    count: 0,
    setCount: (count) => set({ count: count }),

    // Local streams for each user
    streams: {},
    peerConnections: {},
    iceServers: null,
    renegotiationQueue: {}, // New: Queue for pending re-negotiations
    pendingOffers: {}, // New: Queue for pending offers
    activeScreenSharer: null,
    /*setActiveScreenSharer: (userId) => {
        console.log("setActiveScreenSharer called with userId:", userId);
        const activeSharer = get().activeScreenSharer;
        const currentUserId = useAuthStore.getState().authUser?._id;
        const socket = useAuthStore.getState().socket;
        if (activeSharer && activeSharer !== currentUserId) {
            toast.error("Someone else is already sharing their screen");
            return;
        }
        set({ activeScreenSharer: userId });
        socket.emit("ActiveScreenSharer", { userId });
        console.log("Active screen sharer set to:", activeSharer);
    },*/
    setActiveScreenSharer: (userId) => {
        set({ activeScreenSharer: userId });
    },

    setIceServers: (servers) => set({ iceServers: servers }),

    setLocalStream: (userId, stream) => set((state) => ({
        streams: { ...state.streams, [userId]: { ...state.streams[userId], video: stream } },
    })),

    setScreenStream: (userId, stream) => {
        set((state) => ({
            streams: { ...state.streams, [userId]: { ...state.streams[userId], screen: stream } },
        }));
        // Trigger re-negotiation for all peer connections
        const { peerConnections } = get();
        const authUserId = useAuthStore.getState().authUser?._id;
        console.log("SET SCREEN STREAM BEFORE RENEGOTIATE: ", get().streams, "peerConnections: ", peerConnections);
        Object.keys(peerConnections).forEach((participantId) => {
            console.log("SET SCREEN STREAM FOR PARTICIPANT: ", participantId, "authUserId: ", authUserId);
            //get().renegotiatePeerConnection(participantId);
            get().queueRenegotiation(participantId); // Queue instead of direct renegotiation
        });
    },

    // Add a remote stream to the streams object
    addRemoteStream: (userId, stream, streamType = 'video') => {
        // CHANGE: Append new tracks to existing stream instead of overwriting
        // Prevents losing screen tracks when new tracks (e.g., audio) are received
        const isScreenShare = get().activeScreenSharer === userId && streamType === 'video';
        let newStream;

        if (isScreenShare) {
            // For screen share, create a new MediaStream with only the screen track
            newStream = new MediaStream(stream.getTracks());
            console.log(`Replacing stream for ${userId} with screen share stream`);
        } else {
            // For camera/audio, append to existing stream
            newStream = get().streams[userId]?.[streamType] || new MediaStream();
            stream.getTracks().forEach(track => {
                if (!newStream.getTrackById(track.id)) {
                    newStream.addTrack(track);
                }
            });
            console.log(`Appending ${streamType} tracks to existing stream for ${userId}`);
        }
        set((state) => ({
            streams: {
                ...state.streams,
                [userId]: {
                    ...state.streams[userId],
                    [streamType]: newStream
                }
            },
        }))
    },

    // Initialize a peer connection for a specific participant
    initPeerConnection: (participantId) => {
        const { iceServers, peerConnections } = get();
        const authUserId = useAuthStore.getState().authUser?._id;
        const socket = useAuthStore.getState().socket;

        if (!iceServers || !authUserId || !socket?.connected) {
            console.error("Cannot initialize peer connection: missing data", {
                iceServers,
                authUserId,
                socketConnected: socket?.connected,
            });
            return null;
        }

        // Skip if connection already exists
        if (peerConnections[participantId]) {
            console.log(`Peer connection for ${participantId} already exists`);
            return peerConnections[participantId];
        }

        console.log(`Initializing peer connection for ${participantId}`);

        // Create a new RTCPeerConnection
        const peerConnection = new RTCPeerConnection({
            iceServers: iceServers
        });

        // Store the connection in state
        set((state) => ({
            peerConnections: {
                ...state.peerConnections,
                [participantId]: peerConnection
            },
            renegotiationQueue: { ...state.renegotiationQueue, [participantId]: [] },
            pendingOffers: { ...state.pendingOffers, [participantId]: [] },
        }));

        console.log("INIT PEER CONNECTION: ", get().peerConnections);

        // Handle ICE candidate events
        peerConnection.onicecandidate = (event) => {
            console.log("INIT PEER CONNECTION, ICE CANDIDATE: ", event.candidate);
            if (event.candidate) {
                console.log(`Sending ICE candidate to ${participantId}`);
                socket.emit("ice-candidate", {
                    to: participantId,
                    from: authUserId,
                    candidate: event.candidate,
                    meetingCode: get().meetingCode
                });
            }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log(`Connection state for ${participantId}: ${peerConnection.connectionState}`);
            if (peerConnection.connectionState === 'failed' ||
                peerConnection.connectionState === 'disconnected' ||
                peerConnection.connectionState === 'closed') {
                // Clean up and try to reconnect
                get().cleanupPeerConnection(participantId);

                // If the meeting is still active, try to reconnect after a short delay
                if (get().myStatus === 'joined') {
                    setTimeout(() => {
                        console.log(`Attempting to reconnect with ${participantId} (onconnectionstatechange)`);
                        get().createPeerConnection(participantId);
                    }, 2000);
                }
            }
        };

        // Handle track events - when remote peer adds tracks
        peerConnection.ontrack = (event) => {
            console.log(`[ON TRACK] Received track from ${participantId}:`, event.track.kind);

            // Determine if this is video or audio track
            //const streamType = event.track.kind === 'video' ? 'video' : 'audio';
            const streamType = event.track.kind === 'video' && get().activeScreenSharer === participantId ? 'screen' : event.track.kind;
            { /*const existingStream = get().streams[participantId]?.video || new MediaStream();
            const track = event.track;
            if (!existingStream.getTrackById(track.id)) {
                existingStream.addTrack(track);
            }*/}

            // Create a new MediaStream if one doesn't exist
            const stream = event.streams[0] || new MediaStream([event.track]);

            // Add the remote stream to our state
            get().addRemoteStream(participantId, stream, streamType);
            console.log("Remote stream added after add Remote stream:", get().streams);
        };

        peerConnection.onsignalingstatechange = () => {
            console.log(`Signaling state for ${participantId}: ${peerConnection.signalingState}`);
            if (peerConnection.signalingState === 'stable') {
                get().processRenegotiationQueue(participantId);
                get().processPendingOffers(participantId);
            }
        };

        return peerConnection;
    },

    queueRenegotiation: debounce((participantId) => {
        const { peerConnections } = get();
        if (!peerConnections[participantId]) {
            console.warn(`No peer connection for ${participantId}, cannot queue renegotiation`);
            return;
        }
        set((state) => ({
            renegotiationQueue: {
                ...state.renegotiationQueue,
                [participantId]: [...(state.renegotiationQueue[participantId] || []), Date.now()]
            }
        }));
        console.log(`Queued renegotiation for ${participantId}`);
        get().processRenegotiationQueue(participantId);
    }, 500),

    processRenegotiationQueue: (participantId) => {
        const RENEGOTIATION_TIMEOUT = 5000;
        const { renegotiationQueue, peerConnections } = get();
        const queue = renegotiationQueue[participantId] || [];
        if (queue.length === 0 || !peerConnections[participantId]) {
            return;
        }
        console.log("PROCESS RENEGOTIATION QUEUE: ", queue, "peerConnection: ", peerConnections[participantId], "state: ", peerConnections[participantId].signalingState);
        const peerConnection = peerConnections[participantId];

        // CHANGE: Check for stalled renegotiations
        const oldestEntry = queue[0];
        const timeElapsed = Date.now() - oldestEntry;
        if (timeElapsed > RENEGOTIATION_TIMEOUT && peerConnection.signalingState !== 'stable') {
            console.warn(`Renegotiation for ${participantId} stalled for ${timeElapsed}ms, forcing reset`);
            try {
                if (peerConnection.rollback) {
                    peerConnection.rollback();
                } else {
                    peerConnection.setLocalDescription({ type: 'rollback' });
                }
            } catch (error) {
                console.error(`Error resetting peer connection for ${participantId}:`, error);
                // Clear the queue to prevent infinite looping
                set((state) => ({
                    renegotiationQueue: {
                        ...state.renegotiationQueue,
                        [participantId]: []
                    }
                }));
                return;
            }
        }

        if (peerConnection.signalingState === 'stable') {
            console.log(`Processing renegotiation queue for ${participantId}`);
            get().renegotiatePeerConnection(participantId);
            set((state) => ({
                renegotiationQueue: {
                    ...state.renegotiationQueue,
                    [participantId]: state.renegotiationQueue[participantId].slice(1)
                }
            }));
        } else {
            console.log(`Delaying renegotiation for ${participantId}, signaling state: ${peerConnection.signalingState}`);
            // CHANGE: Schedule another check if the queue is not empty
            setTimeout(() => get().processRenegotiationQueue(participantId), 100);
        }
    },

    queueOffer: (data) => {
        const { from } = data;
        // CHANGE: Add timestamp to the offer data
        const offerWithTimestamp = { ...data, timestamp: Date.now() };
        set((state) => ({
            pendingOffers: {
                ...state.pendingOffers,
                [from]: [...(state.pendingOffers[from] || []), offerWithTimestamp]
            }
        }));
        console.log(`Queued offer from ${from}`);
    },

    processPendingOffers: (participantId) => {
        const RENEGOTIATION_TIMEOUT = 5000;
        const { pendingOffers, peerConnections } = get();
        const offers = pendingOffers[participantId] || [];
        if (offers.length === 0 || !peerConnections[participantId]) {
            return;
        }
        const peerConnection = peerConnections[participantId];
        console.log("PROCESS PENDING OFFERS: ", offers, "peerConnection: ", peerConnection, "state: ", peerConnection.signalingState);

        // CHANGE: Check for stalled offers
        const oldestOffer = offers[0];
        const timeElapsed = Date.now() - oldestOffer.timestamp; // Assuming timestamp is added when queuing
        if (timeElapsed > RENEGOTIATION_TIMEOUT && peerConnection.signalingState !== 'stable') {
            console.warn(`Offer processing for ${participantId} stalled for ${timeElapsed}ms, forcing reset`);
            try {
                if (peerConnection.rollback) {
                    peerConnection.rollback();
                } else {
                    peerConnection.setLocalDescription({ type: 'rollback' });
                }
            } catch (error) {
                console.error(`Error resetting peer connection for ${participantId}:`, error);
                // Clear the queue to prevent infinite looping
                set((state) => ({
                    pendingOffers: {
                        ...state.pendingOffers,
                        [participantId]: []
                    }
                }));
                return;
            }
        }

        if (peerConnection.signalingState === 'stable') {
            const offerData = offers[0];
            console.log(`Processing pending offer from ${participantId}`);
            get().handleOffer(offerData);
            set((state) => ({
                pendingOffers: {
                    ...state.pendingOffers,
                    [participantId]: state.pendingOffers[participantId].slice(1)
                }
            }));
        } else {
            console.log(`Delaying offer processing for ${participantId}, signaling state: ${peerConnection.signalingState}`);
            // CHANGE: Schedule another check if the queue is not empty
            setTimeout(() => get().processPendingOffers(participantId), 100);
        }
    },



    // Create a peer connection and send an offer
    createPeerConnection: async (participantId) => {
        const peerConnection = get().initPeerConnection(participantId);
        console.log("Create peer connection for participantId: ", participantId, "peerConnection: ", peerConnection)
        const socket = useAuthStore.getState().socket;
        const authUserId = useAuthStore.getState().authUser?._id;
        const { streams } = get();

        if (!peerConnection || !socket?.connected) return;

        // Add local streams to the peer connection
        if (streams[authUserId]?.video) {
            const videoStream = streams[authUserId].video;
            videoStream.getTracks().forEach(track => {
                console.log(`Adding ${track.kind} track to peer connection for ${participantId}`);
                peerConnection.addTrack(track, videoStream);
            });
            // CHANGE: Log the tracks being added
            console.log(`Tracks added to peer connection for ${participantId}:`, videoStream.getTracks());
        }

        // If screen sharing, add that stream too
        if (streams[authUserId]?.screen) {
            const screenStream = streams[authUserId].screen;
            screenStream.getTracks().forEach(track => {
                console.log(`Adding screen ${track.kind} track to peer connection for ${participantId}`);
                peerConnection.addTrack(track, screenStream);
            });
        }

        try {
            console.log("CREATING AN OFFER!!")
            // Create an offer
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });

            // Set local description
            await peerConnection.setLocalDescription(offer);

            // Send the offer to the peer
            console.log(`Sending offer to ${participantId}`);
            socket.emit("webrtc-offer", {
                to: participantId,
                from: authUserId,
                offer: offer,
                meetingCode: get().meetingCode
            });
        } catch (error) {
            console.error(`Error creating offer for ${participantId}:`, error);
            console.log("Error in createPeerConnection:", error);
            toast.error("Failed to establish connection with a participant(createPeerConnection)");
        }
    },

    renegotiatePeerConnection: async (participantId) => {
        const peerConnection = get().peerConnections[participantId];
        const socket = useAuthStore.getState().socket;
        const authUserId = useAuthStore.getState().authUser?._id;
        const { streams } = get();

        if (!peerConnection || !socket?.connected) {
            console.error(`Cannot renegotiate: No peer connection for ${participantId}`);
            return;
        }

        if (peerConnection.signalingState !== 'stable') {
            console.log(`Queuing renegotiation for ${participantId}, current state: ${peerConnection.signalingState}`);
            get().queueRenegotiation(participantId);
            return;
        }

        // Remove existing senders to avoid duplicates
        // CHANGE: Only remove senders for tracks that are no longer active
        // Prevents dropping active screen tracks during renegotiation

        peerConnection.getSenders().forEach(sender => {
            if (sender.track && !streams[authUserId]?.video?.getTrackById(sender.track.id) &&
                !streams[authUserId]?.screen?.getTrackById(sender.track.id)) {
                peerConnection.removeTrack(sender);
            }
        });

        if (streams[authUserId]?.video) {
            const videoStream = streams[authUserId].video;
            videoStream.getTracks().forEach(track => {
                if (!peerConnection.getSenders().find(sender => sender.track === track)) {
                    console.log(`Adding ${track.kind} track for renegotiation to ${participantId}`);
                    peerConnection.addTrack(track, videoStream);
                }
            });
            // CHANGE: Log the tracks being added
            console.log(`Tracks added for renegotiation to ${participantId}:`, videoStream.getTracks());
        }

        // Add new screen tracks 
        if (streams[authUserId]?.screen) {
            const screenStream = streams[authUserId].screen;
            screenStream.getTracks().forEach(track => {
                if (!peerConnection.getSenders().find(sender => sender.track === track)) {
                    console.log("TRACK TRACK TRACK :", { track })
                    console.log(`Adding screen ${track.kind} track for renegotiation to ${participantId}`);
                    peerConnection.addTrack(track, screenStream);
                }
            });
        }

        try {
            console.log(`Renegotiating with ${participantId}`);
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            await peerConnection.setLocalDescription(offer);
            console.log(`Sending renegotiation offer to ${participantId}`);
            socket.emit("webrtc-offer", {
                to: participantId,
                from: authUserId,
                offer: offer,
                meetingCode: get().meetingCode
            });
        } catch (error) {
            console.error(`Error renegotiating with ${participantId}:`, error);
            toast.error("Failed to renegotiate connection");
        }
    },

    //CHANGE 08/10/2023

    switchDevice: async (deviceType, deviceId) => {
        const authUserId = useAuthStore.getState().authUser?._id;
        const { streams, peerConnections } = get();

        if (!authUserId) {
            console.error("No auth user ID found for switching device");
            return null;
        }

        try {
            let newStream;
            const currentStream = streams[authUserId]?.video || new MediaStream();

            if (deviceType === "video") {
                // Stop existing video tracks
                currentStream.getVideoTracks().forEach(track => track.stop());

                // Fetch new video stream
                newStream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: deviceId },
                    audio: currentStream.getAudioTracks().length > 0 // Keep audio constraints
                        ? { deviceId: currentStream.getAudioTracks()[0].getSettings().deviceId }
                        : false,
                });

                console.log(`Switched video device for ${authUserId} to ${deviceId}`);
            } else if (deviceType === "audio") {
                // Stop existing audio tracks
                currentStream.getAudioTracks().forEach(track => track.stop());

                // Fetch new audio stream
                const audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: { deviceId: deviceId },
                });

                // Merge new audio track with existing video tracks
                newStream = new MediaStream();
                currentStream.getVideoTracks().forEach(track => newStream.addTrack(track));
                audioStream.getTracks().forEach(track => newStream.addTrack(track));

                console.log(`Switched audio device for ${authUserId} to ${deviceId}`);
            } else {
                throw new Error("Invalid device type");
            }

            // Update local stream
            get().setLocalStream(authUserId, newStream);

            // Trigger renegotiation for all participants
            Object.keys(peerConnections).forEach(participantId => {
                console.log(`Queuing renegotiation for ${participantId} due to device switch`);
                get().queueRenegotiation(participantId);
            });

            return newStream; // Return the new stream for local preview update
        } catch (error) {
            console.error(`Error switching ${deviceType} device:`, error);
            toast.error(`Failed to switch ${deviceType} device`);
            return null;
        }
    },

    // Handle an incoming offer and send an answer
    handleOffer: async (data) => {
        const { from, offer } = data;
        const socket = useAuthStore.getState().socket;
        const authUserId = useAuthStore.getState().authUser?._id;
        const { streams } = get();

        console.log(`Received offer from ${from}`);

        // Initialize peer connection if it doesn't exist
        const peerConnection = get().initPeerConnection(from);

        if (!peerConnection || !socket?.connected) return;

        // Skip if offer is already being processed
        if (peerConnection.signalingState !== 'stable') {
            const pendingOffers = get().pendingOffers[from] || [];
            if (pendingOffers.some(pending => JSON.stringify(pending.offer) === JSON.stringify(offer))) {
                console.log(`Skipping duplicate offer from ${from}`);
                return;
            }
            // CHANGE: Handle glare scenario when in 'have-local-offer' state
            if (peerConnection.signalingState === 'have-local-offer') {
                console.log(`Glare detected with ${from}, rolling back local offer`);
                try {
                    // Roll back the local offer (modern WebRTC)
                    if (peerConnection.rollback) {
                        await peerConnection.rollback();
                    } else {
                        // Fallback for older WebRTC implementations
                        await peerConnection.setLocalDescription({ type: 'rollback' });
                    }
                } catch (error) {
                    console.error(`Error rolling back local offer for ${from}:`, error);
                    return;
                }
            } else {
                // Queue the offer if in another non-stable state (e.g., 'have-remote-offer')
                console.log(`Queuing offer from ${from}, current state: ${peerConnection.signalingState}`);
                get().queueOffer(data);
                return;
            }
            /*console.log(`Queuing offer from ${from}, current state: ${peerConnection.signalingState}`);
            get().queueOffer(data);
            return;*/
        }

        try {
            // Set remote description
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            // Remove existing senders to avoid duplicates
            // CHANGE: Only remove senders for inactive tracks
            // Ensures active screen tracks are preserved
            peerConnection.getSenders().forEach(sender => {
                if (sender.track && !streams[authUserId]?.video?.getTrackById(sender.track.id) &&
                    !streams[authUserId]?.screen?.getTrackById(sender.track.id)) {
                    peerConnection.removeTrack(sender);
                }
            });

            // Add local tracks, but only if no sender exists for the track
            if (streams[authUserId]?.video) {
                const videoStream = streams[authUserId].video;
                videoStream.getTracks().forEach(track => {
                    if (!peerConnection.getSenders().find(sender => sender.track === track)) {
                        console.log(`Adding ${track.kind} track to peer connection for ${from} (useMeetingStore)`);
                        peerConnection.addTrack(track, videoStream);
                    }
                });
            }

            if (streams[authUserId]?.screen) {
                const screenStream = streams[authUserId].screen;
                screenStream.getTracks().forEach(track => {
                    if (!peerConnection.getSenders().find(sender => sender.track === track)) {
                        console.log(`Adding screen ${track.kind} track to peer connection for ${from}`);
                        peerConnection.addTrack(track, screenStream);
                    }
                });
            }


            // Create an answer
            const answer = await peerConnection.createAnswer();

            // Set local description
            await peerConnection.setLocalDescription(answer);

            // Send the answer to the peer
            console.log(`Sending answer to ${from}`);
            socket.emit("webrtc-answer", {
                to: from,
                from: authUserId,
                answer: answer,
                meetingCode: get().meetingCode
            });
        } catch (error) {
            console.error(`Error handling offer from ${from}:`, error);
            toast.error("Failed to establish connection with a participant(OFFER)");
        }
    },

    // Handle an incoming answer
    handleAnswer: async (data) => {
        const { from, answer } = data;
        const { peerConnections } = get();

        console.log(`Received answer from ${from}`);

        const peerConnection = peerConnections[from];
        if (!peerConnection) {
            console.error(`No peer connection found for ${from}`);
            return;
        }

        try {
            // Set remote description
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log(`Successfully set remote description for ${from}`);
        } catch (error) {
            console.error(`Error handling answer from ${from}:`, error);
        }
    },

    // Handle ICE candidate
    handleIceCandidate: async (data) => {
        const { from, candidate } = data;
        const { peerConnections } = get();

        console.log(`Received ICE candidate from ${from}`);

        const peerConnection = peerConnections[from];
        if (!peerConnection) {
            console.error(`No peer connection found for ${from}`);
            return;
        }

        try {
            // Add ICE candidate
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log(`Successfully added ICE candidate for ${from}`);
        } catch (error) {
            console.error(`Error handling ICE candidate from ${from}:`, error);
        }
    },

    // Initialize connections with all participants
    initializeConnections: () => {
        console.log("Initializing connections with all participants");
        const { participants, peerConnections } = get();
        const authUserId = useAuthStore.getState().authUser?._id;

        // For each participant, create a peer connection
        // For each participant, create a peer connection only if no connection exists
        Object.keys(participants).forEach(participantId => {
            if (participantId !== authUserId && !peerConnections[participantId]) {
                // Only initiate connection if authUserId is lexicographically smaller
                if (authUserId < participantId) {
                    console.log(`Initializing new connection with ${participantId} (authUserId ${authUserId} is smaller)`);
                    get().createPeerConnection(participantId);
                } else {
                    console.log(`Waiting for ${participantId} to initiate connection (authUserId ${authUserId} is larger)`);
                }
            } else if (peerConnections[participantId]) {
                console.log(`Skipping ${participantId}: peer connection already exists`);
            }
        });
    },

    // Clean up a specific peer connection
    cleanupPeerConnection: (participantId) => {
        const { peerConnections } = get();

        const peerConnection = peerConnections[participantId];
        if (peerConnection) {
            console.log(`Cleaning up peer connection for ${participantId}`);
            peerConnection.close();

            // Remove from state
            set((state) => {
                const newPeerConnections = { ...state.peerConnections };
                delete newPeerConnections[participantId];
                const newRenegotiationQueue = { ...state.renegotiationQueue };
                delete newRenegotiationQueue[participantId];
                const newPendingOffers = { ...state.pendingOffers };
                delete newPendingOffers[participantId];
                return {
                    peerConnections: newPeerConnections,
                    renegotiationQueue: newRenegotiationQueue,
                    pendingOffers: newPendingOffers
                };
            });
        }
    },

    // Clean up all peer connections
    cleanupAllConnections: () => {
        const { peerConnections } = get();

        Object.keys(peerConnections).forEach(participantId => {
            get().cleanupPeerConnection(participantId);
        });

        // Clean up streams too
        set({ streams: {}, peerConnections: {}, renegotiationQueue: {}, pendingOffers: {} });
    },

    // Setters for state variables
    setParticipants: (participants) => set({ participants }),

    setSelectedMeeting: (meeting) => set({ selectedMeeting: meeting }),

    setMyStatus: (participants) => {
        const authUserId = useAuthStore.getState().authUser?._id;
        if (!authUserId) {
            console.error("No authUser found to set myStatus");
            return;
        }
        console.log("participants: ", participants);
        console.log("authUserId: ", authUserId);
        const myParticipant = participants.find(
            (p) => {
                console.log("participant user id: ", p.user)
                return p.user.toString() === authUserId.toString()
            }
        );
        console.log("myParticipant: ", myParticipant)
        const newStatus = myParticipant ? myParticipant.status : null;
        console.log("Setting myStatus for user", authUserId, "to", newStatus);
        set({ myStatus: newStatus });
    },


    fetchMeetings: async () => {
        set({ loading: true });
        try {
            const res = await axiosInstance.get("/meetings");
            set({ meetings: res.data });
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to fetch meetings");
        } finally {
            set({ loading: false });
        }
    },

    addMeeting: async (newMeeting) => {
        set({ loading: true });
        try {
            const response = await axiosInstance.post("/meetings", newMeeting);
            set((state) => ({ meetings: [...state.meetings, response.data] }));
        } catch (error) {
            console.log("error in add meeting:" + error)
            toast.error(error.response?.data?.message || "Failed to add meeting");
        } finally {
            set({ loading: false });
        }
    },

    instantMeeting: async () => {
        set({ loading: true });
        try {
            const response = await axiosInstance.post("/meetings/instant");
            set((state) => ({ meetings: [...state.meetings, response.data] }));
            return response.data; // Return the created meeting data
        } catch (error) {
            console.log("error in instant meeting:" + error)
            toast.error(error.response?.data?.message || "Failed to create instant meeting");
        } finally {
            set({ loading: false });
        }
    },

    removeMeeting: async (meetingId) => {
        set({ loading: true });
        try {
            await axiosInstance.delete(`/meetings/${meetingId}`);
            set((state) => ({
                meetings: state.meetings.filter((meeting) => meeting._id !== meetingId)
            }));
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to delete meeting");
        } finally {
            set({ loading: false });
        }
    },

    joinMeeting: async (meetingCode) => {
        set({ loading: true });
        try {
            const res = await axiosInstance.post("/meetings/join", { meetingCode });
            console.log("response in join", res);
            const meeting = res.data;
            // Only set iceServers if not already set
            if (!get().iceServers) {
                get().setIceServers(res.data.iceServers);
                console.log("ice servers in join meeting:", res.data.iceServers);
            }
            set({
                selectedMeeting: meeting,
                meetingCode: meeting.meetingCode,
                hostId: meeting.host,
                participants: meeting.participants
                    .filter((p) => p.status === "joined")
                    .reduce((acc, p) => {
                        console.log("join meeting store: ", p);
                        acc[p.user._id || p.user] = {
                            name: p.name || "Unknown",
                            status: p.status,
                            mic: true,
                            video: true,
                            screenSharing: false,
                        };
                        return acc;
                    }, {}),
                waitingToJoin: meeting.participants
                    .filter((p) => p.status === "waiting")
                    .map((p) => ({ id: p.user._id || p.user, name: p.name || "Unknown" })),
                myStatus: meeting.status,
            });
            console.log("join meeting store MY-STATUS: ", get().myStatus);

            get().subscribeToMeetingEvents();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to join meeting");
        } finally {
            set({ loading: false });
        }
    },



    leaveMeeting: async (options = {}) => {
        const { meetingCode, isLeaving, streams } = get();
        const socket = useAuthStore.getState().socket;
        const userId = useAuthStore.getState().authUser?._id;

        if (isLeaving) {
            console.log("Already leaving, skipping duplicate call");
            return;
        }
        console.log("leaveMeeting called for user:", userId, "meetingCode:", meetingCode, "stack:", new Error().stack);
        if (!meetingCode || !userId || !socket?.connected) {
            console.error("Cannot leave meeting: missing data or socket not connected", {
                meetingCode,
                userId,
                socketConnected: socket?.connected,
            });
            toast.error("Failed to leave meeting: Invalid state");
            return;
        }

        set({ isLeaving: true });

        try {
            get().cleanupAllConnections();
            if (streams[userId]?.video) {
                streams[userId].video.getTracks().forEach((track) => track.stop());
            }
            if (streams[userId]?.screen) {
                streams[userId].screen.getTracks().forEach((track) => track.stop());
            }
            // Skip API call if triggered by meeting end
            if (!options.meetingEnded) {
                console.log("Sending leave request to API:", { meetingCode });
                await axiosInstance.post("/meetings/leave", { meetingCode }).catch((err) => {
                    console.warn("Leave API failed (possibly already left):", err.response?.data);
                });
            } else {
                console.log("Meeting ended by host, skipping API call");
            }
            console.log("Emitting leaveMeeting event:", { meetingCode, userId });
            socket.emit("leaveMeeting", { meetingCode, userId });
            // Clean up socket listeners
            socket.off("participantUpdate");
            socket.off("meetingEnded");
            socket.off("toggleMic");
            socket.off("toggleVideo");
            socket.off("screenShareToggled");
            socket.off("streamUpdate");
            socket.off("updateParticipantState");
            socket.off("webrtc-offer");
            socket.off("webrtc-answer");
            socket.off("ice-candidate");
            socket.off("sendEmoji");
            set({
                selectedMeeting: null,
                meetingCode: null,
                participants: {},
                waitingToJoin: [],
                hostId: null,
                myStatus: null,
                streams: {},
                peerConnections: {},
                renegotiationQueue: {},
                pendingOffers: {}
            });

            console.log("Leaving meeting, redirecting to /");
            window.location.href = "/";
        } catch (err) {
            console.error("Error leaving meeting:", err);
            toast.error(err.response?.data?.message || "Failed to leave meeting");
            set({ isLeaving: false });
        } finally {
            set({ isLeaving: false });
        }
    },

    allowParticipant: async (userId) => {
        const { meetingCode, participants, waitingToJoin } = get();
        const user = waitingToJoin.find((u) => u.id === userId);
        if (!user) return;

        try {
            await axiosInstance.post("/meetings/allow", { meetingCode, userId });
            set({
                participants: {
                    ...participants,
                    [userId]: { name: user.name, mic: false, video: false, screenSharing: false },
                },
                waitingToJoin: waitingToJoin.filter((u) => u.id !== userId),
            });
            const socket = useAuthStore.getState().socket;
            socket.emit("participantUpdate", {
                meetingCode,
                userId,
                status: "joined",
            });
            toast.success(`${user.name} has been allowed to join`);
        } catch (err) {
            console.error("Error allowing participant:", err);
            toast.error("Failed to allow participant");
        }
    },

    denyParticipant: async (userId) => {
        const { meetingCode, waitingToJoin } = get();
        const user = waitingToJoin.find((u) => u.id === userId);
        if (!user) return;

        try {
            await axiosInstance.post("/meetings/deny", { meetingCode, userId });
            set({
                waitingToJoin: waitingToJoin.filter((u) => u.id !== userId),
            });
            const socket = useAuthStore.getState().socket;
            socket.emit("participantUpdate", {
                meetingCode,
                userId,
                status: "denied",
            });
            toast.success(`${user.name} has been denied`);
        } catch (err) {
            console.error("Error denying participant:", err);
            toast.error("Failed to deny participant");
        }
    },

    subscribeToMeetingEvents: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;
        if (!socket?.connected) {
            console.error("Socket not connected, cannot join meeting");
            throw new Error("Socket not connected");
        }

        const { meetingCode } = get().selectedMeeting;
        const userId = useAuthStore.getState().authUser._id;

        console.log("subscribeToMeetingEvents with userId: " + userId + ", meetingCode: " + meetingCode)
        socket.emit("joinMeeting", { meetingCode, userId });

        socket.on("participantUpdate", (participants) => {
            console.log("participantUpdate event received: ", participants);
            const currentPCs = get().peerConnections;
            const currentParticipants = get().participants;

            Object.keys(currentParticipants).forEach((pId) => {
                if (!participants.find((p) => (p.user._id || p.user) === pId)) {
                    if (currentPCs[pId]) {
                        get().cleanupPeerConnection(pId);
                    }
                }
            });
            set({
                participants: participants
                    .filter((p) => p.status === "joined")
                    .reduce((acc, p) => {
                        acc[p.user._id || p.user] = {
                            name: p.name || "Unknown",
                            status: p.status,
                            mic: currentParticipants[p.user._id || p.user]?.mic || false,
                            video: currentParticipants[p.user._id || p.user]?.video || false,
                            screenSharing: currentParticipants[p.user._id || p.user]?.screenSharing || false,
                        };
                        return acc;
                    }, {}),
                waitingToJoin: participants
                    .filter((p) => p.status === "waiting")
                    .map((p) => ({ id: p.user._id || p.user, name: p.name || "Unknown" })),
            });
            // Re-initialize connections for new participants
            get().initializeConnections();
        });

        socket.on("meetingEnded", ({ meetingId }) => {
            console.log("meetingEnded event received, calling leaveMeeting");
            get().leaveMeeting({ meetingEnded: true });
            get().removeMeeting(meetingId);
            toast.success("Meeting has ended");
        });

        socket.on("toggleMic", ({ participantId, mic }) => {
            const audioStream = get().streams[participantId]?.audio;
            const audioTrack = audioStream?.getAudioTracks()[0];

            const videoStream = get().streams[participantId]?.video;
            const vidAudioTrack = videoStream?.getAudioTracks()[0];
            console.log("toggleMic event received VIDEO-audioTrack:", vidAudioTrack);


            console.log("toggleMic event received audioTrack:", audioTrack);
            {/*set((state) => ({
                streams: {
                    ...state.streams,
                    [participantId]: {
                        ...state.streams[participantId], audio: audioTrack.enabled
                    }
                }
            }));*/}


            set((state) => ({
                participants: {
                    ...state.participants,
                    [participantId]: { ...state.participants[participantId], mic },
                },
            }));

            if (participantId !== userId) {
                const peerConnection = get().peerConnections[participantId];
                if (peerConnection) {
                    const senders = peerConnection.getSenders();
                    const audioSender = senders.find(sender => sender.track?.kind === 'audio');
                    if (audioSender && audioSender.track?.enabled !== mic) {
                        console.log(`Queuing renegotiation for ${participantId} due to mic state change`);
                        get().queueRenegotiation(participantId);
                    }
                }
            }
        });

        socket.on("toggleVideo", ({ participantId, video }) => {
            set((state) => ({
                participants: {
                    ...state.participants,
                    [participantId]: { ...state.participants[participantId], video },
                },
            }));
            if (participantId !== userId) {
                const peerConnection = get().peerConnections[participantId];
                if (peerConnection) {
                    const senders = peerConnection.getSenders();
                    const videoSender = senders.find(sender => sender.track?.kind === 'video');
                    if (videoSender && videoSender.track?.enabled !== video) {
                        console.log(`Queuing renegotiation for ${participantId} due to video state change`);
                        get().queueRenegotiation(participantId);
                    }
                }
            }
        });

        socket.on("screenShareToggled", ({ userId, isSharing }) => {
            console.log("screenShareToggled event received (useMeetingStore):", { userId, isSharing });
            if (isSharing === false) {
                get().setCount(0);
            }
            set((state) => ({
                participants: {
                    ...state.participants,
                    [userId]: { ...state.participants[userId], screenSharing: isSharing },
                },
            }));
        });


        socket.on("activeScreenSharer", ({ userId }) => {
            console.log("ActiveScreenSharer event received:", { userId });
            get().setActiveScreenSharer(userId);

        });


        socket.on("sendEmoji", ({ name, emoji }) => {
            console.log("sendEmoji event received:", { name, emoji });
            toast(`${name} reacted with: ${emoji}`);
        });

        socket.on("streamUpdate", ({ userId, mic, video, screenSharing }) => {
            console.log("streamUpdate received:", { userId, mic, video, screenSharing });


            const newStreams = get().streams;
            const newParticipants = get().participants;

            if (mic !== undefined && newStreams[userId]?.video) {
                const audioTrack = newStreams[userId].video.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = mic;
                }
                newParticipants[userId] = { ...newParticipants[userId], mic };
            }

            if (video !== undefined && newStreams[userId]?.video) {
                const videoTrack = newStreams[userId].video.getVideoTracks()[0];
                if (videoTrack) {
                    videoTrack.enabled = video;
                }
                newParticipants[userId] = { ...newParticipants[userId], video };
            }

            if (screenSharing !== undefined) {
                if (!screenSharing && newStreams[userId]?.screen) {
                    newStreams[userId].screen.getTracks().forEach((track) => track.stop());
                    delete newStreams[userId].screen;
                }
                newParticipants[userId] = { ...newParticipants[userId], screenSharing };
            }

            set({ streams: newStreams });
            set({ participants: newParticipants });
            console.log("Updated streams and participants:", { newStreams, newParticipants });
            // Trigger re-negotiation for the user if not self
            if (userId !== useAuthStore.getState().authUser._id) {
                get().queueRenegotiation(userId);
            }
        });

        socket.on("updateParticipantState", ({ participantId, mic, video, screenSharing }) => {
            console.log("updateParticipantState received:", { participantId, mic, video, screenSharing });
            set((state) => ({
                participants: {
                    ...state.participants,
                    [participantId]: {
                        ...state.participants[participantId],
                        mic,
                        video,
                        screenSharing,
                    },
                },
            }));
        });
        return () => {
            socket.off("participantUpdate");
            socket.off("meetingEnded");
            // Remove other listeners
        };
    },

}));


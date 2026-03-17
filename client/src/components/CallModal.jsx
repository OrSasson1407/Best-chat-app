import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import styled from "styled-components";
import { FaPhoneSlash, FaPhone, FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash } from "react-icons/fa";
import { toast } from "react-toastify"; // NEW: Imported toast for premium alerts

export default function CallModal({ socket, currentUser, currentChat, incomingCallData, closeModal }) {
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(!!incomingCallData);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  useEffect(() => {
    // 1. Request Camera & Mic Permissions
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((currentStream) => {
      setStream(currentStream);
      if (myVideo.current) {
        myVideo.current.srcObject = currentStream;
      }
      
      // 2. If we initiated the call (no incoming data), call the user immediately
      if (!incomingCallData) {
        callUser(currentStream);
      }
    }).catch(err => {
      // FIX: Replaced native alert with dev log and smooth toast
      console.error("[Media] Failed to get media devices for call:", err);
      toast.error("Camera or microphone access denied. Please check your browser settings.");
      closeModal();
    });

    // Listen for call acceptance or rejection
    if (socket.current) {
        socket.current.on("call-accepted", (signal) => {
            setCallAccepted(true);
            if (connectionRef.current) {
                connectionRef.current.signal(signal);
            }
        });

        socket.current.on("call-rejected", (data) => {
            // FIX: Replaced native alert with a soft info toast
            console.log(`[Call] Call rejected by recipient: ${data.reason}`);
            toast.info(data.reason || "The call was declined.");
            leaveCall();
        });

        socket.current.on("call-ended", () => {
            setCallEnded(true);
            leaveCall();
        });
    }

    return () => {
        if (socket.current) {
            socket.current.off("call-accepted");
            socket.current.off("call-rejected");
            socket.current.off("call-ended");
        }
    };
  }, []);

  const callUser = (currentStream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: currentStream,
    });

    peer.on("signal", (data) => {
      socket.current.emit("call-user", {
        userToCall: currentChat._id,
        signalData: data,
        from: currentUser._id,
        name: currentUser.username,
        type: "video"
      });
    });

    peer.on("stream", (remoteStream) => {
      if (userVideo.current) {
          userVideo.current.srcObject = remoteStream;
      }
    });

    connectionRef.current = peer;
  };

  const answerCall = () => {
    setCallAccepted(true);
    setReceivingCall(false);

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
    });

    peer.on("signal", (data) => {
      socket.current.emit("answer-call", { signal: data, to: incomingCallData.from });
    });

    peer.on("stream", (remoteStream) => {
      if (userVideo.current) {
          userVideo.current.srcObject = remoteStream;
      }
    });

    peer.signal(incomingCallData.signal);
    connectionRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);
    if (connectionRef.current) {
        connectionRef.current.destroy();
    }
    socket.current.emit("end-call", { to: incomingCallData ? incomingCallData.from : currentChat._id });
    
    // Stop tracks to turn off camera light
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    closeModal();
  };

  const toggleMic = () => {
      if (stream) {
          stream.getAudioTracks()[0].enabled = !micActive;
          setMicActive(!micActive);
      }
  };

  const toggleVideo = () => {
      if (stream) {
          stream.getVideoTracks()[0].enabled = !videoActive;
          setVideoActive(!videoActive);
      }
  };

  return (
    <ModalOverlay>
      <div className="call-container">
        <h2>{receivingCall ? `${incomingCallData.name} is calling...` : `Huddle with ${currentChat.username}`}</h2>
        
        <div className="video-grid">
            <div className="video-wrapper">
                <video playsInline muted ref={myVideo} autoPlay className="my-video" />
                <span className="name-tag">You</span>
            </div>
            
            {callAccepted && !callEnded && (
                <div className="video-wrapper">
                    <video playsInline ref={userVideo} autoPlay className="user-video" />
                    <span className="name-tag">{currentChat.username}</span>
                </div>
            )}
        </div>

        <div className="controls">
            {receivingCall && !callAccepted ? (
                <>
                    <button className="btn-answer" onClick={answerCall}><FaPhone /> Answer</button>
                    <button className="btn-reject" onClick={leaveCall}><FaPhoneSlash /> Reject</button>
                </>
            ) : (
                <>
                    <button className="ctrl-btn" onClick={toggleMic} title={micActive ? "Mute Microphone" : "Unmute Microphone"}>
                        {micActive ? <FaMicrophone /> : <FaMicrophoneSlash color="#ef4444"/>}
                    </button>
                    <button className="ctrl-btn" onClick={toggleVideo} title={videoActive ? "Turn off Camera" : "Turn on Camera"}>
                        {videoActive ? <FaVideo /> : <FaVideoSlash color="#ef4444"/>}
                    </button>
                    <button className="btn-reject" onClick={leaveCall}><FaPhoneSlash /> End</button>
                </>
            )}
        </div>
      </div>
    </ModalOverlay>
  );
}

const ModalOverlay = styled.div`
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex; justify-content: center; align-items: center;
  z-index: 1000;
  color: var(--text-main); 

  .call-container {
    background: var(--bg-panel); 
    border: 1px solid var(--glass-border);
    padding: 2rem; border-radius: 20px;
    display: flex; flex-direction: column; align-items: center;
    gap: 1.5rem; max-width: 800px; width: 90%;
    box-shadow: var(--glass-shadow);
    
    h2 {
        font-weight: 600;
        font-size: 1.2rem;
        margin-bottom: 0.5rem;
    }
  }

  .video-grid {
    display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;
  }

  .video-wrapper {
    position: relative;
    background: #000; border-radius: 12px; overflow: hidden;
    width: 300px; height: 225px;
    border: 1px solid var(--glass-border);
    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
  }

  video { width: 100%; height: 100%; object-fit: cover; }
  
  .name-tag { 
      position: absolute; bottom: 10px; left: 10px; 
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
      padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 500; color: white; border: 1px solid rgba(255,255,255,0.1);
  }
  
  .controls { display: flex; gap: 1.5rem; margin-top: 1rem; align-items: center;}
  
  .ctrl-btn { 
      background: var(--input-bg); border: 1px solid var(--glass-border); 
      padding: 16px; border-radius: 50%; color: var(--text-main); 
      cursor: pointer; font-size: 1.2rem; transition: 0.2s; display: flex; align-items: center; justify-content: center;
      &:hover { background: rgba(255,255,255,0.1); transform: translateY(-2px); } 
  }
  
  .btn-answer { 
      background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
      border: none; padding: 12px 24px; border-radius: 12px; color: white; font-weight: 600; 
      cursor: pointer; display: flex; gap: 8px; align-items: center; transition: 0.2s; box-shadow: 0 4px 15px rgba(16,185,129,0.3);
      &:hover { filter: brightness(1.1); transform: translateY(-2px); } 
  }
  
  .btn-reject { 
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); 
      border: none; padding: 12px 24px; border-radius: 12px; color: white; font-weight: 600; 
      cursor: pointer; display: flex; gap: 8px; align-items: center; transition: 0.2s; box-shadow: 0 4px 15px rgba(239,68,68,0.3);
      &:hover { filter: brightness(1.1); transform: translateY(-2px); } 
  }
`;
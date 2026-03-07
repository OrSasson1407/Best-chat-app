// client/src/components/CallModal.jsx
import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import styled from "styled-components";
import { FaPhoneSlash, FaPhone, FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash } from "react-icons/fa";

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
      console.error("Failed to get media devices", err);
      alert("Microphone/Camera access is required for huddles.");
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
            alert(data.reason);
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
                    <button className="ctrl-btn" onClick={toggleMic}>
                        {micActive ? <FaMicrophone /> : <FaMicrophoneSlash color="red"/>}
                    </button>
                    <button className="ctrl-btn" onClick={toggleVideo}>
                        {videoActive ? <FaVideo /> : <FaVideoSlash color="red"/>}
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
  display: flex; justify-content: center; align-items: center;
  z-index: 1000;
  color: white;

  .call-container {
    background: #1a1a1a; padding: 2rem; border-radius: 12px;
    display: flex; flex-direction: column; align-items: center;
    gap: 1.5rem; max-width: 800px; width: 90%;
  }

  .video-grid {
    display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;
  }

  .video-wrapper {
    position: relative;
    background: #000; border-radius: 8px; overflow: hidden;
    width: 300px; height: 225px;
  }

  video { width: 100%; height: 100%; object-fit: cover; }
  .name-tag { position: absolute; bottom: 10px; left: 10px; background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; }
  
  .controls { display: flex; gap: 1rem; margin-top: 1rem; }
  .ctrl-btn { background: #333; border: none; padding: 12px; border-radius: 50%; color: white; cursor: pointer; font-size: 1.2rem; }
  .btn-answer { background: #25D366; border: none; padding: 10px 20px; border-radius: 8px; color: white; font-weight: bold; cursor: pointer; display: flex; gap: 8px; align-items: center;}
  .btn-reject { background: #ff4b4b; border: none; padding: 10px 20px; border-radius: 8px; color: white; font-weight: bold; cursor: pointer; display: flex; gap: 8px; align-items: center;}
`;
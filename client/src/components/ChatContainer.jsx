import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import ChatInput from "./ChatInput";
import axios from "axios";
import { sendMessageRoute, receiveMessageRoute } from "../utils/APIRoutes";
import { v4 as uuidv4 } from "uuid";

export default function ChatContainer({ currentChat, currentUser, socket }) {
  const [messages, setMessages] = useState([]);
  const [arrivalMessage, setArrivalMessage] = useState(null);
  const scrollRef = useRef();

  // 1. Fetch History from DB
  useEffect(() => {
    async function fetchHistory() {
      if (currentChat && currentUser) {
        const response = await axios.post(receiveMessageRoute, {
          from: currentUser._id,
          to: currentChat._id,
        });
        setMessages(response.data);
      }
    }
    fetchHistory();
  }, [currentChat, currentUser]);

  // 2. Real-time Socket Listener
  useEffect(() => {
    if (socket.current) {
      const s = socket.current;
      s.on("msg-recieve", (data) => {
        // Only trigger update if the message is from the user we are currently viewing
        if (currentChat._id === data.from) {
          setArrivalMessage({ fromSelf: false, message: data.msg });
        }
      });
      // Cleanup to prevent multiple listeners
      return () => s.off("msg-recieve");
    }
  }, [currentChat, socket]);

  // 3. Update the messages array when a new socket message arrives
  useEffect(() => {
    if (arrivalMessage) {
      setMessages((prev) => [...prev, arrivalMessage]);
      setArrivalMessage(null); // Clear the arrival state
    }
  }, [arrivalMessage]);

  // 4. Handle Sending Messages
  const handleSendMsg = async (msg) => {
    // Save to Database
    await axios.post(sendMessageRoute, {
      from: currentUser._id,
      to: currentChat._id,
      message: msg,
    });

    // Notify the recipient via Socket
    socket.current.emit("send-msg", {
      to: currentChat._id,
      from: currentUser._id,
      msg: msg,
    });

    // Update local UI
    setMessages((prev) => [...prev, { fromSelf: true, message: msg }]);
  };

  // 5. Scroll to Bottom automatically
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Container>
      <div className="chat-header">
        <div className="user-details">
          <div className="username">
            <h3>{currentChat.username}</h3>
          </div>
        </div>
      </div>
      <div className="chat-messages">
        {messages.map((message) => (
          <div ref={scrollRef} key={uuidv4()}>
            <div className={`message ${message.fromSelf ? "sended" : "recieved"}`}>
              <div className="content">
                <p>{message.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <ChatInput handleSendMsg={handleSendMsg} />
    </Container>
  );
}

const Container = styled.div`
  display: grid;
  grid-template-rows: 10% 80% 10%;
  gap: 0.1rem;
  overflow: hidden;
  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 2rem;
    background-color: #0d0d30;
    .username h3 { color: white; }
  }
  .chat-messages {
    padding: 1rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: auto;
    &::-webkit-scrollbar {
      width: 0.2rem;
      &-thumb { background-color: #ffffff39; width: 0.1rem; border-radius: 1rem; }
    }
    .message {
      display: flex;
      align-items: center;
      .content {
        max-width: 40%;
        overflow-wrap: break-word;
        padding: 1rem;
        font-size: 1.1rem;
        border-radius: 1rem;
        color: #d1d1d1;
      }
    }
    .sended { justify-content: flex-end; .content { background-color: #4f04ff21; } }
    .recieved { justify-content: flex-start; .content { background-color: #9900ff20; } }
  }
`;
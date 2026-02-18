import React, { useState, useEffect } from "react";
import styled from "styled-components";

export default function Contacts({ contacts, changeChat, onlineUsers, handleLogout }) {
  const [currentUserName, setCurrentUserName] = useState(undefined);
  const [currentSelected, setCurrentSelected] = useState(undefined);

  useEffect(() => {
    const data = JSON.parse(sessionStorage.getItem("chat-app-user"));
    if (data) {
      setCurrentUserName(data.username);
    }
  }, []);

  const changeCurrentChat = (index, contact) => {
    setCurrentSelected(index);
    changeChat(contact);
  };

  return (
    <>
      {currentUserName && (
        <Container>
          <div className="brand">
            <h3>Snappy</h3>
          </div>
          <div className="contacts">
            {/* Safety Check: ensure contacts exists before mapping */}
            {contacts && contacts.map((contact, index) => {
              const isOnline = onlineUsers.includes(contact._id);
              return (
                <div
                  key={contact._id}
                  className={`contact ${
                    index === currentSelected ? "selected" : ""
                  }`}
                  onClick={() => changeCurrentChat(index, contact)}
                >
                  <div className="avatar">
                    {/* Display first letter of username as avatar */}
                    {contact.username[0].toUpperCase()}
                  </div>
                  <div className="username">
                    <h3>{contact.username}</h3>
                    {/* Green Glow for Online Users */}
                    {isOnline && <div className="online-indicator" />}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="current-user">
            <div className="user-info">
               <h2>{currentUserName}</h2>
               <button onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </Container>
      )}
    </>
  );
}

const Container = styled.div`
  display: grid;
  grid-template-rows: 12% 73% 15%;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.2);
  border-right: 1px solid rgba(255, 255, 255, 0.05);

  .brand {
    display: flex;
    align-items: center;
    justify-content: center;
    h3 {
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.2rem;
    }
  }

  .contacts {
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: auto;
    gap: 0.8rem;
    padding: 0.5rem;
    &::-webkit-scrollbar {
      width: 3px;
    }
    &::-webkit-scrollbar-thumb {
      background-color: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
    }

    .contact {
      background: rgba(255, 255, 255, 0.03);
      padding: 0.8rem;
      width: 90%;
      border-radius: 1rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      transition: 0.3s ease;
      cursor: pointer;
      border: 1px solid transparent;

      &:hover {
        background: rgba(255, 255, 255, 0.08);
        transform: scale(1.02);
      }

      .avatar {
        height: 3rem;
        width: 3rem;
        background: #4e0eff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-size: 1.2rem;
      }

      .username {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        h3 {
          color: #e0e0e0;
          font-size: 0.9rem;
        }
      }

      .online-indicator {
        height: 8px;
        width: 8px;
        background: #00ff88;
        border-radius: 50%;
        box-shadow: 0 0 10px #00ff88;
      }
    }

    .selected {
      background: rgba(78, 14, 255, 0.2);
      border: 1px solid rgba(78, 14, 255, 0.4);
    }
  }

  .current-user {
    background: rgba(0, 0, 0, 0.3);
    padding: 1rem;
    display: flex;
    justify-content: center;
    align-items: center;
    
    .user-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding: 0 1rem;
      
      h2 {
        color: white;
        font-size: 1rem;
      }
      
      button {
        background: #ff4e4e;
        border: none;
        padding: 0.4rem 0.8rem;
        border-radius: 0.5rem;
        color: white;
        cursor: pointer;
        font-size: 0.7rem;
        font-weight: bold;
        transition: 0.3s ease-in-out;
        
        &:hover {
          background: #d63030;
        }
      }
    }
  }
`;
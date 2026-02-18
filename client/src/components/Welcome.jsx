import React, { useState, useEffect } from "react";
import styled from "styled-components";

export default function Welcome() {
  const [userName, setUserName] = useState("");

  useEffect(() => {
    // Get the user data from sessionStorage to display the name
    const storedUser = sessionStorage.getItem("chat-app-user");
    if (storedUser) {
      setUserName(JSON.parse(storedUser).username);
    }
  }, []);

  return (
    <Container>
      <h1>
        Welcome, <span>{userName}!</span>
      </h1>
      <h3>Please select a friend from the left to start chatting.</h3>
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  flex-direction: column;
  background-color: #131324;
  span {
    color: #4e0eff;
  }
  h3 {
    margin-top: 1rem;
    font-weight: 400;
  }
`;
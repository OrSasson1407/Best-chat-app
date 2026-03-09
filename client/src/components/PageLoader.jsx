// client/src/components/PageLoader.jsx
import React from "react";

const PageLoader = () => (
  <div style={{ 
    display: 'flex', justifyContent: 'center', alignItems: 'center', 
    height: '100vh', backgroundColor: '#131324', color: 'white', flexDirection: 'column'
  }}>
    <div className="spinner" style={{
      border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #4e0eff',
      borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite',
      marginBottom: '15px'
    }}></div>
    <h3>Loading App...</h3>
    <style>{`
      @keyframes spin { 
        0% { transform: rotate(0deg); } 
        100% { transform: rotate(360deg); } 
      }
    `}</style>
  </div>
);

export default PageLoader;
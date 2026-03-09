// client/src/components/ErrorBoundary.jsx
import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // עדכון הסטייט כדי שהרינדור הבא יציג את ה-UI של השגיאה
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // כאן אפשר לשלוח את השגיאה לשירות לוגים (כמו Sentry)
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#131324', color: 'white' }}>
          <h2>אופס! משהו השתבש בטעינת העמוד.</h2>
          <button 
            onClick={() => window.location.reload()} 
            style={{ padding: '10px 20px', backgroundColor: '#4e0eff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '15px', fontSize: '1rem' }}
          >
            רענן עמוד
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
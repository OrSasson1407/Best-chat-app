// client/src/components/Sidebar/ContactList/chatHelpers.js

export const formatLastSeen = (dateString) => {
  if (!dateString) return "Offline";

  const lastSeenDate = new Date(dateString);
  const today = new Date();
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
  const timeString = lastSeenDate.toLocaleTimeString([], timeOptions);

  if (lastSeenDate.toDateString() === today.toDateString()) {
    return `Last seen today at ${timeString}`;
  } else if (lastSeenDate.toDateString() === yesterday.toDateString()) {
    return `Last seen yesterday at ${timeString}`;
  } else {
    // For older dates: "Last seen Oct 12 at 4:30 PM"
    const dateOptions = { month: 'short', day: 'numeric' };
    return `Last seen ${lastSeenDate.toLocaleDateString([], dateOptions)} at ${timeString}`;
  }
};
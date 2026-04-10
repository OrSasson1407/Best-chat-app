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
        const dateOptions = { month: 'short', day: 'numeric' };
        return `Last seen ${lastSeenDate.toLocaleDateString([], dateOptions)} at ${timeString}`;
    }
};

export const getSmallAvatar = (user) => {
    if (!user) return `https://api.dicebear.com/9.x/avataaars/svg?seed=default`;
    if (user.avatarImage) {
        if (!user.avatarImage.startsWith("http") && !user.avatarImage.startsWith("data:")) {
            return `https://avatar.iran.liara.run/public/${user.avatarImage}`;
        }
        return user.avatarImage;
    }
    return `https://api.dicebear.com/9.x/avataaars/svg?seed=${user.username || "default"}`;
};

export const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

export const isNewDay = (currentMsg, prevMsg) => {
    if (!prevMsg) return true; // First message of the chat is always a new day
    const currentDate = new Date(currentMsg.createdAt || currentMsg.updatedAt || Date.now());
    const prevDate = new Date(prevMsg.createdAt || prevMsg.updatedAt || Date.now());
    return currentDate.toDateString() !== prevDate.toDateString();
};

export const formatDateBadge = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    
    return date.toLocaleDateString(undefined, { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined 
    });
};

export const isSameSender = (currentMsg, prevMsg) => {
    if (!prevMsg) return false;
    
    // Support for both simple string IDs and populated user objects
    const currentSenderId = typeof currentMsg.sender === 'object' ? currentMsg.sender?._id : currentMsg.sender;
    const prevSenderId = typeof prevMsg.sender === 'object' ? prevMsg.sender?._id : prevMsg.sender;
    
    // Also account for the boolean "fromSelf" flag you might be using
    if (currentMsg.fromSelf !== undefined && prevMsg.fromSelf !== undefined) {
        return currentMsg.fromSelf === prevMsg.fromSelf;
    }
    
    return currentSenderId === prevSenderId;
};

export const isWithinTimeFrame = (currentMsg, prevMsg, minutes = 5) => {
    if (!prevMsg) return false;
    const currentDate = new Date(currentMsg.createdAt || currentMsg.updatedAt || Date.now());
    const prevDate = new Date(prevMsg.createdAt || prevMsg.updatedAt || Date.now());
    const diffInMinutes = (currentDate - prevDate) / (1000 * 60);
    return diffInMinutes < minutes;
};
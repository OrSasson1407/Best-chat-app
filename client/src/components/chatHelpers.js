export const getSmallAvatar = (seed) => {
    return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
};

export const isNewDay = (currentDate, previousDate) => {
    if (!previousDate) return true;
    const d1 = new Date(currentDate);
    const d2 = new Date(previousDate);
    return d1.toDateString() !== d2.toDateString();
};

export const formatDateBadge = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const isSameSender = (msg1, msg2) => {
    if (!msg1 || !msg2) return false;
    return msg1.fromSelf === msg2.fromSelf && msg1.username === msg2.username;
};

export const isWithinTimeFrame = (msg1, msg2) => {
    if (!msg1 || !msg2) return false;
    const t1 = new Date(msg1.createdAt).getTime();
    const t2 = new Date(msg2.createdAt).getTime();
    return Math.abs(t1 - t2) < 5 * 60 * 1000; 
};

export const formatTime = (timeStr) => {
    const date = timeStr ? new Date(timeStr) : new Date();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const formatLastSeen = (dateString) => {
    if (!dateString) return "Offline";
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return `Last seen today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return `Last seen ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};
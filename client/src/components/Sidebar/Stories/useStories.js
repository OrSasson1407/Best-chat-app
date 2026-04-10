import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { getStoryFeedRoute, addStoryRoute, viewStoryRoute } from "../../../utils/APIRoutes";

export default function useStories(currentUser) {
    const [storyFeed, setStoryFeed] = useState([]);
    const [viewingStoryUser, setViewingStoryUser] = useState(null);
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const [isUploadingStory, setIsUploadingStory] = useState(false);
    const [storyPreview, setStoryPreview] = useState(null);

    const fileInputRef = useRef(null);
    const pressTimer = useRef(null);

    const getAuthHeader = useCallback(() => {
        const rawToken = currentUser?.token || sessionStorage.getItem("chat-app-token") || "";
        const cleanToken = rawToken.replace(/(Bearer\s*)+/gi, "").trim();
        return { headers: { Authorization: `Bearer ${cleanToken}` } };
    }, [currentUser]);

    // Auto-advance viewing story
    useEffect(() => {
        let timer;
        if (viewingStoryUser && viewingStoryUser.stories) {
            timer = setTimeout(() => handleNextStory(), 5000);
        }
        return () => clearTimeout(timer);
    }, [viewingStoryUser, currentStoryIndex]);

    const fetchStories = async () => {
        if (!currentUser) return;
        try {
            const { data } = await axios.get(getStoryFeedRoute, getAuthHeader());
            if (data.status) setStoryFeed(data.feed || []);
        } catch (error) {
            console.error("[API] Error fetching stories:", error);
        }
    };

    const handleStoryUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploadingStory(true);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            try {
                const { data } = await axios.post(addStoryRoute, {
                    mediaUrl: reader.result,
                    mediaType: file.type.startsWith("video") ? "video" : "image"
                }, getAuthHeader()); 
                
                if (data.status) {
                    toast.success("Status updated.");
                    fetchStories(); // Refresh feed
                }
            } catch (err) {
                console.error("[Media] Failed to upload status:", err);
                toast.error("Status upload failed. Please try again.");
            } finally {
                setIsUploadingStory(false);
            }
        };
    };

    const openStoryViewer = async (userFeedObj) => {
        setViewingStoryUser(userFeedObj);
        setCurrentStoryIndex(0);
        const firstStory = userFeedObj?.stories?.[0];
        if (firstStory && firstStory.user?._id !== currentUser._id) {
            try {
                await axios.post(`${viewStoryRoute}/${firstStory._id}`, {}, getAuthHeader()); 
            } catch (error) {
                console.error("[API] Failed to mark story as viewed", error);
            }
        }
    };

    const handleNextStory = async () => {
        if (!viewingStoryUser || !viewingStoryUser.stories) return;
        if (currentStoryIndex < viewingStoryUser.stories.length - 1) {
            const nextIdx = currentStoryIndex + 1;
            setCurrentStoryIndex(nextIdx);
            const nextStory = viewingStoryUser.stories[nextIdx];
            if (nextStory && nextStory.user?._id !== currentUser._id) {
                try {
                    await axios.post(`${viewStoryRoute}/${nextStory._id}`, {}, getAuthHeader()); 
                } catch (error) {
                    console.error("[API] Failed to mark story as viewed", error);
                }
            }
        } else {
            setViewingStoryUser(null);
        }
    };

    const handleStoryPressStart = (feedItem) => {
        pressTimer.current = setTimeout(() => {
            setStoryPreview(feedItem);
        }, 400);
    };

    const handleStoryPressEnd = () => {
        if (pressTimer.current) clearTimeout(pressTimer.current);
        setStoryPreview(null);
    };

    return {
        storyFeed,
        setStoryFeed,
        isUploadingStory,
        fileInputRef,
        storyPreview,
        fetchStories,
        handleStoryUpload,
        openStoryViewer,
        handleStoryPressStart,
        handleStoryPressEnd
    };
}
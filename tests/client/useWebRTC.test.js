import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWebRTC from '../../client/src/hooks/useWebRTC'; // Assuming you abstracted this

describe('useWebRTC Custom Hook', () => {
  beforeEach(() => {
    // Stub the browser's MediaDevices API
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue('mock_media_stream_object'),
      },
      writable: true,
    });
    
    // Stub RTCPeerConnection
    global.RTCPeerConnection = vi.fn().mockImplementation(() => ({
      addTrack: vi.fn(),
      createOffer: vi.fn().mockResolvedValue('mock_offer'),
      setLocalDescription: vi.fn(),
    }));
  });

  it('should initialize a media stream and create a call offer', async () => {
    const { result } = renderHook(() => useWebRTC());

    // 1. Hook should start with no local stream
    expect(result.current.localStream).toBeNull();

    // 2. Trigger the call initialization
    await act(async () => {
      await result.current.startCall('target_user_id');
    });

    // 3. Verify hardware was requested
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: true, audio: true });
    
    // 4. Verify state was updated with the stream
    expect(result.current.localStream).toBe('mock_media_stream_object');
    
    // 5. Verify the RTCPeerConnection logic fired
    expect(global.RTCPeerConnection).toHaveBeenCalled();
  });
});
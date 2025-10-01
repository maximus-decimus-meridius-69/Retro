import React, { useState, useRef, useEffect } from 'react';
import { auth } from '../firebase';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  Settings,
  Download,
  BookOpen,
  Clock
} from 'lucide-react';

const MeetingRecordingPlayer = ({ meetingId, recordingUrl, title, onProgressUpdate }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(0);
  const [watchedDuration, setWatchedDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const currentUser = auth.currentUser;
  const progressUpdateInterval = useRef(null);
  const hideControlsTimeout = useRef(null);
  
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setLoading(false);
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setProgress((video.currentTime / video.duration) * 100);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      // Mark as completed when video ends
      updateProgress(video.currentTime, video.duration, true);
    };
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);
  
  useEffect(() => {
    // Update watched duration and progress periodically
    if (isPlaying) {
      progressUpdateInterval.current = setInterval(() => {
        if (videoRef.current) {
          const newWatchedDuration = Math.max(watchedDuration, videoRef.current.currentTime);
          setWatchedDuration(newWatchedDuration);
          updateProgress(newWatchedDuration, duration);
        }
      }, 5000); // Update every 5 seconds
    } else {
      if (progressUpdateInterval.current) {
        clearInterval(progressUpdateInterval.current);
      }
    }
    
    return () => {
      if (progressUpdateInterval.current) {
        clearInterval(progressUpdateInterval.current);
      }
    };
  }, [isPlaying, watchedDuration, duration]);
  
  const updateProgress = async (watched, total, completed = false) => {
    if (!meetingId || !currentUser) return;
    
    try {
      await fetch(`http://localhost:3001/api/meetings/${meetingId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.uid,
          watchedDuration: watched,
          totalDuration: total,
          completed
        })
      });
      
      if (onProgressUpdate) {
        onProgressUpdate({
          watchedDuration: watched,
          totalDuration: total,
          completed,
          progressPercentage: Math.round((watched / total) * 100)
        });
      }
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };
  
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };
  
  const seek = (time) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = Math.max(0, Math.min(time, duration));
  };
  
  const skipForward = () => {
    seek(currentTime + 10);
  };
  
  const skipBackward = () => {
    seek(currentTime - 10);
  };
  
  const handleVolumeChange = (newVolume) => {
    const video = videoRef.current;
    if (!video) return;
    
    setVolume(newVolume);
    video.volume = newVolume;
    setIsMuted(newVolume === 0);
  };
  
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isMuted) {
      setIsMuted(false);
      video.volume = volume;
    } else {
      setIsMuted(true);
      video.volume = 0;
    }
  };
  
  const changePlaybackRate = (rate) => {
    const video = videoRef.current;
    if (!video) return;
    
    setPlaybackRate(rate);
    video.playbackRate = rate;
  };
  
  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement;
    if (!container) return;
    
    if (!document.fullscreenElement) {
      container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  const handleProgressBarClick = (e) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const newTime = clickPosition * duration;
    seek(newTime);
  };
  
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  const handleMouseMove = () => {
    setShowControls(true);
    
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    
    hideControlsTimeout.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };
  
  if (loading) {
    return (
      <div className="bg-black aspect-video flex items-center justify-center rounded-lg">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading video...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>Duration: {formatTime(duration)}</span>
              </div>
              
              <div className="flex items-center space-x-1">
                <BookOpen className="w-4 h-4" />
                <span>Progress: {Math.round((watchedDuration / duration) * 100) || 0}%</span>
              </div>
            </div>
          </div>
          
          <a
            href={recordingUrl}
            download
            className="flex items-center space-x-1 px-3 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </a>
        </div>
      </div>
      
      {/* Video Player */}
      <div 
        className="relative bg-black aspect-video"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          src={recordingUrl}
          preload="metadata"
          onClick={togglePlay}
        />
        
        {/* Progress Bar (always visible at bottom) */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600 bg-opacity-50">
          <div 
            className="h-full bg-purple-600 transition-all duration-300 cursor-pointer"
            style={{ width: `${progress}%` }}
            onClick={handleProgressBarClick}
          />
          
          {/* Watched progress indicator */}
          <div 
            className="absolute top-0 h-full bg-purple-300 bg-opacity-50"
            style={{ width: `${(watchedDuration / duration) * 100}%` }}
          />
        </div>
        
        {/* Play/Pause Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={togglePlay}
              className="w-16 h-16 bg-black bg-opacity-50 rounded-full flex items-center justify-center hover:bg-opacity-75 transition-all"
            >
              <Play className="w-8 h-8 text-white ml-1" />
            </button>
          </div>
        )}
        
        {/* Controls */}
        {showControls && (
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-black bg-opacity-75 rounded-lg p-4">
              {/* Progress Bar */}
              <div 
                className="w-full h-2 bg-gray-600 rounded-full cursor-pointer mb-4"
                onClick={handleProgressBarClick}
              >
                <div 
                  className="h-full bg-purple-600 rounded-full relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-purple-600 rounded-full"></div>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-white">
                {/* Left Controls */}
                <div className="flex items-center space-x-3">
                  <button onClick={togglePlay} className="p-1 hover:bg-white hover:bg-opacity-20 rounded">
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
                  
                  <button onClick={skipBackward} className="p-1 hover:bg-white hover:bg-opacity-20 rounded">
                    <SkipBack className="w-5 h-5" />
                  </button>
                  
                  <button onClick={skipForward} className="p-1 hover:bg-white hover:bg-opacity-20 rounded">
                    <SkipForward className="w-5 h-5" />
                  </button>
                  
                  <div className="flex items-center space-x-2">
                    <button onClick={toggleMute} className="p-1 hover:bg-white hover:bg-opacity-20 rounded">
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-16"
                    />
                  </div>
                  
                  <span className="text-sm">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                
                {/* Right Controls */}
                <div className="flex items-center space-x-3">
                  <select
                    value={playbackRate}
                    onChange={(e) => changePlaybackRate(parseFloat(e.target.value))}
                    className="bg-transparent border border-white border-opacity-30 rounded px-2 py-1 text-sm"
                  >
                    <option value="0.5" className="text-black">0.5x</option>
                    <option value="0.75" className="text-black">0.75x</option>
                    <option value="1" className="text-black">1x</option>
                    <option value="1.25" className="text-black">1.25x</option>
                    <option value="1.5" className="text-black">1.5x</option>
                    <option value="2" className="text-black">2x</option>
                  </select>
                  
                  <button onClick={toggleFullscreen} className="p-1 hover:bg-white hover:bg-opacity-20 rounded">
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Progress Info */}
      <div className="p-4 bg-gray-50">
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600">
            Watched: {formatTime(watchedDuration)} of {formatTime(duration)}
          </div>
          
          <div className="text-purple-600 font-medium">
            {Math.round((watchedDuration / duration) * 100) || 0}% Complete
          </div>
        </div>
        
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(watchedDuration / duration) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default MeetingRecordingPlayer;
# Retro - Audio Room Application

A real-time audio room application built with React, Socket.IO, and Express.js.

## Features

### Audio Rooms
- Create and join audio rooms
- Real-time audio communication using WebRTC
- Host controls for room management
- Automatic room cleanup when empty

### Chat System
- Real-time text messaging
- **Direct media sharing** through chat messages
- Base64 encoding for instant file sharing
- Support for multiple file types:
  - Images (JPG, PNG, GIF, WebP)
  - Audio files (MP3, WAV, OGG, M4A)
  - Video files (MP4, WebM, OGG)
  - Documents (PDF, DOC, DOCX, TXT)

### Media Sharing Features
- **Drag and drop** files directly into the chat
- **File type detection** with appropriate icons and previews
- **Instant sharing** using base64 encoding (no server upload)
- **File size limits** (5MB per file for direct sharing)
- **Host controls** to enable/disable media sharing
- **Quick media panel** in chat for easy file sharing
- **Responsive media display** with proper formatting for different file types

### Room Management
- Host can mute/unmute participants
- Host can kick participants
- Host can lock/unlock rooms
- Host can control media permissions
- Automatic participant tracking

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Start the backend server:
   ```bash
   node server.js
   ```

## Media Sharing Usage

1. **Enable Media Sharing**: The host can toggle media sharing permissions in the host controls panel.

2. **Share Files**: 
   - Use the main media sharing section with drag-and-drop
   - Use the quick media panel in the chat (click the 📎 icon)
   - Drag files directly into the chat area

3. **Supported File Types**:
   - Images: JPG, PNG, GIF, WebP
   - Audio: MP3, WAV, OGG, M4A
   - Video: MP4, WebM, OGG
   - Documents: PDF, DOC, DOCX, TXT

4. **File Limits**: Maximum 5MB per file for direct sharing

## Technical Details

- **Frontend**: React with Vite
- **Backend**: Express.js with Socket.IO
- **Media Sharing**: Base64 encoding for direct chat sharing
- **Real-time Communication**: WebRTC for audio, Socket.IO for chat
- **No File Storage**: Files are shared directly through chat messages
# OmniFetch (VidLand)

A premium, privacy-first, zero-footprint web application for downloading and trimming online video content. Designed with a sleek, responsive glassmorphic user interface, OmniFetch streams downloads directly in-memory to prevent media files from taking up storage on the server.

---

## ✦ Key Features

- **Platform Support:** Seamless extraction from YouTube and Instagram.
- **In-Memory Streaming Proxy:** Video and audio files are piped directly in memory from CDNs, ensuring high security and zero storage footprints.
- **Adaptive Muxing:** High-resolution streams (e.g. 1080p, 720p) are merged on-the-fly with their matching audio tracks using FFmpeg stream copying (`-c:v copy`) for near-instant downloads.
- **Shorts-Cutter (Trim & Crop Engine):**
  - Interactive double sliders for custom start/end points.
  - Aspect ratio toggle: Keep Original (Landscape) or Crop to Vertical (9:16) for short-form clips.
  - Timing presets (First 15s, 30s, 60s).
- **Premium Glassmorphic Design:** Native responsive layout built with CSS variables, complete with light/dark theme toggles, pulsing animation visualizers, and polished typography.

---

## 🛠️ Technology Stack

- **Frontend:**
  - React (v19)
  - Vite
  - Vanilla CSS (Glassmorphism & Design Tokens)
- **Backend:**
  - Node.js (ES Modules)
  - Express
  - `yt-dlp` (via `yt-dlp-wrap`) for high-fidelity extraction
  - `ffmpeg-static` for high-performance audio/video muxing and trimming

---

## 🚀 Getting Started

### Prerequisites

Ensure you have **Node.js** (v18 or higher) installed on your system.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/xtremLYx/VidLand.git
   cd VidLand
   ```

2. **Install dependencies:**
   * Install for the **Frontend**:
     ```bash
     cd frontend
     npm install
     cd ..
     ```
   * Install for the **Backend**:
     ```bash
     cd backend
     npm install
     cd ..
     ```

### Running Locally

To run the application, you need to start both servers:

1. **Start Backend Server:**
   ```bash
   cd backend
   npm start
   ```
   *The API server will listen on [http://localhost:8000](http://localhost:8000).*

2. **Start Frontend Server:**
   *Open a separate terminal window:*
   ```bash
   cd frontend
   npm run dev
   ```
   *The web client will open on [http://localhost:5173](http://localhost:5173).*

---

## ⚙️ How it Works under the Hood

### 1. In-Memory Streaming Muxing
Since YouTube serves video tracks and audio tracks as separate adaptive streams for high quality, OmniFetch dynamically combines them:
```js
const ffmpegArgs = [
  '-i', url,
  '-i', audioUrl,
  '-c:v', 'copy', // copies video stream without decoding
  '-c:a', 'aac',  // transcodes audio to standard AAC
  '-map', '0:v:0',
  '-map', '1:a:0',
  '-f', 'mp4',
  '-movflags', 'frag_keyframe+empty_moov',
  'pipe:1'        // pipes directly to client stream
];
```

### 2. Security Validation
To prevent Server-Side Request Forgery (SSRF), all incoming video and CDN download requests are strictly checked against a whitelist of trusted domains and patterns:
- YouTube (`youtube.com`, `youtu.be`)
- Instagram (`instagram.com`, `dd.instagram.com`)
- Valid Media CDNs (`*.googlevideo.com`, `*.cdninstagram.com`, `*.fbcdn.net`)

# YTmate - Fast & Free YouTube Video & MP3 Downloader

**Live Domain:** [https://ytmate.online/](https://ytmate.online/)  
**Repository:** [https://github.com/shilwantr/ytmate.git](https://github.com/shilwantr/ytmate.git)

YTmate is a high-performance, modern, accessible web application designed to download YouTube videos in all resolutions (8K, 4K, 2K, 1080p Full HD, 720p HD, 480p) and extract studio-grade MP3 audio (320 kbps, 256 kbps, 192 kbps), lossless M4A/AAC, WAV, YouTube Shorts, and thumbnails.

---

## 🚀 Key Features

- **All Video Resolutions Supported:**
  - 8K Ultra HD (4320p 60FPS)
  - 4K Ultra HD (2160p 60FPS HDR)
  - 2K Quad HD (1440p 60FPS)
  - 1080p Full HD (60FPS high-bitrate with merged stereo audio)
  - 720p HD & Data-Saver resolutions (480p, 360p, 240p)
- **Studio-Grade Audio Extraction:**
  - MP3 in 320 kbps (Extreme quality), 256 kbps, 192 kbps, 128 kbps
  - Uncompressed PCM WAV for studio production and remixing
  - Native Apple M4A / AAC losslessly preserved
  - WebM Opus for web audio applications
- **Specialized YouTube Tools:**
  - YouTube Shorts Downloader (vertical 9:16 portrait videos without watermarks)
  - YouTube Playlist & Album batch helper
  - High-definition thumbnail artwork grabber (1280×720 MaxRes)
  - Subtitles & Closed Captions extractor (.SRT, .VTT, .TXT)
- **User Experience & Performance:**
  - Instant paste button with Clipboard API integration
  - Interactive stream conversion progress simulation
  - Dark mode by default with light/dark theme switcher and `localStorage` persistence
  - Zero registration or personal data required
  - Pure HTML5/CSS3/ES6 vanilla architecture: loads in < 100ms with no bulky dependencies

---

## 🤖 SEO, Crawlers & Sitemaps

Configured for search engine indexing and AI search agent discovery (Googlebot, Bingbot, Applebot, GPTBot, ClaudeBot, PerplexityBot, CCBot, etc.):

- **`robots.txt`**: Standard robots directives explicitly allowing all search engine web crawlers and AI agents, disallowing `/admin` and `/api/`, and linking to canonical sitemaps.
- **`sitemap_index.xml`**: Standard root index linking to partitioned sub-sitemaps.
- **`sitemap.xml`**: Consolidated sitemap listing all 18 pages with priority, lastmod, and changefreq tags.
- **`sitemap-main.xml`**: Core platform pages (Home, How-to Guide, Formats, FAQ, About, Contact).
- **`sitemap-tools.xml`**: Specialized conversion tool landing pages.
- **`sitemap-legal.xml`**: Compliance and legal policy pages.

---

## 📁 Repository Structure & Page Inventory

```
ytmate/
├── CNAME                              # GitHub Pages custom domain (ytmate.online)
├── robots.txt                         # AI and search crawler configuration
├── sitemap_index.xml                  # Root sitemap index
├── sitemap.xml                        # Master sitemap (all 18 pages)
├── sitemap-main.xml                   # Sub-sitemap for core pages
├── sitemap-tools.xml                  # Sub-sitemap for downloader tools
├── sitemap-legal.xml                  # Sub-sitemap for legal pages
├── index.html                         # Universal Downloader & MP3 Converter
├── youtube-to-mp3.html                # YouTube to MP3 (320kbps) Converter
├── youtube-to-mp4.html                # YouTube to MP4 Downloader
├── youtube-shorts-downloader.html     # YouTube Shorts Downloader (No Watermark)
├── youtube-4k-downloader.html         # YouTube 4K & 8K Ultra HD Downloader
├── youtube-1080p-downloader.html      # YouTube 1080p Full HD (With Audio)
├── youtube-audio-downloader.html      # YouTube Audio Extractor (WAV, M4A, AAC)
├── youtube-playlist-downloader.html   # Playlist & Album Downloader
├── youtube-thumbnail-downloader.html  # YouTube Thumbnail Grabber
├── youtube-subtitles-downloader.html  # Subtitles & Captions (SRT, VTT, TXT)
├── how-to-download.html               # Step-by-Step Tutorial
├── supported-formats.html             # Codecs & Resolutions Reference
├── faq.html                           # Frequently Asked Questions
├── about.html                         # About YTmate
├── contact.html                       # Contact & Support
├── terms.html                         # Terms of Service
├── privacy.html                       # Privacy Policy (Zero Logs)
├── disclaimer.html                    # Legal Disclaimer & DMCA Policy
├── css/
│   └── styles.css                     # Modern, accessible, dark/light theme CSS
└── js/
    └── app.js                         # YouTube URL parser, modal, toast, theme engine
```

---

## 🌐 Deployment Instructions

### GitHub Pages (Recommended)
1. Repository includes a `CNAME` pointing to `ytmate.online`.
2. Go to **Settings** > **Pages** in GitHub.
3. Under **Branch**, select `main` and root `/`.
4. Click **Save**. HTTPS is automatically provisioned via Let's Encrypt.

### Cloudflare Pages / Netlify / Vercel
- Simply link this repository with default static build settings (no build command, publish directory: `.`).

---

## ⚖️ Legal Disclaimer

YTmate is an independent tool for educational and personal fair use. It is not affiliated with, authorized, or endorsed by YouTube or Google LLC.

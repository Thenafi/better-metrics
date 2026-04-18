# Better Metrics — Reservation Dashboard

A production-grade reservation metrics dashboard powered by the **Hospitable API** and built with the **IBM Carbon Design System**.

This tool provides a streamlined view of upcoming checkouts and check-ins, specifically designed for property managers and cleaning crews to track same-day turnovers and guest schedules.

![IBM Carbon Design](https://img.shields.io/badge/Design-IBM%20Carbon-blue)
![Cloudflare Workers](https://img.shields.io/badge/Runs%20on-Cloudflare%20Workers-orange)

## 🚀 Key Features

- **IBM Carbon UI Shell**: Clean, high-contrast, and focused interface using official Carbon components.
- **Smart Grouping**: Toggle results by **Check-out date** or **Property** name instantly.
- **Same-Day Turnover Logic**: Automatically detects and highlights back-to-back bookings (Check-out matching another Check-in) at the same property.
- **Shared Link Mode**: Pass a UUID in the URL (`?uuid=...`) to auto-fetch data and hide configuration controls for a clean "viewer-only" experience.
- **Settings Panel**: A slide-down configuration panel for date ranges and grouping, accessible via the header's tune icon.
- **Mobile First**: Fully responsive layout with compact mode for the densest possible data viewing on small screens.
- **Aggregated Fetching**: Backend Cloudflare Worker handles pagination and CORS, fetching all reservation records across your entire portfolio.

## 🛠 Tech Stack

- **Frontend**: Vanilla JavaScript + HTML5 + CSS3 (Official IBM Carbon v10 CSS).
- **Backend**: Cloudflare Workers (CORS Proxy & API Aggregator).
- **Deployment**: Wrangler for Cloudflare.

## 📦 Setup & Development

### Prerequisites
- Node.js & npm installed.
- A Hospitable Public View UUID.

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Local Development
Run the development server:
```bash
npm run dev
```
Open [http://localhost:8787](http://localhost:8787) in your browser.

### Deployment
To deploy to your Cloudflare account:
```bash
npm run deploy
```

## 📖 Usage

1. **Direct View**: Enter your Hospitable View UUID in the settings panel and click "Apply".
2. **Sharing**: Share a direct link with pre-filled settings:
   `https://your-worker-url.com/?uuid=YOUR_UUID_HERE`

## 📁 Project Structure

- `src/worker.js`: Cloudflare Worker logic (API requests).
- `public/`: Static assets (HTML, CSS, JS).
- `public/app.js`: Frontend application logic and rendering.
- `public/style.css`: Custom Carbon extensions and responsive styling.
- `wrangler.toml`: Cloudflare configuration (ignored in git, needs creation).

---
*Built with Better Metrics.*

# Election Poster Generator

This project generates high-quality election comparison posters (like Kerala local body results)
from configurable data using:

- **Backend**: Node + Express + Puppeteer (HTML → PNG renderer)
- **Frontend**: Next.js React app with a basic UI to configure data and generate images.

## Structure

- `backend/` — Puppeteer-based image renderer
- `frontend/` — Next.js-based UI

## Getting Started

### 1. Backend

```bash
cd backend
npm install
npm start
```

The backend will start on `http://localhost:4000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will start on `http://localhost:3000`.

### 3. Usage

1. Open `http://localhost:3000` in the browser.
2. Fill in:
   - Local body name
   - District
   - Year
   - Alliances + votes + percentages + colors
3. Click **Generate Image**.
4. The generated PNG is shown below; you can right-click → **Save image as...**

You can extend:

- The HTML templates in `backend/templates/` for richer layouts.
- The React form in `frontend/components/PosterForm.js` for more fields (ward data, multiple years, swing, etc.).

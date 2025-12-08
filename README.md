<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Auralis Inventory

Minimal, glassy inventory management workspace (React + Vite + TypeScript) with dashboard analytics, guided asset intake, and optional Gemini-powered insights.

## Stack
- React 19, Vite 6, TypeScript
- Tailwind (CDN), Framer Motion, Recharts, Lucide icons
- In-memory mock data; optional Gemini summaries via `services/geminiService.ts`

## Run locally
1) Prerequisites: Node.js 18+ and npm  
2) Install dependencies: `npm install`  
3) (Optional, enables AI insight card) Create `.env.local` with `GEMINI_API_KEY=your_key`  
4) Start dev server: `npm run dev` then open http://localhost:3000 (Vite binds to `0.0.0.0:3000`)  
5) Production build: `npm run build` and preview with `npm run preview`

Notes:
- Without a Gemini key the app still runs; the insight panel will ask for a key.
- Data is stored in memory only; refresh clears changes.

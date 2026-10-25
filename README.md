<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/16ed7290-4cfa-42a9-8587-57499944786a

## Google Sheets өгөгдлийн сан
Нэвтрэх нэр/нууц үгийг Google Sheet-ийн эхний 2 tab-аас авч, хуваарь, даалгаврын явц, хэсгийн ахлагч, бүлгүүдийг Sheet-д хадгалдаг. Заавар: [apps-script/README.md](apps-script/README.md).

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

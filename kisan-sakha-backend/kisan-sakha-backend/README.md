# Kisan Sakha backend

Render par deploy:
- Build command: `npm install`
- Start command: `npm start`
- Environment variables (Render dashboard mein, kabhi code mein nahi):
  - `ANTHROPIC_API_KEY` = aapki Anthropic key
  - `ALLOWED_ORIGINS` = https://kisan-sakha.netlify.app

Check: `https://<aapka-service>.onrender.com/api/health` kholo, `{"status":"ok"}` aana chahiye.

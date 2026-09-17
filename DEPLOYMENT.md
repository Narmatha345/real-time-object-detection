# Deploying to Render (backend) + Vercel (frontend)

This gets you a real HTTPS URL that works from a phone browser — required
for camera access on mobile (browsers block `getUserMedia` over plain
`http://<ip>` on non-localhost hosts).

## 1. Backend on Render

1. Go to https://dashboard.render.com → **New +** → **Blueprint**.
2. Connect your GitHub account and pick the `real-time-object-detection`
   repo (under narmatha345). Render will detect [`render.yaml`](render.yaml)
   at the repo root and pre-fill the service (Docker, free plan, root
   dir `backend`).
3. Click **Apply** / **Create**. The first build takes several minutes
   (installs PyTorch + Ultralytics + OpenCV and bakes in the YOLO
   weights during the Docker build).
4. Once live, copy the service URL, e.g. `https://object-detection-backend.onrender.com`.
5. Check it works: open `https://<your-service>.onrender.com/api/health`
   in a browser — you should see `{"status":"ok","model_loaded":true,...}`.

**Free-tier notes:**
- The free plan has 512MB RAM. PyTorch + OpenCV + the model are usually
  fine for the nano model, but if you see the service crash-loop or
  `/api/health` never turns `model_loaded: true`, it's most likely an
  out-of-memory kill — upgrade to the paid **Starter** plan (more RAM)
  as the fix.
- Free services spin down after ~15 min idle and take ~30-60s to wake
  on the next request (first camera frame will be slow after idling).

## 2. Frontend on Vercel

1. Go to https://vercel.com/new and import the same GitHub repo.
2. When configuring the project, set **Root Directory** to `frontend`
   (Vercel auto-detects the Vite framework preset once you do).
3. Add an environment variable before deploying:
   - `VITE_API_BASE_URL` = the Render backend URL from step 1
     (e.g. `https://object-detection-backend.onrender.com`) — **no
     trailing slash**.
4. Deploy. Vercel gives you an HTTPS URL like
   `https://real-time-object-detection.vercel.app`.

## 3. Test on your phone

1. Open the Vercel URL on your phone's browser.
2. Tap **Start Camera**, allow camera permission.
3. Point it at objects — detections should appear within a second or two.

If you change `VITE_API_BASE_URL` later (e.g. redeploy the backend to a
new URL), update it in Vercel → Project → Settings → Environment
Variables, then redeploy the frontend for it to take effect.

## Redeploying after code changes

Both Render and Vercel auto-deploy on every push to `main` once
connected — just `git push` and both will rebuild.

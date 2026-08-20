# EventPass Frontend

Turnstile QR Ticket Scanning and Event Check-In Frontend built with React, TypeScript, and Vite.

---

## 🚀 Quick Start (Localhost Desktop Development)

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📱 Mobile Device Testing (QR Camera Scanner via HTTPS)

Modern mobile browsers (iOS Safari, Android Chrome) strictly require a **Secure Context (HTTPS or localhost)** to access physical device cameras via `navigator.mediaDevices.getUserMedia`.

When accessing the frontend from a phone over a local network (e.g., `https://172.20.10.2:5173`), both the frontend and backend must use **HTTPS** to prevent browser **Mixed-Content** blocking.

### 🔒 Local SSL Certificates with `mkcert` (Direct LAN)

1. **Install `mkcert` & Local CA**:
   ```bash
   brew install mkcert
   mkcert -install
   ```

2. **Generate Certificate for Localhost and your LAN IP**:
   ```bash
   mkdir -p certs
   mkcert -key-file certs/lan-key.pem -cert-file certs/lan-cert.pem localhost 127.0.0.1 <YOUR_LAN_IP>
   ```

3. **Install CA Certificate on Mobile Device**:
   - Send the root CA certificate (`mkcert -CAROOT`/`rootCA.pem`) to your phone (via AirDrop, email, or local server) and enable full trust in device settings (e.g. iOS Settings > General > About > Certificate Trust Settings).

4. **Configure `frontend/.env`**:
   > [!IMPORTANT]
   > When the frontend is served over HTTPS, `VITE_API_URL` must also use `https://...` (e.g. via HTTPS backend or HTTPS reverse proxy) so the browser does not block API requests as mixed content.
   ```env
   VITE_API_URL=https://<YOUR_LAN_IP>:5050/api
   VITE_HTTPS_CERT=./certs/lan-cert.pem
   VITE_HTTPS_KEY=./certs/lan-key.pem
   ```

5. **Start Vite**:
   ```bash
   npm run dev
   ```
   Open `https://<YOUR_LAN_IP>:5173` on your mobile device.

---

## 💻 Apple Continuity Camera (Mac Desktop)

On macOS, the scanner supports **Apple Continuity Camera** out of the box with zero certificates needed:
1. Open `http://localhost:5173` in Safari or Chrome on your Mac.
2. Keep your iPhone nearby with Wi-Fi and Bluetooth turned on.
3. The scanner automatically detects and selects **`📱 iPhone (Continuity Camera)`** as the primary video source.

---

## 🛠️ Fallback Manual Token Entry

If camera access is unavailable, denied, or if accessing over an insecure origin, the turnstile scanner provides a **Manual Token Entry** field directly beneath the viewfinder. Organizers can paste or type attendee QR token strings to complete check-ins.

---

## 🧪 Production Build & Validation

```bash
npm run build
```

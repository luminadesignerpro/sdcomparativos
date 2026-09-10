import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Service worker registration disabled for Capacitor build to prevent black screen
// But we must explicitly UNREGISTER any old service workers that might be stuck caching old broken versions
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (let registration of registrations) {
      registration.unregister();
    }
  }).catch((err) => {
    console.error('Service Worker unregistration failed: ', err);
  });
}

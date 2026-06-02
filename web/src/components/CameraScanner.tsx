"use client";

import { useEffect, useRef, useState } from "react";

export default function CameraScanner({ onSimulateScan }: { onSimulateScan: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (active && navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
        .catch(err => console.error("Camera access denied:", err));
    }
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [active]);

  if (!active) {
    return (
      <button onClick={() => setActive(true)} className="ghost" style={{ width: "100%", padding: "2rem", border: "2px dashed var(--brand)" }}>
        📷 Activate Field Camera Scanner
      </button>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "300px", background: "#000", borderRadius: "12px", overflow: "hidden" }}>
      <video ref={videoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "200px", height: "200px", border: "2px solid var(--brand)", boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)" }}>
        <div style={{ width: "100%", height: "2px", background: "var(--ok)", animation: "scan 2s linear infinite" }} />
      </div>
      <button onClick={() => { setActive(false); onSimulateScan(); }} style={{ position: "absolute", bottom: "1rem", left: "50%", transform: "translateX(-50%)" }}>
        Simulate Scan Capture
      </button>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes scan { 0% { transform: translateY(0); } 50% { transform: translateY(198px); } 100% { transform: translateY(0); } }` }} />
    </div>
  );
}
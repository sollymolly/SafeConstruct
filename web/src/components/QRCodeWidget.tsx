"use client";

export default function QRCodeWidget({ value }: { value: string }) {
  if (!value) return null;
  return (
    <div style={{ background: "#fff", padding: "1rem", borderRadius: "12px", display: "inline-block" }}>
      <img 
        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(value)}`} 
        alt="Worker QR Code"
        style={{ width: "200px", height: "200px", display: "block" }}
      />
    </div>
  );
}
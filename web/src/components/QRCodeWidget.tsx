"use client";

export default function QRCodeWidget({
  value,
  size = 200,
  ecc = "M",
}: {
  value: string;
  size?: number;
  ecc?: "L" | "M" | "Q" | "H";
}) {
  if (!value) return null;
  return (
    <div style={{ background: "#fff", padding: "1rem", borderRadius: "12px", display: "inline-block" }}>
      <img
        src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=${ecc}&data=${encodeURIComponent(value)}`}
        alt="QR Code"
        style={{ width: `${size}px`, height: `${size}px`, display: "block" }}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

export default function NetworkGraphPage() {
  const [nodes, setNodes] = useState<{x: number, y: number, type: string}[]>([]);

  useEffect(() => {
    const generated = Array.from({ length: 40 }).map((_, i) => ({
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80,
      type: i < 5 ? "issuer" : "worker"
    }));
    setNodes(generated);
  }, []);

  return (
    <section>
      <div className="search-header">
        <h1>Cryptographic Trust Matrix</h1>
        <p className="lead">Visualizing decentralized trust paths between Issuers and Workers.</p>
      </div>
      
      <div className="card" style={{ height: "600px", position: "relative", overflow: "hidden", padding: 0, background: "#060913" }}>
        <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0 }}>
          {nodes.map((node, i) => 
            nodes.slice(0, 5).map((issuer, j) => (
              Math.random() > 0.7 && (
                <line 
                  key={`${i}-${j}`}
                  x1={`${node.x}%`} y1={`${node.y}%`}
                  x2={`${issuer.x}%`} y2={`${issuer.y}%`}
                  stroke="rgba(255, 176, 32, 0.15)"
                  strokeWidth="1"
                />
              )
            ))
          )}
          {nodes.map((node, i) => (
            <circle
              key={i}
              cx={`${node.x}%`}
              cy={`${node.y}%`}
              r={node.type === "issuer" ? "8" : "4"}
              fill={node.type === "issuer" ? "var(--brand)" : "var(--ok)"}
              opacity={0.8}
            >
              <animate attributeName="r" values={node.type === "issuer" ? "8;10;8" : "4;5;4"} dur={`${2 + Math.random()}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </svg>
        <div style={{ position: "absolute", bottom: "2rem", left: "2rem", background: "var(--panel)", padding: "1rem", borderRadius: "12px", border: "1px solid var(--border)" }}>
          <div className="row" style={{ marginBottom: "0.5rem" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--brand)" }} /> <small>Authorized Issuers</small></div>
          <div className="row"><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--ok)" }} /> <small>Worker Wallets</small></div>
        </div>
      </div>
    </section>
  );
}
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite usar el servidor de desarrollo desde Tailscale y la red local (no solo localhost)
  allowedDevOrigins: ["100.83.33.95", "jetson.tailceaae6.ts.net", "192.168.0.18"],
  // El indicador de Next tapaba el botón de tema del sidebar
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;

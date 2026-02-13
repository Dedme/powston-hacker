/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["pyodide"]
  },
  // Increase serverless function timeout for Pyodide cold starts
  serverRuntimeConfig: {
    maxDuration: 60
  }
};

export default nextConfig;

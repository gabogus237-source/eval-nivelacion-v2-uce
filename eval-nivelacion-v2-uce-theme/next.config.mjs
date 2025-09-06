/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/evaluacion', destination: '/cerrada.html', permanent: false },
      { source: '/evaluacion/:path*', destination: '/cerrada.html', permanent: false },
      // Para cerrar TODO el sitio, descomenta la siguiente línea:
      // { source: '/', destination: '/cerrada.html', permanent: false },
    ];
  },
};

export default nextConfig;

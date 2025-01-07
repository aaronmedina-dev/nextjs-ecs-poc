import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ecsnextjsinfrastack-assetsbucket5cb76180-dx3lkjozgh26.s3.ap-southeast-1.amazonaws.com',
      },
    ],
  },
  //for hostname of static file like data.json
  async rewrites() {
    return [
      {
        source: '/static/:path*',
        destination: 'https://ecsnextjsinfrastack-assetsbucket5cb76180-dx3lkjozgh26.s3.ap-southeast-1.amazonaws.com/static/:path*',
      },
    ];
  },
  
};

export default nextConfig;

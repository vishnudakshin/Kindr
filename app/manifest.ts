import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kindr.',
    short_name: 'Kindr',
    description: 'Wellness, designed for you.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F5F0D0',
    theme_color: '#2C2A1E',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}

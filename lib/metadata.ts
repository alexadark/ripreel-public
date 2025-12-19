import type { Metadata } from "next";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    template: "%s | RIPREEL",
    default: "RIPREEL: AI-Powered Film Production Platform",
  },
  description:
    "Create professional video pitch reels in under 1 hour. AI screenplay parsing, parallel image generation, and automated video assembly for filmmakers.",
  icons: {
    icon: [],
    apple: [],
  },
  keywords: [
    "Film Production",
    "AI Video",
    "Screenplay Parsing",
    "Video Pitch Reel",
    "AI Filmmaking",
    "Image to Video",
    "Film Production Tools",
    "AI Video Generation",
    "Pitch Deck Video",
    "Film Production AI",
  ],
  openGraph: {
    title: "RIPREEL: AI-Powered Film Production Platform",
    description:
      "Create professional video pitch reels in under 1 hour. AI screenplay parsing, parallel image generation, and automated video assembly.",
    url: new URL(defaultUrl),
    siteName: "RIPREEL",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "A preview of the RIPREEL application interface.",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RIPREEL: AI-Powered Film Production Platform",
    description:
      "Create professional video pitch reels in under 1 hour. AI screenplay parsing, parallel image generation, and automated video assembly.",
    images: ["/twitter-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const generateLegalMetadata = (
  title: string,
  description: string
): Metadata => {
  return {
    title: `${title} | RIPREEL`,
    description,
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: `${title} | RIPREEL`,
      description,
      type: "website",
    },
  };
};

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import { CopilotProvider } from '@/components/copilot-chat';
import "./globals.css";
import Navbar from "./NavbarClient";
import Footer from "./FooterClient";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Next.js 15 AIaaS Boilerplate",
  description: "Modern AIaaS boilerplate with Next.js 15, TypeScript, Tailwind CSS, and Clerk Authentication",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
        >
          {/* Navigation */}
          <Navbar />
          {/* End Navigation */}
          <CopilotProvider>
            <main className="flex-1 w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-8 flex flex-col">
              {children}
            </main>
            <Footer />
          </CopilotProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

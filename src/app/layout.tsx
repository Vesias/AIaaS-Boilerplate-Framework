import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import { CopilotProvider } from '@/components/copilot-chat';
import "./globals.css";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";

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
          <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-14 items-center justify-between px-4">
              <div className="flex items-center">
                <Link className="mr-6 flex items-center space-x-2" href="/">
                  <Image
                    src="/next.svg"
                    alt="Logo"
                    width={24}
                    height={24}
                    className="dark:invert"
                  />
                  <span className="hidden font-bold sm:inline-block">
                    AIaaS Boilerplate
                  </span>
                </Link>
              </div>
              <div className="flex items-center gap-6">
                <Link href="/pricing" className="text-sm font-medium transition-colors hover:text-primary">
                  Pricing
                </Link>
                <Link href="/docs" className="text-sm font-medium transition-colors hover:text-primary">
                  Docs
                </Link>
                <a href="https://github.com/Vesias/AIaaS-Boilerplate-Framework" className="text-sm font-medium transition-colors hover:text-primary flex items-center gap-1" target="_blank" rel="noopener noreferrer">
                  <Github className="h-4 w-4" />GitHub
                </a>
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">Dashboard</Button>
                </Link>
                <Link href="/sign-up">
                  <Button size="sm">Get Started</Button>
                </Link>
              </div>
            </div>
          </nav>
          {/* End Navigation */}
          <CopilotProvider>
            <main className="flex-1 w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-8 flex flex-col">
              {children}
            </main>
            <footer className="w-full border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-6 mt-8">
              <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4 px-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Image src="/next.svg" alt="Logo" width={20} height={20} className="dark:invert" />
                  <span>AIaaS Boilerplate © {new Date().getFullYear()}</span>
                </div>
                <div className="flex gap-4">
                  <Link href="/docs" className="hover:text-foreground">Docs</Link>
                  <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
                  <a href="https://github.com/Vesias/AIaaS-Boilerplate-Framework" target="_blank" rel="noopener noreferrer" className="hover:text-foreground flex items-center gap-1">
                    <Github className="h-4 w-4" /> GitHub
                  </a>
                </div>
              </div>
            </footer>
          </CopilotProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

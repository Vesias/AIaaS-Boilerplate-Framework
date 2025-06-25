"use client";
import Link from "next/link";
import Image from "next/image";
import { Github } from "lucide-react";

export default function Footer() {
  return (
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
  );
}

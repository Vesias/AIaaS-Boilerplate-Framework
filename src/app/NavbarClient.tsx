"use client";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import { UserButton, SignInButton, SignUpButton, useUser } from '@clerk/nextjs';

export default function Navbar() {
  const { isSignedIn } = useUser();
  return (
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
          {!isSignedIn ? (
            <div className="flex items-center gap-2">
              <SignInButton mode="modal">
                <Button variant="outline" size="sm">Sign In</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="sm">Register</Button>
              </SignUpButton>
            </div>
          ) : (
            <UserButton afterSignOutUrl="/" />
          )}
        </div>
      </div>
    </nav>
  );
}

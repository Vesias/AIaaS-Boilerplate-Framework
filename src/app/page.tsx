import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Zap, Shield, Palette, Bot, Workflow, CreditCard, Code, Github, Star, Users, Rocket } from "lucide-react";

export default function Home() {
  const features = [
    {
      icon: Shield,
      title: "Authentication & Database",
      description: "Complete user management with Clerk + Supabase PostgreSQL with Row Level Security",
      techs: ["Clerk", "Supabase", "PostgreSQL"]
    },
    {
      icon: CreditCard,
      title: "Payments & Billing",
      description: "Stripe integration with EU VAT compliance, subscriptions, and customer portal",
      techs: ["Stripe", "EU VAT", "Invoices"]
    },
    {
      icon: Bot,
      title: "AI Integrations",
      description: "CopilotKit, MCP, AG-UI, and Google A2A for advanced AI capabilities",
      techs: ["CopilotKit", "MCP", "AG-UI", "OpenAI"]
    },
    {
      icon: Workflow,
      title: "Automation",
      description: "Visual workflow automation with n8n and Make.com integrations",
      techs: ["n8n", "Make.com", "Webhooks"]
    },
    {
      icon: Palette,
      title: "Modern UI/UX",
      description: "Beautiful components with shadcn/ui, Tailwind CSS, and dark mode support",
      techs: ["shadcn/ui", "Tailwind", "TypeScript"]
    },
    {
      icon: Code,
      title: "Developer Experience",
      description: "TypeScript, ESLint, Docker support, and production-ready setup",
      techs: ["Docker", "CI/CD", "ESLint"]
    }
  ];

  const techStack = [
    { name: "Next.js 15", logo: "/next.svg", category: "Framework" },
    { name: "TypeScript", logo: "/typescript.svg", category: "Language" },
    { name: "Tailwind CSS", logo: "/tailwind.svg", category: "Styling" },
    { name: "Clerk", logo: "/clerk.svg", category: "Auth" },
    { name: "Supabase", logo: "/supabase.svg", category: "Database" },
    { name: "Stripe", logo: "/stripe.svg", category: "Payments" },
    { name: "CopilotKit", logo: "/copilot.svg", category: "AI" },
    { name: "Docker", logo: "/docker.svg", category: "DevOps" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 hidden md:flex">
            <Link className="mr-6 flex items-center space-x-2" href="/">
              <Image
                src="/next.svg"
                alt="Logo"
                width={24}
                height={24}
                className="dark:invert"
              />
              <span className="hidden font-bold sm:inline-block">
                MicroSaaS Boilerplate
              </span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <div className="hidden md:flex space-x-6">
                <Link href="/pricing" className="text-sm font-medium transition-colors hover:text-primary">
                  Pricing
                </Link>
                <Link href="/docs" className="text-sm font-medium transition-colors hover:text-primary">
                  Docs
                </Link>
                <Link href="https://github.com" className="text-sm font-medium transition-colors hover:text-primary">
                  GitHub
                </Link>
              </div>
            </div>
            <nav className="flex items-center space-x-2">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  Dashboard
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32">
        <div className="mx-auto flex max-w-[64rem] flex-col items-center space-y-4 text-center">
          <Badge variant="outline" className="text-sm">
            <Rocket className="mr-2 h-3 w-3" />
            Production-Ready MicroSaaS Boilerplate
          </Badge>
          
          <h1 className="font-heading text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            Build Your{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              MicroSaaS
            </span>{" "}
            in Minutes
          </h1>
          
          <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
            Complete Next.js 15 boilerplate with authentication, payments, AI integrations, 
            automation tools, and modern UI components. Everything you need to launch your SaaS.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link href="/sign-up">
              <Button size="lg" className="text-lg px-8">
                <Zap className="mr-2 h-5 w-5" />
                Get Started Free
              </Button>
            </Link>
            <Link href="https://github.com">
              <Button variant="outline" size="lg" className="text-lg px-8">
                <Github className="mr-2 h-5 w-5" />
                View on GitHub
              </Button>
            </Link>
          </div>

          <div className="flex items-center space-x-4 pt-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <Star className="h-4 w-4 fill-current" />
              <span>Open Source</span>
            </div>
            <div className="flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>MIT License</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container space-y-6 py-8 md:py-12 lg:py-24">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
          <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl font-bold">
            Everything You Need
          </h2>
          <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
            A complete, production-ready stack with modern integrations and best practices.
          </p>
        </div>
        
        <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
          {features.map((feature, index) => (
            <Card key={index} className="relative overflow-hidden border-0 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {feature.techs.map((tech, techIndex) => (
                    <Badge key={techIndex} variant="secondary" className="text-xs">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="container space-y-6 py-8 md:py-12 lg:py-24">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
          <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl font-bold">
            Modern Tech Stack
          </h2>
          <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
            Built with the latest and greatest technologies for optimal performance and developer experience.
          </p>
        </div>
        
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-4">
          {techStack.map((tech, index) => (
            <Card key={index} className="group relative overflow-hidden border-0 bg-background/60 backdrop-blur transition-all hover:scale-105 supports-[backdrop-filter]:bg-background/60">
              <CardContent className="flex flex-col items-center justify-center p-6">
                <div className="mb-2 rounded-lg bg-muted p-3">
                  <div className="h-8 w-8 bg-muted-foreground/20 rounded" />
                </div>
                <h3 className="font-semibold">{tech.name}</h3>
                <p className="text-xs text-muted-foreground">{tech.category}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Quick Start Section */}
      <section className="container space-y-6 py-8 md:py-12 lg:py-24">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
          <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl font-bold">
            Quick Start
          </h2>
          <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
            Get up and running in minutes with our simple setup process.
          </p>
        </div>
        
        <div className="mx-auto max-w-4xl">
          <Card className="border-0 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <CardHeader>
              <CardTitle>Installation</CardTitle>
              <CardDescription>
                Copy and run these commands to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4 font-mono text-sm">
                <div className="text-muted-foreground"># Clone the repository</div>
                <div>git clone https://github.com/yourusername/microsaas-boilerplate.git</div>
                <div className="mt-2 text-muted-foreground"># Install dependencies</div>
                <div>pnpm install</div>
                <div className="mt-2 text-muted-foreground"># Start development server</div>
                <div>pnpm dev</div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/sign-up" className="flex-1">
                  <Button className="w-full" size="lg">
                    <Zap className="mr-2 h-4 w-4" />
                    Get Started Now
                  </Button>
                </Link>
                <Link href="/docs" className="flex-1">
                  <Button variant="outline" className="w-full" size="lg">
                    Read Documentation
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
          <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
            <Image
              src="/next.svg"
              alt="Logo"
              width={20}
              height={20}
              className="dark:invert"
            />
            <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
              Built with ❤️ for the developer community. MIT License.
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="https://github.com" className="text-muted-foreground hover:text-foreground">
              <Github className="h-5 w-5" />
            </Link>
            <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
              Documentation
            </Link>
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

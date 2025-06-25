import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Konto erstellen
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Starten Sie mit Ihrem neuen AIaaS-Konto
        </p>
      </div>
      
      <SignUp 
        appearance={{
          elements: {
            formButtonPrimary: 
              "bg-slate-900 hover:bg-slate-700 text-sm font-medium",
            card: "shadow-lg",
            headerTitle: "hidden",
            headerSubtitle: "hidden",
          },
        }}
      />
    </div>
  )
}
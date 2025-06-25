import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Willkommen zurück
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Melden Sie sich in Ihrem AIaaS-Konto an
        </p>
      </div>
      
      <SignIn 
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
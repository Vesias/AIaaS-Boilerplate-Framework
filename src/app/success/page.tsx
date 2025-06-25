import { stripe } from '@/lib/stripe'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

interface SuccessPageProps {
  searchParams: {
    session_id?: string
  }
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const { userId } = await auth()
  
  if (!userId) {
    redirect('/sign-in')
  }

  const sessionId = searchParams.session_id

  if (!sessionId) {
    redirect('/')
  }

  let session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch (error) {
    console.error('Error retrieving session:', error)
    redirect('/')
  }

  if (session.metadata?.userId !== userId) {
    redirect('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Successful!
        </h1>
        
        <p className="text-gray-600 mb-6">
          Thank you for your purchase. Your payment has been processed successfully.
        </p>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="text-sm text-gray-500 mb-1">Session ID</div>
          <div className="font-mono text-xs break-all">{sessionId}</div>
        </div>
        
        <div className="space-y-3">
          <a
            href="/dashboard"
            className="block w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </a>
          
          <a
            href="/"
            className="block w-full border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}
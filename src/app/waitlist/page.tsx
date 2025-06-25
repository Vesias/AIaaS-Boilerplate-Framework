import { WaitlistForm } from '@/components/waitlist-form'
import { CheckCircle, Clock, Users, Zap } from 'lucide-react'

export default function WaitlistPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-6">
            <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Join the Waitlist
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Be among the first to experience our revolutionary automation platform. 
            Get early access to exclusive features and special launch pricing.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Waitlist Form */}
          <div className="order-2 lg:order-1">
            <WaitlistForm />
          </div>

          {/* Benefits */}
          <div className="order-1 lg:order-2">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                What you'll get as an early user:
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Early Access
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Get access to new features before anyone else and help shape the product.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <Zap className="w-6 h-6 text-yellow-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Special Launch Pricing
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Lock in founder pricing with up to 50% off regular subscription rates.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <Users className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Exclusive Community
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Join our private community of early adopters and automation experts.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Priority Support
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Get direct access to our team for support and feature requests.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    1,247
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    People Waiting
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    234
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Already Approved
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Frequently Asked Questions
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                How long is the waitlist?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                We're onboarding users in batches to ensure the best experience. 
                Most users get access within 2-4 weeks of joining.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Is there a cost to join?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Joining the waitlist is completely free. You'll only pay when you 
                decide to upgrade to a paid plan after getting access.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                What happens after I'm approved?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                You'll receive an email with your login credentials and a personalized 
                onboarding guide to help you get started quickly.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Can I refer friends?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Yes! Referring friends helps you move up in the queue faster. 
                You'll get a referral link after joining the waitlist.
              </p>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 dark:text-gray-300">
            Have questions?{' '}
            <a 
              href="mailto:support@yourcompany.com" 
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Contact our support team
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
import { PricingSection } from '@/components/pricing-section'

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <PricingSection 
          title="Choose the Perfect Plan for Your Business"
          subtitle="Start your automation journey with transparent, flexible pricing that grows with you"
        />
        
        {/* FAQ Section */}
        <section className="mt-24 max-w-4xl mx-auto">
          <h3 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Frequently Asked Questions
          </h3>
          
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Can I change plans anytime?
              </h4>
              <p className="text-gray-600 dark:text-gray-300">
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately and you'll be prorated for the difference.
              </p>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                What payment methods do you accept?
              </h4>
              <p className="text-gray-600 dark:text-gray-300">
                We accept all major credit cards, PayPal, and SEPA direct debit for European customers. All payments are secured by Stripe.
              </p>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Is there a free trial?
              </h4>
              <p className="text-gray-600 dark:text-gray-300">
                Yes! All plans come with a 14-day free trial. No credit card required to start. You can cancel anytime during the trial period.
              </p>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Do you offer refunds?
              </h4>
              <p className="text-gray-600 dark:text-gray-300">
                We offer a 30-day money-back guarantee. If you're not satisfied, contact our support team for a full refund.
              </p>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                What about VAT for EU customers?
              </h4>
              <p className="text-gray-600 dark:text-gray-300">
                VAT is automatically calculated and included in the price for EU customers based on your location. You'll receive proper VAT invoices.
              </p>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Need a custom solution?
              </h4>
              <p className="text-gray-600 dark:text-gray-300">
                Our Enterprise plan includes custom development and white-label options. Contact our sales team to discuss your specific needs.
              </p>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="mt-16 text-center">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Still have questions?
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Our team is here to help you choose the right plan and get started.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:support@yourcompany.com"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                Contact Support
              </a>
              <a
                href="mailto:sales@yourcompany.com"
                className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-base font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Talk to Sales
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
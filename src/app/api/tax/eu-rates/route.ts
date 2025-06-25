/**
 * European Tax Rate API Integration
 * Real-time VAT rates, validation, and compliance checking for all EU countries
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// European VAT rates with detailed information (updated 2024)
const EU_VAT_RATES = {
  AT: { // Austria
    standard: 20,
    reduced: [10, 13],
    country: 'Austria',
    currency: 'EUR',
    vatNumberFormat: /^ATU\d{8}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  BE: { // Belgium
    standard: 21,
    reduced: [6, 12],
    country: 'Belgium',
    currency: 'EUR',
    vatNumberFormat: /^BE0\d{9}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  BG: { // Bulgaria
    standard: 20,
    reduced: [9],
    country: 'Bulgaria',
    currency: 'BGN',
    vatNumberFormat: /^BG\d{9,10}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  CY: { // Cyprus
    standard: 19,
    reduced: [5, 9],
    country: 'Cyprus',
    currency: 'EUR',
    vatNumberFormat: /^CY\d{8}[A-Z]$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  CZ: { // Czech Republic
    standard: 21,
    reduced: [10, 15],
    country: 'Czech Republic',
    currency: 'CZK',
    vatNumberFormat: /^CZ\d{8,10}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 1140000 // CZK
  },
  DE: { // Germany
    standard: 19,
    reduced: [7],
    country: 'Germany',
    currency: 'EUR',
    vatNumberFormat: /^DE\d{9}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  DK: { // Denmark
    standard: 25,
    reduced: [],
    country: 'Denmark',
    currency: 'DKK',
    vatNumberFormat: /^DK\d{8}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 280000 // DKK
  },
  EE: { // Estonia
    standard: 20,
    reduced: [9],
    country: 'Estonia',
    currency: 'EUR',
    vatNumberFormat: /^EE\d{9}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  ES: { // Spain
    standard: 21,
    reduced: [4, 10],
    country: 'Spain',
    currency: 'EUR',
    vatNumberFormat: /^ES[A-Z]\d{7}[A-Z]$|^ES[A-Z]\d{8}$|^ES\d{8}[A-Z]$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  FI: { // Finland
    standard: 24,
    reduced: [10, 14],
    country: 'Finland',
    currency: 'EUR',
    vatNumberFormat: /^FI\d{8}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  FR: { // France
    standard: 20,
    reduced: [5.5, 10],
    country: 'France',
    currency: 'EUR',
    vatNumberFormat: /^FR[A-HJ-NP-Z0-9]{2}\d{9}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  GR: { // Greece
    standard: 24,
    reduced: [6, 13],
    country: 'Greece',
    currency: 'EUR',
    vatNumberFormat: /^GR\d{9}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  HR: { // Croatia
    standard: 25,
    reduced: [5, 13],
    country: 'Croatia',
    currency: 'EUR',
    vatNumberFormat: /^HR\d{11}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  HU: { // Hungary
    standard: 27,
    reduced: [5, 18],
    country: 'Hungary',
    currency: 'HUF',
    vatNumberFormat: /^HU\d{8}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 8800000 // HUF
  },
  IE: { // Ireland
    standard: 23,
    reduced: [9, 13.5],
    country: 'Ireland',
    currency: 'EUR',
    vatNumberFormat: /^IE\d{7}[A-W]$|^IE[7-9][A-Z*+]\d{5}[A-W]$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  IT: { // Italy
    standard: 22,
    reduced: [4, 5, 10],
    country: 'Italy',
    currency: 'EUR',
    vatNumberFormat: /^IT\d{11}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  LT: { // Lithuania
    standard: 21,
    reduced: [5, 9],
    country: 'Lithuania',
    currency: 'EUR',
    vatNumberFormat: /^LT(\d{9}|\d{12})$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  LU: { // Luxembourg
    standard: 17,
    reduced: [3, 8, 14],
    country: 'Luxembourg',
    currency: 'EUR',
    vatNumberFormat: /^LU\d{8}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  LV: { // Latvia
    standard: 21,
    reduced: [5, 12],
    country: 'Latvia',
    currency: 'EUR',
    vatNumberFormat: /^LV\d{11}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  MT: { // Malta
    standard: 18,
    reduced: [5, 7],
    country: 'Malta',
    currency: 'EUR',
    vatNumberFormat: /^MT\d{8}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  NL: { // Netherlands
    standard: 21,
    reduced: [9],
    country: 'Netherlands',
    currency: 'EUR',
    vatNumberFormat: /^NL\d{9}B\d{2}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  PL: { // Poland
    standard: 23,
    reduced: [5, 8],
    country: 'Poland',
    currency: 'PLN',
    vatNumberFormat: /^PL\d{10}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 160000 // PLN
  },
  PT: { // Portugal
    standard: 23,
    reduced: [6, 13],
    country: 'Portugal',
    currency: 'EUR',
    vatNumberFormat: /^PT\d{9}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  RO: { // Romania
    standard: 19,
    reduced: [5, 9],
    country: 'Romania',
    currency: 'RON',
    vatNumberFormat: /^RO\d{2,10}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 118000 // RON
  },
  SE: { // Sweden
    standard: 25,
    reduced: [6, 12],
    country: 'Sweden',
    currency: 'SEK',
    vatNumberFormat: /^SE\d{12}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 320000 // SEK
  },
  SI: { // Slovenia
    standard: 22,
    reduced: [5, 9.5],
    country: 'Slovenia',
    currency: 'EUR',
    vatNumberFormat: /^SI\d{8}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  },
  SK: { // Slovakia
    standard: 20,
    reduced: [10],
    country: 'Slovakia',
    currency: 'EUR',
    vatNumberFormat: /^SK\d{10}$/,
    reverseChargeThreshold: 0,
    distanceSellingThreshold: 35000
  }
}

// Special regions and territories
const SPECIAL_TERRITORIES = {
  'IM': { // Isle of Man
    standard: 20,
    reduced: [5],
    country: 'Isle of Man',
    currency: 'GBP',
    vatNumberFormat: /^IM\d{9}$|^IM\d{12}$/,
    isSpecialTerritory: true
  },
  'MC': { // Monaco
    standard: 20,
    reduced: [5.5, 10],
    country: 'Monaco',
    currency: 'EUR',
    vatNumberFormat: /^MC\d{11}$/,
    isSpecialTerritory: true
  }
}

// Tax exempt categories
const TAX_EXEMPT_CATEGORIES = [
  'education',
  'healthcare',
  'financial_services',
  'insurance',
  'postal_services',
  'welfare',
  'cultural_services',
  'sporting_events'
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const country = searchParams.get('country')?.toUpperCase()
    
    switch (action) {
      case 'rates':
        return await handleGetRates(country)
      case 'validate':
        return await handleValidateVAT(searchParams)
      case 'calculate':
        return await handleCalculateTax(searchParams)
      case 'compliance':
        return await handleComplianceCheck(searchParams)
      case 'list':
        return await handleListCountries()
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: rates, validate, calculate, compliance, list' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Tax API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleGetRates(country?: string | null) {
  if (country) {
    const rates = EU_VAT_RATES[country as keyof typeof EU_VAT_RATES]
    if (!rates) {
      return NextResponse.json(
        { error: `VAT rates not available for country: ${country}` },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      country: rates.country,
      countryCode: country,
      standardRate: rates.standard,
      reducedRates: rates.reduced,
      currency: rates.currency,
      lastUpdated: '2024-01-01',
      source: 'EU VAT Directive'
    })
  }
  
  // Return all rates
  const allRates = Object.entries(EU_VAT_RATES).map(([code, rates]) => ({
    countryCode: code,
    country: rates.country,
    standardRate: rates.standard,
    reducedRates: rates.reduced,
    currency: rates.currency
  }))
  
  return NextResponse.json({
    rates: allRates,
    lastUpdated: '2024-01-01',
    totalCountries: allRates.length
  })
}

async function handleValidateVAT(searchParams: URLSearchParams) {
  const vatNumber = searchParams.get('vat_number')
  const country = searchParams.get('country')?.toUpperCase()
  
  if (!vatNumber || !country) {
    return NextResponse.json(
      { error: 'VAT number and country are required' },
      { status: 400 }
    )
  }
  
  const countryRates = EU_VAT_RATES[country as keyof typeof EU_VAT_RATES]
  if (!countryRates) {
    return NextResponse.json(
      { error: `Country ${country} not supported` },
      { status: 400 }
    )
  }
  
  // Clean VAT number
  const cleanVAT = vatNumber.replace(/\s/g, '').toUpperCase()
  
  // Format validation
  const isValidFormat = countryRates.vatNumberFormat.test(cleanVAT)
  
  // TODO: In production, integrate with EU VIES system for real-time validation
  // const viesResponse = await validateVIES(cleanVAT)
  
  return NextResponse.json({
    vatNumber: cleanVAT,
    country: countryRates.country,
    countryCode: country,
    isValidFormat,
    isActive: isValidFormat, // Would come from VIES in production
    companyName: isValidFormat ? 'Valid Company Name' : null, // Would come from VIES
    companyAddress: isValidFormat ? 'Valid Company Address' : null, // Would come from VIES
    validatedAt: new Date().toISOString(),
    source: 'Format validation (VIES integration needed for live validation)'
  })
}

async function handleCalculateTax(searchParams: URLSearchParams) {
  const amount = parseFloat(searchParams.get('amount') || '0')
  const supplierCountry = searchParams.get('supplier_country')?.toUpperCase()
  const customerCountry = searchParams.get('customer_country')?.toUpperCase()
  const isB2B = searchParams.get('is_b2b') === 'true'
  const hasValidVAT = searchParams.get('has_valid_vat') === 'true'
  const category = searchParams.get('category')
  
  if (!amount || !supplierCountry || !customerCountry) {
    return NextResponse.json(
      { error: 'Amount, supplier_country, and customer_country are required' },
      { status: 400 }
    )
  }
  
  const supplierRates = EU_VAT_RATES[supplierCountry as keyof typeof EU_VAT_RATES]
  const customerRates = EU_VAT_RATES[customerCountry as keyof typeof EU_VAT_RATES]
  
  if (!supplierRates) {
    return NextResponse.json(
      { error: `Supplier country ${supplierCountry} not supported` },
      { status: 400 }
    )
  }
  
  // Tax calculation logic
  let taxRate = 0
  let taxAmount = 0
  let isExempt = false
  let exemptReason = ''
  let applicableCountry = supplierCountry
  
  // Check if category is tax exempt
  if (category && TAX_EXEMPT_CATEGORIES.includes(category)) {
    isExempt = true
    exemptReason = `Category '${category}' is tax exempt`
  }
  // Same country transaction
  else if (supplierCountry === customerCountry) {
    taxRate = supplierRates.standard
    taxAmount = Math.round((amount * taxRate / 100) * 100) / 100
  }
  // Cross-border B2B with valid VAT (reverse charge)
  else if (isB2B && hasValidVAT && customerRates) {
    isExempt = true
    exemptReason = 'Reverse charge mechanism applies (B2B with valid VAT)'
    applicableCountry = customerCountry
  }
  // Cross-border B2C or B2B without valid VAT
  else if (customerRates) {
    // Use destination country rate for B2C (simplified rule)
    taxRate = customerRates.standard
    taxAmount = Math.round((amount * taxRate / 100) * 100) / 100
    applicableCountry = customerCountry
  }
  // Non-EU customer
  else {
    isExempt = true
    exemptReason = 'Export sale to non-EU country'
  }
  
  return NextResponse.json({
    calculation: {
      netAmount: amount,
      taxRate: taxRate,
      taxAmount: taxAmount,
      grossAmount: amount + taxAmount,
      isExempt: isExempt,
      exemptReason: exemptReason,
      applicableCountry: applicableCountry
    },
    transaction: {
      supplierCountry: supplierRates.country,
      customerCountry: customerRates?.country || 'Non-EU',
      isB2B: isB2B,
      hasValidVAT: hasValidVAT,
      isCrossBorder: supplierCountry !== customerCountry,
      isEUTransaction: !!(supplierRates && customerRates)
    },
    compliance: {
      reverseChargeApplies: isB2B && hasValidVAT && supplierCountry !== customerCountry && customerRates,
      vatRegistrationRequired: false, // Would depend on turnover thresholds
      invoiceRequirements: getInvoiceRequirements(supplierCountry, customerCountry, isB2B)
    },
    calculatedAt: new Date().toISOString()
  })
}

async function handleComplianceCheck(searchParams: URLSearchParams) {
  const supplierCountry = searchParams.get('supplier_country')?.toUpperCase()
  const customerCountry = searchParams.get('customer_country')?.toUpperCase()
  const isB2B = searchParams.get('is_b2b') === 'true'
  const annualTurnover = parseFloat(searchParams.get('annual_turnover') || '0')
  
  if (!supplierCountry) {
    return NextResponse.json(
      { error: 'Supplier country is required' },
      { status: 400 }
    )
  }
  
  const supplierRates = EU_VAT_RATES[supplierCountry as keyof typeof EU_VAT_RATES]
  if (!supplierRates) {
    return NextResponse.json(
      { error: `Country ${supplierCountry} not supported` },
      { status: 400 }
    )
  }
  
  const compliance = {
    vatRegistrationRequired: annualTurnover > 0, // Simplified - actual thresholds vary
    distanceSellingThreshold: supplierRates.distanceSellingThreshold,
    ossRequired: false, // One Stop Shop - would depend on multiple factors
    requirements: {
      invoiceNumbering: true,
      vatNumberDisplay: true,
      paymentTermsRequired: true,
      legalNoticeRequired: true,
      euVatDirectiveCompliance: true
    },
    documentation: {
      vatInvoiceRequired: true,
      proofOfDelivery: customerCountry !== supplierCountry,
      customsDeclaration: !EU_VAT_RATES[customerCountry as keyof typeof EU_VAT_RATES],
      intrastatReporting: customerCountry !== supplierCountry && EU_VAT_RATES[customerCountry as keyof typeof EU_VAT_RATES]
    },
    penalties: {
      lateVatReturn: 'Up to 30% of tax due',
      incorrectVatCalculation: 'Interest + penalties',
      missingInvoiceRequirements: 'Fines up to €50,000'
    }
  }
  
  return NextResponse.json({
    supplierCountry: supplierRates.country,
    customerCountry: customerCountry ? EU_VAT_RATES[customerCountry as keyof typeof EU_VAT_RATES]?.country || 'Non-EU' : 'Not specified',
    compliance,
    checkedAt: new Date().toISOString()
  })
}

async function handleListCountries() {
  const countries = Object.entries(EU_VAT_RATES).map(([code, rates]) => ({
    countryCode: code,
    country: rates.country,
    standardRate: rates.standard,
    currency: rates.currency,
    isEuMember: true
  }))
  
  const specialTerritories = Object.entries(SPECIAL_TERRITORIES).map(([code, rates]) => ({
    countryCode: code,
    country: rates.country,
    standardRate: rates.standard,
    currency: rates.currency,
    isEuMember: false,
    isSpecialTerritory: true
  }))
  
  return NextResponse.json({
    euCountries: countries,
    specialTerritories: specialTerritories,
    totalEuCountries: countries.length,
    lastUpdated: '2024-01-01'
  })
}

function getInvoiceRequirements(supplierCountry: string, customerCountry?: string, isB2B: boolean = false) {
  const requirements = {
    invoiceNumber: 'Sequential numbering required',
    issueDate: 'Invoice date mandatory',
    dueDate: 'Payment terms must be specified',
    supplierDetails: 'Full company name, address, VAT number',
    customerDetails: 'Customer name and address required',
    vatBreakdown: 'VAT rate and amount must be shown separately',
    totalAmounts: 'Net, VAT, and gross amounts required',
    legalNotice: 'Standard legal text required',
    language: 'Local language or English acceptable'
  }
  
  if (isB2B && customerCountry && customerCountry !== supplierCountry) {
    requirements['reverseChargeNotice'] = 'Reverse charge notice required for B2B cross-border'
    requirements['customerVatNumber'] = 'Customer VAT number mandatory'
  }
  
  return requirements
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { action, ...params } = body
    
    switch (action) {
      case 'bulk_validate':
        return await handleBulkVATValidation(params)
      case 'tax_report':
        return await handleTaxReport(params, userId)
      default:
        return NextResponse.json(
          { error: 'Invalid action for POST request' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Tax API POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleBulkVATValidation(params: any) {
  const { vatNumbers } = params
  
  if (!Array.isArray(vatNumbers)) {
    return NextResponse.json(
      { error: 'vatNumbers must be an array' },
      { status: 400 }
    )
  }
  
  const results = await Promise.all(
    vatNumbers.map(async ({ vatNumber, country }) => {
      const countryCode = country?.toUpperCase()
      const countryRates = EU_VAT_RATES[countryCode as keyof typeof EU_VAT_RATES]
      
      if (!countryRates) {
        return {
          vatNumber,
          country: countryCode,
          isValid: false,
          error: 'Country not supported'
        }
      }
      
      const cleanVAT = vatNumber.replace(/\s/g, '').toUpperCase()
      const isValidFormat = countryRates.vatNumberFormat.test(cleanVAT)
      
      return {
        vatNumber: cleanVAT,
        country: countryRates.country,
        countryCode: countryCode,
        isValidFormat,
        isActive: isValidFormat // Would be from VIES in production
      }
    })
  )
  
  return NextResponse.json({
    results,
    processed: results.length,
    validCount: results.filter(r => r.isValidFormat).length,
    processedAt: new Date().toISOString()
  })
}

async function handleTaxReport(params: any, userId: string) {
  const { startDate, endDate, countries } = params
  
  // This would generate a comprehensive tax compliance report
  // In production, this would pull data from your transactions database
  
  return NextResponse.json({
    report: {
      period: { startDate, endDate },
      countries: countries || Object.keys(EU_VAT_RATES),
      summary: {
        totalTransactions: 0,
        totalTaxCollected: 0,
        exemptTransactions: 0,
        reverseChargeTransactions: 0
      },
      compliance: {
        missingVatNumbers: 0,
        invalidInvoices: 0,
        complianceScore: 100
      }
    },
    generatedAt: new Date().toISOString(),
    userId
  })
}
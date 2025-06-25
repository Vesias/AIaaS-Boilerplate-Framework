/**
 * Invoice Numbering System API
 * European-compliant invoice numbering with custom formats and sequential tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createDatabaseService } from '@/lib/database'

// Invoice numbering formats
export const NUMBERING_FORMATS = {
  sequential: {
    name: 'Sequential',
    description: 'Simple sequential numbering (1, 2, 3...)',
    pattern: '{prefix}-{sequence}',
    example: 'INV-000001',
    compliant: true
  },
  date_based: {
    name: 'Date-based',
    description: 'Date-based numbering with sequence',
    pattern: '{prefix}-{year}{month}{day}-{sequence}',
    example: 'INV-20241225-001',
    compliant: true
  },
  hybrid: {
    name: 'Hybrid',
    description: 'Year-month with sequence',
    pattern: '{prefix}-{year}{month}-{sequence}',
    example: 'INV-202412-00001',
    compliant: true
  },
  monthly: {
    name: 'Monthly Reset',
    description: 'Sequence resets each month',
    pattern: '{prefix}-{year}{month}-{sequence}',
    example: 'INV-202412-00001',
    compliant: true,
    resetPeriod: 'monthly'
  },
  yearly: {
    name: 'Yearly Reset',
    description: 'Sequence resets each year',
    pattern: '{prefix}-{year}-{sequence}',
    example: 'INV-2024-00001',
    compliant: true,
    resetPeriod: 'yearly'
  },
  country_specific: {
    name: 'Country-specific',
    description: 'Includes country code for multi-country businesses',
    pattern: '{prefix}-{country}-{year}{month}-{sequence}',
    example: 'INV-DE-202412-00001',
    compliant: true
  }
}

// European compliance requirements
const EU_INVOICE_REQUIREMENTS = {
  sequential: true,
  unique: true,
  noGaps: false, // Some countries allow gaps, others don't
  chronological: true,
  immutable: true, // Once assigned, cannot be changed
  minLength: 1,
  maxLength: 50,
  allowedCharacters: /^[A-Z0-9\-\/]+$/,
  mustIncludeYear: false // Some countries require year
}

// Country-specific requirements
const COUNTRY_REQUIREMENTS = {
  DE: { // Germany
    noGaps: true,
    chronological: true,
    mustIncludeYear: false,
    archiveYears: 10,
    format: 'Must be sequential and unique'
  },
  FR: { // France
    noGaps: true,
    chronological: true,
    mustIncludeYear: true,
    archiveYears: 6,
    format: 'Must include year and be chronological'
  },
  IT: { // Italy
    noGaps: true,
    chronological: true,
    mustIncludeYear: true,
    archiveYears: 10,
    format: 'Sequential within year, no gaps allowed'
  },
  ES: { // Spain
    noGaps: false,
    chronological: true,
    mustIncludeYear: false,
    archiveYears: 4,
    format: 'Sequential and chronological'
  },
  NL: { // Netherlands
    noGaps: false,
    chronological: true,
    mustIncludeYear: false,
    archiveYears: 7,
    format: 'Unique and chronological'
  }
}

interface NumberingConfig {
  format: keyof typeof NUMBERING_FORMATS
  prefix: string
  startingNumber: number
  paddingLength: number
  resetPeriod?: 'none' | 'monthly' | 'yearly'
  countryCode?: string
  isActive: boolean
  createdAt: string
  lastUsed?: {
    number: string
    sequence: number
    date: string
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    const db = await createDatabaseService()

    switch (action) {
      case 'config':
        return await handleGetConfig(userId, db)
      case 'next':
        return await handleGetNextNumber(userId, searchParams, db)
      case 'formats':
        return await handleGetFormats()
      case 'validate':
        return await handleValidateNumber(searchParams)
      case 'history':
        return await handleGetHistory(userId, searchParams, db)
      case 'compliance':
        return await handleComplianceCheck(searchParams)
      default:
        return await handleGetConfig(userId, db)
    }
  } catch (error) {
    console.error('Numbering API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
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

    const db = await createDatabaseService()

    switch (action) {
      case 'configure':
        return await handleConfigure(userId, params, db)
      case 'generate':
        return await handleGenerate(userId, params, db)
      case 'reserve':
        return await handleReserve(userId, params, db)
      case 'validate_config':
        return await handleValidateConfig(params)
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Numbering API POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleGetConfig(userId: string, db: any) {
  try {
    // Get user's numbering configuration
    const config = await db.getInvoiceNumberingConfig(userId)
    
    if (!config) {
      // Return default configuration
      return NextResponse.json({
        config: {
          format: 'hybrid',
          prefix: 'INV',
          startingNumber: 1,
          paddingLength: 5,
          resetPeriod: 'none',
          isActive: true,
          createdAt: new Date().toISOString()
        },
        isConfigured: false
      })
    }

    return NextResponse.json({
      config,
      isConfigured: true,
      lastGenerated: config.lastUsed
    })
  } catch (error) {
    console.error('Error getting numbering config:', error)
    throw error
  }
}

async function handleGetNextNumber(userId: string, searchParams: URLSearchParams, db: any) {
  const preview = searchParams.get('preview') === 'true'
  
  try {
    const config = await db.getInvoiceNumberingConfig(userId)
    if (!config) {
      return NextResponse.json(
        { error: 'Numbering configuration not found. Please configure first.' },
        { status: 404 }
      )
    }

    const nextNumber = await generateNextNumber(config, preview, db, userId)
    
    return NextResponse.json({
      nextNumber: nextNumber.invoiceNumber,
      sequence: nextNumber.sequence,
      format: config.format,
      preview: preview,
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error getting next number:', error)
    throw error
  }
}

async function handleGetFormats() {
  const formats = Object.entries(NUMBERING_FORMATS).map(([key, format]) => ({
    id: key,
    ...format
  }))

  return NextResponse.json({
    formats,
    totalFormats: formats.length,
    compliance: EU_INVOICE_REQUIREMENTS
  })
}

async function handleValidateNumber(searchParams: URLSearchParams) {
  const invoiceNumber = searchParams.get('invoice_number')
  const country = searchParams.get('country')?.toUpperCase()
  
  if (!invoiceNumber) {
    return NextResponse.json(
      { error: 'Invoice number is required' },
      { status: 400 }
    )
  }

  const validation = validateInvoiceNumber(invoiceNumber, country)
  
  return NextResponse.json({
    invoiceNumber,
    country,
    validation,
    validatedAt: new Date().toISOString()
  })
}

async function handleGetHistory(userId: string, searchParams: URLSearchParams, db: any) {
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  
  try {
    const history = await db.getInvoiceNumberHistory(userId, limit, offset)
    
    return NextResponse.json({
      history,
      pagination: {
        limit,
        offset,
        total: history.length
      }
    })
  } catch (error) {
    console.error('Error getting numbering history:', error)
    throw error
  }
}

async function handleComplianceCheck(searchParams: URLSearchParams) {
  const country = searchParams.get('country')?.toUpperCase()
  const format = searchParams.get('format')
  
  if (!country) {
    return NextResponse.json(
      { error: 'Country is required' },
      { status: 400 }
    )
  }

  const requirements = COUNTRY_REQUIREMENTS[country as keyof typeof COUNTRY_REQUIREMENTS]
  if (!requirements) {
    return NextResponse.json(
      { error: `Compliance requirements not available for ${country}` },
      { status: 404 }
    )
  }

  const compliance = {
    country,
    requirements,
    recommendations: getComplianceRecommendations(country, format),
    warnings: getComplianceWarnings(country, format)
  }

  return NextResponse.json(compliance)
}

async function handleConfigure(userId: string, params: any, db: any) {
  const {
    format,
    prefix,
    startingNumber = 1,
    paddingLength = 5,
    resetPeriod = 'none',
    countryCode
  } = params

  // Validate configuration
  const validation = validateConfiguration({
    format,
    prefix,
    startingNumber,
    paddingLength,
    resetPeriod,
    countryCode
  })

  if (!validation.isValid) {
    return NextResponse.json(
      { error: 'Invalid configuration', details: validation.errors },
      { status: 400 }
    )
  }

  try {
    const config: NumberingConfig = {
      format,
      prefix: prefix.toUpperCase(),
      startingNumber,
      paddingLength,
      resetPeriod,
      countryCode: countryCode?.toUpperCase(),
      isActive: true,
      createdAt: new Date().toISOString()
    }

    await db.saveInvoiceNumberingConfig(userId, config)

    return NextResponse.json({
      success: true,
      config,
      message: 'Numbering configuration saved successfully'
    })
  } catch (error) {
    console.error('Error saving numbering config:', error)
    throw error
  }
}

async function handleGenerate(userId: string, params: any, db: any) {
  const { reserve = false } = params

  try {
    const config = await db.getInvoiceNumberingConfig(userId)
    if (!config) {
      return NextResponse.json(
        { error: 'Numbering configuration not found' },
        { status: 404 }
      )
    }

    const result = await generateNextNumber(config, !reserve, db, userId)

    if (reserve) {
      // Save the generated number as used
      await db.recordInvoiceNumberUsage(userId, result.invoiceNumber, result.sequence)
    }

    return NextResponse.json({
      success: true,
      invoiceNumber: result.invoiceNumber,
      sequence: result.sequence,
      reserved: reserve,
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error generating invoice number:', error)
    throw error
  }
}

async function handleReserve(userId: string, params: any, db: any) {
  const { count = 1 } = params

  if (count > 100) {
    return NextResponse.json(
      { error: 'Cannot reserve more than 100 numbers at once' },
      { status: 400 }
    )
  }

  try {
    const config = await db.getInvoiceNumberingConfig(userId)
    if (!config) {
      return NextResponse.json(
        { error: 'Numbering configuration not found' },
        { status: 404 }
      )
    }

    const reservedNumbers = []
    for (let i = 0; i < count; i++) {
      const result = await generateNextNumber(config, false, db, userId)
      await db.recordInvoiceNumberUsage(userId, result.invoiceNumber, result.sequence)
      reservedNumbers.push(result.invoiceNumber)
    }

    return NextResponse.json({
      success: true,
      reservedNumbers,
      count: reservedNumbers.length,
      reservedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error reserving invoice numbers:', error)
    throw error
  }
}

async function handleValidateConfig(params: any) {
  const validation = validateConfiguration(params)
  
  return NextResponse.json({
    isValid: validation.isValid,
    errors: validation.errors,
    warnings: validation.warnings,
    recommendations: validation.recommendations
  })
}

// Helper functions

async function generateNextNumber(
  config: NumberingConfig,
  preview: boolean,
  db: any,
  userId: string
): Promise<{ invoiceNumber: string; sequence: number }> {
  const format = NUMBERING_FORMATS[config.format]
  if (!format) {
    throw new Error(`Invalid numbering format: ${config.format}`)
  }

  // Get current sequence number
  let sequence = await getNextSequence(config, db, userId)
  
  // Apply reset logic if applicable
  if (config.resetPeriod && config.resetPeriod !== 'none') {
    const shouldReset = await shouldResetSequence(config, db, userId)
    if (shouldReset) {
      sequence = config.startingNumber
    }
  }

  // Generate the invoice number
  const invoiceNumber = formatInvoiceNumber(format.pattern, {
    prefix: config.prefix,
    sequence: sequence.toString().padStart(config.paddingLength, '0'),
    year: new Date().getFullYear().toString(),
    month: (new Date().getMonth() + 1).toString().padStart(2, '0'),
    day: new Date().getDate().toString().padStart(2, '0'),
    country: config.countryCode || ''
  })

  return { invoiceNumber, sequence }
}

async function getNextSequence(config: NumberingConfig, db: any, userId: string): Promise<number> {
  const lastUsed = await db.getLastInvoiceNumber(userId)
  
  if (!lastUsed) {
    return config.startingNumber
  }

  return lastUsed.sequence + 1
}

async function shouldResetSequence(config: NumberingConfig, db: any, userId: string): Promise<boolean> {
  const lastUsed = await db.getLastInvoiceNumber(userId)
  
  if (!lastUsed) {
    return false
  }

  const lastDate = new Date(lastUsed.date)
  const now = new Date()

  switch (config.resetPeriod) {
    case 'monthly':
      return lastDate.getMonth() !== now.getMonth() || lastDate.getFullYear() !== now.getFullYear()
    case 'yearly':
      return lastDate.getFullYear() !== now.getFullYear()
    default:
      return false
  }
}

function formatInvoiceNumber(pattern: string, variables: Record<string, string>): string {
  let result = pattern
  
  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  })
  
  return result
}

function validateInvoiceNumber(invoiceNumber: string, country?: string) {
  const validation = {
    isValid: true,
    errors: [] as string[],
    warnings: [] as string[],
    compliance: {} as any
  }

  // Basic format validation
  if (!EU_INVOICE_REQUIREMENTS.allowedCharacters.test(invoiceNumber)) {
    validation.isValid = false
    validation.errors.push('Contains invalid characters')
  }

  if (invoiceNumber.length < EU_INVOICE_REQUIREMENTS.minLength) {
    validation.isValid = false
    validation.errors.push('Invoice number too short')
  }

  if (invoiceNumber.length > EU_INVOICE_REQUIREMENTS.maxLength) {
    validation.isValid = false
    validation.errors.push('Invoice number too long')
  }

  // Country-specific validation
  if (country && COUNTRY_REQUIREMENTS[country as keyof typeof COUNTRY_REQUIREMENTS]) {
    const requirements = COUNTRY_REQUIREMENTS[country as keyof typeof COUNTRY_REQUIREMENTS]
    validation.compliance = {
      country,
      requirements: requirements.format,
      archiveYears: requirements.archiveYears
    }

    if (requirements.mustIncludeYear) {
      const currentYear = new Date().getFullYear().toString()
      if (!invoiceNumber.includes(currentYear)) {
        validation.warnings.push('Should include current year for this country')
      }
    }
  }

  return validation
}

function validateConfiguration(config: any) {
  const validation = {
    isValid: true,
    errors: [] as string[],
    warnings: [] as string[],
    recommendations: [] as string[]
  }

  // Validate format
  if (!config.format || !NUMBERING_FORMATS[config.format]) {
    validation.isValid = false
    validation.errors.push('Invalid numbering format')
  }

  // Validate prefix
  if (!config.prefix || config.prefix.trim().length === 0) {
    validation.isValid = false
    validation.errors.push('Prefix is required')
  } else if (config.prefix.length > 10) {
    validation.warnings.push('Prefix should be kept short for readability')
  }

  // Validate starting number
  if (!config.startingNumber || config.startingNumber < 1) {
    validation.isValid = false
    validation.errors.push('Starting number must be positive')
  }

  // Validate padding
  if (!config.paddingLength || config.paddingLength < 1 || config.paddingLength > 10) {
    validation.isValid = false
    validation.errors.push('Padding length must be between 1 and 10')
  }

  // Country-specific recommendations
  if (config.countryCode && COUNTRY_REQUIREMENTS[config.countryCode]) {
    const requirements = COUNTRY_REQUIREMENTS[config.countryCode]
    
    if (requirements.noGaps) {
      validation.recommendations.push('Consider sequential format to avoid gaps')
    }
    
    if (requirements.mustIncludeYear) {
      validation.recommendations.push('Include year in format for compliance')
    }
  }

  return validation
}

function getComplianceRecommendations(country?: string, format?: string): string[] {
  const recommendations = []

  if (country && COUNTRY_REQUIREMENTS[country as keyof typeof COUNTRY_REQUIREMENTS]) {
    const req = COUNTRY_REQUIREMENTS[country as keyof typeof COUNTRY_REQUIREMENTS]
    
    if (req.noGaps) {
      recommendations.push('Use sequential numbering without gaps')
    }
    
    if (req.chronological) {
      recommendations.push('Ensure chronological ordering of invoice numbers')
    }
    
    if (req.mustIncludeYear) {
      recommendations.push('Include year in invoice number format')
    }
  }

  if (format && format !== 'sequential') {
    recommendations.push('Consider adding backup numbering in case of system failures')
  }

  return recommendations
}

function getComplianceWarnings(country?: string, format?: string): string[] {
  const warnings = []

  if (country === 'DE' && format && !['sequential', 'hybrid'].includes(format)) {
    warnings.push('Germany requires strict sequential numbering')
  }

  if (country === 'FR' && format && !format.includes('year')) {
    warnings.push('France requires year in invoice numbers')
  }

  return warnings
}
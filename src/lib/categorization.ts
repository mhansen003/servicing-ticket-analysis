/**
 * PHASE 1: Advanced Categorization Engine
 *
 * Multi-level categorization with subcategories, confidence scoring,
 * and multi-issue detection based on the Python analysis framework.
 */

export interface CategoryResult {
  category: string;
  subcategory: string;
  confidence: number; // 0.0 - 1.0
  allIssues: string[]; // All detected issues
  matchedKeywords: string[]; // Keywords that triggered this categorization
}

export interface CategoryDefinition {
  name: string;
  subcategories: {
    name: string;
    keywords: string[];
    weight: number; // Higher weight = higher priority
  }[];
  keywords: string[]; // General category keywords
}

// Comprehensive category definitions based on README guides
export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    name: 'Payment Issues',
    keywords: ['payment', 'pay', 'autopay', 'ach', 'paying', 'bill'],
    subcategories: [
      {
        name: 'First Payment Assistance',
        keywords: ['first payment', 'initial payment', 'how to pay', 'where do i send', 'payment address', 'where to pay', 'payment location'],
        weight: 100,
      },
      {
        name: 'Payment Failure',
        keywords: ['declined', 'failed', 'didn\'t go through', 'bounced', 'rejected', 'payment error'],
        weight: 95,
      },
      {
        name: 'Duplicate Payment',
        keywords: ['duplicate', 'charged twice', 'double payment', 'paid twice', 'multiple charges'],
        weight: 90,
      },
      {
        name: 'Autopay/Recurring Payment Issues',
        keywords: ['autopay', 'recurring', 'automatic payment', 'auto pay', 'scheduled payment'],
        weight: 85,
      },
      {
        name: 'Payment Location Confusion',
        keywords: ['where do i send', 'payment address', 'where to mail', 'payment location', 'send payment'],
        weight: 80,
      },
      {
        name: 'General Payment Inquiry',
        keywords: ['payment', 'pay'],
        weight: 50,
      },
    ],
  },
  {
    name: 'Account Access',
    keywords: ['login', 'password', 'access', 'locked out', 'account'],
    subcategories: [
      {
        name: 'Password/Login Issues',
        keywords: ['password', 'reset', 'forgot password', 'can\'t log in', 'login problem', 'locked out'],
        weight: 95,
      },
      {
        name: 'Account Locked',
        keywords: ['locked', 'frozen', 'suspended', 'disabled account', 'account locked'],
        weight: 90,
      },
      {
        name: 'Registration Issues',
        keywords: ['register', 'sign up', 'create account', 'new account', 'registration'],
        weight: 85,
      },
      {
        name: 'General Access Issues',
        keywords: ['access', 'login'],
        weight: 50,
      },
    ],
  },
  {
    name: 'Loan Transfer',
    keywords: ['transfer', 'servicer', 'sold my loan', 'boarding', 'new servicer'],
    subcategories: [
      {
        name: 'Post-Transfer Payment Confusion',
        keywords: ['where do i pay', 'transfer', 'new servicer', 'where to send payment'],
        weight: 95,
      },
      {
        name: 'Missing Transfer Notice',
        keywords: ['didn\'t receive', 'notice', 'transfer letter', 'no notification', 'never got notice'],
        weight: 90,
      },
      {
        name: 'Transfer Status Inquiry',
        keywords: ['when will transfer', 'transfer date', 'is my loan transferred', 'transfer status'],
        weight: 85,
      },
      {
        name: 'General Transfer Inquiry',
        keywords: ['transfer', 'sold'],
        weight: 50,
      },
    ],
  },
  {
    name: 'Document Requests',
    keywords: ['document', 'statement', 'payoff', 'letter', 'copy', 'paperwork'],
    subcategories: [
      {
        name: 'Payoff Statement',
        keywords: ['payoff', 'payoff quote', 'payoff amount', 'payoff letter', 'closing', 'refinancing'],
        weight: 95,
      },
      {
        name: 'Mortgage Statement',
        keywords: ['mortgage statement', 'statement', 'billing statement', 'monthly statement'],
        weight: 90,
      },
      {
        name: 'Tax Documents',
        keywords: ['1098', 'tax', 'tax document', 'tax form', '1099'],
        weight: 85,
      },
      {
        name: 'Insurance Documents',
        keywords: ['insurance', 'hazard insurance', 'homeowners insurance', 'insurance certificate'],
        weight: 80,
      },
      {
        name: 'General Document Request',
        keywords: ['document', 'copy', 'send me'],
        weight: 50,
      },
    ],
  },
  {
    name: 'Escrow',
    keywords: ['escrow', 'tax', 'insurance', 'impound'],
    subcategories: [
      {
        name: 'Escrow Analysis',
        keywords: ['escrow analysis', 'escrow review', 'escrow adjustment', 'escrow shortage', 'escrow surplus'],
        weight: 95,
      },
      {
        name: 'Tax Payment Issues',
        keywords: ['property tax', 'tax payment', 'tax bill', 'taxes not paid'],
        weight: 90,
      },
      {
        name: 'Insurance Payment Issues',
        keywords: ['insurance payment', 'homeowners insurance', 'insurance not paid', 'insurance lapse'],
        weight: 85,
      },
      {
        name: 'General Escrow Inquiry',
        keywords: ['escrow'],
        weight: 50,
      },
    ],
  },
  {
    name: 'Escalation',
    keywords: ['supervisor', 'manager', 'complaint', 'escalate', 'lawyer', 'attorney', 'legal'],
    subcategories: [
      {
        name: 'Customer Escalation',
        keywords: ['speak to supervisor', 'talk to manager', 'escalate', 'supervisor', 'manager'],
        weight: 100,
      },
      {
        name: 'Formal Complaint',
        keywords: ['complaint', 'file a complaint', 'formal complaint', 'complain'],
        weight: 95,
      },
      {
        name: 'Legal Threat',
        keywords: ['lawyer', 'attorney', 'legal action', 'sue', 'lawsuit', 'legal'],
        weight: 90,
      },
      {
        name: 'General Escalation',
        keywords: ['escalate', 'unacceptable'],
        weight: 50,
      },
    ],
  },
  {
    name: 'Voice/Alert Requests',
    keywords: ['voice', 'alert', 'notification', 'text', 'call preference'],
    subcategories: [
      {
        name: 'Voice Preference',
        keywords: ['voice preference', 'calling preference', 'stop calling', 'do not call', 'communication preference'],
        weight: 90,
      },
      {
        name: 'Alert Setup',
        keywords: ['alert', 'notification', 'text message', 'email alert', 'set up alert'],
        weight: 85,
      },
      {
        name: 'General Voice/Alert Request',
        keywords: ['voice', 'alert'],
        weight: 50,
      },
    ],
  },
  {
    name: 'Loan Information',
    keywords: ['loan info', 'account information', 'balance', 'interest rate', 'loan details'],
    subcategories: [
      {
        name: 'Balance Inquiry',
        keywords: ['balance', 'current balance', 'principal balance', 'what do i owe', 'amount owed'],
        weight: 90,
      },
      {
        name: 'Interest Rate Inquiry',
        keywords: ['interest rate', 'rate', 'apr', 'current rate'],
        weight: 85,
      },
      {
        name: 'Loan Details',
        keywords: ['loan details', 'account details', 'loan information'],
        weight: 80,
      },
      {
        name: 'Payment History',
        keywords: ['payment history', 'past payments', 'payment record'],
        weight: 75,
      },
      {
        name: 'General Loan Inquiry',
        keywords: ['information', 'info'],
        weight: 50,
      },
    ],
  },
  {
    name: 'Loan Modifications',
    keywords: ['modification', 'loan change', 'refinance', 'forbearance', 'hardship'],
    subcategories: [
      {
        name: 'Forbearance Request',
        keywords: ['forbearance', 'hardship', 'financial difficulty', 'can\'t pay', 'payment relief'],
        weight: 95,
      },
      {
        name: 'Loan Modification',
        keywords: ['modification', 'loan mod', 'modify loan', 'change terms'],
        weight: 90,
      },
      {
        name: 'Refinance Inquiry',
        keywords: ['refinance', 'refi', 'refinancing'],
        weight: 85,
      },
      {
        name: 'General Modification Inquiry',
        keywords: ['change', 'modification'],
        weight: 50,
      },
    ],
  },
  {
    name: 'Automated System Messages',
    keywords: ['automated', 'system message', 'auto-generated', 'automatic'],
    subcategories: [
      {
        name: 'System Generated',
        keywords: ['automated', 'system message', 'auto-generated'],
        weight: 100,
      },
    ],
  },
  {
    name: 'Communication',
    keywords: ['forward', 'forwarded', 'communication', 'update'],
    subcategories: [
      {
        name: 'Forwarded Message',
        keywords: ['forwarded', 'forward', 'fwd'],
        weight: 90,
      },
      {
        name: 'Update Request',
        keywords: ['update', 'status update', 'follow up'],
        weight: 80,
      },
      {
        name: 'General Communication',
        keywords: ['communication'],
        weight: 50,
      },
    ],
  },
];

/**
 * Categorize text with subcategory and confidence scoring
 */
export function categorizeText(text: string, title?: string): CategoryResult {
  const combined = title ? `${title} ${text}`.toLowerCase() : text.toLowerCase();

  let bestMatch: CategoryResult = {
    category: 'Other',
    subcategory: 'Uncategorized',
    confidence: 0.3,
    allIssues: [],
    matchedKeywords: [],
  };

  const allDetectedIssues: string[] = [];

  // Check each category
  for (const categoryDef of CATEGORY_DEFINITIONS) {
    // First check if general category keywords match
    const categoryKeywordsMatched = categoryDef.keywords.filter(keyword =>
      combined.includes(keyword.toLowerCase())
    );

    if (categoryKeywordsMatched.length === 0) {
      continue; // Skip this category entirely if no general keywords match
    }

    // Add to detected issues
    if (categoryKeywordsMatched.length > 0) {
      allDetectedIssues.push(categoryDef.name);
    }

    // Now check subcategories (ordered by weight, highest first)
    const sortedSubcategories = [...categoryDef.subcategories].sort((a, b) => b.weight - a.weight);

    for (const subcategory of sortedSubcategories) {
      const matchedKeywords = subcategory.keywords.filter(keyword =>
        combined.includes(keyword.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        // Calculate confidence based on:
        // - Number of matched keywords
        // - Subcategory weight
        // - Keyword specificity (longer keywords = more specific)
        const avgKeywordLength = matchedKeywords.reduce((sum, kw) => sum + kw.length, 0) / matchedKeywords.length;
        const specificityBonus = Math.min(avgKeywordLength / 20, 0.3); // Max 0.3 bonus
        const matchBonus = Math.min(matchedKeywords.length * 0.1, 0.3); // Max 0.3 bonus
        const weightBonus = (subcategory.weight / 100) * 0.4; // Max 0.4 from weight

        const confidence = Math.min(0.4 + specificityBonus + matchBonus + weightBonus, 1.0);

        // Use this if it's better than current best
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            category: categoryDef.name,
            subcategory: subcategory.name,
            confidence,
            allIssues: [...allDetectedIssues],
            matchedKeywords: matchedKeywords,
          };
        }

        // Once we find a subcategory match, don't check lower weight ones
        break;
      }
    }
  }

  // Remove duplicates from all issues
  bestMatch.allIssues = Array.from(new Set(bestMatch.allIssues));

  return bestMatch;
}

/**
 * Detect customer intent from transcript text
 */
export function detectCustomerIntent(transcriptText: string): string {
  const text = transcriptText.toLowerCase();

  // Extract customer statements (between "customer:" markers)
  const customerStatements: string[] = [];
  const parts = text.split('customer:');

  for (let i = 1; i < parts.length; i++) {
    const statement = parts[i].split('agent:')[0].trim();
    customerStatements.push(statement);
  }

  if (customerStatements.length === 0) {
    return 'other';
  }

  // Analyze first customer statement (primary intent)
  const firstStatement = customerStatements[0];

  // Intent patterns (ordered by specificity)
  if (/how do i pay|where do i send|make a payment|pay my bill/i.test(firstStatement)) {
    return 'make_payment';
  }
  if (/can't log in|forgot password|locked out|reset password/i.test(firstStatement)) {
    return 'access_account';
  }
  if (/need a payoff|closing soon|refinancing|payoff quote/i.test(firstStatement)) {
    return 'request_payoff';
  }
  if (/why did|what happened|explain|don't understand/i.test(firstStatement)) {
    return 'understand_issue';
  }
  if (/didn't receive|never got|missing|haven't received/i.test(firstStatement)) {
    return 'missing_information';
  }
  if (/need to speak|talk to supervisor|escalate|complaint/i.test(firstStatement)) {
    return 'escalate_issue';
  }
  if (/what is my balance|account balance|how much do i owe/i.test(firstStatement)) {
    return 'check_balance';
  }
  if (/when is payment due|payment date|due date/i.test(firstStatement)) {
    return 'check_due_date';
  }

  return 'other';
}

/**
 * Detect all issues mentioned in text (multi-issue tagging)
 */
export function detectAllIssues(text: string): string[] {
  const issues: string[] = [];
  const lowerText = text.toLowerCase();

  for (const categoryDef of CATEGORY_DEFINITIONS) {
    const hasMatch = categoryDef.keywords.some(keyword =>
      lowerText.includes(keyword.toLowerCase())
    );

    if (hasMatch) {
      issues.push(categoryDef.name);
    }
  }

  return issues.length > 0 ? issues : ['General Inquiry'];
}

/**
 * Get all available categories and subcategories
 */
export function getAllCategories(): { category: string; subcategories: string[] }[] {
  return CATEGORY_DEFINITIONS.map(cat => ({
    category: cat.name,
    subcategories: cat.subcategories.map(sub => sub.name),
  }));
}

/**
 * Validate if a category/subcategory combination is valid
 */
export function isValidCategorization(category: string, subcategory: string): boolean {
  const categoryDef = CATEGORY_DEFINITIONS.find(c => c.name === category);
  if (!categoryDef) return false;

  return categoryDef.subcategories.some(sub => sub.name === subcategory);
}

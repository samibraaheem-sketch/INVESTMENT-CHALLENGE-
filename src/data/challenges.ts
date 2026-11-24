// Content for all 5 challenges. Every scenario, term and category here is
// drawn directly from the "Certified Incubation Manager · Investment
// Module" source deck — stage names, lenses, the ten selection criteria,
// due-diligence checklist items and pitch-deck sections are quoted or
// closely paraphrased from it, not invented. The fictional startup
// vignettes (GreenCart, etc.) are illustrative wrappers written for the
// game; the judgments they test map onto the module's own categories.
//
// IMPORTANT: this file holds prompts and OPTIONS only. There is no correct
// answer here — grading happens on the server (see supabase/schema.sql),
// so this file is safe to ship to the browser.

export interface ChoiceOption {
  value: string
  label: string
}

export interface QuestionItem {
  id: string
  points: number
  prompt: string
  options: ChoiceOption[]
}

export interface ChallengeGroup {
  heading?: string
  scenario: string
  items: QuestionItem[]
}

export interface ChallengeDef {
  id: string
  index: number
  title: string
  tagline: string
  instructions: string
  totalPoints: number
  groups: ChallengeGroup[]
}

const STAGE_OPTIONS: ChoiceOption[] = [
  { value: 'pre_seed', label: 'Pre-seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series_a', label: 'Series A' },
  { value: 'series_b_plus', label: 'Series B+' },
]

const SOURCE_OPTIONS: ChoiceOption[] = [
  { value: 'bootstrapping', label: 'Bootstrapping (personal savings, friends and family)' },
  { value: 'angel', label: 'Angel investors' },
  { value: 'vc', label: 'Venture capital' },
  { value: 'pe', label: 'Private equity' },
  { value: 'family_office', label: 'Family offices' },
  { value: 'grants', label: 'Government grants' },
  { value: 'crowdfunding', label: 'Crowdfunding' },
  { value: 'bank_loan', label: 'Bank loans / debt' },
  { value: 'incubator', label: 'Incubators and accelerators' },
]

const LENS_OPTIONS: ChoiceOption[] = [
  { value: 'founding_team', label: 'Founding team' },
  { value: 'problem_solution_fit', label: 'Problem-solution fit' },
  { value: 'scalability', label: 'Scalability' },
  { value: 'business_model', label: 'Business and revenue model' },
  { value: 'traction', label: 'Traction' },
  { value: 'market_size', label: 'Market size' },
  { value: 'financial_health', label: 'Financial health and unit economics' },
  { value: 'competitive_advantage', label: 'Competitive advantage' },
  { value: 'exit_potential', label: 'Exit potential' },
]

const STRENGTH_WEAKNESS_OPTIONS: ChoiceOption[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'weakness', label: 'Weakness' },
]

const DECISION_OPTIONS: ChoiceOption[] = [
  { value: 'admit', label: 'Admit' },
  { value: 'admit_conditions', label: 'Admit with conditions' },
  { value: 'decline', label: 'Decline' },
]

// Trimmed to 3 questions per challenge (15 total, 100 pts per challenge, 500
// total). Each kept item's prompt, options, and underlying correct
// answer/explanation (server-side, see supabase/schema.sql) are unchanged
// from the original 37-item set — only which items are shown, their point
// values, and a few now-inaccurate head­ings/instruction counts were
// adjusted to match the smaller set.
export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'funding_match',
    index: 1,
    title: 'Funding Match',
    tagline: 'Match each startup to its funding stage and funding source',
    instructions:
      'Read each short startup snapshot, then answer what is asked about its funding stage (Pre-seed, Seed, Series A, or Series B+) or its funding source.',
    totalPoints: 100,
    groups: [
      {
        heading: 'Scenario 1 of 3',
        scenario:
          'Two friends have an idea for a delivery app that solves a problem they researched carefully, but they have no product yet. So far they have funded everything from their own savings and support from family.',
        items: [
          { id: 'fm1_stage', points: 34, prompt: 'Which funding stage is this startup at?', options: STAGE_OPTIONS },
        ],
      },
      {
        heading: 'Scenario 2 of 3',
        scenario:
          'A startup has built its MVP and signed its first 50 paying customers. It is now raising money to expand its team and scale the product, and a group of individual investors with sector experience is putting in capital and mentorship.',
        items: [
          { id: 'fm2_source', points: 33, prompt: 'Which funding source matches this round?', options: SOURCE_OPTIONS },
        ],
      },
      {
        heading: 'Scenario 3 of 3',
        scenario:
          'A startup has proven traction and strong growth. It is raising a larger round for product development, marketing and acquiring more customers, with a venture capital firm leading the round.',
        items: [
          { id: 'fm3_stage', points: 33, prompt: 'Which funding stage is this startup at?', options: STAGE_OPTIONS },
        ],
      },
    ],
  },
  {
    id: 'investor_detective',
    index: 2,
    title: 'Investor Detective',
    tagline: "Use the investor's nine lenses to spot strengths and weaknesses",
    instructions:
      "GreenCart is a grocery delivery startup applying for your next investor demo day. For each piece of evidence below, say which of the investor's nine lenses it falls under, and whether it is a strength or a weakness.",
    totalPoints: 100,
    groups: [
      {
        scenario: 'GreenCart has signed 200 paying customers, and 85% of them renew their subscription every month.',
        items: [
          { id: 'id1_lens', points: 34, prompt: 'Which lens does this evidence belong to?', options: LENS_OPTIONS },
          { id: 'id1_sw', points: 33, prompt: 'Is this a strength or a weakness?', options: STRENGTH_WEAKNESS_OPTIONS },
        ],
      },
      {
        scenario: "GreenCart's delivery cost per order is higher than the price it charges — it loses money on every single sale.",
        items: [
          { id: 'id3_lens', points: 33, prompt: 'Which lens does this evidence belong to?', options: LENS_OPTIONS },
        ],
      },
    ],
  },
  {
    id: 'startup_selection',
    index: 3,
    title: 'Startup Selection',
    tagline: 'Screen three applications against the ten criteria for an investable startup',
    instructions:
      'For each applicant, read the evidence against the ten criteria for an investable startup, then decide: Admit, Admit with conditions, or Decline.',
    totalPoints: 100,
    groups: [
      {
        heading: 'Applicant 1 of 3',
        scenario:
          'A solid idea tackling a real, well-researched problem. Both founders have quit their jobs to work on it full time, and together they cover technical, business and marketing skills. They have done basic customer interviews and are open to every piece of feedback from mentors. Their only soft spot: they have just a rough idea of how they will eventually charge for the product.',
        items: [
          { id: 'ss1_decision', points: 34, prompt: 'What should your incubator decide?', options: DECISION_OPTIONS },
        ],
      },
      {
        heading: 'Applicant 2 of 3',
        scenario:
          'A strong, already-profitable company scaling quickly on its own revenue and its own hires. It has no real need for your mentoring, facilities or network, and says so plainly in the interview.',
        items: [
          { id: 'ss3_decision', points: 33, prompt: 'What should your incubator decide?', options: DECISION_OPTIONS },
        ],
      },
      {
        heading: 'Applicant 3 of 3',
        scenario:
          'A promising idea from a solo founder with no co-founder and no complementary skills in business or marketing. The founder is coachable and eager to learn, but has not done any market research yet.',
        items: [
          { id: 'ss4_decision', points: 33, prompt: 'What should your incubator decide?', options: DECISION_OPTIONS },
        ],
      },
    ],
  },
  {
    id: 'due_diligence',
    index: 4,
    title: 'Due Diligence Hunt',
    tagline: 'Spot the missing documents and red flags before an investor does',
    instructions:
      "Before a startup goes into an investor's due diligence, the incubator should have already spotted the gaps. Find the missing document in the data room, then answer two quick numbers questions.",
    totalPoints: 100,
    groups: [
      {
        heading: 'Financials',
        scenario: 'The Financials folder contains: bank statements and reconciliations, and financial statements.',
        items: [
          {
            id: 'dd_fin',
            points: 34,
            prompt: 'Which required Financials document is missing from the data room?',
            options: [
              { value: 'audited_financials', label: 'Audited financials to date' },
              { value: 'cap_table', label: 'Current cap table' },
              { value: 'marketing_plans', label: 'Marketing and strategic plans' },
              { value: 'org_chart_salaries', label: 'Org chart and salaries' },
            ],
          },
        ],
      },
      {
        heading: 'Know your numbers',
        scenario: 'A startup reports $120,000 in assets and $45,000 in liabilities.',
        items: [
          {
            id: 'dd_balance',
            points: 33,
            prompt: "Using Assets = Liabilities + Shareholders' equity, what is its equity?",
            options: [
              { value: '75000', label: '$75,000' },
              { value: '165000', label: '$165,000' },
              { value: '45000', label: '$45,000' },
              { value: '120000', label: '$120,000' },
            ],
          },
        ],
      },
      {
        heading: 'Know your numbers',
        scenario:
          "A startup sold $50,000 of product on credit this quarter and its income statement shows a profit — but its bank account is nearly empty and it can't pay salaries.",
        items: [
          {
            id: 'dd_cashflow',
            points: 33,
            prompt: 'What explains this?',
            options: [
              { value: 'paper_profit_not_cash', label: 'Profit on paper is not cash in the bank — the credit sale has not been collected yet' },
              { value: 'income_statement_wrong', label: 'The income statement must be calculated incorrectly' },
              { value: 'raise_prices', label: 'The startup should simply raise its prices' },
              { value: 'normal_financing', label: 'This is a normal result of a financing activity' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'pitch_deck',
    index: 5,
    title: 'Pitch Deck Rescue',
    tagline: 'Fix a deck before it goes in front of an investor',
    instructions:
      "A pitch deck should cover all ten sections, and avoid the classic don'ts. Spot what's missing, and catch the mistakes below.",
    totalPoints: 100,
    groups: [
      {
        heading: 'Missing section',
        scenario:
          'This deck has: Introduction, Problem, Market, Solution, Traction, Competition, Team, and The Ask. It never explains how the product will actually generate revenue or what it will charge for.',
        items: [
          {
            id: 'pd_missing1',
            points: 34,
            prompt: 'Which of the ten pitch deck sections is missing?',
            options: [
              { value: 'business_model', label: 'Business model' },
              { value: 'financials', label: 'Financials' },
              { value: 'problem', label: 'Problem' },
              { value: 'team', label: 'Team' },
            ],
          },
        ],
      },
      {
        heading: "Spot the don't",
        scenario: 'A founder\'s slide reads: "Our startup is worth $50 million based on our vision, even though we have no revenue yet."',
        items: [
          {
            id: 'pd_dont1',
            points: 33,
            prompt: 'Which "don\'t" does this slide break?',
            options: [
              { value: 'overvalue', label: 'Overvalue your startup' },
              { value: 'ignore_due_diligence', label: 'Ignore due diligence' },
              { value: 'be_disorganized', label: 'Be disorganized' },
              { value: 'ignore_exit_strategy', label: 'Ignore the exit strategy' },
            ],
          },
        ],
      },
      {
        heading: "Spot the don't",
        scenario: 'In the Q&A, a founder says: "We don\'t have exact numbers yet, but trust us, the market loves this."',
        items: [
          {
            id: 'pd_dont2',
            points: 33,
            prompt: 'Which "don\'t" does this answer break?',
            options: [
              { value: 'claims_without_data', label: 'Make claims without data or evidence' },
              { value: 'take_rejection_personally', label: 'Take rejection personally' },
              { value: 'overvalue', label: 'Overvalue your startup' },
              { value: 'be_disorganized', label: 'Be disorganized' },
            ],
          },
        ],
      },
    ],
  },
]

export const TOTAL_QUESTIONS = CHALLENGES.reduce(
  (sum, c) => sum + c.groups.reduce((s, g) => s + g.items.length, 0),
  0
)

export const TOTAL_POINTS = CHALLENGES.reduce((sum, c) => sum + c.totalPoints, 0)

export interface FlatStep {
  globalIndex: number
  challengeIndex: number
  challenge: ChallengeDef
  group: ChallengeGroup
  item: QuestionItem
  isFirstInChallenge: boolean
}

export function flattenSteps(): FlatStep[] {
  const steps: FlatStep[] = []
  CHALLENGES.forEach((challenge, challengeIndex) => {
    let firstDone = false
    challenge.groups.forEach((group) => {
      group.items.forEach((item) => {
        steps.push({
          globalIndex: steps.length,
          challengeIndex,
          challenge,
          group,
          item,
          isFirstInChallenge: !firstDone,
        })
        firstDone = true
      })
    })
  })
  return steps
}

export const STEPS = flattenSteps()

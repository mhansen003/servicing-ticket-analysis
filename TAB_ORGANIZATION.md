# Tab Organization & Color Coding

## 🎨 Color-Coded Navigation System

The dashboard uses **color-coded tabs** to visually distinguish between two different data sources:

---

## 🟢 **GREEN TABS** - Ticket Data (23,167 Helpdesk Tickets)

**Data Source**: `processed-stats.json` (92 KB)
**Source File**: `data/tickets.csv` → Capacity Helpdesk tickets from Jira
**Data Coverage**: September 2025 - December 3, 2025 (3 months)

### Tabs:
1. **Categories** 🟢
   - **What it shows**: Category distribution and breakdown
   - **Visualizations**:
     - Category Heatmap (11 categories × 14 days)
     - Pie chart of category distribution
     - Top categories list with percentages
   - **Data Structure**: `categorizedAnalytics.categories[]`
   - **Key Metrics**:
     - Payment Issues: 18,616 tickets (80%)
     - Document Requests: 1,346 tickets (6%)
     - Loan Transfer: 1,076 tickets (5%)
     - 8 additional categories

2. **Trends** 🟢
   - **What it shows**: Ticket volume patterns over time
   - **Visualizations**:
     - Call Volume Heatmap (7 days × 24 hours = 168 cells)
     - Baseline vs Recent comparison charts
     - Increasing/Decreasing issues tracking
     - All trends table with % changes
   - **Data Structure**: `heatmaps.dayHour.data[]` + `baselineAnalytics[]`
   - **Time Windows**: 7, 14, 21, 30, 60, 90 days
   - **Insights**: Busiest day, peak hour, total calls

---

## 🟣 **PURPLE TABS** - Transcript Data (Call Recordings)

**Data Source**: Multiple transcript files + AI analysis
**Source Files**:
- `public/data/transcript-stats.json`
- `public/data/transcript-conversations-*.json`
- `public/data/agent-rankings.json`

### Tabs:
3. **Transcripts** 🟣
   - **What it shows**: Call transcript analysis
   - **Visualizations**:
     - Sentiment distribution (positive/negative/neutral)
     - Emotion breakdown
     - Topic analysis
     - Daily trends
     - Call duration stats
   - **Data Structure**: `transcript-stats.json`
   - **Status**: ⏳ Requires transcript data files

4. **Agents** 🟣
   - **What it shows**: Agent performance rankings and profiles
   - **Visualizations**:
     - Performance distribution (5 tiers)
     - Agent profile cards with metrics
     - Search and sort functionality
     - AI coaching insights (requires API key)
   - **Data Structure**: `agent-rankings.json`
   - **Ranking Criteria**: Agents with 20+ calls
   - **Performance Tiers**:
     - Top Performer (green)
     - Good (blue)
     - Average (gray)
     - Needs Improvement (amber)
     - Critical (red)

5. **Raw Data** 🟣
   - **What it shows**: Complete data grid of all records
   - **Visualizations**:
     - Sortable, filterable data grid
     - Pagination
     - Search functionality
     - Export capabilities
   - **Data Structure**: `all-tickets.json` (9.1 MB)
   - **Records**: 23,167 tickets with full details

6. **Ask AI** 🟣
   - **What it shows**: AI-powered insights and analysis
   - **Features**:
     - Natural language queries
     - Contextual responses
     - Data summaries
   - **Requirements**: OpenRouter API key
   - **API Endpoint**: `/api/analyze` (POST)

---

## 📊 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TICKET DATA (GREEN)                      │
│                                                             │
│  data/tickets.csv                                           │
│        ↓                                                    │
│  scripts/prebuild.js                                        │
│        ↓                                                    │
│  data/processed-stats.json (92 KB)                          │
│  public/data/processed-stats.json                           │
│        ↓                                                    │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │ Categories   │         │   Trends     │                 │
│  │   (Green)    │         │  (Green)     │                 │
│  └──────────────┘         └──────────────┘                 │
│                                                             │
│  Shows:                    Shows:                           │
│  • 11 categories          • Day×Hour heatmap (168 cells)   │
│  • Distribution %         • Baseline comparisons            │
│  • Category heatmap       • Increasing/decreasing trends   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 TRANSCRIPT DATA (PURPLE)                    │
│                                                             │
│  Call Recordings + AI Analysis                              │
│        ↓                                                    │
│  public/data/transcript-*.json                              │
│  public/data/agent-rankings.json                            │
│        ↓                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Transcripts│  │  Agents  │  │Raw Data  │  │ Ask AI   │   │
│  │ (Purple) │  │ (Purple) │  │ (Purple) │  │ (Purple) │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  Shows:         Shows:        Shows:        Shows:          │
│  • Sentiment   • Rankings     • Full grid  • AI insights   │
│  • Emotions    • Profiles     • 23K rows   • NL queries    │
│  • Topics      • Coaching     • Export     • Summaries     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Visual Indicators

### Desktop Navigation
- **Active Tab**: Colored background (green or purple)
- **Inactive Tab**: Gray text with colored hover effect
- **Group Separator**: Left border between data types
- **Tooltip**: Shows data source on hover

### Legend (Top Right)
```
● Green  = Tickets (23K)
● Purple = Transcripts
```

### Mobile Navigation
- Compact icons with labels
- Same color coding as desktop
- Legend below tab bar

---

## 📈 Data Statistics

### Ticket Data (Green Tabs)
- **Total Records**: 23,167 tickets
- **Date Range**: Sept 2025 - Dec 3, 2025
- **Categories**: 11 unique categories
- **Subcategories**: 11 subcategories
- **Projects**: 3 (Servicing Help, Servicing Escalations, ServApp Support)
- **Team Members**: 15 assignees
- **Statuses**: 9 different statuses
- **Priority Levels**: 3 (High, Medium, Low)

### Transcript Data (Purple Tabs)
- **Source**: Call recording transcripts
- **AI Analysis**: Sentiment, emotion, topics
- **Agent Metrics**: Performance scoring, coaching insights
- **Requirements**:
  - Transcript JSON files for Transcripts tab
  - OpenRouter API key for AI features

---

## 🔄 Data Updates

### Automatic Processing
The `prebuild` script runs before every deployment:
1. Reads `data/tickets.csv`
2. Processes and categorizes tickets
3. Generates heatmap data (168 cells)
4. Calculates baseline comparisons (6 time windows)
5. Writes to both `data/` and `public/data/` folders

### Refresh Strategy
- **Static Data**: Pre-processed during build
- **No Runtime Queries**: All data served as static JSON
- **Fast Loading**: 92 KB processed-stats.json loads <200ms
- **Lazy Loading**: 9.1 MB all-tickets.json loaded only when needed

---

## 🎨 Color Palette

```css
/* Green (Ticket Data) */
--green-active: #22c55e;      /* Active tab background */
--green-hover: #22c55e/10;    /* Hover background */
--green-border: #22c55e/50;   /* Group separator */
--green-text: #86efac;        /* Hover text */

/* Purple (Transcript Data) */
--purple-active: #a855f7;     /* Active tab background */
--purple-hover: #a855f7/10;   /* Hover background */
--purple-border: #a855f7/50;  /* Group separator */
--purple-text: #d8b4fe;       /* Hover text */
```

---

## ✅ Benefits of Color Coding

1. **Visual Clarity**: Users instantly know which data source they're viewing
2. **Mental Model**: Consistent color association helps with navigation
3. **Quick Scanning**: Easy to find ticket vs transcript data
4. **Professional UX**: Organized, intentional design
5. **Scalability**: Easy to add new tabs within existing groups

---

**Last Updated**: December 8, 2025
**Version**: Phase 5 Complete with Color-Coded Navigation

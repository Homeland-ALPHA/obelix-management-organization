export const NAV_LINKS = [
  { label: "Platform", to: "/platform" },
  { label: "Compliance", to: "/compliance" },
  { label: "Maintenance", to: "/maintenance" },
  { label: "Financials", to: "/financials" },
  { label: "Owners", to: "/owners" },
  { label: "Pricing", to: "/pricing" },
];

export const UNDERWRITING_URL = "https://theobelix.com";

export const MODULES = [
  {
    to: "/platform",
    label: "Platform",
    title: "Everything required to operate an NYC building",
    body: "Six connected modules sharing one record per building.",
    icon: "LayoutGrid",
  },
  {
    to: "/compliance",
    label: "Compliance",
    title: "Violations, filings and deadlines",
    body: "HPD and DOB workflows from issuance through certification.",
    icon: "ShieldCheck",
  },
  {
    to: "/maintenance",
    label: "Maintenance",
    title: "Assigned, trackable field work",
    body: "Tenant requests to verified completion, with photo proof.",
    icon: "Wrench",
  },
  {
    to: "/financials",
    label: "Financials",
    title: "Collections, arrears and NOI",
    body: "Building-level performance without a spreadsheet rebuild.",
    icon: "TrendingUp",
  },
  {
    to: "/owners",
    label: "Owners",
    title: "Reporting and approvals",
    body: "One monthly answer per building, plus decisions in queue.",
    icon: "Landmark",
  },
  {
    to: "/pricing",
    label: "Pricing",
    title: "Priced by portfolio, not per seat",
    body: "Unit-band pricing for mid-sized and institutional operators.",
    icon: "Receipt",
  },
];

export const PRICING_TIERS = [
  {
    name: "Operator",
    band: "Up to 250 units",
    summary: "For owner-operators and small management companies running a single borough portfolio.",
    features: [
      "Compliance center — HPD and DOB tracking",
      "Maintenance and work order operations",
      "Tenant, lease and renewal records",
      "Mobile inspections with photo capture",
      "Standard owner report pack",
      "Email support, next business day",
    ],
  },
  {
    name: "Portfolio",
    band: "250 – 1,500 units",
    featured: true,
    summary: "For established NYC management companies operating across multiple boroughs and entities.",
    features: [
      "Everything in Operator",
      "Rent regulation and subsidy tracking",
      "Vendor compliance — COI and license expiry",
      "Building-level NOI and budget vs. actual",
      "Owner portal with approval workflows",
      "Named implementation lead and onboarding",
    ],
  },
  {
    name: "Institutional",
    band: "1,500+ units",
    summary: "For asset managers and institutional owners with multi-entity reporting requirements.",
    features: [
      "Everything in Portfolio",
      "Entity and fund-level roll-up reporting",
      "Custom roles and building-level permissions",
      "Data export and warehouse delivery",
      "Quarterly portfolio compliance review",
      "Priority support with response commitments",
    ],
  },
];

export const HERO_STATS = [
  { label: "Buildings", value: "12" },
  { label: "Units", value: "192" },
  { label: "Rent Collected", value: "96.4%", tone: "ok" },
  { label: "Urgent Items", value: "7", tone: "alert" },
];

export const HERO_PRIORITIES = [
  { title: "Class C rat violation", property: "2116 Colonial Avenue", when: "Due today", status: "Urgent" },
  { title: "Section 8 inspection", property: "Unit 4B", when: "August 2", status: "Scheduled" },
  { title: "Lease renewal", property: "Unit 7A", when: "August 5", status: "Awaiting Approval" },
  { title: "Boiler inspection", property: "2169 Hone Avenue", when: "August 12", status: "Completed" },
];

export const FRAGMENTS = [
  "HPD and DOB",
  "Tenant requests",
  "Leases",
  "Contractors",
  "Inspections",
  "Rent and expenses",
  "Documents",
  "Owner approvals",
];

export const PRIORITY_ROWS = [
  {
    priority: "Class C pest violation",
    ref: "HPD #40291",
    property: "2116 Colonial Ave",
    unit: "Unit 3B",
    deadline: "Today",
    assignee: "HiLevel Pest Control",
    status: "Scheduled",
    kind: ["violations", "emergencies"],
  },
  {
    priority: "Section 8 inspection",
    ref: "NYCHA HQS",
    property: "1284 Grand Concourse",
    unit: "Unit 4B",
    deadline: "Aug. 2",
    assignee: "Building Superintendent",
    status: "In Progress",
    kind: ["inspections"],
  },
  {
    priority: "Lease renewal",
    ref: "RSA rider filed",
    property: "540 W 148th St",
    unit: "Unit 7A",
    deadline: "Aug. 5",
    assignee: "Property Manager",
    status: "Awaiting Review",
    kind: ["leases"],
  },
  {
    priority: "Boiler inspection",
    ref: "DOB BPP",
    property: "2169 Hone Ave",
    unit: "Boiler room",
    deadline: "Aug. 12",
    assignee: "Metro Boiler LLC",
    status: "Not Started",
    kind: ["inspections"],
  },
  {
    priority: "No heat / hot water — emergency",
    ref: "311 complaint",
    property: "2116 Colonial Ave",
    unit: "Line C",
    deadline: "Today",
    assignee: "Bronx Mechanical Corp.",
    status: "Urgent",
    kind: ["emergencies"],
  },
  {
    priority: "Class B window guard violation",
    ref: "HPD #40155",
    property: "1284 Grand Concourse",
    unit: "Unit 2D",
    deadline: "Aug. 9",
    assignee: "Superintendent — J. Ortiz",
    status: "In Progress",
    kind: ["violations"],
  },
  {
    priority: "Lease expiration — non-regulated",
    ref: "Market unit",
    property: "31-14 Ditmars Blvd",
    unit: "Unit 5F",
    deadline: "Aug. 22",
    assignee: "Leasing — A. Reyes",
    status: "Awaiting Approval",
    kind: ["leases"],
  },
  {
    priority: "DOB ECB violation — facade notice",
    ref: "ECB #35880194",
    property: "31-14 Ditmars Blvd",
    unit: "Front facade",
    deadline: "Aug. 18",
    assignee: "Skyline Restoration Ltd.",
    status: "Awaiting Review",
    kind: ["violations"],
  },
  {
    priority: "Elevator Category 1 inspection",
    ref: "DOB ELV3",
    property: "540 W 148th St",
    unit: "Elevator 1",
    deadline: "Aug. 28",
    assignee: "Vertex Elevator Inc.",
    status: "Scheduled",
    kind: ["inspections"],
  },
];

export const PRIORITY_FILTERS = [
  { id: "all", label: "All" },
  { id: "emergencies", label: "Emergencies" },
  { id: "violations", label: "Violations" },
  { id: "inspections", label: "Inspections" },
  { id: "leases", label: "Leases" },
];

export const FEATURES = [
  {
    icon: "ShieldCheck",
    title: "NYC Compliance Center",
    body: "Automatically track HPD violations, DOB activity, registration deadlines, required inspections, annual filings, and compliance documents.",
    detail: [
      "HPD violation classes A, B and C with correction and certification windows",
      "DOB permits, ECB hearings and open work orders per BIN",
      "Annual registration, bedbug and DHCR filing tracking",
    ],
  },
  {
    icon: "Wrench",
    title: "Maintenance Operations",
    body: "Receive tenant requests, assign work, schedule access, monitor contractors, upload proof, and verify completion.",
    detail: [
      "Intake from phone, text, email or tenant portal into one queue",
      "Access windows confirmed with the tenant before dispatch",
      "Before/after photo proof required to close a work order",
    ],
  },
  {
    icon: "FileSignature",
    title: "Tenant and Lease Management",
    body: "Manage tenant records, lease expirations, renewal workflows, rent-stabilized units, subsidy information, and communication history.",
    detail: [
      "Rent-stabilized, rent-controlled and market unit designations",
      "Renewal offer windows with RTP and rider tracking",
      "Section 8, CityFHEPS and HASA subsidy portions per unit",
    ],
  },
  {
    icon: "ClipboardCheck",
    title: "Inspections",
    body: "Complete mobile-friendly apartment, common-area, Section 8, move-in, move-out, lead, smoke-detector, and pest inspections.",
    detail: [
      "Configurable checklists with photo and signature capture",
      "Offline-tolerant capture for basements and stairwells",
      "Findings convert straight into assigned work orders",
    ],
  },
  {
    icon: "TrendingUp",
    title: "Financial Performance",
    body: "Monitor rent collection, arrears, vendor expenses, budgets, building-level profit and loss, cash flow, and NOI.",
    detail: [
      "Collections and arrears aging by building, line and unit",
      "Budget versus actual on operating expense categories",
      "Building-level NOI and cash flow roll-ups for the portfolio",
    ],
  },
  {
    icon: "Users",
    title: "Vendor Management",
    body: "Store insurance, W-9s, licenses, contracts, quotes, response times, invoices, and service history.",
    detail: [
      "COI and license expiration alerts before dispatch",
      "Response-time and first-visit-resolution scoring",
      "Quote comparison with full invoice and service history",
    ],
  },
];

export const WORKFLOW_STEPS = [
  { label: "Detected", note: "HPD issues violation" },
  { label: "Explained", note: "Plain-language summary" },
  { label: "Assigned", note: "Vendor + deadline" },
  { label: "Corrected", note: "Work performed" },
  { label: "Documented", note: "Photos + report" },
  { label: "Certified", note: "Filed with HPD" },
  { label: "Cleared", note: "Violation closed" },
];

export const VIOLATION_CHECKS = [
  { label: "Property", value: "2116 Colonial Avenue", done: true },
  { label: "Unit", value: "3B", done: true },
  { label: "Correction deadline", value: "Today", done: true, tone: "alert" },
  { label: "Assigned vendor", value: "HiLevel Pest Control", done: true },
  { label: "Access confirmed", value: "Yes", done: true },
  { label: "Before photos", value: "Uploaded", done: true },
  { label: "Treatment report", value: "Pending", done: false },
  { label: "Certification", value: "Not ready", done: false },
];

export const OWNER_KPIS = [
  { label: "Occupancy", value: "97.8%" },
  { label: "Collections", value: "$284,600" },
  { label: "Outstanding arrears", value: "$18,420", tone: "alert" },
  { label: "Monthly NOI", value: "$126,300" },
  { label: "Open emergencies", value: "2", tone: "alert" },
  { label: "Violations opened", value: "8" },
  { label: "Violations cleared", value: "14", tone: "ok" },
  { label: "Approvals waiting", value: "3" },
];

export const OWNER_CHART = [
  { month: "Feb", noi: 108, collections: 262 },
  { month: "Mar", noi: 112, collections: 268 },
  { month: "Apr", noi: 109, collections: 259 },
  { month: "May", noi: 118, collections: 274 },
  { month: "Jun", noi: 121, collections: 279 },
  { month: "Jul", noi: 126, collections: 284 },
];

export const APPROVALS = [
  {
    id: "apr-1",
    title: "Replace damaged lobby entrance door",
    amount: "$3,850",
    property: "2116 Colonial Avenue",
    vendor: "Bronx Glass & Door Co.",
  },
  {
    id: "apr-2",
    title: "Roof drain and parapet repointing",
    amount: "$12,400",
    property: "1284 Grand Concourse",
    vendor: "Skyline Restoration Ltd.",
  },
  {
    id: "apr-3",
    title: "Basement pest remediation — full line",
    amount: "$2,180",
    property: "540 W 148th Street",
    vendor: "HiLevel Pest Control",
  },
];

export const DEADLINES = [
  { day: 2, title: "Section 8 inspection", detail: "1284 Grand Concourse · Unit 4B", tone: "gold" },
  { day: 5, title: "Lease renewals", detail: "540 W 148th St · Unit 7A", tone: "neutral" },
  { day: 12, title: "Boiler inspection", detail: "2169 Hone Ave · DOB BPP", tone: "gold" },
  { day: 15, title: "Annual bedbug filing", detail: "All 12 buildings · HPD", tone: "alert" },
  { day: 19, title: "Elevator inspection", detail: "540 W 148th St · Category 1", tone: "neutral" },
  { day: 23, title: "Insurance expiration", detail: "Portfolio GL policy renewal", tone: "alert" },
  { day: 26, title: "Vendor-license expiration", detail: "Metro Boiler LLC · master plumber", tone: "neutral" },
  { day: 29, title: "HPD property registration", detail: "2116 Colonial Ave · annual", tone: "gold" },
  { day: 31, title: "DHCR annual rent registration", detail: "84 rent-stabilized units", tone: "alert" },
];

export const COMPARISON = [
  ["General maintenance tracking", "NYC violation workflows"],
  ["Basic tenant profiles", "Rent-regulation and subsidy tracking"],
  ["Manual deadline entry", "NYC compliance calendar"],
  ["Simple vendor list", "Insurance, licensing and document expiration"],
  ["Generic reporting", "Building-level NOI and owner reporting"],
  ["Displays open issues", "Assigns the next required action"],
];

export const SECURITY_ITEMS = [
  { icon: "KeyRound", title: "Role-based access", body: "Permissions follow the role, not the person. Access changes the moment a role does." },
  { icon: "FolderLock", title: "Secure document storage", body: "Leases, COIs, filings and inspection evidence stored per building with controlled sharing." },
  { icon: "History", title: "Complete activity history", body: "Every assignment, status change, upload and approval is attributed and time-stamped." },
  { icon: "Building2", title: "Building-level permissions", body: "Scope a superintendent to one address and an asset manager to a whole portfolio." },
  { icon: "UsersRound", title: "Five distinct roles", body: "Owner, manager, staff, vendor and tenant each see only what their work requires." },
  { icon: "Download", title: "Exportable records", body: "Export violation, financial and inspection history as CSV or PDF whenever you need it." },
];

export const FOOTER_LINKS = [
  {
    heading: "Product",
    items: [
      { label: "Platform", to: "/platform" },
      { label: "NYC Compliance", to: "/compliance" },
      { label: "Maintenance", to: "/maintenance" },
      { label: "Financials", to: "/financials" },
    ],
  },
  {
    heading: "Company",
    items: [
      { label: "Owner Reporting", to: "/owners" },
      { label: "Security", to: "/security" },
      { label: "Pricing", to: "/pricing" },
      { label: "Contact", to: "/pricing#cta" },
    ],
  },
  {
    heading: "Legal",
    items: [
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
      { label: "Obelix Underwriting", external: UNDERWRITING_URL },
    ],
  },
];

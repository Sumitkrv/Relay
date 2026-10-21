export const INDUSTRIES = [
  {
    slug: 'real-estate',
    name: 'Real Estate',
    shortName: 'Real Estate',
    headline: 'Real Estate WhatsApp Automation',
    tagline: 'Automate luxury property enquiries, brochure delivery, and site-visit scheduling.',
    description: 'Designed specifically for real estate developers, brokers, and agencies. Relay helps you qualify property seekers, share brochure PDFs instantly, segment leads by location and budget, and follow up without manual chaos.',
    badge: 'Flagship Industry',
    heroStats: [
      { label: 'Enquiry Response Time', value: '< 2 sec' },
      { label: 'Brochure Open Rate', value: '88%' },
      { label: 'Site Visit Conversions', value: '+34%' },
    ],
    features: [
      {
        title: 'Instant Property Brochure Sharing',
        description: 'Deliver rich PDF property brochures, floor plans, and pricing sheets automatically when prospective buyers enquire about a project.',
      },
      {
        title: 'Location & Budget Segmentation',
        description: 'Tag and segment leads by preferred micro-markets (e.g., Golf Course Road, Whitefield) and budget ranges (e.g., 2 Cr - 5 Cr).',
      },
      {
        title: 'Site Visit Follow-up Automation',
        description: 'Send automated site visit confirmations, location Google Map pins, and agent contact cards with zero manual typing.',
      },
      {
        title: 'NRI & Investor VIP Campaigns',
        description: 'Launch personalized high-intent campaigns tailored to overseas investors with customized currency and project ROI highlights.',
      },
    ],
    useCases: [
      'New Project Launch Announcements',
      'VIP Buyer Preview Invitations',
      'Brochure & Floor Plan Requests',
      'Site Visit Booking & Confirmations',
      'Resale & Rental Deal Broadcasts',
    ],
    keywords: [
      { trigger: 'BROCHURE', response: 'Here is the comprehensive PDF brochure and floor plan for the property.' },
      { trigger: 'PRICE', response: 'Pricing starts at ₹2.4 Cr for 3BHK luxury apartments. Would you like a payment schedule?' },
      { trigger: 'VISIT', response: 'Our site office is open 10 AM to 7 PM. What date suits you for a guided tour?' },
      { trigger: 'STOP', response: 'You have been opted out of marketing updates. Reply START anytime to re-enable.' },
    ],
    sampleTemplate: {
      header: 'EMERALD BAY RESIDENCES',
      body: 'Hi {{clientName}}, thank you for enquiring about Emerald Bay Residences on Golf Course Ext. Road. We have attached the master plan and pricing sheet for your review.',
      buttons: ['Download Brochure', 'Book Site Visit', 'Speak to Advisor'],
    },
  },
  {
    slug: 'gym',
    name: 'Gym & Fitness',
    shortName: 'Fitness',
    headline: 'Gym & Fitness Studio WhatsApp Automation',
    tagline: 'Streamline membership enquiries, free trial bookings, and class schedules.',
    description: 'Transform prospect enquiries into active gym members. Automate trial pass deliveries, share weekly class timetables, and handle membership fee FAQs directly on WhatsApp.',
    badge: 'Popular for Studios',
    heroStats: [
      { label: 'Trial Booking Rate', value: '42%' },
      { label: 'Enquiry to Walk-in', value: '3.1x' },
      { label: 'Renewal Reminders', value: '94% Read' },
    ],
    features: [
      {
        title: '1-Click Free Trial Pass Delivery',
        description: 'Send digital trial passes with QR codes or redemption instructions automatically when prospects ask for a trial.',
      },
      {
        title: 'Weekly Class Timetable Auto-Reply',
        description: 'Provide instant updates on Zumba, Yoga, CrossFit, and HIIT batch timings whenever members message.',
      },
      {
        title: 'Membership Tier Breakdown',
        description: 'Share transparent monthly, quarterly, and annual membership packages with personalized perks and trainer options.',
      },
      {
        title: 'Membership Renewal Broadcasts',
        description: 'Run targeted reminder campaigns to members whose plans expire in the next 7 days, boosting retention.',
      },
    ],
    useCases: [
      'Free 1-Day Trial Passes',
      'Monthly / Annual Plan Explanations',
      'Daily & Weekly Class Schedules',
      'Personal Training Introductions',
      'Gym Facility Photos & Virtual Tour',
    ],
    keywords: [
      { trigger: 'TRIAL', response: 'Your complimentary 1-day pass is ready! Valid at our downtown branch this week.' },
      { trigger: 'PLANS', response: 'Our plans: Monthly (₹2,499), 6 Months (₹11,999), Annual (₹19,999). Which suits you?' },
      { trigger: 'TIMINGS', response: 'Gym floor: 6:00 AM - 10:30 PM. Group classes: 7:00 AM, 5:30 PM, 7:00 PM.' },
      { trigger: 'STOP', response: 'You have been unsubscribed from promotional messages.' },
    ],
    sampleTemplate: {
      header: 'IRON FITNESS CLUB',
      body: 'Hey {{memberName}}, ready to crush your fitness goals? Your complimentary 1-day pass for our Premium Strength Floor is confirmed. Show this message at the front desk.',
      buttons: ['View Class Timetable', 'Directions on Maps', 'Chat with Trainer'],
    },
  },
  {
    slug: 'clinic',
    name: 'Clinic & Healthcare Services',
    shortName: 'Healthcare',
    headline: 'Healthcare & Clinic WhatsApp Automation',
    tagline: 'Manage doctor availability enquiries, clinic hours, and location guidance.',
    description: 'Designed for dental clinics, wellness centers, diagnostic labs, and outpatient practices. Provide instant answers for consultation hours, clinic directions, and service details while preserving patient privacy.',
    badge: 'High Trust',
    heroStats: [
      { label: 'Consultation Enquiries', value: '2.4x' },
      { label: 'No-Show Reduction', value: '-45%' },
      { label: 'Location Sharing', value: 'Instant' },
    ],
    features: [
      {
        title: 'Clinic Timings & Doctor Availability',
        description: 'Give patients immediate answers regarding doctor consultation hours and OPD days without tying up reception staff.',
      },
      {
        title: 'Directions & Parking Guidance',
        description: 'Instantly send exact clinic address, Google Maps link, and parking instructions to first-time visitors.',
      },
      {
        title: 'Service & Treatment Overview',
        description: 'Share structured summaries of dental treatments, skin therapy packages, or diagnostic test packages.',
      },
      {
        title: 'Strict Patient Privacy Guard',
        description: 'Relay is strictly designed for administrative and scheduling communications, safeguarding sensitive health data.',
      },
    ],
    useCases: [
      'Doctor Consultation Hours Enquiries',
      'Clinic Directions & Landmark Sharing',
      'Diagnostic Test Preparation Instructions',
      'General Healthcare Service Details',
      'Holiday & Closure Alerts',
    ],
    keywords: [
      { trigger: 'HOURS', response: 'Dr. Sharma is available Mon-Sat, 10:00 AM to 1:00 PM and 5:00 PM to 8:30 PM.' },
      { trigger: 'LOCATION', response: 'We are located at Suite 304, Metro Plaza, Sector 14. Google Maps: https://maps.example/clinic' },
      { trigger: 'SERVICES', response: 'We offer Dental Implants, Orthodontics, Teeth Whitening, and Root Canal Treatments.' },
      { trigger: 'STOP', response: 'You have unsubscribed from clinic announcement updates.' },
    ],
    sampleTemplate: {
      header: 'APEX DENTAL & WELLNESS',
      body: 'Hello {{patientName}}, thank you for contacting Apex Dental. Our clinic is open today from 10:00 AM to 8:00 PM. Would you like to check doctor availability or view our services?',
      buttons: ['Doctor Timings', 'Get Directions', 'Call Clinic Desk'],
    },
  },
  {
    slug: 'education',
    name: 'Education & Coaching',
    shortName: 'Education',
    headline: 'Education & Coaching Institute Automation',
    tagline: 'Automate admissions enquiries, syllabus sharing, and batch timetable alerts.',
    description: 'For coaching institutes, tutoring centers, vocational academies, and test-prep centers. Answer course fee questions, distribute prospectus PDFs, and announce new batch dates effortlessly.',
    badge: 'High Volume',
    heroStats: [
      { label: 'Prospectus Download', value: '78%' },
      { label: 'Batch Enquiry Turnaround', value: '< 1 min' },
      { label: 'Student Walk-ins', value: '+55%' },
    ],
    features: [
      {
        title: 'Prospectus & Curriculum Distribution',
        description: 'Send course brochures, exam patterns, and faculty credentials via PDF immediately upon student enquiry.',
      },
      {
        title: 'Upcoming Batch Dates & Timings',
        description: 'Keep aspiring students informed about upcoming weekend, morning, and evening batch commencement dates.',
      },
      {
        title: 'Free Demo Class Registrations',
        description: 'Capture student interest for free demonstration lectures and send automatic Zoom links or classroom directions.',
      },
      {
        title: 'Fee Structure Transparency',
        description: 'Provide clear payment milestones and early-bird scholarship eligibility criteria automatically.',
      },
    ],
    useCases: [
      'New Batch Commencement Announcements',
      'Curriculum & Syllabus PDF Sharing',
      'Free Demo Class Confirmation',
      'Scholarship & Early Bird Discounts',
      'Parent Enquiry Follow-ups',
    ],
    keywords: [
      { trigger: 'BATCH', response: 'Next batch starts this Monday, Oct 27. Timings: 4:30 PM - 6:30 PM (Mon to Fri).' },
      { trigger: 'FEES', response: 'Course fee: ₹18,500 including study material and mock tests. Early-bird discount: 10%.' },
      { trigger: 'SYLLABUS', response: 'Here is the detailed 12-week curriculum PDF for the IIT-JEE Foundation program.' },
      { trigger: 'STOP', response: 'You have been opted out of coaching institute announcements.' },
    ],
    sampleTemplate: {
      header: 'HORIZON ACADEMY',
      body: 'Dear {{studentName}}, our next weekend batch for Data Science & AI Certification commences on Saturday. We have reserved your seat for the free orientation webinar.',
      buttons: ['View Curriculum PDF', 'Webinar Link', 'Speak to Counselor'],
    },
  },
  {
    slug: 'salon',
    name: 'Salon & Beauty',
    shortName: 'Salon',
    headline: 'Salon & Beauty Studio WhatsApp Automation',
    tagline: 'Showcase hair & skincare packages, service menus, and seasonal offers.',
    description: 'Help salons, spas, and makeup studios engage clients on their favorite channel. Share service rate cards, announce festival bridal packages, and answer appointment questions quickly.',
    badge: 'High Engagement',
    heroStats: [
      { label: 'Service Menu Views', value: '91%' },
      { label: 'Weekend Bookings', value: '+40%' },
      { label: 'Offer Redemption', value: '28%' },
    ],
    features: [
      {
        title: 'Digital Rate Card & Service Menu',
        description: 'Share full price lists for hair styling, skincare treatments, bridal packages, and nail art in one clean tap.',
      },
      {
        title: 'Festival & Seasonal Offer Broadcasts',
        description: 'Run targeted festive promotions (Diwali, New Year, Wedding Season) to past clients with zero spam risk.',
      },
      {
        title: 'Location & Working Hours',
        description: 'Provide salon floor timings, landmark directions, and valet parking information immediately.',
      },
      {
        title: 'Specialist Stylist Portfolios',
        description: 'Share lookbooks and Instagram portfolio links directly within WhatsApp conversation threads.',
      },
    ],
    useCases: [
      'Service Price List Distribution',
      'Bridal & Groom Package Consultations',
      'Festive Discount Broadcasts',
      'Opening Hours & Booking Assistance',
      'Stylist Portfolio Demonstrations',
    ],
    keywords: [
      { trigger: 'PRICE', response: 'Haircut & Styling: ₹800. Global Color: ₹3,500. Keratin: ₹5,000. Full menu: https://example.com/menu' },
      { trigger: 'BRIDAL', response: 'Our bridal packages include makeup, hair, drape & trial. Starts at ₹18,000. Book a consultation!' },
      { trigger: 'TIMINGS', response: 'We are open Tuesday to Sunday from 10:00 AM to 8:30 PM (Closed on Mondays).' },
      { trigger: 'STOP', response: 'You have unsubscribed from salon promotional updates.' },
    ],
    sampleTemplate: {
      header: 'GLOW & GRACE SALON',
      body: 'Hi {{clientName}}, refresh your style this weekend! Enjoy 20% off all Hair Spa & Keratin treatments from Friday to Sunday. Would you like to view our full service menu?',
      buttons: ['View Rate Card', 'Get Directions', 'Call for Booking'],
    },
  },
  {
    slug: 'automobile',
    name: 'Automobile',
    shortName: 'Automobile',
    headline: 'Automotive Dealership & Service WhatsApp CRM',
    tagline: 'Manage vehicle enquiries, digital brochures, and test-drive requests.',
    description: 'Built for car dealerships, two-wheeler showrooms, and multi-brand service centers. Instantly share car spec sheets, arrange test-drive appointments, and send service status updates.',
    badge: 'High Value Deals',
    heroStats: [
      { label: 'Test Drive Requests', value: '+48%' },
      { label: 'Brochure Delivery', value: 'Instant' },
      { label: 'Sales Follow-up Rate', value: '96%' },
    ],
    features: [
      {
        title: 'Instant Vehicle Spec Sheets & Brochures',
        description: 'Send high-resolution model brochures, feature comparisons, and fuel efficiency sheets as soon as a customer enquiries.',
      },
      {
        title: 'Test Drive Scheduling Coordination',
        description: 'Collect model preference, preferred dealership branch, and time slot directly on WhatsApp for executive follow-up.',
      },
      {
        title: 'Exchange & Trade-In Evaluations',
        description: 'Gather current car model, year, and mileage details to prepare preliminary valuation estimates.',
      },
      {
        title: 'Service Maintenance Reminders',
        description: 'Broadcast scheduled periodic service reminders and monsoon health check-up camp alerts to car owners.',
      },
    ],
    useCases: [
      'New Car Model Feature Brochures',
      'Test Drive Registration & Slot Selection',
      'On-Road Price Breakdowns',
      'Vehicle Exchange & Valuation Enquiries',
      'Service Booking & Location Guidance',
    ],
    keywords: [
      { trigger: 'BROCHURE', response: 'Attached is the official PDF brochure and variant spec sheet for the 2026 SUV model.' },
      { trigger: 'TESTDRIVE', response: 'Our executive can bring the vehicle to your home or office. What city and time suit you?' },
      { trigger: 'PRICE', response: 'Ex-showroom starts at ₹11.49 Lakh. On-road pricing varies by state. Reply with your city for details.' },
      { trigger: 'STOP', response: 'You have been unsubscribed from vehicle promotional messages.' },
    ],
    sampleTemplate: {
      header: 'ROYAL MOTORS AUTOMOTIVE',
      body: 'Hello {{customerName}}, thank you for your interest in the all-new Urban SUV. We have attached the full spec sheet and on-road pricing guide for your city.',
      buttons: ['Download Spec Sheet', 'Book Home Test Drive', 'Talk to Sales Exec'],
    },
  },
  {
    slug: 'other',
    name: 'Other Businesses',
    shortName: 'Other',
    headline: 'Universal WhatsApp Automation for Growing Businesses',
    tagline: 'Flexible WhatsApp campaigns, segmented contacts, and unified inbox for any industry.',
    description: 'Whether you run an interior design studio, accounting consultancy, catering firm, or boutique retail store, Relay provides the core building blocks you need to automate conversations effortlessly.',
    badge: 'Universal Adaptability',
    heroStats: [
      { label: 'Setup Time', value: '< 5 min' },
      { label: 'Unified Inbox', value: 'All-in-One' },
      { label: 'Excel Import', value: '10,000 Rows' },
    ],
    features: [
      {
        title: 'Customizable Contact Fields',
        description: 'Store custom business tags, notes, and categorization fields suited to your unique customer journey.',
      },
      {
        title: 'Dynamic Template Studio',
        description: 'Create approved marketing templates with rich media headers, custom text tokens, and interactive quick-reply buttons.',
      },
      {
        title: 'Targeted Campaign Broadcasts',
        description: 'Send personalized WhatsApp updates to imported contact groups or dynamically filtered customer segments.',
      },
      {
        title: 'Keyword Auto-Replies & Takeover',
        description: 'Configure automated instant responses for recurring FAQs while allowing human operators to take over anytime.',
      },
    ],
    useCases: [
      'Customer Support & FAQ Answering',
      'Product Catalog & Price List Sharing',
      'Seasonal Promotion Broadcasts',
      'Event & RSVP Reminders',
      'Post-Sale Service Follow-ups',
    ],
    keywords: [
      { trigger: 'INFO', response: 'Thank you for reaching out to us! How can we assist you with our services today?' },
      { trigger: 'CATALOG', response: 'You can explore our full product catalog and current price list here: https://example.com/catalog' },
      { trigger: 'HOURS', response: 'Our operating hours are Monday to Saturday, 9:30 AM to 6:30 PM.' },
      { trigger: 'STOP', response: 'You have been successfully unsubscribed from marketing broadcasts.' },
    ],
    sampleTemplate: {
      header: 'CUSTOMER UPDATE',
      body: 'Hello {{customerName}}, thank you for being a valued client. We have updated our seasonal catalog with fresh arrivals and exclusive member discounts.',
      buttons: ['View Catalog', 'Contact Team', 'Website'],
    },
  },
];

export function getIndustryBySlug(slug) {
  return INDUSTRIES.find((i) => i.slug === slug) || null;
}

export function getAllIndustries() {
  return INDUSTRIES;
}


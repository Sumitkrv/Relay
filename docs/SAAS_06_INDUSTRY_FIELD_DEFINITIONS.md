# RELAY SAAS — SAAS 06: INDUSTRY FIELD DEFINITIONS

## 1. Schema Definition & Supported Types

Every industry definition declares custom contact fields via a structured schema:

```javascript
{
  key: string,                 // Stable alphanumeric key (e.g., 'membershipType')
  label: string,               // Human-readable label (e.g., 'Membership Type')
  type: string,                // 'text' | 'number' | 'select' | 'multiselect' | 'date' | 'boolean' | 'phone' | 'url'
  required: boolean,           // Required flag (defaults to false)
  searchable: boolean,         // Whether indexed for client search
  filterable: boolean,         // Whether available in filter toolbar
  showInTable: boolean,        // Default column visibility in contacts table
  showInForm: boolean,         // Visibility in Add/Edit Contact form
  options: Array<{ value, label }>, // Required for select/multiselect
  defaultValue: any,           // Type-appropriate default or null
  placeholder: string,         // Input placeholder text
  helpText: string,            // Helper description beneath the control
  validation: {                // Server & client validation bounds
    minLength?: number,
    maxLength?: number,
    min?: number,
    max?: number,
    pattern?: string,
  },
  group: 'businessInterest' | 'qualification' | 'preferences',
  order: number                // Form display sort order
}
```

---

## 2. Complete Field Inventory Across All 7 Verticals

### 1. Real Estate (`real_estate`)
- **`interestedPropertyType`** (select): Apartment, Villa, Residential Plot, Commercial, Penthouse, Studio.
- **`interestedProject`** (text): Target development (e.g., DLF Cybercity, Sobha City).
- **`budgetRange`** (select): Under ₹50L, ₹50L - ₹1Cr, ₹1Cr - ₹2.5Cr, ₹2.5Cr - ₹5Cr, Above ₹5Cr.
- **`preferredLocation`** (text): Micro-market or city locality.
- **`siteVisitInterest`** (boolean): Whether client opted into a site visit.
- **`preferredVisitDate`** (date): Desired site visit schedule.
- **`leadSource`** (select): Website, Referral, Walk-in, Social Media, WhatsApp Inbound, Broker Network.

### 2. Gym & Fitness (`gym`)
- **`membershipInterest`** (select): Monthly, Quarterly, Half-Yearly, Annual, Day Pass.
- **`fitnessProgram`** (select): Strength Training, Cardio & HIIT, Yoga, CrossFit, Personal Training, Zumba.
- **`branch`** (text): Center location or branch name.
- **`trialSessionInterest`** (boolean): Interest in taking a complimentary workout trial.
- **`preferredTiming`** (select): Early Morning (6 AM - 9 AM), Morning (9 AM - 12 PM), Afternoon (12 PM - 4 PM), Evening (4 PM - 7 PM), Night (7 PM - 10 PM).
- **`targetGoal`** (select): Weight Loss, Muscle Gain, Endurance, General Fitness, Rehabilitation.

### 3. Clinic & Healthcare (`clinic`)
*Privacy note: Strictly administrative CRM fields. Zero medical history, diagnoses, symptoms, or prescription records.*
- **`serviceInterest`** (select): General Consultation, Dental Checkup, Dermatology & Skin, Physiotherapy, Ophthalmology, Health Screening, Pediatrics.
- **`branchLocation`** (text): Clinic facility or outpatient branch.
- **`preferredEnquiryTime`** (select): Morning, Afternoon, Evening.
- **`serviceCategory`** (select): In-Person Clinic Visit, Teleconsultation, Home Sample Collection.
- **`followUpPreference`** (select): WhatsApp Message, Phone Call, Email.

### 4. Education & Coaching (`education`)
*Privacy note: No minor identification or sensitive personal records collected.*
- **`courseInterest`** (select): IIT-JEE Preparation, NEET Medical, Foundation (Class 9-10), Commerce & CA Foundation, Coding & Computer Science, English Fluency.
- **`batchPreference`** (select): Weekday Morning, Weekday Evening, Weekend Batch, Flexible Schedule.
- **`learningMode`** (select): Classroom Offline, Live Online, Hybrid.
- **`campus`** (text): Campus or center location.
- **`admissionEnquiryStatus`** (select): Information Gathering, Attended Demo Class, Entrance Test Pending, Registration In Progress.
- **`preferredContactTime`** (select): Morning, Afternoon, Evening, Weekends Only.

### 5. Salon & Beauty (`salon`)
- **`serviceInterest`** (select): Haircut & Styling, Hair Coloring, Facials & Skincare, Bridal & Occasion Makeup, Spa & Massage, Manicure & Pedicure.
- **`preferredBranch`** (text): Salon branch or outlet.
- **`preferredAppointmentTime`** (select): Morning (10 AM - 1 PM), Afternoon (1 PM - 4 PM), Evening (4 PM - 7 PM), Late Evening (7 PM - 9 PM).
- **`packageInterest`** (select): Single Service, Monthly Grooming, Bridal Package, Annual Membership.
- **`enquiryStatus`** (select): General Price Enquiry, Appointment Request, Special Occasion Booking.

### 6. Automobile Dealerships (`automobile`)
- **`vehicleModelInterest`** (text): Model or trim interest (e.g., SUV Prime, Sedan EV).
- **`vehicleCategory`** (select): Hatchback, Sedan, Compact SUV, Full-Size SUV, Electric Vehicle, Commercial Vehicle.
- **`preferredDealership`** (text): Showroom branch or regional outlet.
- **`testDriveInterest`** (boolean): Whether test drive is requested.
- **`purchaseTimeframe`** (select): Immediate (Within 1 week), Within 1 Month, 1 to 3 Months, Exploring / Future.
- **`budgetRange`** (select): Under ₹10 Lakh, ₹10L - ₹20 Lakh, ₹20L - ₹40 Lakh, Above ₹40 Lakh.

### 7. Other Businesses (`other`)
- **`serviceInterest`** (text): Primary service or offering of interest.
- **`enquiryType`** (select): General Information, Price Quote / Estimate, Service Appointment, Partnership / Vendor, Customer Support.
- **`preferredLocation`** (text): Locality or regional preference.
- **`preferredContactTime`** (select): Morning, Afternoon, Evening, Anytime.
- **`businessCategory`** (text): Descriptive classification of business.

---

## 3. Server-Side Validation Rules

All dynamic fields submitted to `/workspaces/current/validate-contact-fields` or during contact creation/updating are validated by `industryValidationService.js`:
1. **Enum Enforcement**: Select and multiselect values must belong to registered `options`.
2. **String Bounds**: Text fields are bounded by `maxLength` (default 500 characters).
3. **Numeric Bounds**: Validated against `min` and `max` constraints; `NaN` is strictly rejected.
4. **Date Format**: Validated as parseable ISO dates; malformed dates rejected.
5. **NoSQL Injection Defense**: Dynamic field keys cannot start with `$` or contain dots (`.`).
6. **Prototype Pollution Protection**: `__proto__`, `constructor`, and `prototype` are stripped and rejected.
7. **Strict Field Registry**: Unrecognized keys for the active vertical are rejected with descriptive developer feedback.

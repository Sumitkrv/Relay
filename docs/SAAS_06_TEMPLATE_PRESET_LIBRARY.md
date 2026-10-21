# RELAY SAAS — SAAS 06: TEMPLATE PRESET LIBRARY

## 1. Design & Safety Contracts

The Relay Template Preset Engine provides curated, professionally drafted WhatsApp message templates tailored to each of the 7 supported industries.

### Safety Invariants
1. **Never Automatically Approved by Meta**: Presets are software drafting aids. They are NOT automatically submitted to Meta.
2. **Never Trigger Spontaneous Sends**: Saving a template preset creates an editable `DRAFT` in the active workspace. No messages are sent.
3. **Strict Variable Validation**: Preset variables must exist in the vertical allowlist.
4. **Tenant Scoping**: Draft templates are saved with `workspaceId: workspace._id`. A gym tenant cannot view or modify a salon tenant's drafts.

---

## 2. Complete Template Preset Catalog

### 1. Real Estate (`real_estate`)
- **`re_property_enquiry`** — Property Enquiry Follow-up:
  `Hi {{customer_name}}, thank you for your interest in {{project_name}} with {{business_name}}. We'd be delighted to share unit plans, brochure details, and current availability.`
- **`re_site_visit_invite`** — Site Visit Invitation:
  `Hello {{customer_name}}, we'd love to host you for a private site tour of {{project_name}}. Let us know a convenient time this week.`
- **`re_brochure_delivery`** — Project Brochure Request:
  `Hi {{customer_name}}, here are the details and master layout for {{project_name}}. Please reach out if you have any questions.`
- **`re_price_sheet_followup`** — Pricing & Payment Plan:
  `Hello {{customer_name}}, following up regarding the pricing options for {{project_name}}. We offer flexible construction-linked payment plans.`

### 2. Gym & Fitness (`gym`)
- **`gym_membership_enquiry`** — Membership Enquiry Welcome:
  `Hi {{customer_name}}, thank you for reaching out to {{business_name}}! We offer flexible plans including our popular {{membership_type}} option.`
- **`gym_free_trial_invite`** — Complimentary Trial Session:
  `Hello {{customer_name}}, experience a workout at {{business_name}}! Your complimentary trial session for {{program_name}} is ready to schedule.`
- **`gym_program_details`** — Fitness Program Information:
  `Hi {{customer_name}}, here is what's included in our {{program_name}} program at {{business_name}}. Sessions run across multiple daily slots.`
- **`gym_timings_info`** — Facility Timings & Schedule:
  `Hello {{customer_name}}, {{business_name}} is open Monday to Saturday from 6:00 AM to 10:00 PM.`

### 3. Clinic & Healthcare (`clinic`)
- **`clinic_enquiry_ack`** — Service Enquiry Acknowledgment:
  `Hello {{customer_name}}, thank you for contacting {{business_name}}. We have received your enquiry regarding {{service_name}}. Our team will follow up promptly.`
- **`clinic_hours_location`** — Clinic Hours & Facility Location:
  `Hi {{customer_name}}, {{business_name}} is located at our {{branch_name}} center. Consultation hours are Monday through Saturday, 9:00 AM to 7:00 PM.`
- **`clinic_general_followup`** — General Consultation Follow-up:
  `Hello {{customer_name}}, this is {{business_name}} following up on your consultation enquiry for {{service_name}}. How can we assist you today?`

### 4. Education & Coaching (`education`)
- **`edu_course_enquiry`** — Course Enquiry Overview:
  `Hi {{customer_name}}, thank you for your interest in the {{course_name}} program at {{business_name}}. We'd be glad to share syllabus and batch schedules.`
- **`edu_demo_class_invite`** — Complimentary Demo Session:
  `Hello {{customer_name}}, join us for an interactive demo session for {{course_name}} at {{business_name}}. Experience our faculty and teaching methodology.`
- **`edu_batch_schedule`** — Batch Schedule & Enrollment:
  `Hi {{customer_name}}, upcoming batches for {{course_name}} at {{business_name}} are filling fast. Let us know your preferred time slot.`

### 5. Salon & Beauty (`salon`)
- **`salon_service_enquiry`** — Service Enquiry & Menu:
  `Hello {{customer_name}}, thank you for contacting {{business_name}}! We would love to pamper you with our {{service_name}} service.`
- **`salon_appointment_request`** — Appointment Booking Request:
  `Hi {{customer_name}}, we'd be happy to schedule your appointment for {{service_name}} at {{business_name}}. Let us know your preferred date and time.`
- **`salon_package_details`** — Grooming Packages & Special Care:
  `Hello {{customer_name}}, explore our curated beauty and grooming packages at {{business_name}}. Ask our team about customized bundles.`

### 6. Automobile Dealerships (`automobile`)
- **`auto_model_enquiry`** — Vehicle Model Enquiry:
  `Hi {{customer_name}}, thank you for your interest in the {{model_name}} at {{business_name}}. We can share full technical specifications and trim options.`
- **`auto_test_drive_invite`** — Test Drive Booking:
  `Hello {{customer_name}}, experience the {{model_name}} firsthand with a personalized test drive at {{business_name}}. When would you like to visit?`
- **`auto_brochure_delivery`** — Vehicle Digital Brochure:
  `Hi {{customer_name}}, here is the digital brochure and spec sheet for the {{model_name}} from {{business_name}}. Let us know if you have questions.`

### 7. Other Businesses (`other`)
- **`other_enquiry_ack`** — General Enquiry Acknowledgment:
  `Hi {{customer_name}}, thank you for contacting {{business_name}} regarding {{service_name}}. We have received your message and will respond shortly.`
- **`other_business_hours`** — Operating Hours & Contact:
  `Hello {{customer_name}}, {{business_name}} is open Monday through Saturday during regular business hours.`
- **`other_general_followup`** — General Service Follow-up:
  `Hi {{customer_name}}, this is {{business_name}} following up on your recent enquiry. Please let us know if you need any additional information.`

---

## 3. Allowed Variables Reference

| Variable | Universal / Vertical | Description |
|---|---|---|
| `customer_name` | Universal | Full name of recipient contact |
| `business_name` | Universal | Display name of the business workspace |
| `city` | Universal | Primary operating city |
| `phone_number` | Universal | Contact phone number |
| `project_name` | Real Estate | Target real estate project or development |
| `membership_type`| Gym | Selected membership duration or tier |
| `program_name` | Gym | Fitness program / training regimen |
| `service_name` | Clinic / Salon / Other | Administrative service or offering |
| `branch_name` | Clinic / Salon / Gym | Operating branch location |
| `course_name` | Education | Course or curriculum title |
| `batch_time` | Education | Batch time slot |
| `model_name` | Automobile | Vehicle model or trim level |

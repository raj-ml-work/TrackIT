# Employee Form Design Proposal

## Recommendation: **3-Step Wizard Approach**

Based on the normalized employee data structure and following the existing pattern in `AssetManager.tsx`, I recommend a **3-step wizard** for creating/editing employees.

### Why Wizard Over Single Form?

**Advantages:**
1. **Better UX**: Less overwhelming, logical grouping of related fields
2. **Consistency**: Matches existing AssetManager pattern (2-step wizard)
3. **Mobile-Friendly**: Easier to navigate on smaller screens
4. **Progressive Disclosure**: Users can focus on one section at a time
5. **Better Validation**: Step-by-step validation is clearer
6. **Privacy Separation**: Natural separation between personal and official data

**Disadvantages:**
- More clicks to complete (mitigated by progress indicator)
- Slightly more complex state management (already handled in AssetManager)

---

## Proposed 3-Step Structure

### **Step 1: Basic Employee Information**
**Purpose**: Core employee identification and organizational assignment

**Fields:**
- **Employee ID** * (required, unique, uppercase, disabled on edit)
  - Format: e.g., BS0001, EMP001
  - Validation: Check uniqueness, auto-uppercase
  
- **Client** (optional dropdown)
  - Select from existing clients
  - Show: Client name (code)
  
- **Location** (optional dropdown)
  - Select from existing locations
  - Show: Location name - City
  
- **Status** * (required dropdown)
  - Options: Active, Inactive
  - Default: Active

**Visual Design:**
- Clean, focused layout
- Progress indicator: "Step 1 of 3: Basic Information"
- Icon: UserPlus or Briefcase

---

### **Step 2: Personal Information**
**Purpose**: Private/personal details (for HR records, emergency contacts)

**Fields:**

**Personal Details:**
- **First Name** * (required)
- **Last Name** (optional)
- **Gender** (optional dropdown: Male, Female, Other, Prefer not to say)
- **Mobile Number** (optional, with phone format validation)
- **Personal Email** (optional, email validation)

**Emergency Contact:**
- **Emergency Contact Name** (optional)
- **Emergency Contact Number** (optional, phone format)

**Additional:**
- **LinkedIn URL** (optional, URL validation)
- **Additional Comments** (optional, textarea)

**Visual Design:**
- Grouped sections with subtle dividers
- Progress indicator: "Step 2 of 3: Personal Information"
- Icon: User or UserCircle
- Privacy note: "This information is kept confidential"

---

### **Step 3: Official Information**
**Purpose**: Work-related and official details

**Fields:**

**Work Details:**
- **Division** (optional)
  - Could be dropdown if divisions are predefined, or free text
- **Official Email** * (required if no personal email, email validation)
  - Note: "Required if personal email not provided"
- **Start Date** (optional, date picker)
- **Official Date of Birth** (optional, date picker)
  - Note: "For official records (may differ from actual DOB)"

**Identification:**
- **Biometric ID** (optional)
- **RFID Serial** (optional)

**Agreement:**
- **Agreement Signed** (checkbox)
  - Default: unchecked
  - Label: "Employee agreement has been signed"

**Visual Design:**
- Progress indicator: "Step 3 of 3: Official Information"
- Icon: Building or FileText
- Final step - shows "Create Employee" button instead of "Next"

---

## Form State Management

### Form Data Structure
```typescript
interface EmployeeFormData {
  // Step 1: Basic Info
  employeeId: string;
  clientId?: string;
  locationId?: string;
  status: EmployeeStatus;
  
  // Step 2: Personal Info
  personalInfo: {
    firstName: string;
    lastName?: string;
    gender?: string;
    mobileNumber?: string;
    emergencyContactName?: string;
    emergencyContactNumber?: string;
    personalEmail?: string;
    linkedinUrl?: string;
    additionalComments?: string;
  };
  
  // Step 3: Official Info
  officialInfo: {
    division?: string;
    biometricId?: string;
    rfidSerial?: string;
    agreementSigned: boolean;
    startDate?: string;
    officialDob?: string;
    officialEmail?: string;
  };
}
```

### Validation Rules

**Step 1:**
- Employee ID: Required, unique, min 3 chars, max 50 chars
- Status: Required

**Step 2:**
- First Name: Required, min 2 chars
- Personal Email: Valid email format (if provided)
- Mobile Number: Valid phone format (if provided)
- LinkedIn URL: Valid URL format (if provided)
- Emergency Contact Number: Valid phone format (if provided)

**Step 3:**
- Official Email: Required if personal email not provided, valid email format
- Start Date: Valid date, not in future (if provided)
- Official DOB: Valid date (if provided)

---

## UI/UX Features

### Progress Indicator
```
[●]────[○]────[○]  Step 1 of 3: Basic Information
[●]────[●]────[○]  Step 2 of 3: Personal Information  
[●]────[●]────[●]  Step 3 of 3: Official Information
```

### Navigation
- **Back Button**: Available on steps 2 and 3
- **Cancel Button**: Available on step 1, closes modal and discards changes
- **Next Button**: Validates current step before proceeding
- **Create/Save Button**: Only on final step

### Validation Feedback
- Inline error messages below each field
- Step-level validation summary (if errors prevent proceeding)
- Success indicators for completed steps

### Responsive Design
- Mobile: Full-width, stacked fields
- Tablet: 2-column grid where appropriate
- Desktop: Optimal spacing, side-by-side where logical

---

## Edit Mode Considerations

### Pre-population
- Load existing employee data
- Pre-fill all three steps with current values
- Allow editing all fields except Employee ID (disabled)

### Step Navigation in Edit Mode
- Allow jumping to any step (all steps accessible)
- Show which steps have been completed
- Highlight any fields with validation errors

---

## Implementation Plan

### Phase 1: Basic Structure
1. Create wizard state management (currentStep, formData)
2. Implement Step 1 form with validation
3. Add navigation (Next/Back buttons)
4. Add progress indicator

### Phase 2: Personal Info
1. Implement Step 2 form
2. Add field validations (email, phone, URL)
3. Add grouping/visual hierarchy

### Phase 3: Official Info
1. Implement Step 3 form
2. Add conditional validation (official email if no personal)
3. Add final submission logic

### Phase 4: Integration
1. Connect to employeeService (create/update)
2. Handle personal_info and official_info creation/update
3. Error handling and success feedback
4. Edit mode support

---

## Alternative: Single Form with Tabs

If wizard feels too complex, alternative approach:

**Tabbed Interface:**
- Tab 1: Basic Information
- Tab 2: Personal Information  
- Tab 3: Official Information

**Pros:**
- All fields visible (can switch tabs)
- Faster for power users
- Less state management

**Cons:**
- Can still feel overwhelming
- Less guided experience
- Doesn't match existing AssetManager pattern

**Recommendation**: Stick with wizard for consistency and better UX.

---

## Field Requirements Summary

### Required Fields
- Employee ID
- First Name
- Status
- Official Email (if Personal Email not provided)

### Optional but Recommended
- Last Name
- Location
- Division
- Start Date
- Mobile Number

### Optional
- All other fields

---

## Next Steps

1. **Review this proposal** - Confirm approach and field requirements
2. **Create implementation plan** - Break down into tasks
3. **Design mockups** (optional) - Visual design for each step
4. **Implement Step 1** - Basic employee information form
5. **Implement Step 2** - Personal information form
6. **Implement Step 3** - Official information form
7. **Add validation** - Step-by-step and final validation
8. **Test** - Create, edit, validation, error handling

---

## Questions to Consider

1. **Divisions**: Are divisions predefined (dropdown) or free text?
2. **Client Assignment**: Is client assignment required or optional?
3. **Email Priority**: If both personal and official emails provided, which takes precedence for display?
4. **Agreement Workflow**: Should agreement signing trigger any workflow/notification?
5. **Biometric/RFID**: Are these required for certain employee types?
6. **Date Validation**: Any business rules for start date (e.g., not before company founding)?

---

## Conclusion

The **3-step wizard approach** provides the best balance of:
- User experience (not overwhelming)
- Data organization (logical grouping)
- Consistency (matches AssetManager pattern)
- Maintainability (clear separation of concerns)

Ready to proceed with implementation once approved!



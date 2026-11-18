# Validation functions for Insurance Policy and Claims Management System

def validate_customer_registration(data):
    required_fields = [
        "name",
        "email",
        "password",
        "phone",
        "address"
    ]

    for field in required_fields:
        if field not in data:
            return field + " is required"
        if str(data[field]).strip() == "":
            return field + " is required"

    # Email format check
    email = data["email"]
    if "@" not in email or "." not in email:
        return "Invalid email format"

    # Password length check
    if len(data["password"]) < 4:
        return "Password must be at least 4 characters"

    # Phone number check
    if len(str(data["phone"]).strip()) < 8:
        return "Valid phone number is required"

    return None


def validate_staff_creation(data):
    required_fields = [
        "name",
        "email",
        "password",
        "role",
        "phone"
    ]

    for field in required_fields:
        if field not in data:
            return field + " is required"
        if str(data[field]).strip() == "":
            return field + " is required"

    if "@" not in data["email"] or "." not in data["email"]:
        return "Invalid email format"

    # Admin can only create Agent or Officer accounts (Customers register themselves)
    allowed_staff_roles = ["Agent", "Officer"]
    if data["role"] not in allowed_staff_roles:
        return "Admin can only create Agent or Officer roles"

    return None


def validate_policy(data):
    required_fields = [
        "policy_number",
        "policy_type",
        "coverage_amount",
        "customer_id",
        "start_date",
        "end_date",
        "premium"
    ]

    for field in required_fields:
        if field not in data:
            return field + " is required"
        if str(data[field]).strip() == "":
            return field + " is required"

    try:
        premium = float(data["premium"])
        coverage = float(data["coverage_amount"])
        customer_id = int(data["customer_id"])
    except ValueError:
        return "Premium, coverage_amount must be numeric and customer_id must be integer"

    if premium <= 0 or coverage <= 0:
        return "Premium and coverage amount must be greater than zero"

    if customer_id <= 0:
        return "Valid customer_id is required"

    if data["end_date"] <= data["start_date"]:
        return "End date must be after start date"

    return None


def validate_claim(data):
    required_fields = [
        "claim_number",
        "policy_id",
        "customer_id",
        "reason",
        "amount",
        "claim_date"
    ]

    for field in required_fields:
        if field not in data:
            return field + " is required"
        if str(data[field]).strip() == "":
            return field + " is required"

    try:
        amount = float(data["amount"])
        policy_id = int(data["policy_id"])
        customer_id = int(data["customer_id"])
    except ValueError:
        return "Amount must be numeric and IDs must be integers"

    if amount <= 0:
        return "Claim amount must be greater than zero"

    if policy_id <= 0 or customer_id <= 0:
        return "Valid policy_id and customer_id are required"

    return None


def validate_review(data):
    required_fields = [
        "claim_id",
        "officer_id",
        "decision",
        "remarks"
    ]

    for field in required_fields:
        if field not in data:
            return field + " is required"
        if str(data[field]).strip() == "":
            return field + " is required"

    allowed_decisions = ["Pending", "Approved", "Rejected"]
    if data["decision"] not in allowed_decisions:
        return "Decision must be Pending, Approved, or Rejected"

    try:
        int(data["claim_id"])
        int(data["officer_id"])
    except ValueError:
        return "Claim ID and Officer ID must be integers"

    return None


def validate_document_decision(data):
    if "doc_status" not in data or str(data["doc_status"]).strip() == "":
        return "doc_status is required"

    allowed_statuses = ["Pending", "Approved", "Rejected"]
    if data["doc_status"] not in allowed_statuses:
        return "Document status must be Pending, Approved, or Rejected"

    return None
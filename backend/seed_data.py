from database import get_db
from auth_service import register_customer, create_staff_user
from policy_service import create_or_purchase_policy
from claim_service import add_claim, save_customer_document


def seed_initial_data():
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id FROM users WHERE email = %s", ("agent@insure.com",))
        if cursor.fetchone():
            print("[OK] Demo accounts and sample records already exist.")
            return

        cursor.execute("SELECT id FROM users WHERE role = 'Admin' LIMIT 1")
        admin_row = cursor.fetchone()
        admin_id = admin_row[0] if admin_row else 1

        create_staff_user(admin_id, {
            "name": "Alex Carter",
            "email": "agent@insure.com",
            "password": "123",
            "role": "Agent",
            "phone": "9876500001"
        })

        create_staff_user(admin_id, {
            "name": "Jordan Blake",
            "email": "officer@insure.com",
            "password": "123",
            "role": "Officer",
            "phone": "9876500002"
        })

        register_customer({
            "name": "Rahul Sharma",
            "email": "customer@insure.com",
            "password": "1234",
            "phone": "9876500003",
            "address": "Madhapur, Hyderabad, Telangana 500081"
        })

        cursor.execute("SELECT id FROM users WHERE email = %s", ("agent@insure.com",))
        agent_id = cursor.fetchone()[0]

        cursor.execute("SELECT id FROM users WHERE email = %s", ("customer@insure.com",))
        customer_id = cursor.fetchone()[0]

        # Seed initial policy in Indian Rupees (INR)
        create_or_purchase_policy({
            "policy_number": "POL-1001",
            "policy_type": "IMS Health Shield Plus",
            "coverage_amount": 500000,
            "customer_id": customer_id,
            "agent_id": agent_id,
            "start_date": "2026-01-01",
            "end_date": "2027-01-01",
            "premium": 8500,
            "payment_method": "UPI",
            "status": "Active"
        })

        cursor.execute("SELECT id FROM policies WHERE policy_number = %s", ("POL-1001",))
        policy_id = cursor.fetchone()[0]

        add_claim({
            "claim_number": "CLM-5001",
            "policy_id": policy_id,
            "customer_id": customer_id,
            "reason": "Hospitalization & diagnostic treatment",
            "amount": 35000,
            "claim_date": "2026-11-18"
        })

        cursor.execute("SELECT id FROM claims WHERE claim_number = %s", ("CLM-5001",))
        claim_id = cursor.fetchone()[0]

        save_customer_document(
            claim_id,
            customer_id,
            "sample_medical_bill.pdf",
            "uploads/sample_medical_bill.pdf",
            "Medical Bill"
        )

        print("[OK] Initial IMS Indian Currency demo data seeded!")

    except Exception as e:
        print("[ERROR] Seeding data failed:", e)

    finally:
        cursor.close()
        conn.close()
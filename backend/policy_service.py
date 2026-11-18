import random
from database import get_db

# Service file for Policy Purchase, Payment Integration & Tax Invoice Generation

def create_or_purchase_policy(data):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:
        # Step 1: Check duplicate policy number
        cursor.execute(
            "SELECT id FROM policies WHERE policy_number = %s",
            (data["policy_number"],)
        )
        if cursor.fetchone():
            return False, "Policy number already exists", None

        # Step 2: Fetch customer details for policy & invoice
        cursor.execute(
            "SELECT id, name, email, phone, address, role FROM users WHERE id = %s",
            (data["customer_id"],)
        )
        customer = cursor.fetchone()

        if not customer:
            return False, "Customer ID not found", None

        if customer["role"] != "Customer":
            return False, "Policies can only be assigned to Customer accounts", None

        # Step 3: Insert Policy
        agent_id = data.get("agent_id") if data.get("agent_id") else None
        status = data.get("status", "Active")

        cursor.execute("""
            INSERT INTO policies
            (policy_number, policy_type, coverage_amount, customer_id, agent_id, start_date, end_date, premium, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            data["policy_number"],
            data["policy_type"],
            data["coverage_amount"],
            data["customer_id"],
            agent_id,
            data["start_date"],
            data["end_date"],
            data["premium"],
            status
        ))

        # Step 4: Generate GST Invoice & Payment Transaction Record
        base_amount = round(float(data["premium"]), 2)
        gst_amount = round(base_amount * 0.18, 2)
        total_paid = round(base_amount + gst_amount, 2)

        invoice_number = data.get("invoice_number") or f"INV-IMS-{random.randint(100000, 999999)}"
        transaction_id = data.get("transaction_id") or f"TXN{random.randint(1000000000, 9999999999)}"
        payment_method = data.get("payment_method", "UPI / Online Payment")
        company_gstin = f"36AABCI{random.randint(1000, 9999)}M1Z{random.randint(1, 9)}"

        cursor.execute("""
            INSERT INTO payments
            (invoice_number, transaction_id, policy_number, customer_id, payment_method, base_amount, gst_amount, total_paid, company_gstin)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            invoice_number,
            transaction_id,
            data["policy_number"],
            data["customer_id"],
            payment_method,
            base_amount,
            gst_amount,
            total_paid,
            company_gstin
        ))

        # Step 5: Commit transaction
        conn.commit()

        invoice_details = {
            "invoice_number": invoice_number,
            "transaction_id": transaction_id,
            "policy_number": data["policy_number"],
            "policy_type": data["policy_type"],
            "coverage_amount": float(data["coverage_amount"]),
            "start_date": data["start_date"],
            "end_date": data["end_date"],
            "customer_name": customer["name"],
            "customer_email": customer["email"],
            "customer_phone": customer["phone"],
            "customer_address": customer["address"],
            "payment_method": payment_method,
            "base_amount": base_amount,
            "gst_amount": gst_amount,
            "total_paid": total_paid,
            "company_gstin": company_gstin
        }

        return True, "Payment successful & Official IMS Policy Invoice generated!", invoice_details

    except Exception as e:
        conn.rollback()
        print("Error in create_or_purchase_policy:", e)
        raise

    finally:
        cursor.close()
        conn.close()
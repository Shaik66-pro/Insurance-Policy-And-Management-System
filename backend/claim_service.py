from database import get_db

# Service file for Claims, Customer Documents, and Claims Officer Reviews

def add_claim(data):
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Step 1: Check duplicate claim number
        cursor.execute(
            "SELECT id FROM claims WHERE claim_number = %s",
            (data["claim_number"],)
        )
        if cursor.fetchone():
            return False, "Claim number already exists"

        # Step 2: Verify policy belongs to this customer and is Active
        cursor.execute("""
            SELECT id, status, coverage_amount
            FROM policies
            WHERE id = %s AND customer_id = %s
        """, (data["policy_id"], data["customer_id"]))
        policy = cursor.fetchone()

        if not policy:
            return False, "Policy not found for this customer"

        if policy[1] != "Active":
            return False, "Claims can only be submitted on Active policies"

        if float(data["amount"]) > float(policy[2]):
            return False, "Claim amount exceeds policy coverage limit"

        # Step 3: Insert claim with initial status 'Pending'
        cursor.execute("""
            INSERT INTO claims
            (claim_number, policy_id, customer_id, reason, amount, claim_date, status)
            VALUES (%s, %s, %s, %s, %s, %s, 'Pending')
        """, (
            data["claim_number"],
            data["policy_id"],
            data["customer_id"],
            data["reason"],
            data["amount"],
            data["claim_date"]
        ))

        # Step 4: Save data
        conn.commit()
        return True, "Claim submitted successfully (Status: Pending). Now upload supporting documents."

    except Exception as e:
        conn.rollback()
        print("Error in add_claim:", e)
        raise

    finally:
        cursor.close()
        conn.close()


def save_customer_document(claim_id, customer_id, file_name, file_path, doc_type):
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Step 1: Check if claim exists and belongs to the customer
        cursor.execute(
            "SELECT id FROM claims WHERE id = %s AND customer_id = %s",
            (claim_id, customer_id)
        )
        claim = cursor.fetchone()

        if not claim:
            return False, "Claim ID not found for this customer"

        # Step 2: Insert document record with initial status 'Pending'
        cursor.execute("""
            INSERT INTO documents (claim_id, customer_id, file_name, file_path, doc_type, doc_status)
            VALUES (%s, %s, %s, %s, %s, 'Pending')
        """, (claim_id, customer_id, file_name, file_path, doc_type))

        # Step 3: Save data
        conn.commit()
        return True, "Customer document uploaded successfully (Status: Pending)"

    except Exception as e:
        conn.rollback()
        print("Error in save_customer_document:", e)
        raise

    finally:
        cursor.close()
        conn.close()


def update_document_status(doc_id, officer_id, doc_status):
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Step 1: Verify user is Claims Officer or Admin
        cursor.execute("SELECT role FROM users WHERE id = %s", (officer_id,))
        user = cursor.fetchone()
        if not user or user[0] not in ["Officer", "Admin"]:
            return False, "Access Denied: Only Claims Officer or Admin can verify documents"

        # Step 2: Check document exists
        cursor.execute("SELECT id FROM documents WHERE id = %s", (doc_id,))
        if not cursor.fetchone():
            return False, "Document not found"

        # Step 3: Update document status (Pending, Approved, Rejected)
        cursor.execute("""
            UPDATE documents
            SET doc_status = %s
            WHERE id = %s
        """, (doc_status, doc_id))

        # Step 4: Save data
        conn.commit()
        return True, "Document decision updated to " + doc_status

    except Exception as e:
        conn.rollback()
        print("Error in update_document_status:", e)
        raise

    finally:
        cursor.close()
        conn.close()


def review_claim(data):
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Step 1: Verify user is Claims Officer or Admin
        cursor.execute("SELECT role FROM users WHERE id = %s", (data["officer_id"],))
        user = cursor.fetchone()
        if not user or user[0] not in ["Officer", "Admin"]:
            return False, "Access Denied: Only Claims Officer or Admin can review claims"

        # Step 2: Check claim exists
        cursor.execute("SELECT id FROM claims WHERE id = %s", (data["claim_id"],))
        if not cursor.fetchone():
            return False, "Claim not found"

        # Step 3: Insert or update review record
        cursor.execute("SELECT id FROM reviews WHERE claim_id = %s", (data["claim_id"],))
        existing_review = cursor.fetchone()

        if existing_review:
            cursor.execute("""
                UPDATE reviews
                SET officer_id = %s, decision = %s, remarks = %s, review_date = CURRENT_TIMESTAMP
                WHERE claim_id = %s
            """, (
                data["officer_id"],
                data["decision"],
                data["remarks"],
                data["claim_id"]
            ))
        else:
            cursor.execute("""
                INSERT INTO reviews (claim_id, officer_id, decision, remarks)
                VALUES (%s, %s, %s, %s)
            """, (
                data["claim_id"],
                data["officer_id"],
                data["decision"],
                data["remarks"]
            ))

        # Step 4: Update claim live status (Pending, Approved, or Rejected)
        cursor.execute("""
            UPDATE claims
            SET status = %s
            WHERE id = %s
        """, (data["decision"], data["claim_id"]))

        # Step 5: Save data
        conn.commit()
        return True, "Claim status updated to " + data["decision"]

    except Exception as e:
        conn.rollback()
        print("Error in review_claim:", e)
        raise

    finally:
        cursor.close()
        conn.close()